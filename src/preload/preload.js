// Única ponte entre o renderer e o main. Expõe só funções específicas em
// `window.api`; o renderer nunca recebe `ipcRenderer` nem Node.
const { contextBridge, ipcRenderer } = require('electron');

const call = (name, payload) => ipcRenderer.invoke('spotify:call', name, payload);

contextBridge.exposeInMainWorld('api', {
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  quitApp: () => ipcRenderer.invoke('window:quit'),
  getWindowMode: () => ipcRenderer.invoke('window:get-mode'),
  setWindowMode: (mode) => ipcRenderer.invoke('window:set-mode', mode),

  launchSpotify: () => ipcRenderer.invoke('spotify:launch'),
  getIdleSession: () => ipcRenderer.invoke('spotify:idle'),

  getPlayback: () => call('getPlayback'),
  play: () => call('play'),
  resumeOnDevice: (deviceId) => call('transferPlayback', { deviceId, shouldPlay: true }),
  pause: () => call('pause'),
  next: () => call('next'),
  previous: () => call('previous'),
  seek: (positionMs) => call('seek', { positionMs }),
  setVolume: (percent) => call('setVolume', { percent }),
  setShuffle: (isShuffled) => call('setShuffle', { isShuffled }),
  setRepeat: (mode) => call('setRepeat', { mode }),
  isTrackLiked: (trackUri) => call('isTrackLiked', { trackUri }),
  setTrackLiked: (trackUri, isLiked) => call('setTrackLiked', { trackUri, isLiked }),
});
