import { describe, it, expect, vi } from 'vitest';
import { createIdleResolver } from '../../src/main/idle.js';

const computer = { id: 'pc', type: 'Computer' };
const media = {
  title: 'Song',
  artist: 'A',
  album: 'Alb',
  positionMs: 0,
  durationMs: 1000,
};
const apiTrack = { id: 't1', name: 'Song', artists: [{ name: 'A' }] };

function setup(overrides = {}) {
  return {
    getDevices: vi.fn().mockResolvedValue([computer]),
    readMedia: vi.fn().mockResolvedValue(media),
    searchTracks: vi.fn().mockResolvedValue([apiTrack]),
    ...overrides,
  };
}

describe('createIdleResolver', () => {
  it('devolve null quando o Spotify do computador não está aberto', async () => {
    const deps = setup({
      getDevices: vi.fn().mockResolvedValue([{ id: 'p', type: 'Smartphone' }]),
    });
    expect(await createIdleResolver(deps)()).toBeNull();
    expect(deps.readMedia).not.toHaveBeenCalled();
  });

  it('junta dispositivo, música do Windows e faixa encontrada na API', async () => {
    const result = await createIdleResolver(setup())();
    expect(result).toEqual({ device: computer, media, found: apiTrack });
  });

  it('devolve media null quando o Windows não tem sessão do Spotify', async () => {
    const deps = setup({ readMedia: vi.fn().mockResolvedValue(null) });
    expect(await createIdleResolver(deps)()).toEqual({
      device: computer,
      media: null,
      found: null,
    });
  });

  it('segue sem a faixa da API se a busca falhar', async () => {
    const error = Object.assign(new Error('x'), { kind: 'http' });
    const deps = setup({ searchTracks: vi.fn().mockRejectedValue(error) });
    expect((await createIdleResolver(deps)()).found).toBeNull();
  });

  it('não repete a busca para a mesma música', async () => {
    const deps = setup();
    const resolve = createIdleResolver(deps);
    await resolve();
    await resolve();
    expect(deps.searchTracks).toHaveBeenCalledTimes(1);
  });

  it('repassa erro de autorização', async () => {
    const error = Object.assign(new Error('x'), { kind: 'unauthorized' });
    const deps = setup({ getDevices: vi.fn().mockRejectedValue(error) });
    await expect(createIdleResolver(deps)()).rejects.toBe(error);
  });
});
