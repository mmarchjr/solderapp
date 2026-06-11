import { parentPort } from 'worker_threads'
import { Point, BedPoint, PcbConfig, NoGoZone, drillToBedSpace } from './distance'
import { bfsOptimize, BfsCallbacks, LeftMoveConfig } from './bfs'
import { clusterPoints, ClusterConfig, getClusterColor } from './cluster'

interface WorkerPayload {
  points: Point[]
  pcb: PcbConfig
  startId: number | null
  allZones: NoGoZone[]
  leftMoveConfig: LeftMoveConfig
  clusterConfig: ClusterConfig
}

const port = parentPort
if (!port) throw new Error('Worker must be run as a worker thread')

port.on('message', async (payload: WorkerPayload) => {
  const { points, pcb, startId, allZones, leftMoveConfig, clusterConfig } = payload

  if (points.length === 0) {
    port!.postMessage({ type: 'done', bestPath: [], bestCost: 0, layersExplored: 0, cancelled: false })
    return
  }

  let paused = false
  let cancelled = false

  port!.on('message', (msg: { type: string }) => {
    if (msg.type === 'pause') paused = true
    else if (msg.type === 'resume') paused = false
    else if (msg.type === 'cancel') { cancelled = true; paused = false }
  })

  const sendUpdate = (data: Record<string, unknown>) => {
    port!.postMessage({ type: 'update', ...data })
  }

  let totalLayersExplored = 0

  const rad = -(pcb.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const toBed = (pt: Point): BedPoint => ({
    x: pt.x * cos - pt.y * sin + pcb.originOffsetX,
    y: pt.x * sin + pt.y * cos + pcb.originOffsetY
  })

  const topClusters = clusterPoints(points, pcb, clusterConfig)

  const clusterColors = topClusters.map((_, i) => getClusterColor(i, topClusters.length))
  const clusterConvexHulls = topClusters.map((c) => c.convexHull)

  let startClusterIdx = 0
  let bestPadDist = Infinity
  for (let ci = 0; ci < topClusters.length; ci++) {
    for (const pt of topClusters[ci].points) {
      const bed = toBed(pt)
      const d = Math.hypot(bed.x, bed.y)
      if (d < bestPadDist) {
        bestPadDist = d
        startClusterIdx = ci
      }
    }
  }

  const centroidBeds = topClusters.map((c) => c.centroid)
  const CLUSTER_DFS_THRESHOLD = 15
  let clusterOrder: number[] = []

  if (topClusters.length === 1) {
    clusterOrder.push(0)
  } else if (topClusters.length <= CLUSTER_DFS_THRESHOLD) {
    const centroidPoints: Point[] = topClusters.map((c, i) => ({
      id: i,
      x: c.centroid.x - pcb.originOffsetX,
      y: c.centroid.y - pcb.originOffsetY,
      solder: true
    }))

    const centroidPcb: PcbConfig = { ...pcb, noGoZones: [] }
    const centroidResult = await bfsOptimize(
      centroidPoints,
      centroidPcb,
      startClusterIdx,
      [],
      { warningDistance: 0, yTolerance: 0 },
      callbacks
    )
    totalLayersExplored += centroidResult.layersExplored

    if (centroidResult.bestPath.length > 0) {
      clusterOrder = centroidResult.bestPath.filter((id) => id >= 0 && id < topClusters.length)
    } else {
      clusterOrder = nearestNeighborOrder(centroidBeds, startClusterIdx)
    }
  } else {
    clusterOrder = nearestNeighborOrder(centroidBeds, startClusterIdx)
  }

  sendUpdate({
    clusterOrder,
    totalClusters: topClusters.length,
    clusterColors,
    clusterConvexHulls
  })

  async function optimizeRecursive(
    pts: Point[],
    depth: number,
    topClusterIdx: number,
    color: string
  ): Promise<{ path: number[], cost: number }> {
    if (cancelled) return { path: [], cost: 0 }

    while (paused) {
      await new Promise((r) => setTimeout(r, 50))
      if (cancelled) return { path: [], cost: 0 }
    }

    if (pts.length <= 1) {
      return { path: pts.map((p) => p.id), cost: 0 }
    }

    if (pts.length <= clusterConfig.targetPointsPerCluster) {
      const clusterStartId = findClusterStart(pts, pcb)

      let leafBestPath: number[] = []
      let leafBestCost = 0

      const leafCallbacks: BfsCallbacks = {
        onUpdate: (data) => {
          if (data.bestPath && data.bestPath.length > 0) {
            leafBestPath = data.bestPath
            leafBestCost = data.bestCost
          }
          sendUpdate({
            bestPath: data.bestPath,
            bestCost: data.bestCost,
            layer: data.layer,
            totalLayers: data.totalLayers,
            currentDepth: data.currentDepth,
            isComplete: data.isComplete,
            clustersDone: topClusterIdx,
            totalClusters: topClusters.length,
            activeCluster: topClusterIdx,
            clusterColors,
            clusterConvexHulls,
            hierarchyDepth: depth
          })
        },
        isPaused: () => paused,
        isCancelled: () => cancelled
      }

      const result = await bfsOptimize(pts, pcb, clusterStartId, allZones, leftMoveConfig, leafCallbacks)
      totalLayersExplored += result.layersExplored

      if (result.bestPath.length > 0) {
        return { path: result.bestPath, cost: result.bestCost }
      }

      return { path: pts.map((p) => p.id), cost: 0 }
    }

    const clusters = clusterPoints(pts, pcb, clusterConfig)

    const childResults: { path: number[], cost: number, centroid: BedPoint }[] = []

    for (const cluster of clusters) {
      if (cancelled) break
      const child = await optimizeRecursive(cluster.points, depth + 1, topClusterIdx, color)
      childResults.push({ path: child.path, cost: child.cost, centroid: cluster.centroid })
    }

    if (childResults.length === 0) return { path: [], cost: 0 }

    let ordered: typeof childResults
    if (childResults.length === 1) {
      ordered = childResults
    } else {
      let startIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < childResults.length; i++) {
        const c = childResults[i].centroid
        const d = Math.hypot(c.x, c.y)
        if (d < bestDist) {
          bestDist = d
          startIdx = i
        }
      }

      const visited = new Set<number>()
      ordered = []
      let current = startIdx
      for (let i = 0; i < childResults.length; i++) {
        ordered.push(childResults[current])
        visited.add(current)
        let nearest = -1
        let nearestDist = Infinity
        for (let j = 0; j < childResults.length; j++) {
          if (visited.has(j)) continue
          const d = Math.hypot(
            childResults[j].centroid.x - childResults[current].centroid.x,
            childResults[j].centroid.y - childResults[current].centroid.y
          )
          if (d < nearestDist) {
            nearestDist = d
            nearest = j
          }
        }
        if (nearest === -1) break
        current = nearest
      }
    }

    const mergedPath: number[] = []
    let mergedCost = 0

    for (const child of ordered) {
      if (cancelled) break
      if (child.path.length === 0) continue

      const connectionCost = mergedPath.length > 0
        ? calculateConnectionCost(mergedPath, child.path, points, pcb)
        : 0

      for (const id of child.path) {
        if (!mergedPath.includes(id)) {
          mergedPath.push(id)
        }
      }
      mergedCost += child.cost + connectionCost
    }

    return { path: mergedPath, cost: mergedCost }
  }

  const mergedBestPath: number[] = []
  let mergedBestCost = 0

  for (let oi = 0; oi < clusterOrder.length; oi++) {
    if (cancelled) break

    while (paused) {
      await new Promise((r) => setTimeout(r, 50))
      if (cancelled) break
    }
    if (cancelled) break

    const ci = clusterOrder[oi]
    if (ci == null || ci < 0 || ci >= topClusters.length) continue
    const topCluster = topClusters[ci]
    const color = clusterColors[ci]

    sendUpdate({
      bestPath: [...mergedBestPath],
      bestCost: mergedBestCost,
      layer: 0,
      totalLayers: topCluster.points.length,
      currentDepth: 0,
      isComplete: false,
      clustersDone: oi,
      totalClusters: topClusters.length,
      activeCluster: ci,
      clusterColors,
      clusterConvexHulls
    })

    const child = await optimizeRecursive(topCluster.points, 1, ci, color)

    if (child.path.length > 0) {
      const connectionCost = mergedBestPath.length > 0
        ? calculateConnectionCost(mergedBestPath, child.path, points, pcb)
        : 0

      for (const id of child.path) {
        if (!mergedBestPath.includes(id)) {
          mergedBestPath.push(id)
        }
      }
      mergedBestCost += child.cost + connectionCost
    }

    sendUpdate({
      bestPath: [...mergedBestPath],
      bestCost: mergedBestCost,
      layer: topCluster.points.length,
      totalLayers: topCluster.points.length,
      currentDepth: topCluster.points.length,
      isComplete: oi === clusterOrder.length - 1,
      clustersDone: oi + 1,
      totalClusters: topClusters.length,
      activeCluster: ci,
      clusterColors,
      clusterConvexHulls
    })

    await new Promise((r) => setTimeout(r, 0))
  }

  port!.postMessage({
    type: 'done',
    bestPath: mergedBestPath,
    bestCost: mergedBestCost,
    layersExplored: totalLayersExplored,
    cancelled
  })
})

function findClusterStart(pts: Point[], pcb: PcbConfig): number | null {
  if (pts.length === 0) return null
  if (pts.length === 1) return pts[0].id

  const rad = -(pcb.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const toBed = (pt: Point) => ({
    x: pt.x * cos - pt.y * sin + pcb.originOffsetX,
    y: pt.x * sin + pt.y * cos + pcb.originOffsetY
  })

  const bedPts = pts.map((pt) => ({ pt, bed: toBed(pt) }))
  bedPts.sort((a, b) => a.bed.x - b.bed.x)

  const minX = bedPts[0].bed.x
  const leftCandidates = bedPts.filter((c) => c.bed.x <= minX + 1)

  let best = leftCandidates[0]
  let bestDist = Infinity
  for (const c of leftCandidates) {
    const d = Math.hypot(c.bed.x, c.bed.y)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best.pt.id
}

function calculateConnectionCost(
  pathA: number[],
  pathB: number[],
  allPoints: Point[],
  pcb: PcbConfig
): number {
  if (pathA.length === 0 || pathB.length === 0) return 0

  const lastA = allPoints.find((p) => p.id === pathA[pathA.length - 1])
  const firstB = allPoints.find((p) => p.id === pathB[0])
  if (!lastA || !firstB) return 0

  const rad = -(pcb.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const bedA = {
    x: lastA.x * cos - lastA.y * sin + pcb.originOffsetX,
    y: lastA.x * sin + lastA.y * cos + pcb.originOffsetY
  }
  const bedB = {
    x: firstB.x * cos - firstB.y * sin + pcb.originOffsetX,
    y: firstB.x * sin + firstB.y * cos + pcb.originOffsetY
  }

  return Math.hypot(bedB.x - bedA.x, bedB.y - bedA.y)
}

function nearestNeighborOrder(centroids: BedPoint[], startIdx: number): number[] {
  const n = centroids.length
  if (n === 0) return []
  const visited = new Set<number>()
  const order: number[] = []
  let current = startIdx
  for (let i = 0; i < n; i++) {
    order.push(current)
    visited.add(current)
    let nearest = -1
    let nearestDist = Infinity
    for (let j = 0; j < n; j++) {
      if (visited.has(j)) continue
      const d = Math.hypot(centroids[j].x - centroids[current].x, centroids[j].y - centroids[current].y)
      if (d < nearestDist) {
        nearestDist = d
        nearest = j
      }
    }
    if (nearest === -1) break
    current = nearest
  }
  return order
}
