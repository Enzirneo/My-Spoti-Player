// Chamadas à Web API do Spotify. Sem Electron e sem DOM: o token e o fetch
// são injetados, o que deixa tudo testável com mocks.

import { createRequestGuard } from './request-guard.js';

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MS_PER_SECOND = 1000;
// Sem Retry-After, insistir logo só prolonga o bloqueio do Spotify.
const DEFAULT_RETRY_AFTER_SECONDS = 30;
const MAX_VOLUME = 100;

// Freio único do app: todo pedido passa por ele, então um 429 para tudo, não só o polling.
export const requestGuard = createRequestGuard();

/** Erro com `kind` estável para a UI decidir o que mostrar. */
export class SpotifyError extends Error {
  constructor(kind, { status = 0, retryAfterMs = 0, message = kind } = {}) {
    super(message);
    this.name = 'SpotifyError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

async function readErrorReason(response) {
  try {
    const body = await response.json();
    return body?.error?.reason ?? '';
  } catch {
    // Corpo vazio ou não-JSON: o status já basta para classificar.
    return '';
  }
}

async function toSpotifyError(response, guard) {
  const { status } = response;
  if (status === 401) return new SpotifyError('unauthorized', { status });
  if (status === 429) {
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || DEFAULT_RETRY_AFTER_SECONDS;
    const retryAfterMs = retryAfterSeconds * MS_PER_SECOND;
    guard.block(retryAfterMs);
    return new SpotifyError('rate-limited', { status, retryAfterMs });
  }

  const reason = await readErrorReason(response);
  if (reason === 'NO_ACTIVE_DEVICE') return new SpotifyError('no-device', { status });
  if (reason === 'PREMIUM_REQUIRED')
    return new SpotifyError('premium-required', { status });
  return new SpotifyError('http', { status, message: `HTTP ${status}` });
}

async function request({
  token,
  fetch = globalThis.fetch,
  guard = requestGuard,
  method = 'GET',
  path,
  body,
}) {
  const waitMs = guard.acquire();
  if (waitMs > 0) {
    throw new SpotifyError('rate-limited', { retryAfterMs: waitMs, message: 'throttled' });
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
      method,
      headers,
      body: body && JSON.stringify(body),
    });
  } catch (cause) {
    throw new SpotifyError('network', { message: cause.message });
  }
  if (!response.ok) throw await toSpotifyError(response, guard);
  return response;
}

export async function getPlayback(options) {
  const response = await request({ ...options, path: '/me/player' });
  // 204 = nenhum dispositivo ativo.
  return response.status === 204 ? null : response.json();
}

export const play = (options) =>
  request({ ...options, method: 'PUT', path: '/me/player/play' });
export const pause = (options) =>
  request({ ...options, method: 'PUT', path: '/me/player/pause' });
export const nextTrack = (options) =>
  request({ ...options, method: 'POST', path: '/me/player/next' });
export const previousTrack = (options) =>
  request({ ...options, method: 'POST', path: '/me/player/previous' });

export const seek = ({ positionMs, ...options }) =>
  request({
    ...options,
    method: 'PUT',
    path: `/me/player/seek?position_ms=${Math.round(positionMs)}`,
  });

export const setVolume = ({ percent, ...options }) => {
  const clamped = Math.min(MAX_VOLUME, Math.max(0, Math.round(percent)));
  return request({
    ...options,
    method: 'PUT',
    path: `/me/player/volume?volume_percent=${clamped}`,
  });
};

export const setShuffle = ({ isShuffled, ...options }) =>
  request({ ...options, method: 'PUT', path: `/me/player/shuffle?state=${isShuffled}` });

export const setRepeat = ({ mode, ...options }) =>
  request({ ...options, method: 'PUT', path: `/me/player/repeat?state=${mode}` });

// Biblioteca do usuário (substitui os endpoints antigos /me/tracks, hoje obsoletos).
const libraryQuery = (trackUri) => `uris=${encodeURIComponent(trackUri)}`;

export async function isTrackLiked({ trackUri, ...options }) {
  const response = await request({
    ...options,
    path: `/me/library/contains?${libraryQuery(trackUri)}`,
  });
  const [isLiked] = await response.json();
  return Boolean(isLiked);
}

export const setTrackLiked = ({ trackUri, isLiked, ...options }) =>
  request({
    ...options,
    method: isLiked ? 'PUT' : 'DELETE',
    path: `/me/library?${libraryQuery(trackUri)}`,
  });

export async function getDevices(options) {
  const response = await request({ ...options, path: '/me/player/devices' });
  return (await response.json()).devices ?? [];
}

/** Busca faixas pelo título e artista (usado para completar a música lida do Windows). */
export async function searchTracks({ title, artist, ...options }) {
  const query = encodeURIComponent(`track:${title} artist:${artist}`);
  const response = await request({
    ...options,
    path: `/search?type=track&limit=5&q=${query}`,
  });
  return (await response.json()).tracks?.items ?? [];
}

/**
 * Move a reprodução para um dispositivo. Com shouldPlay=true, retoma a sessão que o
 * próprio Spotify tinha carregada (funciona mesmo quando o dispositivo está inativo).
 */
export const transferPlayback = ({ deviceId, shouldPlay = false, ...options }) =>
  request({
    ...options,
    method: 'PUT',
    path: '/me/player',
    body: { device_ids: [deviceId], play: shouldPlay },
  });
