import { describe, it, expect } from 'vitest';
import { capsuleBounds, expandedBounds } from '../../src/main/window-bounds.js';

const SCREEN = { x: 0, y: 0, width: 1920, height: 1040 };
const CAPSULE = { width: 400, height: 80 };
const MIN = { width: 260, height: 320 };

describe('capsuleBounds', () => {
  it('centraliza a cápsula no topo da área de trabalho', () => {
    expect(capsuleBounds(SCREEN, CAPSULE, 6)).toEqual({
      x: 760,
      y: 6,
      width: 400,
      height: 80,
    });
  });

  it('respeita o deslocamento do monitor (segundo monitor à direita)', () => {
    const second = { x: 1920, y: 0, width: 1280, height: 1000 };
    expect(capsuleBounds(second, CAPSULE, 6).x).toBe(1920 + 440);
  });

  it('respeita a barra de tarefas no topo (y da área de trabalho)', () => {
    const area = { x: 0, y: 40, width: 1920, height: 1000 };
    expect(capsuleBounds(area, CAPSULE, 6).y).toBe(46);
  });
});

describe('expandedBounds', () => {
  it('abre centralizado no topo com o tamanho pedido', () => {
    expect(expandedBounds(SCREEN, { width: 360, height: 480 }, MIN, 6)).toEqual({
      x: 780,
      y: 6,
      width: 360,
      height: 480,
    });
  });

  it('nunca fica menor que o mínimo', () => {
    const bounds = expandedBounds(SCREEN, { width: 100, height: 100 }, MIN, 6);
    expect(bounds.width).toBe(260);
    expect(bounds.height).toBe(320);
  });

  it('não passa do tamanho da tela', () => {
    const bounds = expandedBounds(SCREEN, { width: 5000, height: 5000 }, MIN, 6);
    expect(bounds.width).toBeLessThanOrEqual(SCREEN.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(SCREEN.y + SCREEN.height);
  });
});
