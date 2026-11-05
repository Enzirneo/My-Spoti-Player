// Liga eventos da UI às ações do Spotify. Fluxo de cada clique:
//   1. atualiza a tela na hora (UI otimista);
//   2. manda o comando pela ponte `window.api`;
//   3. agenda um polling curto que corrige a tela se a API discordar.
import { applyOptimistic, nextRepeatMode, normalizePlayback } from '../shared/state.js';
import { positionFromClick, startProgressLoop } from './progress.js';
import * as ui from './ui.js';

const { api } = window;
const { elements } = ui;

const POLL_INTERVAL_MS = 1500;
const POST_COMMAND_POLL_MS = 800; // a API demora um instante para refletir o comando
const ERROR_BACKOFF_FACTOR = 2;
const VOLUME_DEBOUNCE_MS = 150;

const ERROR_MESSAGES = {
  'rate-limited': 'Muitas requisições, aguardando…',
  network: 'Sem conexão',
  'no-device': 'Nenhum dispositivo ativo',
  'premium-required': 'Requer Spotify Premium',
  http: 'Erro ao falar com o Spotify',
};

let playback = null;
let likedState = { trackId: null, isLiked: false };
let isPollingEnabled = false;
let isPolling = false;
let isAdjustingVolume = false;
let commandVersion = 0; // muda a cada comando; descarta respostas de polling antigas
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

  ui.renderBanner(null);
  applyPlayback(normalizePlayback(result.data, Date.now()));
  return POLL_INTERVAL_MS;
}

function handlePollError(error) {
  if (error.kind === 'unauthorized') {
    showLogin();
    return null;
  }
  ui.renderBanner(ERROR_MESSAGES[error.kind] ?? ERROR_MESSAGES.http);
  // Mantém o último estado na tela; só espera mais antes de tentar de novo.
  return error.retryAfterMs || POLL_INTERVAL_MS * ERROR_BACKOFF_FACTOR;
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
}

function togglePlay() {
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
  likedState = { trackId: track.id, isLiked: false };
  ui.renderLiked({ isLiked: false, isLikeable: track.isLikeable });
  if (!track.isLikeable) return;

  const result = await api.isTrackLiked(track.id);
  if (!result.ok || likedState.trackId !== track.id) return;
  likedState.isLiked = result.data;
  ui.renderLiked({ isLiked: result.data, isLikeable: true });
}

async function toggleLiked() {
  const { trackId, isLiked } = likedState;
  ui.renderLiked({ isLiked: !isLiked, isLikeable: true });
  likedState.isLiked = !isLiked;

  const result = await api.setTrackLiked(trackId, !isLiked);
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

function showLogin() {
  isPollingEnabled = false;
  clearTimeout(pollTimer);
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

function bindEvents() {
  elements.playButton.addEventListener('click', togglePlay);
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
  elements.closeButton.addEventListener('click', () => api.hideWindow());
  elements.statusAction.addEventListener('click', login);
  document.addEventListener('visibilitychange', () =>
    document.hidden ? clearTimeout(pollTimer) : poll()
  );
}

async function init() {
  bindEvents();
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
