import { describe, it, expect, vi } from 'vitest';
import {
  buildCommandScript,
  createLocalSpotify,
  parseLocalPlayback,
} from '../../src/main/local-spotify.js';

const SEP = String.fromCharCode(31);
const fields = (...values) => values.join(SEP);

const playing = fields(
  'playing',
  '12,5', // vírgula decimal: macOS em português
  '80',
  'true',
  'false',
  'spotify:track:abc123',
  'Doin Time',
  'Lana Del Rey',
  'NFR',
  '199000',
  'https://i.scdn.co/image/cover'
);

describe('parseLocalPlayback', () => {
  it('devolve null quando o Spotify está fechado', () => {
    expect(parseLocalPlayback('closed\n')).toBeNull();
  });

  it('converte a leitura no formato da Web API', () => {
    const playback = parseLocalPlayback(`${playing}\n`);
    expect(playback).toMatchObject({
      is_playing: true,
      progress_ms: 12500,
      shuffle_state: true,
      repeat_state: 'off',
      device: { volume_percent: 80, supports_volume: true },
    });
    expect(playback.item).toMatchObject({
      id: 'abc123',
      uri: 'spotify:track:abc123',
      type: 'track',
      name: 'Doin Time',
      artists: [{ name: 'Lana Del Rey' }],
      album: { name: 'NFR', images: [{ url: 'https://i.scdn.co/image/cover' }] },
      duration_ms: 199000,
      is_local: false,
      external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
    });
  });

  it('marca repeat como context quando a repetição está ligada', () => {
    const repeating = playing.replace(`${SEP}false${SEP}spotify`, `${SEP}true${SEP}spotify`);
    expect(parseLocalPlayback(repeating).repeat_state).toBe('context');
  });

  it('sem música carregada devolve a sessão sem item', () => {
    const playback = parseLocalPlayback(fields('stopped', '0', '50', 'false', 'false'));
    expect(playback.item).toBeUndefined();
    expect(playback.is_playing).toBe(false);
  });

  it('trata arquivo local e anúncio como não curtíveis', () => {
    const local = playing.replace('spotify:track:abc123', 'spotify:local:a:b:c:1');
    expect(parseLocalPlayback(local).item.is_local).toBe(true);
    const ad = playing.replace('spotify:track:abc123', 'spotify:ad:xyz');
    expect(parseLocalPlayback(ad).item.type).toBe('ad');
  });

  it('devolve null se a saída é inválida', () => {
    expect(parseLocalPlayback('')).toBeNull();
    expect(parseLocalPlayback('lixo')).toBeNull();
  });
});

describe('buildCommandScript', () => {
  it('monta o AppleScript de cada comando', () => {
    expect(buildCommandScript('pause')).toContain('pause');
    expect(buildCommandScript('next')).toContain('next track');
    expect(buildCommandScript('previous')).toContain('previous track');
    expect(buildCommandScript('seek', { positionMs: 90500 })).toContain(
      'set player position to 90.5'
    );
    expect(buildCommandScript('setVolume', { percent: 42 })).toContain(
      'set sound volume to 42'
    );
    expect(buildCommandScript('setShuffle', { isShuffled: true })).toContain(
      'set shuffling to true'
    );
    expect(buildCommandScript('setRepeat', { mode: 'track' })).toContain(
      'set repeating to true'
    );
    expect(buildCommandScript('setRepeat', { mode: 'off' })).toContain(
      'set repeating to false'
    );
  });

  it('nunca abre o Spotify sozinho para obedecer um comando', () => {
    expect(buildCommandScript('play')).toContain('is not running then return');
  });

  it('retomar em um dispositivo equivale a dar play', () => {
    expect(buildCommandScript('transferPlayback')).toBe(buildCommandScript('play'));
  });

  it('comando desconhecido devolve null', () => {
    expect(buildCommandScript('nope')).toBeNull();
  });
});

describe('createLocalSpotify', () => {
  const execReturning = (stdout) =>
    vi.fn((_cmd, _args, _options, callback) => callback(null, stdout));

  it('lê o estado chamando osascript', async () => {
    const execFile = execReturning(playing);
    const local = createLocalSpotify({ execFile });
    const playback = await local.getPlayback();

    expect(execFile.mock.calls[0][0]).toBe('osascript');
    expect(playback.item.name).toBe('Doin Time');
  });

  it('executa comandos pelo osascript', async () => {
    const execFile = execReturning('');
    const local = createLocalSpotify({ execFile });
    await local.call('setVolume', { percent: 10 });
    expect(execFile.mock.calls[0][1].join(' ')).toContain('set sound volume to 10');
  });

  it('curtir não existe no modo local: devolve falso e recusa gravar', async () => {
    const local = createLocalSpotify({ execFile: execReturning('') });
    expect(await local.call('isTrackLiked', { trackUri: 'x' })).toBe(false);
    await expect(local.call('setTrackLiked', {})).rejects.toMatchObject({ kind: 'http' });
  });

  it('falha do osascript vira erro com kind', async () => {
    const execFile = vi.fn((_c, _a, _o, callback) => callback(new Error('boom'), ''));
    const local = createLocalSpotify({ execFile });
    await expect(local.getPlayback()).rejects.toMatchObject({ kind: 'http' });
  });

  it('abre o Spotify e espera ele ficar aberto', async () => {
    const execFile = vi
      .fn()
      .mockImplementationOnce((_c, _a, _o, cb) => cb(null, 'closed'))
      .mockImplementationOnce((_c, _a, _o, cb) => cb(null, ''))
      .mockImplementation((_c, _a, _o, cb) => cb(null, playing));
    const local = createLocalSpotify({ execFile, sleep: async () => {} });
    await local.launch();

    const commands = execFile.mock.calls.map((call) => call[0]);
    expect(commands).toContain('open');
  });
});
