import { describe, it, expect } from 'vitest';
import { createStore } from '../../src/main/store.js';

function fakeFs(initialContent) {
  let content = initialContent;
  return {
    readFileSync: () => {
      if (content === undefined) throw new Error('ENOENT');
      return content;
    },
    writeFileSync: (_path, value) => (content = value),
    mkdirSync: () => {},
    current: () => content,
  };
}

describe('createStore', () => {
  it('devolve undefined para chave inexistente quando o arquivo não existe', () => {
    const store = createStore({ filePath: 'x/store.json', fs: fakeFs(undefined) });
    expect(store.get('tokens')).toBeUndefined();
  });

  it('persiste e lê valores', () => {
    const fs = fakeFs(undefined);
    createStore({ filePath: 'x/store.json', fs }).set('bounds', { width: 340 });
    expect(createStore({ filePath: 'x/store.json', fs }).get('bounds')).toEqual({
      width: 340,
    });
  });

  it('ignora arquivo corrompido em vez de quebrar o app', () => {
    const store = createStore({ filePath: 'x/store.json', fs: fakeFs('{quebrado') });
    expect(store.get('tokens')).toBeUndefined();
  });

  it('preserva as outras chaves ao gravar uma', () => {
    const fs = fakeFs(JSON.stringify({ tokens: { accessToken: 'a' } }));
    const store = createStore({ filePath: 'x/store.json', fs });
    store.set('bounds', { width: 1 });
    expect(JSON.parse(fs.current())).toEqual({
      tokens: { accessToken: 'a' },
      bounds: { width: 1 },
    });
  });
});
