// Spotify aberto, mas sem sessão ativa: descobre o dispositivo e a última música tocada.
import { COMPUTER_TYPE, FATAL_KINDS } from './wake.js';

/** Devolve null (Spotify do computador fechado) ou { device, recent }. */
export async function findIdleSession({ getDevices, getRecentlyPlayed }) {
  const device = (await getDevices()).find(
    (candidate) => candidate.type === COMPUTER_TYPE
  );
  if (!device) return null;

  try {
    return { device, recent: await getRecentlyPlayed() };
  } catch (error) {
    if (FATAL_KINDS.includes(error.kind)) throw error;
    // Sem permissão de histórico ou falha passageira: ainda dá para tocar, só sem a capa.
    return { device, recent: null };
  }
}
