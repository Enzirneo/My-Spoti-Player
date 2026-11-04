// Spotify aberto, mas sem sessão ativa na API: reúne o que dá para saber localmente.
import { matchSearchResult } from '../shared/state.js';
import { COMPUTER_TYPE, FATAL_KINDS } from './wake.js';

/**
 * Devolve uma função que resolve o estado ocioso:
 * null (Spotify do computador fechado) ou { device, media, found }.
 */
export function createIdleResolver({ getDevices, readMedia, searchTracks }) {
  const foundByMedia = new Map(); // evita buscar de novo a mesma música a cada polling

  async function findTrack(media) {
    const key = `${media.title}|${media.artist}`;
    if (foundByMedia.has(key)) return foundByMedia.get(key);

    try {
      const items = await searchTracks({ title: media.title, artist: media.artist });
      const found = matchSearchResult(items, media);
      foundByMedia.set(key, found);
      return found;
    } catch (error) {
      if (FATAL_KINDS.includes(error.kind)) throw error;
      // Sem busca ainda dá para mostrar o texto lido do Windows (só sem capa e curtir).
      return null;
    }
  }

  return async function resolveIdle() {
    const device = (await getDevices()).find(
      (candidate) => candidate.type === COMPUTER_TYPE
    );
    if (!device) return null;

    const media = await readMedia();
    return { device, media, found: media ? await findTrack(media) : null };
  };
}
