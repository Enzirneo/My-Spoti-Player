// Servidor HTTP temporário que captura o código do OAuth no redirect do Spotify.
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 8888;
const CALLBACK_PATH = '/callback';
const TIMEOUT_MS = 2 * 60 * 1000;

const PAGE_OK = '<h3>Login concluído. Pode fechar esta aba.</h3>';
const PAGE_FAIL = '<h3>Não foi possível concluir o login.</h3>';

/**
 * Sobe o servidor, espera o redirect e devolve o `code`.
 * Rejeita se o `state` não bater, se o usuário negar ou se estourar o tempo.
 */
export function waitForAuthCode({ expectedState, timeoutMs = TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://${HOST}:${PORT}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get('code');
      const isValid = url.searchParams.get('state') === expectedState && Boolean(code);
      res.writeHead(isValid ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(isValid ? PAGE_OK : PAGE_FAIL);

      finish(
        isValid ? null : new Error(url.searchParams.get('error') ?? 'invalid_state'),
        code
      );
    });

    const timer = setTimeout(() => finish(new Error('login_timeout')), timeoutMs);

    function finish(error, code) {
      clearTimeout(timer);
      server.close();
      if (error) reject(error);
      else resolve(code);
    }

    server.once('error', (error) => finish(error));
    server.listen(PORT, HOST);
  });
}
