// Animação local da barra de progresso. A API só é consultada a cada ~1,5 s;
// entre uma resposta e outra, a posição é calculada a partir do relógio.

/** Posição atual em ms, extrapolada a partir do último estado recebido. */
export function computeProgressMs(state, now) {
  if (!state.isPlaying) return state.progressMs;
  const elapsedMs = Math.max(0, now - state.receivedAt);
  return Math.min(state.track.durationMs, state.progressMs + elapsedMs);
}

export function progressRatio(progressMs, durationMs) {
  if (!durationMs) return 0;
  return Math.min(1, Math.max(0, progressMs / durationMs));
}

/** Converte a posição do clique (clientX) na barra em milissegundos da faixa. */
export function positionFromClick(clientX, barRect, durationMs) {
  const ratio = (clientX - barRect.left) / barRect.width;
  return Math.round(Math.min(1, Math.max(0, ratio)) * durationMs);
}

/** Chama `onFrame(progressMs)` a cada frame em que a posição mudou (estado 'ready'). */
export function startProgressLoop({ getState, onFrame }) {
  let lastFrameMs = -1;
  function tick() {
    const state = getState();
    const progressMs =
      state?.status === 'ready' ? computeProgressMs(state, Date.now()) : -1;
    // Pausado ou sem mudança: não mexe no DOM.
    if (progressMs >= 0 && progressMs !== lastFrameMs) onFrame(progressMs);
    lastFrameMs = progressMs;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
