import { describe, it, expect } from 'vitest';
import { createDebugLog } from '../../src/main/debug-log.js';

function fakeFs() {
  const writes = [];
  return {
    writes,
    mkdirSync: () => {},
    writeFileSync: (_path, text) => writes.push(['write', text]),
    appendFileSync: (_path, text) => writes.push(['append', text]),
  };
}

describe('createDebugLog', () => {
  it('recomeça o arquivo a cada execução', () => {
    const fs = fakeFs();
    createDebugLog({ filePath: 'x/debug.log', fs });
    expect(fs.writes[0]).toEqual(['write', '']);
  });

  it('grava a linha com data/hora', () => {
    const fs = fakeFs();
    const log = createDebugLog({ filePath: 'x/debug.log', fs, now: () => new Date(0) });
    log.write('olá');
    expect(fs.writes[1][1]).toBe('1970-01-01T00:00:00.000Z olá\n');
  });

  it('não repete a mesma linha para a mesma chave', () => {
    const fs = fakeFs();
    const log = createDebugLog({ filePath: 'x/debug.log', fs });
    log.writeIfChanged('playback', 'a');
    log.writeIfChanged('playback', 'a');
    log.writeIfChanged('playback', 'b');
    expect(fs.writes.length).toBe(3); // truncate + a + b
  });

  it('para de gravar depois do limite de linhas', () => {
    const fs = fakeFs();
    const log = createDebugLog({ filePath: 'x/debug.log', fs, maxLines: 2 });
    log.write('1');
    log.write('2');
    log.write('3');
    expect(fs.writes.length).toBe(3); // truncate + 2 linhas
  });

  it('nunca deixa um erro de disco derrubar o app', () => {
    const fs = fakeFs();
    fs.appendFileSync = () => {
      throw new Error('disk');
    };
    const log = createDebugLog({ filePath: 'x/debug.log', fs });
    expect(() => log.write('x')).not.toThrow();
  });
});
