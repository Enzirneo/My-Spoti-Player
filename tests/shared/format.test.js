import { describe, it, expect } from 'vitest';
import { msToClock } from '../../src/shared/format.js';

describe('msToClock', () => {
  it('formata minutos e segundos', () => {
    expect(msToClock(94000)).toBe('1:34');
  });

  it('completa segundos com zero à esquerda', () => {
    expect(msToClock(61000)).toBe('1:01');
  });

  it('inclui horas quando passa de 60 minutos', () => {
    expect(msToClock(3_725_000)).toBe('1:02:05');
  });

  it('retorna 0:00 para valor negativo ou inválido', () => {
    expect(msToClock(-5)).toBe('0:00');
    expect(msToClock(undefined)).toBe('0:00');
    expect(msToClock(NaN)).toBe('0:00');
  });
});
