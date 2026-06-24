export interface Point {
  id: number
  x: number
  y: number
  solder: boolean
  tool?: string
  size?: string
}

export interface BedPoint {
  x: number
  y: number
}

export interface NoGoZone {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PcbConfig {
  originOffsetX: number
  originOffsetY: number
  rotation: number
  noGoZones: NoGoZone[]
  thickness: number
}

export function drillToBedSpace(drill: Point, pcb: PcbConfig): BedPoint {
  const rad = -(pcb.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: drill.x * cos - drill.y * sin + pcb.originOffsetX,
    y: drill.x * sin + drill.y * cos + pcb.originOffsetY
  }
}

export function segmentCrossesNoGoZone(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  zones: NoGoZone[]
): boolean {
  if (zones.length === 0) return false
  const dx = bx - ax
  const dy = by - ay
  for (const z of zones) {
    let tmin = 0,
      tmax = 1
    if (dx !== 0) {
      let t1 = (z.x1 - ax) / dx
      let t2 = (z.x2 - ax) / dx
      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
      }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) continue
    } else {
      if (ax < z.x1 || ax > z.x2) continue
    }
    if (dy !== 0) {
      let t1 = (z.y1 - ay) / dy
      let t2 = (z.y2 - ay) / dy
      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
      }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) continue
    } else {
      if (ay < z.y1 || ay > z.y2) continue
    }
    return true
  }
  return false
}

function getNoGoCorners(margin: number, zones: NoGoZone[]): BedPoint[] {
  const corners: BedPoint[] = []
  for (const z of zones) {
    const candidates = [
      { x: z.x1 - margin, y: z.y1 - margin },
      { x: z.x2 + margin, y: z.y1 - margin },
      { x: z.x2 + margin, y: z.y2 + margin },
      { x: z.x1 - margin, y: z.y2 + margin }
    ]
    for (const c of candidates) {
      const insideAny = zones.some((oz) => c.x > oz.x1 && c.x < oz.x2 && c.y > oz.y1 && c.y < oz.y2)
      if (!insideAny) corners.push(c)
    }
  }
  return corners
}

function computeRouteAroundZones(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  zones: NoGoZone[]
): BedPoint[] {
  if (zones.length === 0) return []
  if (!segmentCrossesNoGoZone(ax, ay, bx, by, zones)) return []
  const corners = getNoGoCorners(0.5, zones)
  const nodes: BedPoint[] = [{ x: ax, y: ay }, ...corners, { x: bx, y: by }]
  const n = nodes.length
  const endIdx = n - 1
  const dist = new Array(n).fill(Infinity)
  const prev = new Array(n).fill(-1)
  const visited = new Array(n).fill(false)
  dist[0] = 0
  for (let step = 0; step < n; step++) {
    let u = -1
    for (let i = 0; i < n; i++) {
      if (!visited[i] && (u === -1 || dist[i] < dist[u])) u = i
    }
    if (u === -1 || dist[u] === Infinity) break
    if (u === endIdx) break
    visited[u] = true
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue
      if (segmentCrossesNoGoZone(nodes[u].x, nodes[u].y, nodes[v].x, nodes[v].y, zones)) continue
      const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y)
      if (d < dist[v]) {
        dist[v] = d
        prev[v] = u
      }
    }
  }
  if (dist[endIdx] === Infinity) return []
  const route: number[] = []
  let cur = endIdx
  while (cur !== -1) {
    route.push(cur)
    cur = prev[cur]
  }
  route.reverse()
  return route.slice(1, -1).map((i) => nodes[i])
}

export function routedDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  zones: NoGoZone[]
): number {
  if (zones.length === 0 || !segmentCrossesNoGoZone(ax, ay, bx, by, zones)) {
    return Math.hypot(bx - ax, by - ay)
  }
  const waypoints = computeRouteAroundZones(ax, ay, bx, by, zones)
  let d = 0,
    cx = ax,
    cy = ay
  for (const wp of waypoints) {
    d += Math.hypot(wp.x - cx, wp.y - cy)
    cx = wp.x
    cy = wp.y
  }
  d += Math.hypot(bx - cx, by - cy)
  return d
}

export function distBetweenPoints(a: BedPoint, b: BedPoint, zones: NoGoZone[]): number {
  if (zones.length === 0) {
    return Math.hypot(b.x - a.x, b.y - a.y)
  }
  return routedDistance(a.x, a.y, b.x, b.y, zones)
}

export function distSquaredBetweenPoints(a: BedPoint, b: BedPoint, zones: NoGoZone[]): number {
  const d = distBetweenPoints(a, b, zones)
  return d * d
}
