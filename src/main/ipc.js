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
import { describeDevices, describeIdle, describePlayback } from './debug-describe.js';
import { createIdleResolver } from './idle.js';
import { createHybridSpotify } from './hybrid-spotify.js';
import { createLocalSpotify } from './local-spotify.js';
import { controlSpotifyMedia, readSpotifyMediaSession } from './media-session.js';
import { launchSpotify } from './wake.js';

// Protocolo registrado pelo app do Spotify no Windows.
const SPOTIFY_APP_URI = 'spotify:';

// Nome do comando (usado pelo renderer) -> função da Web API.
const COMMANDS = {
  getPlayback: spotify.getPlayback,
  play: spotify.play,
  transferPlayback: spotify.transferPlayback,
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

function createLocalIfMac() {
  return IS_LOCAL_MODE ? createLocalSpotify() : null;
}

function toErrorResult(error) {
  const kind = error.kind ?? 'network';
  return {
    ok: false,
    error: { kind, retryAfterMs: error.retryAfterMs ?? 0, message: error.message },
  };
}

// macOS: controla o Spotify localmente, sem login nem Web API.
// Windows: híbrido, com o estado vindo do sistema e a Web API só para o que ele não dá.
// Outros sistemas: só Web API.
const IS_LOCAL_MODE = process.platform === 'darwin';
const IS_HYBRID_MODE = process.platform === 'win32';

export function registerIpc({ tokens, clientId, debugLog, local = createLocalIfMac() }) {
  // Último estado lido: a janela nova (troca de modo) já nasce com a música na tela.
  let lastPlayback = null;

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

  async function listDevices() {
    const devices = await callOrThrow(spotify.getDevices);
    debugLog.writeIfChanged('dispositivos', describeDevices(devices));
    return devices;
  }

  /** Executa o comando e registra no log o que importa (só mudanças e erros). */
  function remember(playback) {
    if (playback) lastPlayback = { at: Date.now(), playback };
  }

  async function callAndLog(name, command, payload) {
    const result = await callWithToken(command, payload);
    if (!result.ok) {
      debugLog.writeIfChanged(
        `erro:${name}`,
        `${result.error.kind} ${result.error.message}`
      );
    } else if (name === 'getPlayback') {
      debugLog.writeIfChanged('player', describePlayback(result.data));
      remember(result.data);
    } else {
      debugLog.write(`[comando] ${name} ok`);
    }
    return result;
  }

  async function callProvider(provider, name, payload) {
    try {
      const data = await provider.call(name, payload);
      if (name === 'getPlayback') {
        debugLog.writeIfChanged('player', describePlayback(data));
        remember(data);
      } else if (name !== 'isTrackLiked') {
        debugLog.write(`[comando] ${name} ok`);
      }
      return { ok: true, data };
    } catch (error) {
      debugLog.writeIfChanged(`erro:${name}`, `${error.kind ?? ''} ${error.message}`);
      return toErrorResult(error);
    }
  }

  // Windows: o híbrido pede à API só o que precisa, pelo mesmo caminho dos comandos normais.
  const hybrid = IS_HYBRID_MODE
    ? createHybridSpotify({
        api: {
          call: (name, payload) => {
            if (!COMMANDS[name])
              throw Object.assign(new Error('unknown_command'), { kind: 'http' });
            return callOrThrow(COMMANDS[name], payload);
          },
        },
        readMedia: readSpotifyMediaSession,
        controlMedia: controlSpotifyMedia,
      })
    : null;

  async function login() {
    const { verifier, challenge } = generatePkcePair();
    const state = generateState();
    // O servidor precisa estar ouvindo antes de abrir o navegador.
    const codePromise = waitForAuthCode({ expectedState: state });
    await shell.openExternal(buildAuthorizeUrl({ clientId, challenge, state }));

    const code = await codePromise;
    tokens.saveTokens(await exchangeCodeForTokens({ clientId, code, verifier }));
  }

  ipcMain.handle('auth:status', () =>
    local
      ? { hasClientId: true, isLoggedIn: true }
      : { hasClientId: Boolean(clientId), isLoggedIn: tokens.isLoggedIn() }
  );

  ipcMain.handle('auth:login', async () => {
    try {
      await login();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: { kind: 'login-failed', message: error.message } };
    }
  });

  ipcMain.handle('spotify:last-playback', () => ({ ok: true, data: lastPlayback }));

  ipcMain.handle('auth:logout', () => tokens.clearTokens());

  ipcMain.handle('spotify:launch', async () => {
    try {
      if (local) {
        debugLog.write('[launch] abrindo o Spotify (modo local)');
        await local.launch();
        return { ok: true };
      }
      await launchSpotify({
        getDevices: listDevices,
        launch: () => {
          debugLog.write('[launch] abrindo o Spotify pelo protocolo spotify:');
          return shell.openExternal(SPOTIFY_APP_URI);
        },
      });
      debugLog.write('[launch] computador apareceu na lista de dispositivos');
      return { ok: true };
    } catch (error) {
      debugLog.write(`[launch] falhou: ${error.kind ?? ''} ${error.message}`);
      return toErrorResult(error);
    }
  });

  const resolveIdle = createIdleResolver({
    getDevices: listDevices,
    readMedia: readSpotifyMediaSession,
    searchTracks: (query) => callOrThrow(spotify.searchTracks, query),
  });

  ipcMain.handle('spotify:idle', async () => {
    // Modo local: o Spotify fechado já aparece como "sem dispositivo"; não há o que resolver.
    if (local) return { ok: true, data: null };
    try {
      const idle = await resolveIdle();
      debugLog.writeIfChanged('ocioso', describeIdle(idle));
      return { ok: true, data: idle };
    } catch (error) {
      debugLog.write(`[idle] falhou: ${error.kind ?? ''} ${error.message}`);
      return toErrorResult(error);
    }
  });

  ipcMain.handle('spotify:call', (_event, name, payload = {}) => {
    const command = COMMANDS[name];
    const provider = local ?? hybrid;
    if (provider) return callProvider(provider, name, payload);
    if (!command)
      return { ok: false, error: { kind: 'http', message: `unknown_command` } };
    return callAndLog(name, command, payload);
  });
}
