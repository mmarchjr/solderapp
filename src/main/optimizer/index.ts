import { ipcMain, BrowserWindow } from 'electron'
import { Worker } from 'worker_threads'
import { join } from 'path'
import { Point, PcbConfig, NoGoZone, BedPoint } from './distance'
import { LeftMoveConfig } from './bfs'
import { ClusterConfig, getClusterColor } from './cluster'

export interface OptimizeStartPayload {
  points: Point[]
  pcb: PcbConfig
  startId: number | null
  globalNoGoZones: NoGoZone[]
  leftMoveWarningDistance: number
  leftMoveYTolerance: number
  targetPointsPerCluster: number
  maxPointsPerCluster: number
  softBoundaryDistance: number
}

export interface OptimizeUpdateData {
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
  clusterConvexHulls: BedPoint[][]
}

export interface OptimizeDoneData {
  bestPath: number[]
  bestCost: number
  layersExplored: number
  cancelled: boolean
}

let activeWorker: Worker | null = null

export function setupOptimizerIPC(mainWindow: BrowserWindow): void {
  ipcMain.on('optimize:pause', () => {
    activeWorker?.postMessage({ type: 'pause' })
  })

  ipcMain.on('optimize:resume', () => {
    activeWorker?.postMessage({ type: 'resume' })
  })

  ipcMain.on('optimize:cancel', () => {
    activeWorker?.postMessage({ type: 'cancel' })
  })

  ipcMain.handle('optimize:start', async (_event, payload: OptimizeStartPayload) => {
    if (activeWorker) {
      activeWorker.terminate()
      activeWorker = null
    }

    const {
      points,
      pcb,
      startId,
      globalNoGoZones,
      leftMoveWarningDistance,
      leftMoveYTolerance,
      targetPointsPerCluster,
      maxPointsPerCluster,
      softBoundaryDistance
    } = payload

    if (points.length === 0) {
      return { bestPath: [], bestCost: 0, layersExplored: 0, cancelled: false }
    }

    const allZones: NoGoZone[] = [...globalNoGoZones, ...pcb.noGoZones]

    const leftMoveConfig: LeftMoveConfig = {
      warningDistance: leftMoveWarningDistance,
      yTolerance: leftMoveYTolerance
    }

    const clusterConfig: ClusterConfig = {
      targetPointsPerCluster,
      maxPointsPerCluster,
      softBoundaryDistance
    }

    const clusterColors: string[] = []
    let clusterConvexHulls: BedPoint[][] = []

    return new Promise((resolve) => {
      const worker = new Worker(join(__dirname, 'optimizer/worker.js'))
      activeWorker = worker

      worker.postMessage({
        points,
        pcb,
        startId,
        allZones,
        leftMoveConfig,
        clusterConfig
      })

      worker.on('message', (msg: Record<string, unknown>) => {
        if (msg.type === 'update') {
          if (msg.clusterColors && Array.isArray(msg.clusterColors)) {
            const rawColors = msg.clusterColors as string[]
            for (let i = 0; i < rawColors.length; i++) {
              clusterColors[i] = rawColors[i] || getClusterColor(i, rawColors.length)
            }
          }
          if (msg.clusterConvexHulls && Array.isArray(msg.clusterConvexHulls)) {
            clusterConvexHulls = msg.clusterConvexHulls as BedPoint[][]
          }

          const updateData: OptimizeUpdateData = {
            bestPath: (msg.bestPath as number[]) || [],
            bestCost: (msg.bestCost as number) || 0,
            layer: (msg.layer as number) || 0,
            totalLayers: (msg.totalLayers as number) || 0,
            currentDepth: (msg.currentDepth as number) || 0,
            isComplete: (msg.isComplete as boolean) || false,
            clustersDone: (msg.clustersDone as number) || 0,
            totalClusters: (msg.totalClusters as number) || 1,
            activeCluster: msg.activeCluster != null ? (msg.activeCluster as number) : null,
            clusterColors: [...clusterColors],
            clusterConvexHulls
          }

          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('optimize:update', updateData)
          }
        } else if (msg.type === 'done') {
          activeWorker = null
          const doneData: OptimizeDoneData = {
            bestPath: (msg.bestPath as number[]) || [],
            bestCost: (msg.bestCost as number) || 0,
            layersExplored: (msg.layersExplored as number) || 0,
            cancelled: (msg.cancelled as boolean) || false
          }
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('optimize:done', doneData)
          }
          resolve(doneData)
        }
      })

      worker.on('error', (err) => {
        console.error('Optimizer worker error:', err)
        activeWorker = null
        const errorResult: OptimizeDoneData = {
          bestPath: [],
          bestCost: 0,
          layersExplored: 0,
          cancelled: false
        }
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('optimize:done', errorResult)
        }
        resolve(errorResult)
      })
    })
  })
}
