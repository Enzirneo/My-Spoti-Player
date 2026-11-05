import { describe, it, expect, vi } from 'vitest';
import { launchSpotify } from '../../src/main/wake.js';

const computer = { id: 'pc', type: 'Computer' };
const phone = { id: 'phone', type: 'Smartphone' };

function setup(overrides = {}) {
  let now = 0;
  return {
    getDevices: vi.fn().mockResolvedValue([computer]),
    launch: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn(async (ms) => (now += ms)),
    now: () => now,
    ...overrides,
  };
}

describe('launchSpotify', () => {
  it('não abre o Spotify se o computador já aparece como dispositivo', async () => {
    const deps = setup();
    await launchSpotify(deps);
    expect(deps.launch).not.toHaveBeenCalled();
  });

  it('abre o Spotify uma vez e espera o computador aparecer', async () => {
    const getDevices = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([computer]);
    const deps = setup({ getDevices });
    await launchSpotify(deps);
    expect(deps.launch).toHaveBeenCalledTimes(1);
  });

  it('ignora outros dispositivos (celular)', async () => {
    const getDevices = vi
      .fn()
      .mockResolvedValueOnce([phone])
      .mockResolvedValue([computer]);
    const deps = setup({ getDevices });
    await launchSpotify(deps);
    expect(deps.launch).toHaveBeenCalledTimes(1);
  });

  it('falha com timeout se o computador nunca aparece', async () => {
    const deps = setup({ getDevices: vi.fn().mockResolvedValue([]) });
    await expect(launchSpotify({ ...deps, timeoutMs: 5000 })).rejects.toThrow(
      'wake_timeout'
    );
  });

  it('repassa erro de autorização sem insistir', async () => {
    const unauthorized = Object.assign(new Error('x'), { kind: 'unauthorized' });
    const deps = setup({ getDevices: vi.fn().mockRejectedValue(unauthorized) });
    await expect(launchSpotify(deps)).rejects.toBe(unauthorized);
  });

  it('propaga a falha ao abrir o Spotify', async () => {
    const deps = setup({
      getDevices: vi.fn().mockResolvedValue([]),
      launch: vi.fn().mockRejectedValue(new Error('no_handler')),
    });
    await expect(launchSpotify(deps)).rejects.toThrow('no_handler');
  });
});
