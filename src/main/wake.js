// Abre o app do Spotify (se preciso) e espera o computador aparecer como dispositivo.

const WAKE_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 1000;
export const COMPUTER_TYPE = 'Computer';
// Erros que não adianta tentar de novo (login expirado, limite de requisições).
export const FATAL_KINDS = ['unauthorized', 'rate-limited'];

function sleepFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Devolve true se o Spotify do computador já está na lista de dispositivos. */
async function isComputerListed(getDevices) {
  try {
    return (await getDevices()).some((device) => device.type === COMPUTER_TYPE);
  } catch (error) {
    if (FATAL_KINDS.includes(error.kind)) throw error;
    // Falha passageira (ex.: rede): tenta de novo no próximo ciclo.
    return false;
  }
}

export async function launchSpotify({
  getDevices,
  launch,
  sleep = sleepFor,
  now = Date.now,
  timeoutMs = WAKE_TIMEOUT_MS,
}) {
  const deadline = now() + timeoutMs;
  let hasLaunched = false;

  while (now() < deadline) {
    if (await isComputerListed(getDevices)) return;

    if (!hasLaunched) {
      hasLaunched = true;
      await launch(); // se falhar (Spotify não instalado), o erro sobe para a UI
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('wake_timeout');
}
