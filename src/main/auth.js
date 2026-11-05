// OAuth 2.0 com PKCE (sem client secret) e renovação automática do access token.
import { createHash, randomBytes } from 'node:crypto';

export const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
export const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'user-library-modify',
];

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const VERIFIER_BYTES = 64;
const MS_PER_SECOND = 1000;
// Renova um pouco antes de expirar para não falhar no meio de uma chamada.
const EXPIRY_MARGIN_MS = 60 * MS_PER_SECOND;

export function generatePkcePair() {
  const verifier = randomBytes(VERIFIER_BYTES).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState() {
  return randomBytes(16).toString('base64url');
}

export function buildAuthorizeUrl({ clientId, challenge, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES.join(' '),
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/** A API de tokens recusou o pedido (ex.: refresh token revogado). */
export class TokenRejectedError extends Error {}

async function requestTokens({ params, fetch = globalThis.fetch, now = Date.now }) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.json();
  if (!response.ok)
    throw new TokenRejectedError(body.error_description ?? body.error ?? 'token_error');
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now() + body.expires_in * MS_PER_SECOND,
  };
}

export function exchangeCodeForTokens({ clientId, code, verifier, ...deps }) {
  return requestTokens({
    ...deps,
    params: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    },
  });
}

export async function refreshAccessToken({ clientId, refreshToken, ...deps }) {
  const tokens = await requestTokens({
    ...deps,
    params: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    },
  });
  // O Spotify nem sempre devolve um refresh token novo; nesse caso vale o antigo.
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}

/**
 * Guarda os tokens no `store` e entrega sempre um access token válido.
 * Retorna null quando o usuário precisa fazer login de novo.
 */
export function createTokenManager({ store, clientId, fetch, now = Date.now }) {
  let pendingRefresh = null;

  async function refresh(tokens) {
    try {
      const renewed = await refreshAccessToken({
        clientId,
        refreshToken: tokens.refreshToken,
        fetch,
        now,
      });
      store.set('tokens', renewed);
      return renewed.accessToken;
    } catch (error) {
      // Erro de rede não invalida o login; só a recusa explícita da API.
      if (!(error instanceof TokenRejectedError)) throw error;
      store.set('tokens', null);
      return null;
    }
  }

  async function getAccessToken({ forceRefresh = false } = {}) {
    const tokens = store.get('tokens');
    if (!tokens) return null;
    if (!forceRefresh && tokens.expiresAt - now() > EXPIRY_MARGIN_MS)
      return tokens.accessToken;

    // Várias chamadas simultâneas compartilham o mesmo refresh em andamento.
    pendingRefresh ??= refresh(tokens).finally(() => (pendingRefresh = null));
    return pendingRefresh;
  }

  return {
    getAccessToken,
    saveTokens: (tokens) => store.set('tokens', tokens),
    clearTokens: () => store.set('tokens', null),
    isLoggedIn: () => Boolean(store.get('tokens')),
  };
}
