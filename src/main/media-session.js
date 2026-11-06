// Lê, localmente e na hora, o que o app do Spotify tem carregado (via sessão de mídia
// do Windows). É a única forma de saber a música quando a Web API não tem sessão ativa.
import { execFile as nodeExecFile } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT_PATH = join(import.meta.dirname, 'media-session.ps1');
const SCRIPT_TIMEOUT_MS = 8000;

/** Interpreta o JSON do script. Devolve null se não há sessão ou a saída é inválida. */
export function parseMediaSession(stdout) {
  try {
    const session = JSON.parse(stdout.trim());
    return session?.title ? session : null;
  } catch {
    return null;
  }
}

function runScript({ execFile, scriptPath, scriptArgs = [] }) {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...scriptArgs,
  ];
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      args,
      { timeout: SCRIPT_TIMEOUT_MS, windowsHide: true, encoding: 'utf-8' },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    );
  });
}

export async function readSpotifyMediaSession({
  execFile = nodeExecFile,
  scriptPath = SCRIPT_PATH,
} = {}) {
  try {
    return parseMediaSession(await runScript({ execFile, scriptPath }));
  } catch {
    // Qualquer falha vira "sem sessão": o app continua funcionando só com a API.
    return null;
  }
}

/** Manda play, pause, next, previous ou seek ao Spotify pelo Windows. Lança se ele recusar. */
export async function controlSpotifyMedia(
  action,
  { positionMs = 0 } = {},
  { execFile = nodeExecFile, scriptPath = SCRIPT_PATH } = {}
) {
  const scriptArgs = ['-Action', action];
  if (action === 'seek') scriptArgs.push('-PositionMs', String(Math.round(positionMs)));
  await runScript({ execFile, scriptPath, scriptArgs });
}
