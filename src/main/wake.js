// Abre o Spotify do computador (se preciso) e transfere a reprodução para ele
// sem dar play, para o mini player já mostrar o que estava tocando.

const WAKE_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 1000;
const COMPUTER_TYPE = 'Computer';
// Erros que não adianta tentar de novo (login expirado, limite de requisições).
const FATAL_KINDS = ['unauthorized', 'rate-limited'];

function sleepFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function wakeSpotify({
  getDevices,
  transfer,
  launch,
  sleep = sleepFor,
  now = Date.now,
  timeoutMs = WAKE_TIMEOUT_MS,
}) {
  const deadline = now() + timeoutMs;
  let hasLaunched = false;

  while (now() < deadline) {
    const isDone = await tryTransfer({ getDevices, transfer });
    if (isDone) return;

    if (!hasLaunched) {
      hasLaunched = true;
      await launch(); // se falhar (Spotify não instalado), o erro sobe para a UI
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('wake_timeout');
}

/** Devolve true se transferiu para o computador; false se ainda não dá. */
async function tryTransfer({ getDevices, transfer }) {
  try {
    const computer = (await getDevices()).find((device) => device.type === COMPUTER_TYPE);
    if (!computer) return false;
    await transfer(computer.id);
    return true;
  } catch (error) {
    if (FATAL_KINDS.includes(error.kind)) throw error;
    // Falha passageira (ex.: o Spotify ainda carregando): tenta no próximo ciclo.
    return false;
  }
}
