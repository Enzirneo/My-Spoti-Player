import { describe, it, expect, vi } from 'vitest';
import { createHybridSpotify } from '../../src/main/hybrid-spotify.js';

const media = {
  title: 'Doin Time',
  artist: 'Lana Del Rey',
  album: 'NFR',
  isPlaying: true,
  positionMs: 12000,
  durationMs: 199000,
};

const apiPlayback = {
  is_playing: true,
  progress_ms: 11000,
  shuffle_state: true,
  repeat_state: 'context',
  device: { volume_percent: 60, supports_volume: true },
  item: {
    id: 'abc',
    uri: 'spotify:track:abc',
    type: 'track',
    name: 'Doin Time',
    artists: [{ name: 'Lana Del Rey' }],
    album: { name: 'NFR', images: [{ url: 'cover' }] },
    duration_ms: 199000,
  },
};

function setup({ mediaNow = media, apiResult = apiPlayback } = {}) {
  const clock = { time: 0 };
  const readMedia = vi.fn(async () => mediaNow);
  const controlMedia = vi.fn(async () => {});
  const api = {
    call: vi.fn(async (name) => (name === 'getPlayback' ? apiResult : null)),
  };
  const hybrid = createHybridSpotify({
    api,
    readMedia,
    controlMedia,
    now: () => clock.time,
  });
  return { hybrid, api, readMedia, controlMedia, clock };
}

const apiCalls = (api, name) => api.call.mock.calls.filter(([called]) => called === name);

describe('getPlayback', () => {
  it('estado vem do sistema; a API só completa capa, volume e afins', async () => {
    const { hybrid } = setup();
    const playback = await hybrid.call('getPlayback');

    expect(playback.progress_ms).toBe(12000); // do sistema, não da API
    expect(playback.item.album.images[0].url).toBe('cover');
    expect(playback.device.volume_percent).toBe(60);
    expect(playback.shuffle_state).toBe(true);
  });

  it('não chama a API de novo enquanto a música é a mesma', async () => {
    const { hybrid, api, clock } = setup();
    await hybrid.call('getPlayback');
    clock.time = 3000;
    await hybrid.call('getPlayback');
    clock.time = 6000;
    await hybrid.call('getPlayback');

    expect(apiCalls(api, 'getPlayback')).toHaveLength(1);
  });

  it('chama a API quando a música muda', async () => {
    const { hybrid, api, readMedia } = setup();
    await hybrid.call('getPlayback');
    readMedia.mockResolvedValue({ ...media, title: 'Outra', artist: 'Alguém' });
    await hybrid.call('getPlayback');

    expect(apiCalls(api, 'getPlayback')).toHaveLength(2);
  });

  it('atualiza os detalhes de vez em quando enquanto toca (volume mudado fora do app)', async () => {
    const { hybrid, api, clock } = setup();
    await hybrid.call('getPlayback');
    clock.time = 61_000;
    await hybrid.call('getPlayback');
    expect(apiCalls(api, 'getPlayback')).toHaveLength(2);
  });

  it('pausado não gasta API para atualizar detalhes', async () => {
    const { hybrid, api, readMedia, clock } = setup();
    await hybrid.call('getPlayback');
    readMedia.mockResolvedValue({ ...media, isPlaying: false });
    clock.time = 120_000;
    const playback = await hybrid.call('getPlayback');

    expect(apiCalls(api, 'getPlayback')).toHaveLength(1);
    expect(playback.is_playing).toBe(false);
  });

  it('se a API falha, continua mostrando a música pelo que o sistema sabe', async () => {
    const { hybrid, api } = setup();
    api.call.mockRejectedValue(Object.assign(new Error('x'), { kind: 'rate-limited' }));
    const playback = await hybrid.call('getPlayback');

    expect(playback.item.name).toBe('Doin Time');
    expect(playback.item.is_local).toBe(true); // sem id da API: não dá para curtir
    expect(playback.device.supports_volume).toBe(false);
  });

  it('depois de uma falha, espera antes de tentar a API de novo', async () => {
    const { hybrid, api, clock } = setup();
    api.call.mockRejectedValue(new Error('x'));
    await hybrid.call('getPlayback');
    clock.time = 3000;
    await hybrid.call('getPlayback');
    expect(apiCalls(api, 'getPlayback')).toHaveLength(1);

    clock.time = 31_000;
    await hybrid.call('getPlayback');
    expect(apiCalls(api, 'getPlayback')).toHaveLength(2);
  });

  it('ignora a resposta da API se ela ainda é de outra música', async () => {
    const stale = { ...apiPlayback, item: { ...apiPlayback.item, name: 'Anterior' } };
    const { hybrid } = setup({ apiResult: stale });
    const playback = await hybrid.call('getPlayback');
    expect(playback.item.name).toBe('Doin Time');
    expect(playback.item.is_local).toBe(true);
  });

  it('sem sessão de mídia, deixa a API decidir', async () => {
    const { hybrid, api } = setup({ mediaNow: null, apiResult: null });
    expect(await hybrid.call('getPlayback')).toBeNull();
    expect(apiCalls(api, 'getPlayback')).toHaveLength(1);
  });
});

describe('comandos', () => {
  it.each(['play', 'pause', 'next', 'previous'])(
    '%s usa o sistema, sem API',
    async (name) => {
      const { hybrid, api, controlMedia } = setup();
      await hybrid.call(name);

      expect(controlMedia).toHaveBeenCalledWith(name, {});
      expect(api.call).not.toHaveBeenCalled();
    }
  );

  it('seek usa o sistema', async () => {
    const { hybrid, controlMedia } = setup();
    await hybrid.call('seek', { positionMs: 5000 });
    expect(controlMedia).toHaveBeenCalledWith('seek', { positionMs: 5000 });
  });

  it('se o sistema falha, o comando cai para a API', async () => {
    const { hybrid, api, controlMedia } = setup();
    controlMedia.mockRejectedValue(new Error('x'));
    await hybrid.call('pause');
    expect(api.call).toHaveBeenCalledWith('pause', {});
  });

  it('volume, shuffle, repeat, curtir e retomar vão para a API', async () => {
    const { hybrid, api, controlMedia } = setup();
    await hybrid.call('setVolume', { percent: 30 });
    await hybrid.call('setShuffle', { isShuffled: false });
    await hybrid.call('setRepeat', { mode: 'off' });
    await hybrid.call('isTrackLiked', { trackUri: 'u' });
    await hybrid.call('setTrackLiked', { trackUri: 'u', isLiked: true });
    await hybrid.call('transferPlayback', { deviceId: 'd', shouldPlay: true });

    expect(controlMedia).not.toHaveBeenCalled();
    expect(api.call).toHaveBeenCalledTimes(6);
  });

  it('volume, shuffle e repeat mudam o que a tela mostra sem nova chamada de leitura', async () => {
    const { hybrid, api } = setup();
    await hybrid.call('getPlayback');
    await hybrid.call('setVolume', { percent: 30 });
    await hybrid.call('setShuffle', { isShuffled: false });
    await hybrid.call('setRepeat', { mode: 'track' });
    const playback = await hybrid.call('getPlayback');

    expect(playback.device.volume_percent).toBe(30);
    expect(playback.shuffle_state).toBe(false);
    expect(playback.repeat_state).toBe('track');
    expect(apiCalls(api, 'getPlayback')).toHaveLength(1);
  });

  it('próxima e anterior pedem os detalhes de novo', async () => {
    const { hybrid, api } = setup();
    await hybrid.call('getPlayback');
    await hybrid.call('next');
    await hybrid.call('getPlayback');
    expect(apiCalls(api, 'getPlayback')).toHaveLength(2);
  });
});
