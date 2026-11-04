// Spotify aberto, mas sem sessão ativa: descobre o dispositivo do computador.
import { COMPUTER_TYPE } from './wake.js';

/** Devolve o dispositivo do computador, ou null se o Spotify dele não está aberto. */
export async function findIdleDevice({ getDevices }) {
  const devices = await getDevices();
  return devices.find((device) => device.type === COMPUTER_TYPE) ?? null;
}
