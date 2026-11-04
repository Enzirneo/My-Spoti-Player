import { describe, it, expect, vi } from 'vitest';
import { findIdleSession } from '../../src/main/idle.js';

const computer = { id: 'pc', type: 'Computer' };
const recent = { track: { id: 't1' }, context: null };

describe('findIdleSession', () => {
  it('devolve null quando o Spotify do computador não está aberto', async () => {
    const getDevices = vi.fn().mockResolvedValue([{ id: 'phone', type: 'Smartphone' }]);
    const getRecentlyPlayed = vi.fn();
    expect(await findIdleSession({ getDevices, getRecentlyPlayed })).toBeNull();
    expect(getRecentlyPlayed).not.toHaveBeenCalled();
  });

  it('devolve o computador e a última música tocada', async () => {
    const session = await findIdleSession({
      getDevices: vi.fn().mockResolvedValue([computer]),
      getRecentlyPlayed: vi.fn().mockResolvedValue(recent),
    });
    expect(session).toEqual({ device: computer, recent });
  });

  it('devolve o computador sem histórico se a leitura do histórico falha', async () => {
    const session = await findIdleSession({
      getDevices: vi.fn().mockResolvedValue([computer]),
      getRecentlyPlayed: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('x'), { kind: 'http' })),
    });
    expect(session).toEqual({ device: computer, recent: null });
  });

  it('repassa erro de autorização', async () => {
    const unauthorized = Object.assign(new Error('x'), { kind: 'unauthorized' });
    await expect(
      findIdleSession({
        getDevices: vi.fn().mockRejectedValue(unauthorized),
        getRecentlyPlayed: vi.fn(),
      })
    ).rejects.toBe(unauthorized);
  });
});
