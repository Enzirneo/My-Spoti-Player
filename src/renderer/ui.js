// Funções que atualizam o DOM. Nenhuma regra de negócio aqui: recebem dados
// já prontos e só refletem na tela. Estilo fica no CSS (aqui só troca classes).
import { msToClock } from '../shared/format.js';
import { progressRatio } from './progress.js';

const TOAST_DURATION_MS = 2200;

const STATUS_MESSAGES = {
  'missing-config': 'Preencha o "clientId" no config.json e reinicie o app.',
  'login-required': 'Conecte sua conta do Spotify para controlar a reprodução.',
  'logging-in': 'Conclua o login no navegador…',
  loading: 'Carregando…',
  'no-device': 'O Spotify não está aberto neste computador.',
  waking: 'Abrindo o Spotify…',
  idle: 'Spotify aberto, nada tocando.',
  resuming: 'Retomando a música…',
  empty: 'Nada tocando no momento.',
};

const $ = (id) => document.getElementById(id);

export const elements = {
  player: $('player'),
  covers: [$('cover-a'), $('cover-b')],
  info: $('info'),
  title: $('title'),
  artist: $('artist'),
  album: $('album'),
  playButton: $('play-btn'),
  shuffleButton: $('shuffle-btn'),
  repeatButton: $('repeat-btn'),
  previousButton: $('previous-btn'),
  nextButton: $('next-btn'),
  closeButton: $('close-btn'),
  hideButton: $('hide-btn'),
  likeButton: $('like-btn'),
  copyButton: $('copy-btn'),
  volume: $('volume'),
  progressBar: $('progress-bar'),
  progressFill: $('progress-fill'),
  timeCurrent: $('time-current'),
  timeTotal: $('time-total'),
  status: $('status'),
  statusText: $('status-text'),
  statusAction: $('status-action'),
  banner: $('banner'),
  toast: $('toast'),
};

let visibleCoverIndex = -1;
let toastTimer = null;

/** Mostra a capa nova por cima da antiga (o crossfade é feito pelo CSS). */
function showCover(url) {
  const nextIndex = (visibleCoverIndex + 1) % elements.covers.length;
  const nextCover = elements.covers[nextIndex];
  const preloader = new Image();
  preloader.onload = () => {
    nextCover.src = url;
    elements.covers[visibleCoverIndex]?.classList.remove('is-visible');
    nextCover.classList.add('is-visible');
    visibleCoverIndex = nextIndex;
  };
  preloader.src = url;
}

function replayChangeAnimation() {
  elements.info.classList.remove('is-changing');
  void elements.info.offsetWidth; // força reflow para a animação reiniciar
  elements.info.classList.add('is-changing');
}

export function renderTrack(track) {
  elements.title.textContent = track.name;
  elements.artist.textContent = track.artists;
  elements.album.textContent = track.album;
  elements.timeTotal.textContent = msToClock(track.durationMs);
  if (track.coverUrl) showCover(track.coverUrl);
  replayChangeAnimation();
}

export function renderControls(state) {
  elements.player.classList.toggle('is-idle', Boolean(state.isIdle));
  elements.playButton.classList.toggle('is-playing', state.isPlaying);
  elements.shuffleButton.classList.toggle('is-active', state.isShuffled);
  elements.repeatButton.dataset.repeat = state.repeatMode;
  elements.volume.disabled = !state.canSetVolume;
}

export function renderVolume(volume) {
  elements.volume.value = volume;
}

export function renderProgress(progressMs, durationMs) {
  elements.timeCurrent.textContent = msToClock(progressMs);
  elements.progressFill.style.setProperty(
    '--progress',
    progressRatio(progressMs, durationMs)
  );
}

export function renderLiked({ isLiked, isLikeable }) {
  elements.likeButton.classList.toggle('is-liked', isLiked);
  elements.likeButton.disabled = !isLikeable;
}

/** Mostra a tela de status (login, nada tocando...) ou, com null, o player. */
export function renderStatus(kind, { actionLabel } = {}) {
  const message = STATUS_MESSAGES[kind];
  elements.status.hidden = !message;
  elements.player.classList.toggle('is-disabled', Boolean(message));
  if (!message) return;

  elements.statusText.textContent = message;
  elements.statusAction.hidden = !actionLabel;
  elements.statusAction.textContent = actionLabel ?? '';
}

/** Aviso discreto no topo que não esconde o último estado conhecido. */
export function renderBanner(text) {
  elements.banner.hidden = !text;
  elements.banner.textContent = text ?? '';
}

export function showToast(text) {
  elements.toast.textContent = text;
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => elements.toast.classList.remove('is-visible'),
    TOAST_DURATION_MS
  );
}
