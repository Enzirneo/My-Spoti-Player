import { describe, it, expect, vi } from 'vitest';
import {
  SpotifyError,
  getPlayback,
  nextTrack,
  seek,
  setRepeat,
  setVolume,
  play,
  isTrackLiked,
  setTrackLiked,
  getDevices,
  transferPlayback,
  searchTracks,
} from '../../src/shared/spotify.js';

const BASE = 'https://api.spotify.com/v1';

function response(status, { body = null, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (body ? JSON.stringify(body) : ''),
  };
}

describe('chamadas de comando', () => {
  it('nextTrack chama POST /me/player/next com o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await nextTrack({ token: 'abc', fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/me/player/next`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
      })
    );
  });

  it('seek envia position_ms inteiro na query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await seek({ token: 't', fetch: fetchMock, positionMs: 1234.7 });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/player/seek?position_ms=1235`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('setVolume limita o valor entre 0 e 100', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await setVolume({ token: 't', fetch: fetchMock, percent: 150 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/me/player/volume?volume_percent=100`
    );
  });

  it('setRepeat envia o estado pedido', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await setRepeat({ token: 't', fetch: fetchMock, mode: 'track' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/player/repeat?state=track`);
  });

  it('play usa PUT /me/player/play', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await play({ token: 't', fetch: fetchMock });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/player/play`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });
});

describe('getPlayback', () => {
  it('retorna null quando a API responde 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    expect(await getPlayback({ token: 't', fetch: fetchMock })).toBeNull();
  });

  it('retorna o JSON quando a API responde 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { body: { is_playing: true } }));
    expect(await getPlayback({ token: 't', fetch: fetchMock })).toEqual({
      is_playing: true,
    });
  });
});

describe('curtidas', () => {
  it('isTrackLiked lê o primeiro item de /me/library/contains', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { body: [true] }));
    const trackUri = 'spotify:track:x1';
    expect(await isTrackLiked({ token: 't', fetch: fetchMock, trackUri })).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/me/library/contains?uris=spotify%3Atrack%3Ax1`
    );
  });

  it('setTrackLiked usa PUT para curtir e DELETE para descurtir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200));
    const trackUri = 'spotify:track:x1';
    await setTrackLiked({ token: 't', fetch: fetchMock, trackUri, isLiked: true });
    await setTrackLiked({ token: 't', fetch: fetchMock, trackUri, isLiked: false });
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/me/library?uris=spotify%3Atrack%3Ax1`
    );
  });
});

describe('tratamento de erros', () => {
  async function failureOf(fetchMock) {
    try {
      await nextTrack({ token: 't', fetch: fetchMock });
    } catch (error) {
      return error;
    }
    return null;
  }

  it('classifica 401 como unauthorized', async () => {
    const error = await failureOf(vi.fn().mockResolvedValue(response(401)));
    expect(error).toBeInstanceOf(SpotifyError);
    expect(error.kind).toBe('unauthorized');
  });

  it('classifica 429 como rate-limited e lê Retry-After em ms', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(429, { headers: { 'retry-after': '3' } }));
    const error = await failureOf(fetchMock);
    expect(error.kind).toBe('rate-limited');
    expect(error.retryAfterMs).toBe(3000);
  });

  it('classifica 404 NO_ACTIVE_DEVICE como no-device', async () => {
    const body = { error: { status: 404, reason: 'NO_ACTIVE_DEVICE' } };
    const error = await failureOf(vi.fn().mockResolvedValue(response(404, { body })));
    expect(error.kind).toBe('no-device');
  });

  it('classifica 403 PREMIUM_REQUIRED como premium-required', async () => {
    const body = { error: { status: 403, reason: 'PREMIUM_REQUIRED' } };
    const error = await failureOf(vi.fn().mockResolvedValue(response(403, { body })));
    expect(error.kind).toBe('premium-required');
  });

  it('classifica falha de fetch como network', async () => {
    const error = await failureOf(vi.fn().mockRejectedValue(new TypeError('failed')));
    expect(error.kind).toBe('network');
  });

  it('usa kind http para outros status', async () => {
    const error = await failureOf(vi.fn().mockResolvedValue(response(500)));
    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
  });
});

describe('dispositivos', () => {
  it('getDevices devolve a lista de dispositivos', async () => {
    const devices = [{ id: 'd1', type: 'Computer' }];
    const fetchMock = vi.fn().mockResolvedValue(response(200, { body: { devices } }));
    expect(await getDevices({ token: 't', fetch: fetchMock })).toEqual(devices);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/player/devices`);
  });
});

describe('transferPlayback', () => {
  it('envia o dispositivo e play=true para retomar a sessão do Spotify', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await transferPlayback({
      token: 't',
      fetch: fetchMock,
      deviceId: 'd1',
      shouldPlay: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/me/player`);
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ device_ids: ['d1'], play: true });
  });

  it('não inicia o áudio por padrão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await transferPlayback({ token: 't', fetch: fetchMock, deviceId: 'd1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).play).toBe(false);
  });
});

describe('searchTracks', () => {
  it('busca por título e artista e devolve os itens', async () => {
    const items = [{ id: 't1' }];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { body: { tracks: { items } } }));
    const result = await searchTracks({
      token: 't',
      fetch: fetchMock,
      title: "Doin' Time",
      artist: 'Lana',
    });

    expect(result).toEqual(items);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/search');
    expect(url.searchParams.get('type')).toBe('track');
    expect(url.searchParams.get('q')).toBe("track:Doin' Time artist:Lana");
  });
});
