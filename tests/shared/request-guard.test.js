import { describe, it, expect, vi } from 'vitest';
import { backoffDelayMs, createRequestGuard } from '../../src/shared/request-guard.js';

function guardAt(clock, options = {}) {
  return createRequestGuard({ now: () => clock.time, ...options });
}

describe('createRequestGuard', () => {
  it('libera pedidos até o teto da janela e manda esperar o resto', () => {
    const clock = { time: 0 };
    const guard = guardAt(clock, { maxRequests: 2, windowMs: 1000 });

    expect(guard.acquire()).toBe(0);
    clock.time = 100;
    expect(guard.acquire()).toBe(0);
    clock.time = 300;
    expect(guard.acquire()).toBe(700); // o primeiro pedido sai da janela em t=1000
  });

  it('libera de novo quando os pedidos antigos saem da janela', () => {
    const clock = { time: 0 };
    const guard = guardAt(clock, { maxRequests: 1, windowMs: 1000 });
    guard.acquire();
    clock.time = 1000;
    expect(guard.acquire()).toBe(0);
  });

  it('pedido recusado não gasta a cota', () => {
    const clock = { time: 0 };
    const guard = guardAt(clock, { maxRequests: 1, windowMs: 1000 });
    guard.acquire();
    guard.acquire();
    guard.acquire();
    clock.time = 1000;
    expect(guard.acquire()).toBe(0);
  });

  it('bloqueia tudo pelo tempo pedido depois de um 429', () => {
    const clock = { time: 0 };
    const guard = guardAt(clock);
    guard.block(5000);

    clock.time = 1000;
    expect(guard.acquire()).toBe(4000);
    clock.time = 5000;
    expect(guard.acquire()).toBe(0);
  });

  it('um bloqueio curto não encurta um bloqueio longo', () => {
    const clock = { time: 0 };
    const guard = guardAt(clock);
    guard.block(10000);
    guard.block(1000);
    expect(guard.acquire()).toBe(10000);
  });

  it('avisa quem escuta e restaura um bloqueio salvo', () => {
    const clock = { time: 0 };
    const guard = guardAt(clock);
    const listener = vi.fn();
    guard.listen(listener);

    guard.block(3000);
    expect(listener).toHaveBeenCalledWith(3000);

    const restored = guardAt(clock);
    restored.restore(3000);
    expect(restored.acquire()).toBe(3000);
  });

  it('ignora um bloqueio restaurado inválido ou já vencido', () => {
    const clock = { time: 5000 };
    const guard = guardAt(clock);
    guard.restore(undefined);
    guard.restore(1000);
    expect(guard.acquire()).toBe(0);
  });
});

describe('backoffDelayMs', () => {
  it('dobra a espera a cada falha seguida até um teto', () => {
    expect(backoffDelayMs(1)).toBe(3000);
    expect(backoffDelayMs(2)).toBe(6000);
    expect(backoffDelayMs(3)).toBe(12000);
    expect(backoffDelayMs(50)).toBe(60000);
  });
});
