// Freio para a Web API: teto de pedidos por janela de tempo e bloqueio total depois de
// um 429. Sem Electron e sem DOM: o relógio é injetado para testar.

const DEFAULT_MAX_REQUESTS = 25;
const DEFAULT_WINDOW_MS = 30000;
const BACKOFF_BASE_MS = 3000;
const BACKOFF_MAX_MS = 60000;

export function createRequestGuard({
  now = Date.now,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
} = {}) {
  let sentAt = []; // quando saíram os pedidos que ainda contam na janela
  let blockedUntil = 0;
  const listeners = [];

  return {
    /** Devolve 0 e registra o pedido se pode sair; senão, quantos ms esperar. */
    acquire() {
      const current = now();
      if (current < blockedUntil) return blockedUntil - current;

      sentAt = sentAt.filter((time) => current - time < windowMs);
      if (sentAt.length >= maxRequests) return sentAt[0] + windowMs - current;

      sentAt.push(current);
      return 0;
    },

    /** Para tudo por `durationMs` (o Spotify mandou esperar). Nunca encurta um bloqueio. */
    block(durationMs) {
      const until = now() + durationMs;
      if (until <= blockedUntil) return;
      blockedUntil = until;
      listeners.forEach((listener) => listener(until));
    },

    /** Retoma um bloqueio salvo antes de o app fechar. */
    restore(until) {
      if (Number.isFinite(until) && until > blockedUntil) blockedUntil = until;
    },

    listen: (listener) => listeners.push(listener),
  };
}

/** Espera antes de tentar de novo depois de `failures` falhas seguidas: dobra até um teto. */
export function backoffDelayMs(failures) {
  return Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
}
