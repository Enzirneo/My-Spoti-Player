import { describe, it, expect, vi } from 'vitest';
import { wakeSpotify } from '../../src/main/wake.js';

const computer = { id: 'pc', type: 'Computer' };
const phone = { id: 'phone', type: 'Smartphone' };

function setup(overrides = {}) {
  let now = 0;
  return {
    getDevices: vi.fn().mockResolvedValue([computer]),
    transfer: vi.fn().mockResolvedValue(undefined),
    launch: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn(async (ms) => (now += ms)),
    now: () => now,
    ...overrides,
  };
}

describe('wakeSpotify', () => {
  it('não abre o Spotify se o computador já aparece como dispositivo', async () => {
    const deps = setup();
    await wakeSpotify(deps);
    expect(deps.launch).not.toHaveBeenCalled();
    expect(deps.transfer).toHaveBeenCalledWith('pc');
  });

  it('abre o Spotify e espera o computador aparecer', async () => {
    const getDevices = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([computer]);
    const deps = setup({ getDevices });
    await wakeSpotify(deps);
    expect(deps.launch).toHaveBeenCalledTimes(1);
    expect(deps.transfer).toHaveBeenCalledWith('pc');
  });

  it('ignora outros dispositivos (celular) e abre o Spotify no computador', async () => {
    const getDevices = vi
      .fn()
      .mockResolvedValueOnce([phone])
      .mockResolvedValue([computer, phone]);
    const deps = setup({ getDevices });
    await wakeSpotify(deps);
    expect(deps.launch).toHaveBeenCalledTimes(1);
    expect(deps.transfer).toHaveBeenCalledWith('pc');
  });

  it('tenta de novo se a transferência falha enquanto o Spotify carrega', async () => {
    const transfer = vi
      .fn()
      .mockRejectedValueOnce(new Error('loading'))
      .mockResolvedValue();
    const deps = setup({ transfer });
    await wakeSpotify(deps);
    expect(transfer).toHaveBeenCalledTimes(2);
  });

  it('falha com timeout se o computador nunca aparece', async () => {
    const deps = setup({ getDevices: vi.fn().mockResolvedValue([]) });
    await expect(wakeSpotify({ ...deps, timeoutMs: 5000 })).rejects.toThrow(
      'wake_timeout'
    );
  });

  it('repassa erro de autorização sem insistir', async () => {
    const unauthorized = Object.assign(new Error('x'), { kind: 'unauthorized' });
    const deps = setup({ getDevices: vi.fn().mockRejectedValue(unauthorized) });
    await expect(wakeSpotify(deps)).rejects.toBe(unauthorized);
  });
});
