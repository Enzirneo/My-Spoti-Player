import { describe, it, expect } from 'vitest';
import {
  describePlayback,
  describeDevices,
  describeRecent,
} from '../../src/main/debug-describe.js';

describe('describePlayback', () => {
  it('descreve ausência de sessão', () => {
    expect(describePlayback(null)).toBe('sem sessão (204)');
  });

  it('descreve música, estado e dispositivo', () => {
    const playback = {
      is_playing: false,
      item: { name: 'Song' },
      device: { name: 'PC', type: 'Computer', is_active: true },
    };
    expect(describePlayback(playback)).toBe(
      '"Song" tocando=false dispositivo=PC/Computer/ativo=true'
    );
  });
});

describe('describeDevices', () => {
  it('lista os dispositivos ou avisa que não há nenhum', () => {
    expect(describeDevices([])).toBe('nenhum dispositivo');
    expect(describeDevices([{ name: 'PC', type: 'Computer', is_active: false }])).toBe(
      'PC/Computer/ativo=false'
    );
  });
});

describe('describeRecent', () => {
  it('descreve a faixa e quando foi tocada', () => {
    expect(
      describeRecent({ track: { name: 'S' }, played_at: '2026-01-01T00:00:00Z' })
    ).toBe('"S" tocada em 2026-01-01T00:00:00Z');
    expect(describeRecent(null)).toBe('histórico vazio');
  });
});
