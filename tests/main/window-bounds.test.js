import { describe, it, expect } from 'vitest';
import {
  restoreBounds,
  restoreTagBounds,
  movedBounds,
} from '../../src/main/window-bounds.js';

const SCREEN = { x: 0, y: 0, width: 1920, height: 1040 };
const DEFAULT_SIZE = { width: 320, height: 320 };
const TAG_SIZE = { width: 300, height: 64 };

describe('restoreBounds', () => {
  it('centraliza o tamanho padrão quando não há nada salvo', () => {
    expect(restoreBounds(undefined, [SCREEN], DEFAULT_SIZE, SCREEN)).toEqual({
      x: 800,
      y: 360,
      width: 320,
      height: 320,
    });
  });

  it('mantém posição e tamanho salvos quando a janela está visível', () => {
    const saved = { x: 100, y: 200, width: 400, height: 500 };
    expect(restoreBounds(saved, [SCREEN], DEFAULT_SIZE, SCREEN)).toEqual(saved);
  });

  it('mantém o tamanho e centraliza se a posição estava num monitor que sumiu', () => {
    const saved = { x: 5000, y: 100, width: 400, height: 500 };
    expect(restoreBounds(saved, [SCREEN], DEFAULT_SIZE, SCREEN)).toEqual({
      x: 760,
      y: 270,
      width: 400,
      height: 500,
    });
  });

  it('aceita janela parcialmente visível', () => {
    const saved = { x: 1800, y: 100, width: 340, height: 420 };
    expect(restoreBounds(saved, [SCREEN], DEFAULT_SIZE, SCREEN)).toEqual(saved);
  });
});

describe('restoreTagBounds', () => {
  it('sem posição salva, fica no topo e no centro da área de trabalho', () => {
    expect(restoreTagBounds(undefined, TAG_SIZE, [SCREEN], SCREEN, 6)).toEqual({
      x: 810,
      y: 6,
      width: 300,
      height: 64,
    });
  });

  it('respeita a barra de tarefas no topo', () => {
    const area = { x: 0, y: 40, width: 1920, height: 1000 };
    expect(restoreTagBounds(undefined, TAG_SIZE, [area], area, 6).y).toBe(46);
  });

  it('usa a posição salva (tag movida pelo usuário) quando visível', () => {
    expect(restoreTagBounds({ x: 50, y: 700 }, TAG_SIZE, [SCREEN], SCREEN, 6)).toEqual({
      x: 50,
      y: 700,
      width: 300,
      height: 64,
    });
  });

  it('volta ao topo central se a posição salva está fora de qualquer monitor', () => {
    const bounds = restoreTagBounds({ x: 9000, y: 9000 }, TAG_SIZE, [SCREEN], SCREEN, 6);
    expect(bounds).toMatchObject({ x: 810, y: 6 });
  });
});

describe('movedBounds', () => {
  it('desloca a janela pelo mesmo tanto que o mouse andou, sem mudar o tamanho', () => {
    const start = { x: 100, y: 100, width: 320, height: 320 };
    expect(movedBounds(start, { x: 500, y: 400 }, { x: 530, y: 380 })).toEqual({
      x: 130,
      y: 80,
      width: 320,
      height: 320,
    });
  });
});
