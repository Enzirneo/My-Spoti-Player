// Persistência simples em JSON (posição da janela e tokens), na pasta de dados do usuário.
import nodeFs from 'node:fs';
import { dirname } from 'node:path';

export function createStore({ filePath, fs = nodeFs }) {
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      // Arquivo ausente ou corrompido: começa vazio em vez de impedir o app de abrir.
      return {};
    }
  }

  return {
    get: (key) => readAll()[key],
    set(key, value) {
      fs.mkdirSync(dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ ...readAll(), [key]: value }, null, 2));
    },
  };
}
