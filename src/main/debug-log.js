// Log de diagnóstico local (sem tokens): o que a API do Spotify respondeu em cada etapa.
// Fica na pasta de dados do usuário e é recriado a cada execução.
import nodeFs from 'node:fs';
import { dirname } from 'node:path';

const MAX_LINES = 1000;

export function createDebugLog({
  filePath,
  fs = nodeFs,
  now = () => new Date(),
  maxLines = MAX_LINES,
}) {
  let lineCount = 0;
  const lastLineByKey = new Map();

  function safely(action) {
    try {
      action();
    } catch {
      // Diagnóstico nunca pode atrapalhar o app.
    }
  }

  safely(() => {
    fs.mkdirSync(dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '');
  });

  function write(line) {
    if (lineCount >= maxLines) return;
    lineCount += 1;
    safely(() => fs.appendFileSync(filePath, `${now().toISOString()} ${line}\n`));
  }

  /** Grava só quando a linha muda para aquela chave (evita encher o log a cada polling). */
  function writeIfChanged(key, line) {
    if (lastLineByKey.get(key) === line) return;
    lastLineByKey.set(key, line);
    write(`[${key}] ${line}`);
  }

  return { write, writeIfChanged };
}
