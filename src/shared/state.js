// Transforma a resposta crua de GET /me/player no estado que a UI consome.
// Estado "status": 'ready' | 'empty' (dispositivo ativo, nada tocando) | 'no-device'.

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

/**
 * Spotify aberto mas sem sessão: mostra a última música tocada, pausada.
 * `isIdle` avisa a UI que só o play funciona até a sessão existir.
 */
export function normalizeIdle({ device, recent }, receivedAt) {
  if (!recent?.track) return { status: 'empty', receivedAt };

  return {
    status: 'ready',
    isIdle: true,
    receivedAt,
    isPlaying: false,
    progressMs: 0,
    isShuffled: false,
    repeatMode: 'off',
    volume: device.volume_percent ?? 0,
    canSetVolume: false,
    deviceId: device.id,
    contextUri: recent.context?.uri ?? null,
    track: normalizeTrack(recent.track),
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
