// Troca suave entre duas janelas: a nova aparece e a antiga some em poucos milissegundos,
// para o salto entre os modos não parecer um piscar.
const DEFAULT_DURATION_MS = 140;
const DEFAULT_STEP_MS = 16;

/**
 * Devolve { finish }: termina o fade na hora (usado se o usuário trocar de modo de novo
 * antes de acabar). `onDone` roda uma vez, quando o fade termina, para fechar a antiga.
 */
export function crossfade({
  from,
  to,
  onDone,
  durationMs = DEFAULT_DURATION_MS,
  stepMs = DEFAULT_STEP_MS,
}) {
  const setOpacity = (window, value) => {
    if (!window.isDestroyed()) window.setOpacity(value);
  };

  let elapsedMs = 0;
  let isDone = false;

  function finish() {
    if (isDone) return;
    isDone = true;
    clearInterval(timer);
    setOpacity(to, 1);
    setOpacity(from, 0);
    onDone();
  }

  setOpacity(to, 0);
  const timer = setInterval(() => {
    elapsedMs += stepMs;
    if (elapsedMs >= durationMs) return finish();
    const progress = elapsedMs / durationMs;
    setOpacity(to, progress);
    setOpacity(from, 1 - progress);
  }, stepMs);

  return { finish };
}
