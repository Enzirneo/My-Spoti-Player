import { describe, it, expect } from 'vitest';
import {
  normalizePlayback,
  normalizeIdle,
  matchSearchResult,
  applyOptimistic,
  nextRepeatMode,
} from '../../src/shared/state.js';

const apiTrack = {
  id: 't1',
  name: 'Song',
  type: 'track',
  duration_ms: 200000,
  external_urls: { spotify: 'https://open.spotify.com/track/t1' },
  artists: [{ name: 'A' }, { name: 'B' }],
  album: { name: 'Album', images: [{ url: 'big.jpg' }, { url: 'small.jpg' }] },
};

const apiPlayback = {
  is_playing: true,
  progress_ms: 5000,
  shuffle_state: true,
  repeat_state: 'context',
  device: { volume_percent: 40, supports_volume: true },
  item: apiTrack,
};

describe('normalizePlayback', () => {
  it('retorna estado sem dispositivo quando a API devolve null (204)', () => {
    expect(normalizePlayback(null, 1).status).toBe('no-device');
  });

  it('retorna estado vazio quando não há item tocando', () => {
    expect(normalizePlayback({ ...apiPlayback, item: null }, 1).status).toBe('empty');
  });

  it('junta vários artistas em uma lista e escolhe a maior capa', () => {
    const state = normalizePlayback(apiPlayback, 1);
    expect(state.track.artists).toBe('A, B');
    expect(state.track.coverUrl).toBe('big.jpg');
  });

  it('copia progresso, volume, aleatório e repetição', () => {
    const state = normalizePlayback(apiPlayback, 99);
    expect(state).toMatchObject({
      status: 'ready',
      isPlaying: true,
      progressMs: 5000,
      isShuffled: true,
      repeatMode: 'context',
      volume: 40,
      canSetVolume: true,
      receivedAt: 99,
    });
  });

  it('aceita faixa sem álbum (podcast/episódio)', () => {
    const episode = {
      ...apiTrack,
      type: 'episode',
      album: undefined,
      show: { name: 'Show', images: [{ url: 'show.jpg' }] },
      artists: undefined,
    };
    const state = normalizePlayback({ ...apiPlayback, item: episode }, 1);
    expect(state.track.album).toBe('Show');
    expect(state.track.artists).toBe('');
    expect(state.track.coverUrl).toBe('show.jpg');
    expect(state.track.isLikeable).toBe(false);
  });
});

describe('applyOptimistic', () => {
  const base = normalizePlayback(apiPlayback, 1);

  it('inverte play/pause', () => {
    expect(applyOptimistic(base, 'togglePlay').isPlaying).toBe(false);
  });

  it('inverte aleatório', () => {
    expect(applyOptimistic(base, 'toggleShuffle').isShuffled).toBe(false);
  });

  it('avança o modo de repetição em ciclo', () => {
    expect(applyOptimistic(base, 'cycleRepeat').repeatMode).toBe('track');
  });

  it('aplica volume e posição escolhidos', () => {
    expect(applyOptimistic(base, 'setVolume', 70).volume).toBe(70);
    expect(applyOptimistic(base, 'seek', 12000).progressMs).toBe(12000);
  });

  it('não altera o estado original', () => {
    applyOptimistic(base, 'togglePlay');
    expect(base.isPlaying).toBe(true);
  });
});

describe('nextRepeatMode', () => {
  it('cicla off, context, track e volta para off', () => {
    expect(nextRepeatMode('off')).toBe('context');
    expect(nextRepeatMode('context')).toBe('track');
    expect(nextRepeatMode('track')).toBe('off');
  });
});

describe('matchSearchResult', () => {
  const media = { title: 'Song', artist: 'A' };

  it('escolhe o resultado com mesmo título e artista', () => {
    const other = { ...apiTrack, id: 'x', name: 'Outra', artists: [{ name: 'Z' }] };
    expect(matchSearchResult([other, apiTrack], media)).toBe(apiTrack);
  });

  it('ignora diferença de maiúsculas e de sufixos como (feat. X)', () => {
    const featured = { ...apiTrack, name: 'Song (feat. Someone)' };
    expect(matchSearchResult([featured], { title: 'SONG', artist: 'a' })).toBe(featured);
  });

  it('devolve null quando nada combina', () => {
    expect(
      matchSearchResult([apiTrack], { title: 'Nada a ver', artist: 'Q' })
    ).toBeNull();
    expect(matchSearchResult([], media)).toBeNull();
  });
});

describe('normalizeIdle', () => {
  const device = { id: 'pc', volume_percent: 30 };
  const media = {
    title: 'Song',
    artist: 'A',
    album: 'Alb',
    positionMs: 6000,
    durationMs: 199000,
  };

  it('sem música no Windows, pede só para tocar', () => {
    expect(normalizeIdle({ device, media: null, found: null }, 5)).toEqual({
      status: 'idle',
      deviceId: 'pc',
      receivedAt: 5,
    });
  });

  it('com música do Windows e sem resultado da API, usa o texto local', () => {
    const state = normalizeIdle({ device, media, found: null }, 5);
    expect(state).toMatchObject({
      status: 'ready',
      isIdle: true,
      isPlaying: false,
      progressMs: 6000,
      deviceId: 'pc',
    });
    expect(state.track).toMatchObject({
      name: 'Song',
      artists: 'A',
      album: 'Alb',
      durationMs: 199000,
      isLikeable: false,
    });
  });

  it('com resultado da API, completa capa, id e link', () => {
    const state = normalizeIdle({ device, media, found: apiTrack }, 5);
    expect(state.track).toMatchObject({
      id: 't1',
      coverUrl: 'big.jpg',
      shareUrl: 'https://open.spotify.com/track/t1',
      isLikeable: true,
    });
  });
});
