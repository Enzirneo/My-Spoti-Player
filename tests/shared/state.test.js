import { describe, it, expect } from 'vitest';
import {
  normalizePlayback,
  normalizeIdle,
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

describe('normalizeIdle', () => {
  const device = { id: 'pc', volume_percent: 30, supports_volume: true };
  const recent = {
    track: { ...apiTrack, uri: 'spotify:track:t1' },
    context: { uri: 'spotify:album:a1' },
  };

  it('monta um estado pausado e ocioso com a última música tocada', () => {
    const state = normalizeIdle({ device, recent }, 5);
    expect(state).toMatchObject({
      status: 'ready',
      isIdle: true,
      isPlaying: false,
      progressMs: 0,
      deviceId: 'pc',
      contextUri: 'spotify:album:a1',
      volume: 30,
      receivedAt: 5,
    });
    expect(state.track.uri).toBe('spotify:track:t1');
    expect(state.track.name).toBe('Song');
  });

  it('retorna estado vazio quando o Spotify está aberto mas sem histórico', () => {
    expect(normalizeIdle({ device, recent: null }, 5).status).toBe('empty');
  });

  it('tem contexto nulo quando a música veio sem playlist/álbum', () => {
    const state = normalizeIdle(
      { device, recent: { track: recent.track, context: null } },
      5
    );
    expect(state.contextUri).toBeNull();
  });
});
