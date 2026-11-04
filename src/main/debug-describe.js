// Resumos curtos (sem dados sensíveis) das respostas da API, para o log de diagnóstico.

function describeDevice(device) {
  return `${device.name}/${device.type}/ativo=${device.is_active}`;
}

export function describePlayback(playback) {
  if (!playback) return 'sem sessão (204)';
  const item = playback.item ? `"${playback.item.name}"` : 'sem item';
  const device = playback.device ? describeDevice(playback.device) : 'sem dispositivo';
  return `${item} tocando=${playback.is_playing} dispositivo=${device}`;
}

export function describeDevices(devices) {
  return devices.length ? devices.map(describeDevice).join(' | ') : 'nenhum dispositivo';
}

export function describeIdle(idle) {
  if (!idle?.media) return 'sem música no Windows';
  const apiResult = idle.found ? 'achou na API' : 'não achou na API';
  return `Windows: "${idle.media.title}" - ${idle.media.artist}; ${apiResult}`;
}
