import { Point, BedPoint, NoGoZone, PcbConfig, drillToBedSpace, distBetweenPoints } from './distance'

export interface BfsResult {
  bestPath: number[]
  bestCost: number
  layersExplored: number
  cancelled: boolean
}

export interface BfsCallbacks {
  onUpdate: (data: {
    bestPath: number[]
    bestCost: number
    layer: number
    totalLayers: number
    currentDepth: number
    isComplete: boolean
  }) => void
  isPaused: () => boolean
  isCancelled: () => boolean
}

export interface LeftMoveConfig {
  warningDistance: number
  yTolerance: number
}

function isLeftMoveViolation(
  b: BedPoint,
  visitedBeds: Map<number, BedPoint>,
  config: LeftMoveConfig
): boolean {
  if (config.warningDistance <= 0) return false

  for (const [, c] of visitedBeds) {
    if (c.x > b.x) {
      if (
        Math.hypot(c.x - b.x, c.y - b.y) < config.warningDistance &&
        Math.abs(c.y - b.y) < config.yTolerance
      ) {
        return true
      }
    }
  }
  return false
}

export async function bfsOptimize(
  points: Point[],
  pcb: PcbConfig,
  startId: number | null,
  zones: NoGoZone[],
  leftMoveConfig: LeftMoveConfig,
  callbacks: BfsCallbacks,
  _clusterLabel?: string
): Promise<BfsResult> {
  if (points.length === 0) {
    return { bestPath: [], bestCost: 0, layersExplored: 0, cancelled: false }
  }
  if (points.length === 1) {
    return { bestPath: [points[0].id], bestCost: 0, layersExplored: 0, cancelled: false }
  }

  const bedCoords = new Map<number, BedPoint>()
  for (const p of points) {
    bedCoords.set(p.id, drillToBedSpace(p, pcb))
  }

  let startPt = points[0]
  if (startId !== null) {
    const found = points.find((p) => p.id === startId)
    if (found) startPt = found
  } else {
    let bestDist = Infinity
    for (const p of points) {
      const bed = bedCoords.get(p.id)!
      const d = Math.hypot(bed.x, bed.y)
      if (d < bestDist) {
        bestDist = d
        startPt = p
      }
    }
  }

  const hasZones = zones.length > 0

  const distBetween = (a: Point, b: Point): number => {
    const bedA = bedCoords.get(a.id)!
    const bedB = bedCoords.get(b.id)!
    return distBetweenPoints(bedA, bedB, hasZones ? zones : [])
  }

  let bestPath: number[] = []
  let bestCost = Infinity
  let maxDepthReached = 0

  const totalLayers = points.length

  let branchCount = 0
  const YIELD_EVERY = 100
  let lastUpdateTime = Date.now()

  type Branch = {
    path: number[]
    visited: Set<number>
    visitedBeds: Map<number, BedPoint>
    cost: number
  }

  async function checkYield(depth: number): Promise<boolean> {
    branchCount++
    if (branchCount % YIELD_EVERY !== 0) return false

    if (callbacks.isCancelled()) return true

    if (depth > maxDepthReached) {
      maxDepthReached = depth
    }

    callbacks.onUpdate({
      bestPath: bestPath.length > 0 ? [...bestPath] : [],
      bestCost: bestCost === Infinity ? 0 : bestCost,
      layer: depth,
      totalLayers,
      currentDepth: depth,
      isComplete: false
    })

    await new Promise((r) => setTimeout(r, 0))

    if (callbacks.isCancelled()) return true
    while (callbacks.isPaused()) {
      await new Promise((r) => setTimeout(r, 100))
      if (callbacks.isCancelled()) return true
    }
    return false
  }

  async function dfs(branch: Branch): Promise<boolean> {
    if (branch.path.length === totalLayers) {
      if (branch.cost < bestCost) {
        bestCost = branch.cost
        bestPath = [...branch.path]

        callbacks.onUpdate({
          bestPath: [...bestPath],
          bestCost,
          layer: totalLayers,
          totalLayers,
          currentDepth: totalLayers,
          isComplete: true
        })
      }
      return false
    }

    if (await checkYield(branch.path.length)) return true

    const lastId = branch.path[branch.path.length - 1]
    const lastPt = points.find((p) => p.id === lastId)!

    for (const pt of points) {
      if (branch.visited.has(pt.id)) continue

      const ptBed = bedCoords.get(pt.id)!

      if (isLeftMoveViolation(ptBed, branch.visitedBeds, leftMoveConfig)) {
        continue
      }

      const moveCost = distBetween(lastPt, pt)
      const newCost = branch.cost + moveCost

      if (bestCost !== Infinity && newCost >= bestCost) {
        continue
      }

      const newPath = [...branch.path, pt.id]
      const newVisited = new Set(branch.visited)
      newVisited.add(pt.id)
      const newVisitedBeds = new Map(branch.visitedBeds)
      newVisitedBeds.set(pt.id, ptBed)

      const shouldStop = await dfs({
        path: newPath,
        visited: newVisited,
        visitedBeds: newVisitedBeds,
        cost: newCost
      })

      if (shouldStop) return true

      if (callbacks.isCancelled()) return true
    }

    return false
  }

  await dfs({
    path: [startPt.id],
    visited: new Set([startPt.id]),
    visitedBeds: new Map([[startPt.id, bedCoords.get(startPt.id)!]]),
    cost: 0
  })

  return {
    bestPath,
    bestCost: bestCost === Infinity ? 0 : bestCost,
    layersExplored: maxDepthReached,
    cancelled: callbacks.isCancelled()
  }
}
