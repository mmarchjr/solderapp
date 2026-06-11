import { Point, BedPoint, PcbConfig, drillToBedSpace } from './distance'

export interface Cluster {
  id: number
  points: Point[]
  centroid: BedPoint
  convexHull: BedPoint[]
  softBoundaryPoints: Set<number>
}

export interface ClusterConfig {
  targetPointsPerCluster: number
  maxPointsPerCluster: number
  softBoundaryDistance: number
}

function kMeans(
  bedPoints: BedPoint[],
  k: number,
  maxIterations = 100
): number[] {
  const n = bedPoints.length
  if (n === 0) return []
  if (k >= n) return bedPoints.map((_, i) => i)

  const assignments = new Array(n).fill(0)
  const centroids: BedPoint[] = []

  for (let i = 0; i < k; i++) {
    centroids.push({ ...bedPoints[i] })
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false

    for (let i = 0; i < n; i++) {
      let bestCluster = 0
      let bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const d = Math.hypot(
          bedPoints[i].x - centroids[c].x,
          bedPoints[i].y - centroids[c].y
        )
        if (d < bestDist) {
          bestDist = d
          bestCluster = c
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster
        changed = true
      }
    }

    if (!changed) break

    for (let c = 0; c < k; c++) {
      let sumX = 0,
        sumY = 0,
        count = 0
      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) {
          sumX += bedPoints[i].x
          sumY += bedPoints[i].y
          count++
        }
      }
      if (count > 0) {
        centroids[c] = { x: sumX / count, y: sumY / count }
      }
    }
  }

  return assignments
}

function convexHull(points: BedPoint[]): BedPoint[] {
  if (points.length <= 1) return [...points]

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)

  const cross = (o: BedPoint, a: BedPoint, b: BedPoint): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const lower: BedPoint[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: BedPoint[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function expandedConvexHull(
  clusterPoints: Point[],
  clusterBeds: BedPoint[],
  _pcb: PcbConfig,
  padding: number
): BedPoint[] {
  if (clusterBeds.length <= 1) {
    if (clusterBeds.length === 0) return []
    const pt = clusterPoints[0]
    const radius = pt ? (parseFloat(String(pt.size)) || 0) / 2 : 0
    const expand = padding + radius
    return [
      { x: clusterBeds[0].x - expand, y: clusterBeds[0].y - expand },
      { x: clusterBeds[0].x + expand, y: clusterBeds[0].y - expand },
      { x: clusterBeds[0].x + expand, y: clusterBeds[0].y + expand },
      { x: clusterBeds[0].x - expand, y: clusterBeds[0].y + expand }
    ]
  }

  const hull = convexHull(clusterBeds)
  if (hull.length === 0) return hull

  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length

  const bedToPt = new Map<string, Point>()
  for (let i = 0; i < clusterBeds.length; i++) {
    const key = `${clusterBeds[i].x},${clusterBeds[i].y}`
    bedToPt.set(key, clusterPoints[i])
  }

  const expanded: BedPoint[] = []
  for (const vertex of hull) {
    const dx = vertex.x - cx
    const dy = vertex.y - cy
    const dist = Math.hypot(dx, dy)

    let expandBy = padding
    if (dist > 0.001) {
      const key = `${vertex.x},${vertex.y}`
      const pt = bedToPt.get(key)
      if (pt && pt.size) {
        const radius = parseFloat(String(pt.size)) / 2
        if (!isNaN(radius) && radius > 0) {
          expandBy = padding + radius
        }
      }
      expanded.push({
        x: vertex.x + (dx / dist) * expandBy,
        y: vertex.y + (dy / dist) * expandBy
      })
    } else {
      expanded.push({ x: vertex.x + expandBy, y: vertex.y })
    }
  }

  return expanded
}

export function clusterPoints(
  points: Point[],
  pcb: PcbConfig,
  config: ClusterConfig
): Cluster[] {
  if (points.length === 0) return []

  const bedCoords: BedPoint[] = points.map((p) => drillToBedSpace(p, pcb))

  const k = Math.ceil(points.length / config.targetPointsPerCluster)
  const assignments = kMeans(bedCoords, Math.max(1, k))

  const clusterMap = new Map<number, Point[]>()
  const clusterBedMap = new Map<number, BedPoint[]>()

  for (let i = 0; i < points.length; i++) {
    const c = assignments[i]
    if (!clusterMap.has(c)) {
      clusterMap.set(c, [])
      clusterBedMap.set(c, [])
    }
    clusterMap.get(c)!.push(points[i])
    clusterBedMap.get(c)!.push(bedCoords[i])
  }

  const clusters: Cluster[] = []
  let clusterId = 0

  for (const [c, clusterPoints] of clusterMap) {
    const clusterBeds = clusterBedMap.get(c)!
    const centroid: BedPoint = {
      x: clusterBeds.reduce((s, p) => s + p.x, 0) / clusterBeds.length,
      y: clusterBeds.reduce((s, p) => s + p.y, 0) / clusterBeds.length
    }
    const hull = expandedConvexHull(clusterPoints, clusterBeds, pcb, 2)

    clusters.push({
      id: clusterId++,
      points: clusterPoints,
      centroid,
      convexHull: hull,
      softBoundaryPoints: new Set()
    })
  }

  if (config.maxPointsPerCluster > 0) {
    let changed = true
    while (changed) {
      changed = false
      for (let ci = 0; ci < clusters.length; ci++) {
        if (clusters[ci].points.length <= config.maxPointsPerCluster) continue

        const oversized = clusters[ci]
        const oversizedBeds = oversized.points.map((p) => drillToBedSpace(p, pcb))
        const splitK = Math.ceil(oversized.points.length / config.targetPointsPerCluster)
        const splitAssignments = kMeans(oversizedBeds, Math.max(2, splitK))

        const splits = new Map<number, { points: Point[]; beds: BedPoint[] }>()
        for (let i = 0; i < oversized.points.length; i++) {
          const s = splitAssignments[i]
          if (!splits.has(s)) splits.set(s, { points: [], beds: [] })
          splits.get(s)!.points.push(oversized.points[i])
          splits.get(s)!.beds.push(oversizedBeds[i])
        }

        clusters.splice(ci, 1)
        for (const [, split] of splits) {
          const centroid: BedPoint = {
            x: split.beds.reduce((s, p) => s + p.x, 0) / split.beds.length,
            y: split.beds.reduce((s, p) => s + p.y, 0) / split.beds.length
          }
          clusters.push({
            id: clusterId++,
            points: split.points,
            centroid,
            convexHull: expandedConvexHull(split.points, split.beds, pcb, 2),
            softBoundaryPoints: new Set()
          })
        }
        changed = true
        break
      }
    }
  }

  if (config.softBoundaryDistance > 0) {
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i]
        const b = clusters[j]

        for (const ptA of a.points) {
          const bedA = drillToBedSpace(ptA, pcb)
          for (const ptB of b.points) {
            const bedB = drillToBedSpace(ptB, pcb)
            const d = Math.hypot(bedA.x - bedB.x, bedA.y - bedB.y)
            if (d < config.softBoundaryDistance) {
              a.softBoundaryPoints.add(ptA.id)
              b.softBoundaryPoints.add(ptB.id)
            }
          }
        }
      }
    }
  }

  for (const cluster of clusters) {
    const softPoints = points.filter((p) => cluster.softBoundaryPoints.has(p.id))
    const mergedIds = new Set([...cluster.points.map((p) => p.id), ...softPoints.map((p) => p.id)])
    cluster.points = points.filter((p) => mergedIds.has(p.id))
  }

  return clusters
}

export function getClusterColor(index: number, total: number): string {
  const hue = (index / total) * 360
  const h = hue
  const s = 70
  const l = 50
  const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l / 100 - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
