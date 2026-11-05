import { describe, it, expect } from 'vitest';
import { pickTheme } from '../../src/renderer/palette.js';

/** Monta um array RGBA (como o de getImageData) com `count` pixels da mesma cor. */
function solidPixels([red, green, blue], count = 16) {
  return Array.from({ length: count }, () => [red, green, blue, 255]).flat();
}

function lightnessOf(hsl) {
  return Number(/hsl\(\s*[\d.]+,\s*[\d.]+%,\s*([\d.]+)%\)/.exec(hsl)[1]);
}

describe('pickTheme', () => {
  it('gera fundo escuro e destaque claro para qualquer capa', () => {
    const theme = pickTheme(solidPixels([220, 60, 60]));
    expect(lightnessOf(theme.background)).toBeLessThan(32);
    expect(lightnessOf(theme.accent)).toBeGreaterThan(60);
  });

  it('mantém o matiz da capa (capa vermelha resulta em matiz vermelho)', () => {
    const theme = pickTheme(solidPixels([220, 40, 40]));
    expect(theme.background).toMatch(/^hsl\((0|3[0-9]{2}|[0-9]|1[0-9]),/);
  });

  it('capa preto e branco gera tema cinza, sem cor', () => {
    const theme = pickTheme(solidPixels([128, 128, 128]));
    expect(theme.background).toContain(', 0%,');
    expect(theme.accent).toContain(', 0%,');
  });

  it('dá mais peso a pixels coloridos do que a pixels cinza', () => {
    const grayAndBlue = [
      ...solidPixels([128, 128, 128], 12),
      ...solidPixels([30, 60, 220], 4),
    ];
    const theme = pickTheme(grayAndBlue);
    // O azul (matiz ~230) aparece mesmo sendo minoria.
    const hue = Number(/^hsl\(([\d.]+),/.exec(theme.background)[1]);
    expect(hue).toBeGreaterThan(200);
    expect(hue).toBeLessThan(260);
  });

  it('ignora pixels transparentes', () => {
    const pixels = [...solidPixels([200, 30, 30], 4), 0, 0, 255, 0, 0, 0, 255, 0];
    expect(pickTheme(pixels)).not.toBeNull();
  });

  it('usa só a cor dominante: capa com vermelho, azul e verde fica toda vermelha', () => {
    const redBlueGreen = [
      ...solidPixels([220, 40, 40], 8),
      ...solidPixels([40, 60, 220], 6),
      ...solidPixels([40, 200, 60], 4),
    ];
    const theme = pickTheme(redBlueGreen);
    for (const color of [theme.background, theme.accent, ...theme.colors]) {
      const hue = Number(/^hsl\(([\d.]+),/.exec(color)[1]);
      expect(Math.min(hue, 360 - hue)).toBeLessThan(15);
    }
  });

  it('a cor dominante é a que mais aparece, mesmo sendo verde no meio de azul e amarelo', () => {
    const theme = pickTheme([
      ...solidPixels([40, 200, 60], 10),
      ...solidPixels([40, 60, 220], 4),
      ...solidPixels([230, 210, 40], 4),
    ]);
    const hue = Number(/^hsl\(([\d.]+),/.exec(theme.background)[1]);
    expect(hue).toBeGreaterThan(110);
    expect(hue).toBeLessThan(140);
  });

  it('gera 3 cores de onda do mesmo matiz, de claras a mais claras', () => {
    const { colors } = pickTheme(solidPixels([40, 120, 220]));
    expect(colors).toHaveLength(3);
    const hues = colors.map((color) => /^hsl\((\d+),/.exec(color)[1]);
    expect(new Set(hues).size).toBe(1);
    const lightness = colors.map(lightnessOf);
    expect([...lightness].sort((a, b) => a - b)).toEqual(lightness);
  });

  it('capa preto e branco gera cores de onda sem matiz', () => {
    const { colors } = pickTheme(solidPixels([128, 128, 128]));
    expect(colors).toHaveLength(3);
    for (const color of colors) expect(color).toContain(', 0%,');
  });

  it('devolve null quando não há pixels utilizáveis', () => {
    expect(pickTheme([])).toBeNull();
    expect(pickTheme([10, 10, 10, 0])).toBeNull();
  });
});
