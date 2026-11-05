import { describe, it, expect } from 'vitest';
import { describePlayback, describeDevices } from '../../src/main/debug-describe.js';

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
