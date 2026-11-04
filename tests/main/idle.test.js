import { describe, it, expect, vi } from 'vitest';
import { findIdleDevice } from '../../src/main/idle.js';

const computer = { id: 'pc', type: 'Computer' };

describe('findIdleDevice', () => {
  it('devolve null quando o Spotify do computador não está aberto', async () => {
    const getDevices = vi.fn().mockResolvedValue([{ id: 'phone', type: 'Smartphone' }]);
    expect(await findIdleDevice({ getDevices })).toBeNull();
  });

  it('devolve o dispositivo do computador', async () => {
    const getDevices = vi
      .fn()
      .mockResolvedValue([{ id: 'phone', type: 'Smartphone' }, computer]);
    expect(await findIdleDevice({ getDevices })).toEqual(computer);
  });

  it('repassa erros da API', async () => {
    const error = Object.assign(new Error('x'), { kind: 'unauthorized' });
    await expect(
      findIdleDevice({ getDevices: vi.fn().mockRejectedValue(error) })
    ).rejects.toBe(error);
  });
});
