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

export function readSpotifyMediaSession({
  execFile = nodeExecFile,
  scriptPath = SCRIPT_PATH,
} = {}) {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ];
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      args,
      { timeout: SCRIPT_TIMEOUT_MS, windowsHide: true, encoding: 'utf-8' },
      // Qualquer falha vira "sem sessão": o app continua funcionando só com a API.
      (error, stdout) => resolve(error ? null : parseMediaSession(stdout))
    );
  });
}
