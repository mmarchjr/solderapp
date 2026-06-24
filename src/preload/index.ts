import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  serial: {
    getPorts: () => ipcRenderer.invoke('serial:get-ports'),
    selectPort: (portId: string) => ipcRenderer.send('serial:select-port', portId)
  },
  optimizer: {
    start: (data: unknown) => ipcRenderer.invoke('optimize:start', data),
    pause: () => ipcRenderer.send('optimize:pause'),
    resume: () => ipcRenderer.send('optimize:resume'),
    cancel: () => ipcRenderer.send('optimize:cancel'),
    onUpdate: (cb: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => cb(data)
      ipcRenderer.on('optimize:update', handler)
      return () => ipcRenderer.removeListener('optimize:update', handler)
    },
    onDone: (cb: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => cb(data)
      ipcRenderer.on('optimize:done', handler)
      return () => ipcRenderer.removeListener('optimize:done', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
