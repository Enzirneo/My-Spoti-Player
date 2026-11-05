const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** Converte milissegundos em "m:ss" (ou "h:mm:ss"). Valores inválidos viram "0:00". */
export function msToClock(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';

  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  if (totalMinutes < MINUTES_PER_HOUR) return `${totalMinutes}:${seconds}`;

  const minutes = String(totalMinutes % MINUTES_PER_HOUR).padStart(2, '0');
  return `${Math.floor(totalMinutes / MINUTES_PER_HOUR)}:${minutes}:${seconds}`;
}
