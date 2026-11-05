import { describe, it, expect } from 'vitest';
import { restoreBounds } from '../../src/main/window-bounds.js';

const DEFAULTS = { width: 340, height: 420 };
const SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };

describe('restoreBounds', () => {
  it('usa o tamanho padrão quando não há nada salvo', () => {
    expect(restoreBounds(undefined, [SCREEN], DEFAULTS)).toEqual(DEFAULTS);
  });

  it('mantém posição e tamanho salvos quando a janela está visível', () => {
    const saved = { x: 100, y: 200, width: 400, height: 500 };
    expect(restoreBounds(saved, [SCREEN], DEFAULTS)).toEqual(saved);
  });

  it('descarta a posição (mas mantém o tamanho) se estava num monitor que sumiu', () => {
    const saved = { x: 3000, y: 100, width: 400, height: 500 };
    expect(restoreBounds(saved, [SCREEN], DEFAULTS)).toEqual({ width: 400, height: 500 });
  });

  it('aceita janela parcialmente visível em algum monitor', () => {
    const saved = { x: 1800, y: 100, width: 340, height: 420 };
    expect(restoreBounds(saved, [SCREEN], DEFAULTS)).toEqual(saved);
  });
});
