// Controle local do Spotify no macOS, via AppleScript: sem login, sem Web API e sem
// limite de requisições. Devolve o estado no mesmo formato da Web API, para o resto
// do app (state.js e a UI) não precisar saber de onde veio.
import { execFile as nodeExecFile } from 'node:child_process';

const SCRIPT_TIMEOUT_MS = 5000;
const LAUNCH_TIMEOUT_MS = 25_000;
const LAUNCH_POLL_MS = 1000;
const FIELD_SEPARATOR = String.fromCharCode(31);
const MS_PER_SECOND = 1000;

// Nunca deixa o AppleScript abrir o Spotify sozinho: "tell application" abre o app.
const ONLY_IF_RUNNING = 'if application "Spotify" is not running then return';

const READ_SCRIPT = `
if application "Spotify" is not running then return "closed"
tell application "Spotify"
  set sep to character id 31
  set info to (player state as text) & sep & (player position as text) & sep & (sound volume as text) & sep & (shuffling as text) & sep & (repeating as text)
  try
    set t to current track
    set info to info & sep & (id of t) & sep & (name of t) & sep & (artist of t) & sep & (album of t) & sep & ((duration of t) as text) & sep & (artwork url of t)
  end try
  return info
end tell`;

function spotifyError(message) {
  return Object.assign(new Error(message), { kind: 'http' });
}

/** "12,5" (macOS em português) e "12.5" viram 12.5. */
function toNumber(text) {
  return Number(String(text).replace(',', '.')) || 0;
}

function buildItem([uri, name, artist, album, duration, artwork]) {
  const [, type = 'track', id = ''] = uri.split(':');
  return {
    id,
    uri,
    type,
    name,
    artists: [{ name: artist }],
    album: { name: album, images: artwork ? [{ url: artwork }] : [] },
    duration_ms: toNumber(duration),
    is_local: type === 'local',
    external_urls:
      type === 'track' ? { spotify: `https://open.spotify.com/track/${id}` } : {},
  };
}

/** Interpreta a saída do script de leitura. Devolve null se o Spotify está fechado. */
export function parseLocalPlayback(stdout) {
  const parts = stdout.trim().split(FIELD_SEPARATOR);
  if (parts.length < 5) return null;

  const [state, position, volume, shuffling, repeating, ...track] = parts;
  const playback = {
    is_playing: state === 'playing',
    progress_ms: Math.round(toNumber(position) * MS_PER_SECOND),
    shuffle_state: shuffling === 'true',
    repeat_state: repeating === 'true' ? 'context' : 'off',
    device: { volume_percent: toNumber(volume), supports_volume: true },
  };
  if (track.length >= 6 && track[0]) playback.item = buildItem(track);
  return playback;
}

const COMMAND_BODIES = {
  play: () => 'play',
  pause: () => 'pause',
  next: () => 'next track',
  previous: () => 'previous track',
  seek: ({ positionMs }) => `set player position to ${positionMs / MS_PER_SECOND}`,
  setVolume: ({ percent }) => `set sound volume to ${Math.round(percent)}`,
  setShuffle: ({ isShuffled }) => `set shuffling to ${Boolean(isShuffled)}`,
  setRepeat: ({ mode }) => `set repeating to ${mode !== 'off'}`,
};
// Sem dispositivos no modo local: "retomar no computador" é só dar play.
COMMAND_BODIES.transferPlayback = COMMAND_BODIES.play;

export function buildCommandScript(name, payload = {}) {
  const body = COMMAND_BODIES[name];
  if (!body) return null;
  return `${ONLY_IF_RUNNING}\ntell application "Spotify" to ${body(payload)}`;
}

function sleepFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createLocalSpotify({
  execFile = nodeExecFile,
  sleep = sleepFor,
  launchTimeoutMs = LAUNCH_TIMEOUT_MS,
} = {}) {
  function run(command, args) {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        { timeout: SCRIPT_TIMEOUT_MS, encoding: 'utf-8' },
        (error, stdout) => (error ? reject(spotifyError(error.message)) : resolve(stdout))
      );
    });
  }

  const runScript = (script) => run('osascript', ['-e', script]);

  async function getPlayback() {
    return parseLocalPlayback(await runScript(READ_SCRIPT));
  }

  async function launch() {
    await run('open', ['-a', 'Spotify']);
    for (let waited = 0; waited < launchTimeoutMs; waited += LAUNCH_POLL_MS) {
      if (await getPlayback()) return;
      await sleep(LAUNCH_POLL_MS);
    }
    throw new Error('wake_timeout');
  }

  async function call(name, payload) {
    if (name === 'getPlayback') return getPlayback();
    // Curtir depende da conta (Web API): fica desligado no modo local.
    if (name === 'isTrackLiked') return false;
    if (name === 'setTrackLiked') throw spotifyError('like_unavailable');

    const script = buildCommandScript(name, payload);
    if (!script) throw spotifyError('unknown_command');
    await runScript(script);
    return null;
  }

  return { call, getPlayback, launch };
}
