import { describe, it, expect } from 'vitest';
import { isTap } from '../../src/renderer/drag.js';

describe('isTap', () => {
  it('é toque quando o mouse não saiu do lugar', () => {
    expect(isTap({ x: 100, y: 50 }, { x: 100, y: 50 })).toBe(true);
  });

  it('tolera um tremidinha pequena', () => {
    expect(isTap({ x: 100, y: 50 }, { x: 102, y: 49 })).toBe(true);
  });

  it('é arrasto quando o mouse andou além do limite', () => {
    expect(isTap({ x: 100, y: 50 }, { x: 110, y: 50 })).toBe(false);
    expect(isTap({ x: 100, y: 50 }, { x: 100, y: 62 })).toBe(false);
  });

  it('mede a distância na diagonal', () => {
    expect(isTap({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(false);
  });
});
