// Ponte entre o renderer e o main: login, logout e comandos da Web API.
// Toda resposta volta como { ok: true, data } ou { ok: false, error } para
// atravessar o IPC sem perder o tipo do erro.
import { ipcMain, shell } from 'electron';
import * as spotify from '../shared/spotify.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  generateState,
} from './auth.js';
import { waitForAuthCode } from './callback-server.js';
import { findIdleSession } from './idle.js';
import { launchSpotify } from './wake.js';

// Protocolo registrado pelo app do Spotify no Windows.
const SPOTIFY_APP_URI = 'spotify:';

// Nome do comando (usado pelo renderer) -> função da Web API.
const COMMANDS = {
  getPlayback: spotify.getPlayback,
  play: spotify.play,
  playOnDevice: spotify.playOnDevice,
  pause: spotify.pause,
  next: spotify.nextTrack,
  previous: spotify.previousTrack,
  seek: spotify.seek,
  setVolume: spotify.setVolume,
  setShuffle: spotify.setShuffle,
  setRepeat: spotify.setRepeat,
  isTrackLiked: spotify.isTrackLiked,
  setTrackLiked: spotify.setTrackLiked,
};

function toErrorResult(error) {
  const kind = error.kind ?? 'network';
  return {
    ok: false,
    error: { kind, retryAfterMs: error.retryAfterMs ?? 0, message: error.message },
  };
}

export function registerIpc({ tokens, clientId }) {
  async function callWithToken(command, payload, { forceRefresh = false } = {}) {
    const token = await tokens.getAccessToken({ forceRefresh });
    if (!token)
      return { ok: false, error: { kind: 'unauthorized', message: 'login_required' } };

    try {
      return { ok: true, data: await command({ ...payload, token }) };
    } catch (error) {
      // 401 com token que parecia válido: renova uma vez e tenta de novo.
      if (error.kind === 'unauthorized' && !forceRefresh) {
        return callWithToken(command, payload, { forceRefresh: true });
      }
      return toErrorResult(error);
    }
  }

  /** Como callWithToken, mas lança em caso de erro (para uso em fluxos com várias chamadas). */
  async function callOrThrow(command, payload) {
    const result = await callWithToken(command, payload);
    if (result.ok) return result.data;
    throw Object.assign(new Error(result.error.message), result.error);
  }

  async function login() {
    const { verifier, challenge } = generatePkcePair();
    const state = generateState();
    // O servidor precisa estar ouvindo antes de abrir o navegador.
    const codePromise = waitForAuthCode({ expectedState: state });
    await shell.openExternal(buildAuthorizeUrl({ clientId, challenge, state }));

    const code = await codePromise;
    tokens.saveTokens(await exchangeCodeForTokens({ clientId, code, verifier }));
  }

  ipcMain.handle('auth:status', () => ({
    hasClientId: Boolean(clientId),
    isLoggedIn: tokens.isLoggedIn(),
  }));

  ipcMain.handle('auth:login', async () => {
    try {
      await login();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: { kind: 'login-failed', message: error.message } };
    }
  });

  ipcMain.handle('auth:logout', () => tokens.clearTokens());

  ipcMain.handle('spotify:launch', async () => {
    try {
      await launchSpotify({
        getDevices: () => callOrThrow(spotify.getDevices),
        launch: () => shell.openExternal(SPOTIFY_APP_URI),
      });
      return { ok: true };
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('spotify:idle', async () => {
    try {
      const session = await findIdleSession({
        getDevices: () => callOrThrow(spotify.getDevices),
        getRecentlyPlayed: () => callOrThrow(spotify.getRecentlyPlayed),
      });
      return { ok: true, data: session };
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('spotify:call', (_event, name, payload = {}) => {
    const command = COMMANDS[name];
    if (!command)
      return { ok: false, error: { kind: 'http', message: `unknown_command` } };
    return callWithToken(command, payload);
  });
}
