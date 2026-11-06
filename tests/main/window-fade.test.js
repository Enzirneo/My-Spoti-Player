import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crossfade } from '../../src/main/window-fade.js';

const fakeWindow = () => ({
  opacity: 1,
  setOpacity: vi.fn(function setOpacity(value) {
    this.opacity = value;
  }),
  isDestroyed: () => false,
});

describe('crossfade', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a janela nova aparece e a antiga some, e no fim a antiga é descartada', () => {
    const from = fakeWindow();
    const to = fakeWindow();
    const onDone = vi.fn();
    crossfade({ from, to, durationMs: 100, stepMs: 20, onDone });

    expect(to.opacity).toBe(0);
    expect(from.opacity).toBe(1);

    vi.advanceTimersByTime(50);
    expect(to.opacity).toBeGreaterThan(0);
    expect(to.opacity).toBeLessThan(1);
    expect(from.opacity).toBeGreaterThan(0);
    expect(from.opacity).toBeLessThan(1);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(to.opacity).toBe(1);
    expect(from.opacity).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('finish() termina na hora, sem esperar o fade', () => {
    const from = fakeWindow();
    const to = fakeWindow();
    const onDone = vi.fn();
    const { finish } = crossfade({ from, to, durationMs: 1000, stepMs: 20, onDone });

    finish();
    expect(to.opacity).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(onDone).toHaveBeenCalledTimes(1); // não termina duas vezes
  });

  it('não falha se uma das janelas já foi fechada', () => {
    const from = { ...fakeWindow(), isDestroyed: () => true };
    const to = fakeWindow();
    const onDone = vi.fn();
    crossfade({ from, to, durationMs: 40, stepMs: 20, onDone });
    vi.advanceTimersByTime(100);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(from.setOpacity).not.toHaveBeenCalled();
  });
});
