import { describe, it, expect, vi } from 'vitest';
import {
  parseMediaSession,
  readSpotifyMediaSession,
} from '../../src/main/media-session.js';

const json = JSON.stringify({
  title: 'Doin Time',
  artist: 'Lana Del Rey',
  album: 'NFR',
  isPlaying: false,
  positionMs: 6000,
  durationMs: 199000,
});

describe('parseMediaSession', () => {
  it('lê o JSON da sessão do Spotify', () => {
    expect(parseMediaSession(json)).toEqual({
      title: 'Doin Time',
      artist: 'Lana Del Rey',
      album: 'NFR',
      isPlaying: false,
      positionMs: 6000,
      durationMs: 199000,
    });
  });

  it('devolve null quando não há sessão do Spotify', () => {
    expect(parseMediaSession('null\r\n')).toBeNull();
  });

  it('devolve null para saída vazia, inválida ou sem título', () => {
    expect(parseMediaSession('')).toBeNull();
    expect(parseMediaSession('lixo')).toBeNull();
    expect(parseMediaSession(JSON.stringify({ title: '' }))).toBeNull();
  });
});

describe('readSpotifyMediaSession', () => {
  it('executa o PowerShell sem perfil e interpreta a saída', async () => {
    const execFile = vi.fn((_cmd, _args, _opts, callback) => callback(null, json));
    const session = await readSpotifyMediaSession({ execFile, scriptPath: 'x.ps1' });

    expect(session.title).toBe('Doin Time');
    expect(execFile.mock.calls[0][0]).toBe('powershell.exe');
    expect(execFile.mock.calls[0][1]).toEqual(
      expect.arrayContaining(['-NoProfile', '-NonInteractive', '-File', 'x.ps1'])
    );
  });

  it('devolve null (sem lançar) se o PowerShell falhar', async () => {
    const execFile = vi.fn((_cmd, _args, _opts, callback) => callback(new Error('boom')));
    expect(await readSpotifyMediaSession({ execFile, scriptPath: 'x.ps1' })).toBeNull();
  });
});
