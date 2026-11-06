// Liga eventos da UI às ações do Spotify. Fluxo de cada clique:
//   1. atualiza a tela na hora (UI otimista);
//   2. manda o comando pela ponte `window.api`;
//   3. agenda um polling curto que corrige a tela se a API discordar.
import {
  applyOptimistic,
  nextRepeatMode,
  normalizeIdle,
  normalizePlayback,
  pollDelayMs,
} from '../shared/state.js';
import { backoffDelayMs } from '../shared/request-guard.js';
import { positionFromClick, startProgressLoop } from './progress.js';
import { enableWindowDrag } from './drag.js';
import * as ui from './ui.js';

const { api } = window;
const { elements } = ui;

const POLL_INTERVAL_MS = 1500;
const POST_COMMAND_POLL_MS = 800; // a API demora um instante para refletir o comando
const VOLUME_DEBOUNCE_MS = 150;
const IDLE_REFRESH_MS = 2000; // quanto tempo reaproveitar a leitura do Spotify ocioso
const START_GRACE_MS = 5000; // após dar play, ignora respostas "sem dispositivo" atrasadas

const ERROR_MESSAGES = {
  'rate-limited': 'Muitas requisições, aguardando…',
  network: 'Sem conexão',
  'no-device': 'Nenhum dispositivo ativo',
  'premium-required': 'Requer Spotify Premium',
  http: 'Erro ao falar com o Spotify',
};

let playback = null;
let likedState = { trackId: null, trackUri: null, isLiked: false };
let isPollingEnabled = false;
let isPolling = false;
let isAdjustingVolume = false;
let isLaunching = false;
let hasTriedLaunch = false; // abre o Spotify sozinho só uma vez por execução
let statusAction = 'login'; // o que o botão da tela de status faz: 'login' | 'launch' | 'resume'
let idleCache = null; // última leitura do dispositivo ocioso: { at, result }
let ignoreNoDeviceUntil = 0;
let commandVersion = 0; // muda a cada comando; descarta respostas de polling antigas
let pollFailures = 0; // falhas seguidas, para o backoff
let pollTimer = null;
let volumeTimer = null;

// ---------- Polling ----------

function schedulePoll(delayMs) {
  clearTimeout(pollTimer);
  // Janela oculta (bandeja) não consulta a API.
  if (!isPollingEnabled || document.hidden || delayMs === null) return;
  pollTimer = setTimeout(poll, delayMs);
}

async function poll() {
  if (isPolling) return;
  isPolling = true;
  const nextDelayMs = await fetchPlayback();
  isPolling = false;
  schedulePoll(nextDelayMs);
}

/** Busca e aplica o estado. Devolve em quanto tempo consultar de novo (null = parar). */
async function fetchPlayback() {
  const version = commandVersion;
  const result = await api.getPlayback();
  // Um comando saiu enquanto esperávamos: essa resposta já é velha.
  if (version !== commandVersion) return POST_COMMAND_POLL_MS;
  if (!result.ok) return handlePollError(result.error);

  pollFailures = 0;
  ui.renderBanner(null);
  const next = normalizePlayback(result.data, Date.now());
  if (next.status === 'no-device') return handleNoDevice();
  idleCache = null;
  applyPlayback(next);
  return pollDelayMs(next);
}

function handlePollError(error) {
  if (error.kind === 'unauthorized') {
    showLogin();
    return null;
  }
  ui.renderBanner(ERROR_MESSAGES[error.kind] ?? ERROR_MESSAGES.http);
  // Mantém o último estado na tela; só espera mais antes de tentar de novo.
  pollFailures += 1;
  return error.retryAfterMs || backoffDelayMs(pollFailures);
}

function applyPlayback(next) {
  const previous = playback;
  playback = next;
  if (next.status !== 'ready') {
    ui.renderStatus(next.status);
    return;
  }

  ui.renderStatus(null);
  if (previous?.track?.id !== next.track.id) {
    ui.renderTrack(next.track);
    loadLikedState(next.track);
  }
  ui.renderControls(next);
  if (!isAdjustingVolume) ui.renderVolume(next.volume);
}

// ---------- Spotify fechado ou ocioso ----------
// A API responde "sem dispositivo" tanto com o Spotify fechado quanto aberto sem nada
// tocando. Para diferenciar (e mostrar a última música), consultamos os dispositivos.

async function loadIdleSession() {
  if (idleCache && Date.now() - idleCache.at < IDLE_REFRESH_MS) return idleCache.result;
  const result = await api.getIdleSession();
  if (result.ok) idleCache = { at: Date.now(), result };
  return result;
}

/** Trata "sem dispositivo". Devolve em quanto tempo consultar de novo. */
async function handleNoDevice() {
  // Abrindo o Spotify ou acabamos de dar play: não mexe na tela.
  if (isLaunching || Date.now() < ignoreNoDeviceUntil) return POLL_INTERVAL_MS;

  const idle = await loadIdleSession();
  if (!idle.ok) return handlePollError(idle.error);
  if (!idle.data) return showSpotifyClosed();

  const idleState = normalizeIdle(idle.data, Date.now());
  applyIdle(idleState);
  return pollDelayMs(idleState);
}

/** Spotify aberto sem sessão: mostra a música que ele tem carregada, ou só o botão "Tocar". */
function applyIdle(idleState) {
  statusAction = 'resume';
  if (idleState.status === 'ready') {
    applyPlayback(idleState);
    return;
  }
  playback = idleState;
  ui.renderStatus('idle', { actionLabel: 'Tocar' });
}

function showSpotifyClosed() {
  playback = { status: 'no-device' };
  if (!hasTriedLaunch) {
    hasTriedLaunch = true;
    launchSpotifyApp();
  } else {
    statusAction = 'launch';
    ui.renderStatus('no-device', { actionLabel: 'Abrir Spotify' });
  }
  return pollDelayMs(playback);
}

/** Abre o app do Spotify e espera ele aparecer como dispositivo. */
async function launchSpotifyApp() {
  isLaunching = true;
  ui.renderStatus('waking');
  const result = await api.launchSpotify();
  isLaunching = false;

  if (!result.ok && result.error.kind === 'unauthorized') return showLogin();
  if (!result.ok) {
    statusAction = 'launch';
    ui.renderStatus('no-device', { actionLabel: 'Abrir Spotify' });
    ui.showToast('Não consegui abrir o Spotify');
  }
  idleCache = null;
  schedulePoll(0);
}

// ---------- Comandos ----------

function reportCommandError(error) {
  if (error.kind === 'unauthorized') return showLogin();
  ui.showToast(ERROR_MESSAGES[error.kind] ?? 'Não foi possível executar');
}

/** Aplica o efeito otimista (se houver), envia o comando e agenda a conferência. */
async function runCommand({ action, value, send }) {
  commandVersion += 1;
  if (action && playback?.status === 'ready') {
    playback = applyOptimistic(playback, action, value);
    ui.renderControls(playback);
  }

  const result = await send();
  if (!result.ok) reportCommandError(result.error);
  schedulePoll(POST_COMMAND_POLL_MS);
  return result;
}

/** Spotify aberto sem sessão: pede para ele retomar a sessão que tinha. */
async function resumeIdleSpotify() {
  const idleState = playback;
  ignoreNoDeviceUntil = Date.now() + START_GRACE_MS;
  if (idleState.status === 'idle') ui.renderStatus('resuming');
  const result = await runCommand({
    action: idleState.status === 'ready' ? 'togglePlay' : undefined,
    send: () => api.resumeOnDevice(idleState.deviceId),
  });
  if (result.ok) return;

  // Falhou: libera a próxima leitura para a tela voltar ao estado real.
  ignoreNoDeviceUntil = 0;
  idleCache = null;
}

function togglePlay() {
  if (playback.isIdle) {
    resumeIdleSpotify();
    return;
  }
  const shouldPlay = !playback.isPlaying;
  runCommand({
    action: 'togglePlay',
    send: () => (shouldPlay ? api.play() : api.pause()),
  });
}

function toggleShuffle() {
  const shouldShuffle = !playback.isShuffled;
  runCommand({ action: 'toggleShuffle', send: () => api.setShuffle(shouldShuffle) });
}

function cycleRepeat() {
  const mode = nextRepeatMode(playback.repeatMode);
  runCommand({ action: 'cycleRepeat', send: () => api.setRepeat(mode) });
}

function seekToClick(event) {
  const rect = elements.progressBar.getBoundingClientRect();
  const positionMs = positionFromClick(event.clientX, rect, playback.track.durationMs);
  runCommand({ action: 'seek', value: positionMs, send: () => api.seek(positionMs) });
}

function changeVolume() {
  const percent = Number(elements.volume.value);
  ui.renderVolume(percent);
  clearTimeout(volumeTimer);
  // Espera o usuário parar de arrastar para não estourar o limite da API.
  volumeTimer = setTimeout(() => {
    runCommand({
      action: 'setVolume',
      value: percent,
      send: () => api.setVolume(percent),
    });
  }, VOLUME_DEBOUNCE_MS);
}

// ---------- Curtir e copiar link ----------

async function loadLikedState(track) {
  likedState = { trackId: track.id, trackUri: track.uri, isLiked: false };
  ui.renderLiked({ isLiked: false, isLikeable: track.isLikeable });
  if (!track.isLikeable) return;

  const result = await api.isTrackLiked(track.uri);
  if (!result.ok || likedState.trackId !== track.id) return;
  likedState.isLiked = result.data;
  ui.renderLiked({ isLiked: result.data, isLikeable: true });
}

async function toggleLiked() {
  const { trackId, trackUri, isLiked } = likedState;
  ui.renderLiked({ isLiked: !isLiked, isLikeable: true });
  likedState.isLiked = !isLiked;

  const result = await api.setTrackLiked(trackUri, !isLiked);
  if (result.ok || likedState.trackId !== trackId) return;
  likedState.isLiked = isLiked; // a API recusou: desfaz
  ui.renderLiked({ isLiked, isLikeable: true });
  reportCommandError(result.error);
}

async function copyTrackLink() {
  try {
    await navigator.clipboard.writeText(playback.track.shareUrl);
    ui.showToast('Link copiado');
  } catch (error) {
    console.error('Falha ao copiar o link:', error.message);
    ui.showToast('Não foi possível copiar');
  }
}

// ---------- Login e inicialização ----------

// O que o botão da tela de status faz, conforme `statusAction`.
const STATUS_ACTIONS = { login, launch: launchSpotifyApp, resume: resumeIdleSpotify };

function showLogin() {
  isPollingEnabled = false;
  clearTimeout(pollTimer);
  statusAction = 'login';
  ui.renderStatus('login-required', { actionLabel: 'Entrar com Spotify' });
}

function startPolling() {
  isPollingEnabled = true;
  ui.renderStatus('loading');
  poll();
}

async function login() {
  ui.renderStatus('logging-in');
  const result = await api.login();
  if (result.ok) return startPolling();
  showLogin();
  ui.showToast('Login não concluído');
}

async function changeWindowMode(mode) {
  ui.renderMode(await api.setWindowMode(mode));
}

function bindEvents() {
  elements.playButton.addEventListener('click', togglePlay);
  elements.tagPlayButton.addEventListener('click', togglePlay);
  elements.tagPreviousButton.addEventListener('click', () =>
    runCommand({ send: () => api.previous() })
  );
  elements.tagNextButton.addEventListener('click', () =>
    runCommand({ send: () => api.next() })
  );
  elements.tagModeButton.addEventListener('click', () => changeWindowMode('tag'));
  elements.shuffleButton.addEventListener('click', toggleShuffle);
  elements.repeatButton.addEventListener('click', cycleRepeat);
  elements.previousButton.addEventListener('click', () =>
    runCommand({ send: () => api.previous() })
  );
  elements.nextButton.addEventListener('click', () =>
    runCommand({ send: () => api.next() })
  );
  elements.progressBar.addEventListener('click', seekToClick);
  elements.volume.addEventListener('input', changeVolume);
  elements.volume.addEventListener('pointerdown', () => (isAdjustingVolume = true));
  window.addEventListener('pointerup', () => (isAdjustingVolume = false));
  elements.likeButton.addEventListener('click', toggleLiked);
  elements.copyButton.addEventListener('click', copyTrackLink);
  elements.closeButton.addEventListener('click', () => api.quitApp());
  elements.statusAction.addEventListener('click', () => STATUS_ACTIONS[statusAction]());
  window.addEventListener('resize', ui.updateTagScroll);
  document.addEventListener('visibilitychange', () =>
    document.hidden ? clearTimeout(pollTimer) : poll()
  );
}

/** Janela nova (troca de modo): mostra já a última música lida, em vez de "Carregando…". */
async function showLastPlayback() {
  const { data } = await api.getLastPlayback();
  if (data) applyPlayback(normalizePlayback(data.playback, data.at));
}

async function init() {
  bindEvents();
  // Na tag, clicar em qualquer área livre (sem arrastar) abre a janela normal.
  enableWindowDrag(elements.player, api, {
    onTap: () => {
      if (elements.player.dataset.mode === 'tag') changeWindowMode('normal');
    },
  });
  // O main abre uma janela por modo e diz qual na URL, assim a tela já nasce no modo certo.
  ui.renderMode(new URLSearchParams(location.search).get('mode') ?? 'normal');
  ui.renderMode(await api.getWindowMode());
  await showLastPlayback();
  startProgressLoop({
    getState: () => playback,
    onFrame: (progressMs) => ui.renderProgress(progressMs, playback.track.durationMs),
  });

  const authStatus = await api.getAuthStatus();
  if (!authStatus.hasClientId) return ui.renderStatus('missing-config');
  if (!authStatus.isLoggedIn) return showLogin();
  startPolling();
}

init();
