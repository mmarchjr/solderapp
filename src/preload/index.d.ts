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

interface OptimizeUpdateData {
  bestPath: number[]
  bestCost: number
  layer: number
  totalLayers: number
  currentDepth: number
  isComplete: boolean
  clustersDone: number
  totalClusters: number
  activeCluster: number | null
  clusterColors: string[]
  clusterConvexHulls: Array<{ x: number; y: number }[]>
}

interface OptimizeDoneData {
  bestPath: number[]
  bestCost: number
  layersExplored: number
  cancelled: boolean
}

interface OptimizerApi {
  start(data: unknown): Promise<OptimizeDoneData>
  pause(): void
  resume(): void
  cancel(): void
  onUpdate(cb: (data: OptimizeUpdateData) => void): () => void
  onDone(cb: (data: OptimizeDoneData) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      serial: SerialApi
      optimizer: OptimizerApi
    }
  }
}
