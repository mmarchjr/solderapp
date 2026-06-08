<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'

const emit = defineEmits(['point-click'])

const props = defineProps({
  selectedTool: { type: String, default: null }
})

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()

const canvas = ref(null)
let ctx,
  scale = 1,
  offsetX = 0,
  offsetY = 0
let pendingRenderFrame = null
let isPanning = false
let startX = 0,
  startY = 0

const hoveredPoint = ref(null)

function getDiameter(sizeString) {
  if (!sizeString) return 0
  const match = sizeString.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

function resizeCanvas() {
  const canvasEl = canvas.value
  if (!canvasEl) return
  const dpr = window.devicePixelRatio || 1
  const width = canvasEl.parentElement.clientWidth
  const height = canvasEl.parentElement.clientHeight
  canvasEl.width = width * dpr
  canvasEl.height = height * dpr
  canvasEl.style.width = width + 'px'
  canvasEl.style.height = height + 'px'
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  offsetX = width / 3
  offsetY = height * 0.75
  updateCanvas()
}

function fitCanvasToBuildPlate() {
  const canvasEl = canvas.value
  if (!canvasEl) return
  const screenWidth = canvasEl.width / (window.devicePixelRatio || 1)
  const screenHeight = canvasEl.height / (window.devicePixelRatio || 1)
  const padding = 0.1
  const bedWidth = drillStore.currentBedWidth
  const bedHeight = drillStore.currentBedHeight
  const scaleX = screenWidth / (bedWidth * (1 + padding))
  const scaleY = screenHeight / (bedHeight * (1 + padding))
  scale = Math.min(scaleX, scaleY)
  offsetX = screenWidth / 2 - (bedWidth * scale) / 2
  offsetY = screenHeight / 2 + (bedHeight * scale) / 2
  updateCanvas()
}

function drawClippedGrid(context, bedWidth, bedHeight, gridSize) {
  context.save()
  context.rect(0, -bedHeight, bedWidth, bedHeight)
  context.clip()
  context.strokeStyle = 'rgba(0,0,0,0.08)'
  context.lineWidth = 1 / scale
  context.beginPath()
  for (let x = 0; x <= bedWidth; x += gridSize) {
    context.moveTo(x, 0)
    context.lineTo(x, -bedHeight)
  }
  for (let y = 0; y <= bedHeight; y += gridSize) {
    context.moveTo(0, -y)
    context.lineTo(bedWidth, -y)
  }
  context.stroke()
  context.restore()
}

function drawNoGoZones(context) {
  const zones = [...drillStore.globalNoGoZones]
  for (const pcb of drillStore.pcbs) {
    for (const z of pcb.noGoZones) zones.push(z)
  }
  if (zones.length === 0) return
  for (const z of zones) {
    const x = z.x1
    const y = -z.y2
    const w = z.x2 - z.x1
    const h = z.y2 - z.y1
    context.save()
    context.fillStyle = 'rgba(255, 60, 60, 0.18)'
    context.fillRect(x, y, w, h)
    context.beginPath()
    context.rect(x, y, w, h)
    context.clip()
    context.strokeStyle = 'rgba(255, 60, 60, 0.35)'
    context.lineWidth = 1 / scale
    const step = 4
    for (let i = -Math.max(w, h); i < Math.max(w, h) * 2; i += step) {
      context.beginPath()
      context.moveTo(x + i, y)
      context.lineTo(x + i + h, y + h)
      context.stroke()
    }
    context.restore()
    context.strokeStyle = 'rgba(220, 40, 40, 0.7)'
    context.lineWidth = 1.5 / scale
    context.setLineDash([4 / scale, 3 / scale])
    context.strokeRect(x, y, w, h)
    context.setLineDash([])
    if (w * scale > 50 && h * scale > 20) {
      context.save()
      context.fillStyle = 'rgba(220, 40, 40, 0.6)'
      context.font = `bold ${Math.min(14, w * scale * 0.15)}px sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('NO-GO', x + w / 2, y + h / 2)
      context.restore()
    }
  }
}

function drawPcbOutline(context, pcb) {
  const outline = pcb.outline
  if (!outline || outline.length < 2) return
  context.save()
  context.strokeStyle = 'rgba(0, 120, 200, 0.7)'
  context.lineWidth = 2 / scale
  context.setLineDash([])
  context.beginPath()
  let started = false
  for (let i = 0; i < outline.length; i++) {
    const pt = outline[i]
    if (pt === null) {
      if (started) context.stroke()
      context.beginPath()
      started = false
      continue
    }
    if (!started) {
      context.moveTo(pt.x, -pt.y)
      started = true
    } else {
      context.lineTo(pt.x, -pt.y)
    }
  }
  if (started) context.stroke()
  context.fillStyle = 'rgba(0, 120, 200, 0.04)'
  context.fill()
  context.restore()
}

function drawDrillHoles(context, pcb) {
  const viaFilter = pcb.viaFilterDiameter ?? 0.4
  for (const d of pcb.drillData) {
    const holeDiameter = getDiameter(d.size)
    if (holeDiameter < viaFilter) continue
    const x = d.x,
      y = -d.y
    const r = holeDiameter / 2 || 2
    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fillStyle = d.solder ? 'red' : 'gray'
    context.strokeStyle = d.selected ? 'cyan' : 'black'
    context.lineWidth = 2 / scale
    context.fill()
    context.stroke()
  }
}

function drawPathLines(context, pcb) {
  const path = pcb.path
  if (!Array.isArray(path) || path.length < 2) return
  const zones = drillStore._getAllNoGoZones(pcb)
  const hasZones = zones.length > 0
  const printer = printerCtrl.printer
  const currentLine = printer.currentLine
  const totalLines = printer.totalLines

  context.lineWidth = 6 / scale

  let prevBed = null
  for (let i = 0; i < path.length; i++) {
    const pt = pcb.drillData.find((d) => d.id === path[i])
    if (!pt) continue

    if (!prevBed) {
      prevBed = drillStore.drillToBedSpace(pt, pcb)
      continue
    }

    const curBed = drillStore.drillToBedSpace(pt, pcb)

    if (hasZones) {
      const waypoints = drillStore.computeRouteAroundZones(
        prevBed.x,
        prevBed.y,
        curBed.x,
        curBed.y,
        zones
      )
      for (const wp of waypoints) {
        const rad = (pcb.rotation * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const dx = wp.x - pcb.originOffsetX
        const dy = wp.y - pcb.originOffsetY
        const dcx = dx * cos - dy * sin
        const dcy = -(dx * sin + dy * cos)
        context.beginPath()
        context.moveTo(prevBed.x, -prevBed.y)
        context.lineTo(dcx, dcy)
        prevBed = wp
      }
    }

    context.beginPath()
    context.moveTo(prevBed.x, -prevBed.y)
    context.lineTo(curBed.x, -curBed.y)
    context.stroke()

    prevBed = curBed
  }
}

function drawTraveledPath(context, pcb) {
  const printer = printerCtrl.printer
  if (!printer.printing && !printer.paused) return
  if (printer.currentLine <= 0) return

  const solderPoints = []
  for (const id of pcb.path) {
    const drill = pcb.drillData.find((d) => d.id === id)
    if (drill && drill.solder) {
      solderPoints.push(drillStore.drillToBedSpace(drill, pcb))
    }
  }

  if (solderPoints.length === 0) return

  const progressRatio = printer.totalLines > 0 ? printer.currentLine / printer.totalLines : 0
  const traveledCount = Math.floor(progressRatio * solderPoints.length)

  if (traveledCount < 1) return

  context.save()
  context.strokeStyle = 'rgba(76, 175, 80, 0.8)'
  context.lineWidth = 4 / scale
  context.setLineDash([])
  context.beginPath()
  context.moveTo(solderPoints[0].x, -solderPoints[0].y)
  for (let i = 1; i < Math.min(traveledCount, solderPoints.length); i++) {
    context.lineTo(solderPoints[i].x, -solderPoints[i].y)
  }
  context.stroke()
  context.restore()
}

function drawPositionMarker(context) {
  const printer = printerCtrl.printer
  if (!printer.connected) return

  const pos = printer.position
  const sx = offsetX + pos.x * scale
  const sy = offsetY - pos.y * scale
  const size = 12

  context.save()

  const blinkOn = !printer.paused || Date.now() % 1000 < 500

  if (blinkOn) {
    context.strokeStyle = '#f44336'
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(sx - size, sy)
    context.lineTo(sx + size, sy)
    context.moveTo(sx, sy - size)
    context.lineTo(sx, sy + size)
    context.stroke()

    context.beginPath()
    context.arc(sx, sy, 4, 0, 2 * Math.PI)
    context.fillStyle = '#f44336'
    context.fill()

    if (printer.printing && !printer.paused) {
      const pulsePhase = (Date.now() % 1500) / 1500
      const pulseRadius = 8 + pulsePhase * 12
      const pulseAlpha = 1 - pulsePhase
      context.beginPath()
      context.arc(sx, sy, pulseRadius, 0, 2 * Math.PI)
      context.strokeStyle = `rgba(244, 67, 54, ${pulseAlpha})`
      context.lineWidth = 2
      context.stroke()
    }
  }

  context.restore()
}

function drawOriginMarkers(context) {
  for (const pcb of drillStore.pcbs) {
    if (!pcb.originSet) continue
    if (pcb.path.length === 0) continue

    const firstDrill = pcb.drillData.find((d) => pcb.path.includes(d.id))
    if (!firstDrill) continue

    const bedCoords = drillStore.drillToBedSpace(firstDrill, pcb)
    const sx = offsetX + bedCoords.x * scale
    const sy = offsetY - bedCoords.y * scale

    context.save()
    context.strokeStyle = '#4caf50'
    context.lineWidth = 2
    context.beginPath()
    context.arc(sx, sy, 6, 0, 2 * Math.PI)
    context.stroke()
    context.beginPath()
    context.moveTo(sx - 4, sy)
    context.lineTo(sx + 4, sy)
    context.moveTo(sx, sy - 4)
    context.lineTo(sx, sy + 4)
    context.stroke()
    context.restore()
  }
}

function drawPathLabels(context) {
  context.save()
  context.font = `bold ${11}px sans-serif`
  context.fillStyle = 'white'
  context.strokeStyle = 'rgba(0,0,0,0.6)'
  context.lineWidth = 2
  context.textAlign = 'left'
  context.textBaseline = 'bottom'

  for (const pcb of drillStore.pcbs) {
    const rad = -(pcb.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    for (const id of pcb.path) {
      const d = pcb.drillData.find((drill) => drill.id === id)
      if (!d || d.pathIndex == null) continue
      const rx = d.x * cos - d.y * sin + pcb.originOffsetX
      const ry = d.x * sin + d.y * cos + pcb.originOffsetY
      const sx = offsetX + rx * scale + 6
      const sy = offsetY - ry * scale - 6
      const label = (d.pathIndex + 1).toString()
      context.strokeText(label, sx, sy)
      context.fillText(label, sx, sy)
    }
  }
  context.restore()
}

function updateCanvas() {
  if (!ctx) return
  if (pendingRenderFrame) return

  pendingRenderFrame = requestAnimationFrame(() => {
    pendingRenderFrame = null
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
    ctx.scale(dpr, dpr)

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    const bedWidth = drillStore.currentBedWidth
    const bedHeight = drillStore.currentBedHeight
    ctx.fillStyle = '#c9c9c9'
    ctx.fillRect(0, -bedHeight, bedWidth, bedHeight)

    drawClippedGrid(ctx, bedWidth, bedHeight, 16)
    drawNoGoZones(ctx)

    for (let pcbIdx = 0; pcbIdx < drillStore.pcbs.length; pcbIdx++) {
      const pcb = drillStore.pcbs[pcbIdx]
      const isActive = pcb.id === drillStore.activePcbId
      const alpha = isActive ? 1.0 : 0.35
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(pcb.originOffsetX, -pcb.originOffsetY)
      ctx.rotate((pcb.rotation * Math.PI) / 180)

      ctx.strokeStyle = 'magenta'
      ctx.lineWidth = 2 / scale
      ctx.beginPath()
      ctx.moveTo(-4, 0)
      ctx.lineTo(4, 0)
      ctx.moveTo(0, -4)
      ctx.lineTo(0, 4)
      ctx.stroke()

      drawPcbOutline(ctx, pcb)
      drawDrillHoles(ctx, pcb)
      ctx.restore()

      drawTraveledPath(ctx, pcb)
      drawPathLines(ctx, pcb)
    }

    drawPathLabels(ctx)
    drawOriginMarkers(ctx)
    ctx.restore()

    drawPositionMarker(ctx)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.save()
    ctx.strokeStyle = 'blue'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(offsetX - 16, offsetY)
    ctx.lineTo(offsetX + 16, offsetY)
    ctx.moveTo(offsetX, offsetY - 16)
    ctx.lineTo(offsetX, offsetY + 16)
    ctx.stroke()
    ctx.restore()
  })
}

function getMouseBedPosition(e) {
  const rect = canvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left - offsetX) / scale
  const y = -(e.clientY - rect.top - offsetY) / scale
  return { x, y }
}

function findPointAtPosition(bedX, bedY) {
  const hitRadius = 5 / scale
  for (const pcb of drillStore.pcbs) {
    for (const d of pcb.drillData) {
      const bed = drillStore.drillToBedSpace(d, pcb)
      const dist = Math.hypot(bed.x - bedX, bed.y - bedY)
      if (dist < hitRadius) {
        return { data: d, pcb }
      }
    }
  }
  return null
}

function handleMouseDown(e) {
  if (e.button === 2) {
    isPanning = true
    startX = e.clientX
    startY = e.clientY
    e.preventDefault()
    return
  }

  if (e.button === 0 && props.selectedTool) {
    const bed = getMouseBedPosition(e)
    const point = findPointAtPosition(bed.x, bed.y)
    if (point) {
      emit('point-click', point)
    }
  }
}

function handleMouseMove(e) {
  if (isPanning) {
    offsetX += e.clientX - startX
    offsetY += e.clientY - startY
    startX = e.clientX
    startY = e.clientY
    updateCanvas()
    return
  }

  if (props.selectedTool) {
    const bed = getMouseBedPosition(e)
    const point = findPointAtPosition(bed.x, bed.y)
    hoveredPoint.value = point
    if (canvas.value) {
      canvas.value.style.cursor = point ? 'pointer' : 'default'
    }
  }
}

function handleMouseUp(e) {
  if (e.button === 2) {
    isPanning = false
  }
}

function handleZoom(e) {
  if (!canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const oldScale = scale
  const delta = e.deltaY * -0.005
  scale = Math.max(0.1, Math.min(30, scale + delta))
  offsetX = mx - (mx - offsetX) * (scale / oldScale)
  offsetY = my - (my - offsetY) * (scale / oldScale)
  updateCanvas()
}

let positionAnimFrame = null
function startPositionAnimation() {
  function animate() {
    updateCanvas()
    positionAnimFrame = requestAnimationFrame(animate)
  }
  positionAnimFrame = requestAnimationFrame(animate)
}

function stopPositionAnimation() {
  if (positionAnimFrame) {
    cancelAnimationFrame(positionAnimFrame)
    positionAnimFrame = null
  }
}

watch(
  () => printerCtrl.printer.printing,
  (printing) => {
    if (printing) {
      startPositionAnimation()
    } else {
      stopPositionAnimation()
      updateCanvas()
    }
  }
)

watch(
  () => drillStore.canvasShouldUpdate,
  (val) => {
    if (val) {
      updateCanvas()
      drillStore.acknowledgeCanvasUpdate()
    }
  }
)

watch(
  () => printerCtrl.printer.position,
  () => {
    updateCanvas()
  },
  { deep: true }
)

function onWindowResize() {
  resizeCanvas()
  fitCanvasToBuildPlate()
}

onMounted(async () => {
  const canvasEl = canvas.value
  if (!canvasEl) return
  ctx = canvasEl.getContext('2d')
  resizeCanvas()
  fitCanvasToBuildPlate()
  await nextTick()
  resizeCanvas()
  fitCanvasToBuildPlate()
  window.addEventListener('resize', onWindowResize)
  if (printerCtrl.printer.printing) {
    startPositionAnimation()
  }
})

onBeforeUnmount(() => {
  stopPositionAnimation()
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <canvas
    ref="canvas"
    class="print-canvas"
    :class="{
      'jog-cursor': selectedTool === 'jog-to-point',
      'solder-cursor': selectedTool === 'solder-point'
    }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @wheel.prevent="handleZoom"
    @contextmenu.prevent
  ></canvas>
</template>

<style scoped>
.print-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.jog-cursor {
  cursor: crosshair;
}

.solder-cursor {
  cursor: cell;
}
</style>
