import { describe, it, expect } from 'vitest';
import {
  computeProgressMs,
  progressRatio,
  positionFromClick,
} from '../../src/renderer/progress.js';

const playing = {
  isPlaying: true,
  progressMs: 10000,
  receivedAt: 1000,
  track: { durationMs: 200000 },
};

describe('computeProgressMs', () => {
  it('soma o tempo decorrido desde o último polling quando está tocando', () => {
    expect(computeProgressMs(playing, 3500)).toBe(12500);
  });

  it('mantém a posição parada quando está pausado', () => {
    expect(computeProgressMs({ ...playing, isPlaying: false }, 9000)).toBe(10000);
  });

  it('nunca passa da duração da faixa', () => {
    expect(computeProgressMs(playing, 999_999)).toBe(200000);
  });

  it('não volta no tempo se o relógio vier antes do polling', () => {
    expect(computeProgressMs(playing, 500)).toBe(10000);
  });
});

describe('progressRatio', () => {
  it('devolve a fração entre 0 e 1', () => {
    expect(progressRatio(50000, 200000)).toBe(0.25);
  });

  it('devolve 0 quando a duração é desconhecida', () => {
    expect(progressRatio(50000, 0)).toBe(0);
  });
});

describe('positionFromClick', () => {
  const bar = { left: 100, width: 200 };

  it('converte o clique na barra em milissegundos', () => {
    expect(positionFromClick(150, bar, 200000)).toBe(50000);
  });

  it('limita cliques fora da barra', () => {
    expect(positionFromClick(50, bar, 200000)).toBe(0);
    expect(positionFromClick(999, bar, 200000)).toBe(200000);
  });
});
