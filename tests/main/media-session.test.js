import { describe, it, expect, vi } from 'vitest';
import {
  parseMediaSession,
  readSpotifyMediaSession,
  controlSpotifyMedia,
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

describe('controlSpotifyMedia', () => {
  it('passa a ação ao script', async () => {
    const execFile = vi.fn((_cmd, _args, _opts, callback) => callback(null, 'ok'));
    await controlSpotifyMedia('next', {}, { execFile, scriptPath: 'x.ps1' });
    expect(execFile.mock.calls[0][1]).toEqual(
      expect.arrayContaining(['-Action', 'next'])
    );
  });

  it('seek leva a posição em ms, arredondada', async () => {
    const execFile = vi.fn((_cmd, _args, _opts, callback) => callback(null, 'ok'));
    await controlSpotifyMedia(
      'seek',
      { positionMs: 1234.6 },
      { execFile, scriptPath: 'x' }
    );
    expect(execFile.mock.calls[0][1].slice(-4)).toEqual([
      '-Action',
      'seek',
      '-PositionMs',
      '1235',
    ]);
  });

  it('lança se o PowerShell falhar (o Spotify recusou)', async () => {
    const execFile = vi.fn((_cmd, _args, _opts, callback) => callback(new Error('boom')));
    await expect(
      controlSpotifyMedia('pause', {}, { execFile, scriptPath: 'x.ps1' })
    ).rejects.toThrow('boom');
  });
});
