// Transforma a resposta crua de GET /me/player no estado que a UI consome.
// Estado "status": 'ready' | 'empty' (sessão sem música) | 'idle' (Spotify aberto sem
// sessão) | 'no-device' (Spotify fechado).

const REPEAT_CYCLE = ['off', 'context', 'track'];

export function nextRepeatMode(currentMode) {
  const index = REPEAT_CYCLE.indexOf(currentMode);
  return REPEAT_CYCLE[(index + 1) % REPEAT_CYCLE.length];
}

function pickCoverUrl(images) {
  // A API ordena da maior para a menor imagem.
  return images?.[0]?.url ?? '';
}

function normalizeTrack(item) {
  const isTrack = item.type === 'track';
  const source = isTrack ? item.album : item.show;
  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    artists: (item.artists ?? []).map((artist) => artist.name).join(', '),
    album: source?.name ?? '',
    coverUrl: pickCoverUrl(source?.images),
    durationMs: item.duration_ms ?? 0,
    shareUrl: item.external_urls?.spotify ?? '',
    // Episódios e arquivos locais não podem ser curtidos via /me/tracks.
    isLikeable: isTrack && !item.is_local,
  };
}

export function normalizePlayback(apiPlayback, receivedAt) {
  if (!apiPlayback) return { status: 'no-device', receivedAt };
  if (!apiPlayback.item) return { status: 'empty', receivedAt };

  return {
    status: 'ready',
    receivedAt,
    isPlaying: Boolean(apiPlayback.is_playing),
    progressMs: apiPlayback.progress_ms ?? 0,
    isShuffled: Boolean(apiPlayback.shuffle_state),
    repeatMode: apiPlayback.repeat_state ?? 'off',
    volume: apiPlayback.device?.volume_percent ?? 0,
    canSetVolume: Boolean(apiPlayback.device?.supports_volume),
    track: normalizeTrack(apiPlayback.item),
  };
}

/** Minúsculas e sem sufixos entre parênteses/colchetes: "Song (feat. X)" vira "song". */
function simplifyTitle(title) {
  return title
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, '')
    .trim();
}

/** Acha, nos resultados da busca, a faixa que corresponde à música lida do Windows. */
export function matchSearchResult(items, media) {
  const wantedTitle = simplifyTitle(media.title);
  const wantedArtist = media.artist.toLowerCase();

  return (
    items.find((item) => {
      const title = simplifyTitle(item.name);
      const isSameTitle = title === wantedTitle || title.includes(wantedTitle);
      const isSameArtist = (item.artists ?? []).some((artist) =>
        wantedArtist.includes(artist.name.toLowerCase())
      );
      return isSameTitle && isSameArtist;
    }) ?? null
  );
}

function trackFromMedia(media) {
  return {
    id: `media:${media.title}|${media.artist}`,
    name: media.title,
    artists: media.artist,
    album: media.album,
    coverUrl: '',
    durationMs: media.durationMs,
    shareUrl: '',
    isLikeable: false,
  };
}

/**
 * Spotify aberto no computador, mas sem sessão na API.
 * `media` é o que o app tem carregado (lido do Windows); `found` é a faixa
 * correspondente na API (dá capa, id e link). Sem `media`, só dá para pedir "Tocar".
 */
export function normalizeIdle({ device, media, found }, receivedAt) {
  if (!media) return { status: 'idle', deviceId: device.id, receivedAt };

  return {
    status: 'ready',
    isIdle: true,
    receivedAt,
    isPlaying: false,
    progressMs: media.positionMs,
    isShuffled: false,
    repeatMode: 'off',
    volume: device.volume_percent ?? 0,
    canSetVolume: false,
    deviceId: device.id,
    track: found ? normalizeTrack(found) : trackFromMedia(media),
  };
}

/**
 * Devolve uma cópia do estado já refletindo o que o usuário acabou de pedir,
 * sem esperar a API. O próximo polling corrige se a API discordar.
 */
export function applyOptimistic(state, action, value) {
  const patches = {
    togglePlay: { isPlaying: !state.isPlaying },
    toggleShuffle: { isShuffled: !state.isShuffled },
    cycleRepeat: { repeatMode: nextRepeatMode(state.repeatMode) },
    setVolume: { volume: value },
    seek: { progressMs: value },
  };
  return { ...state, ...patches[action], receivedAt: Date.now() };
}
