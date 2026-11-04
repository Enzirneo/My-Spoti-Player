import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  generatePkcePair,
  buildAuthorizeUrl,
  refreshAccessToken,
  createTokenManager,
  REDIRECT_URI,
  SCOPES,
} from '../../src/main/auth.js';

function tokenResponse(body, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body };
}

describe('generatePkcePair', () => {
  it('gera challenge = base64url(sha256(verifier))', () => {
    const { verifier, challenge } = generatePkcePair();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('gera verifier com tamanho válido (43 a 128) e só caracteres seguros', () => {
    const { verifier } = generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('buildAuthorizeUrl', () => {
  it('monta a URL com PKCE, redirect, state e todos os scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'cid', challenge: 'chal', state: 'st' })
    );
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('scope')).toBe(SCOPES.join(' '));
  });
});

describe('refreshAccessToken', () => {
  it('envia grant_type refresh_token sem client secret', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(tokenResponse({ access_token: 'new', expires_in: 3600 }));
    await refreshAccessToken({ clientId: 'cid', refreshToken: 'old', fetch: fetchMock });

    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old');
    expect(body.get('client_id')).toBe('cid');
    expect(body.has('client_secret')).toBe(false);
  });

  it('mantém o refresh token antigo quando a API não devolve um novo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(tokenResponse({ access_token: 'new', expires_in: 3600 }));
    const tokens = await refreshAccessToken({
      clientId: 'c',
      refreshToken: 'old',
      fetch: fetchMock,
      now: () => 1000,
    });
    expect(tokens).toEqual({
      accessToken: 'new',
      refreshToken: 'old',
      expiresAt: 1000 + 3600 * 1000,
    });
  });

  it('lança erro quando a API recusa o refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(tokenResponse({ error: 'invalid_grant' }, false));
    await expect(
      refreshAccessToken({ clientId: 'c', refreshToken: 'x', fetch: fetchMock })
    ).rejects.toThrow('invalid_grant');
  });
});

describe('createTokenManager', () => {
  function memoryStore(initial = {}) {
    const data = { ...initial };
    return { get: (key) => data[key], set: (key, value) => (data[key] = value) };
  }

  it('devolve null quando não há tokens salvos', async () => {
    const manager = createTokenManager({
      store: memoryStore(),
      clientId: 'c',
      fetch: vi.fn(),
    });
    expect(await manager.getAccessToken()).toBeNull();
  });

  it('reutiliza o access token enquanto não está perto de expirar', async () => {
    const store = memoryStore({
      tokens: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: 100000,
        scope: SCOPES.join(' '),
      },
    });
    const fetchMock = vi.fn();
    const manager = createTokenManager({
      store,
      clientId: 'c',
      fetch: fetchMock,
      now: () => 0,
    });
    expect(await manager.getAccessToken()).toBe('a');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renova e salva o token quando está expirando', async () => {
    const store = memoryStore({
      tokens: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: 5000,
        scope: SCOPES.join(' '),
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(tokenResponse({ access_token: 'b', expires_in: 3600 }));
    const manager = createTokenManager({
      store,
      clientId: 'c',
      fetch: fetchMock,
      now: () => 4000,
    });

    expect(await manager.getAccessToken()).toBe('b');
    expect(store.get('tokens').accessToken).toBe('b');
  });

  it('força a renovação com forceRefresh mesmo com token válido', async () => {
    const store = memoryStore({
      tokens: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: 1e12,
        scope: SCOPES.join(' '),
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(tokenResponse({ access_token: 'b', expires_in: 3600 }));
    const manager = createTokenManager({ store, clientId: 'c', fetch: fetchMock });
    expect(await manager.getAccessToken({ forceRefresh: true })).toBe('b');
  });

  it('apaga os tokens e devolve null quando o refresh é recusado', async () => {
    const store = memoryStore({
      tokens: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: 0,
        scope: SCOPES.join(' '),
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(tokenResponse({ error: 'invalid_grant' }, false));
    const manager = createTokenManager({ store, clientId: 'c', fetch: fetchMock });

    expect(await manager.getAccessToken()).toBeNull();
    expect(store.get('tokens')).toBeNull();
  });

  it('mantém os tokens quando o refresh falha por rede', async () => {
    const store = memoryStore({
      tokens: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: 0,
        scope: SCOPES.join(' '),
      },
    });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    const manager = createTokenManager({ store, clientId: 'c', fetch: fetchMock });

    await expect(manager.getAccessToken()).rejects.toThrow('offline');
    expect(store.get('tokens')).not.toBeNull();
  });
});

describe('escopos salvos', () => {
  it('trata login antigo (sem os escopos atuais) como não logado', async () => {
    const store = {
      data: {
        tokens: {
          accessToken: 'a',
          refreshToken: 'r',
          expiresAt: 1e12,
          scope: 'user-library-read',
        },
      },
      get(key) {
        return this.data[key];
      },
      set(key, value) {
        this.data[key] = value;
      },
    };
    const manager = createTokenManager({ store, clientId: 'c', fetch: vi.fn() });
    expect(manager.isLoggedIn()).toBe(false);
    expect(await manager.getAccessToken()).toBeNull();
  });

  it('aceita login com todos os escopos atuais', async () => {
    const tokens = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1e12,
      scope: SCOPES.join(' '),
    };
    const store = { get: () => tokens, set: () => {} };
    const manager = createTokenManager({ store, clientId: 'c', fetch: vi.fn() });
    expect(manager.isLoggedIn()).toBe(true);
  });
});
