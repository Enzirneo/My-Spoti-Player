// Modo híbrido (Windows): o que muda o tempo todo (tocando, posição, música atual) vem da
// sessão de mídia do sistema, de graça. A Web API só entra para o que o sistema não dá
// (capa, volume, shuffle, repeat, curtir) e uma vez por música, não a cada polling.
// Devolve o estado no formato da Web API, como o resto do app espera.

const DETAILS_REFRESH_MS = 60_000; // mantém volume/shuffle/repeat em dia enquanto toca
const RETRY_AFTER_ERROR_MS = 30_000;
const RETRY_AFTER_MISMATCH_MS = 5_000; // a API ainda mostra a música anterior

// Comandos que o sistema executa; qualquer falha cai para a API.
const SYSTEM_COMMANDS = ['play', 'pause', 'next', 'previous', 'seek'];
const TRACK_CHANGING_COMMANDS = ['next', 'previous'];

const trackKey = (media) => `${media.title}|${media.artist}`;
const simplify = (text) => text.toLowerCase().trim();

function itemFromMedia(media) {
  return {
    id: `media:${trackKey(media)}`,
    type: 'track',
    is_local: true, // sem id da API: sem curtir nem link
    name: media.title,
    artists: [{ name: media.artist }],
    album: { name: media.album, images: [] },
    duration_ms: media.durationMs,
  };
}

export function createHybridSpotify({ api, readMedia, controlMedia, now = Date.now }) {
  // { key, raw (resposta da API ou null), at, retryAt }
  let details = null;

  async function refreshDetails(media, key) {
    try {
      const raw = await api.call('getPlayback');
      const isSameTrack = raw?.item && simplify(raw.item.name) === simplify(media.title);
      details = isSameTrack
        ? { key, raw, at: now() }
        : { key, raw: null, retryAt: now() + RETRY_AFTER_MISMATCH_MS };
    } catch {
      // Sem API (limite, rede, sem login) o app continua mostrando o que o sistema sabe.
      details = { key, raw: null, retryAt: now() + RETRY_AFTER_ERROR_MS };
    }
  }

  function needsRefresh(media, key) {
    if (details?.key !== key) return true;
    if (!details.raw) return now() >= details.retryAt;
    return media.isPlaying && now() - details.at >= DETAILS_REFRESH_MS;
  }

  function compose(media) {
    const raw = details?.raw;
    return {
      is_playing: media.isPlaying,
      progress_ms: media.positionMs,
      shuffle_state: raw?.shuffle_state ?? false,
      repeat_state: raw?.repeat_state ?? 'off',
      device: {
        volume_percent: raw?.device?.volume_percent ?? 0,
        supports_volume: Boolean(raw?.device?.supports_volume),
      },
      item: raw?.item ?? itemFromMedia(media),
    };
  }

  async function getPlayback() {
    const media = await readMedia();
    if (!media) {
      details = null;
      return api.call('getPlayback'); // sem sessão: a API diz se é "fechado" ou "ocioso"
    }

    const key = trackKey(media);
    if (needsRefresh(media, key)) await refreshDetails(media, key);
    return compose(media);
  }

  /** Reflete na tela o que o usuário acabou de pedir, sem outra leitura da API. */
  function patchDetails(name, payload) {
    if (!details?.raw) return;
    const { raw } = details;
    if (name === 'setVolume')
      raw.device = { ...raw.device, volume_percent: payload.percent };
    if (name === 'setShuffle') raw.shuffle_state = payload.isShuffled;
    if (name === 'setRepeat') raw.repeat_state = payload.mode;
  }

  async function call(name, payload = {}) {
    if (name === 'getPlayback') return getPlayback();

    if (SYSTEM_COMMANDS.includes(name)) {
      try {
        await controlMedia(name, payload);
        if (TRACK_CHANGING_COMMANDS.includes(name)) details = null;
        return null;
      } catch {
        // Sistema não obedeceu: tenta pela API.
      }
    }

    const result = await api.call(name, payload);
    patchDetails(name, payload);
    return result;
  }

  return { call };
}
