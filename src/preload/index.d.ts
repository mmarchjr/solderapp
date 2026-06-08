import { ElectronAPI } from '@electron-toolkit/preload'

interface SerialPortInfo {
  portId: string
  portName: string
  displayName: string
}

interface SerialApi {
  getPorts(): Promise<SerialPortInfo[]>
  selectPort(portId: string): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      serial: SerialApi
    }
  }
}
