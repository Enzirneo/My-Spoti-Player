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
  getRecentlyPlayed,
  playOnDevice,
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
  it('isTrackLiked lê o primeiro item de /me/tracks/contains', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { body: [true] }));
    expect(await isTrackLiked({ token: 't', fetch: fetchMock, trackId: 'x1' })).toBe(
      true
    );
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/tracks/contains?ids=x1`);
  });

  it('setTrackLiked usa PUT para curtir e DELETE para descurtir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200));
    await setTrackLiked({ token: 't', fetch: fetchMock, trackId: 'x1', isLiked: true });
    await setTrackLiked({ token: 't', fetch: fetchMock, trackId: 'x1', isLiked: false });
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/tracks?ids=x1`);
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

describe('histórico e início de reprodução', () => {
  it('getRecentlyPlayed devolve o item mais recente', async () => {
    const item = { track: { id: 't1' }, context: { uri: 'spotify:album:a1' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { body: { items: [item] } }));
    expect(await getRecentlyPlayed({ token: 't', fetch: fetchMock })).toEqual(item);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me/player/recently-played?limit=1`);
  });

  it('getRecentlyPlayed devolve null quando o histórico está vazio', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { body: { items: [] } }));
    expect(await getRecentlyPlayed({ token: 't', fetch: fetchMock })).toBeNull();
  });

  it('playOnDevice inicia no dispositivo, continuando o contexto na faixa', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await playOnDevice({
      token: 't',
      fetch: fetchMock,
      deviceId: 'd1',
      trackUri: 'spotify:track:t1',
      contextUri: 'spotify:album:a1',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/me/player/play?device_id=d1`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({
      context_uri: 'spotify:album:a1',
      offset: { uri: 'spotify:track:t1' },
    });
  });

  it('playOnDevice usa só a faixa quando não há contexto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    await playOnDevice({
      token: 't',
      fetch: fetchMock,
      deviceId: 'd1',
      trackUri: 'spotify:track:t1',
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      uris: ['spotify:track:t1'],
    });
  });
});
