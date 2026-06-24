<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useDrillStore } from '@/stores/store'

const emit = defineEmits(['point-clicked'])

const props = defineProps({
  selectedPad: { type: Object, default: null },
  phase: { type: String, default: 'idle' },
  printerPosition: { type: Object, default: () => ({ x: 0, y: 0, z: 0 }) },
  padColorMap: { type: Object, default: () => ({}) }
})

const drillStore = useDrillStore()

const canvas = ref(null)
let ctx,
  scale = 1,
  offsetX = 0,
  offsetY = 0
let pendingRenderFrame = null
let isPanning = false
let startX = 0,
  startY = 0

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

function drawDrillHoles(context, pcb) {
  const viaFilter = pcb.viaFilterDiameter ?? 0.4
  for (const d of pcb.drillData) {
    const holeDiameter = getDiameter(d.size)
    if (holeDiameter < viaFilter) continue
    const x = d.x,
      y = -d.y
    const r = holeDiameter / 2 || 2

    const isSelected =
      props.selectedPad &&
      props.selectedPad.drill.id === d.id &&
      props.selectedPad.pcb.id === pcb.id
    const colorKey = Math.round(holeDiameter * 1000) / 1000
    const color = props.padColorMap[colorKey]

    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)

    if (isSelected) {
      context.fillStyle = '#ffeb3b'
      context.strokeStyle = '#ff9800'
      context.lineWidth = 3 / scale
    } else if (color) {
      context.fillStyle = color
      context.strokeStyle = '#333'
      context.lineWidth = 1.5 / scale
    } else {
      context.fillStyle = d.solder ? '#999' : '#ccc'
      context.strokeStyle = '#666'
      context.lineWidth = 1.5 / scale
    }

    context.fill()
    context.stroke()

    if (isSelected) {
      context.beginPath()
      context.arc(x, y, r + 4 / scale, 0, 2 * Math.PI)
      context.strokeStyle = '#ff9800'
      context.lineWidth = 2 / scale
      context.setLineDash([3 / scale, 3 / scale])
      context.stroke()
      context.setLineDash([])
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

function drawPositionMarker(context) {
  if (!drillStore.printerConnected) return

  const pos = props.printerPosition
  const sx = offsetX + pos.x * scale
  const sy = offsetY - pos.y * scale
  const size = 12

  context.save()

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

  context.restore()
}

function updateCanvas() {
  if (!ctx) return
  if (pendingRenderFrame) return

  pendingRenderFrame = requestAnimationFrame(() => {
    pendingRenderFrame = null
    if (!canvas.value || !ctx) return
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
    }

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

function handlePointerDown(e) {
  if (e.button === 2) {
    isPanning = true
    startX = e.clientX
    startY = e.clientY
    e.preventDefault()
  }
}

function handlePointerMove(e) {
  if (isPanning) {
    offsetX += e.clientX - startX
    offsetY += e.clientY - startY
    startX = e.clientX
    startY = e.clientY
    updateCanvas()
  }
}

function handlePointerUp(e) {
  if (e.button === 2) {
    isPanning = false
  } else if (e.button === 0 && !isPanning) {
    handleClick(e)
  }
}

function handleClick(e) {
  const rect = canvas.value.getBoundingClientRect()
  const mx = (e.clientX - rect.left - offsetX) / scale
  const my = -(e.clientY - rect.top - offsetY) / scale

  let bestDist = Infinity
  let bestHit = null

  for (const pcb of drillStore.pcbs) {
    const rad = -(pcb.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const viaFilter = pcb.viaFilterDiameter ?? 0.4

    for (const d of pcb.drillData) {
      if (!d.solder) continue
      const holeDiameter = getDiameter(d.size)
      if (holeDiameter < viaFilter) continue

      const rotatedX = d.x * cos - d.y * sin + pcb.originOffsetX
      const rotatedY = d.x * sin + d.y * cos + pcb.originOffsetY
      const dist = Math.hypot(rotatedX - mx, rotatedY - my)
      if (dist < bestDist) {
        bestDist = dist
        bestHit = { drill: d, pcb, diameter: holeDiameter }
      }
    }
  }

  if (bestHit && bestDist <= bestHit.diameter / 2 + 2 / scale) {
    emit('point-clicked', bestHit)
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
  () => props.printerPosition,
  () => {
    updateCanvas()
  },
  { deep: true }
)

watch(
  () => props.selectedPad,
  () => {
    updateCanvas()
  },
  { deep: true }
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
  startPositionAnimation()
})

onBeforeUnmount(() => {
  stopPositionAnimation()
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <canvas
    ref="canvas"
    class="calibrate-canvas"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @wheel.prevent="handleZoom"
    @contextmenu.prevent
  ></canvas>
</template>

<style scoped>
.calibrate-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
