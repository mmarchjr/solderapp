<script setup>
import { ref, computed, onBeforeUnmount, onMounted, watch, nextTick } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'
import { useGcodeGenerator } from '@/composables/useGcodeGenerator'
import CalibrateCanvas from './CalibrateCanvas.vue'
import ExtrudeBar from './ExtrudeBar.vue'
import CalibrateJogControls from './CalibrateJogControls.vue'

const PALETTE = [
  '#e6194b',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#42d4f4',
  '#f032e6',
  '#bfef45',
  '#fabed4',
  '#469990',
  '#dcbeff',
  '#9A6324',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000075',
  '#a9a9a9',
  '#000000',
  '#e6beff'
]

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()
const { interpolateLagrange, getPadArea, processTemplate } = useGcodeGenerator()

const printer = computed(() => printerCtrl.printer)
const currentProfile = computed(() => drillStore.profiles[drillStore.currentProfile])

const phase = ref('idle')
const calibrationType = ref(null)
const selectedPad = ref(null)
const extrudedAmount = ref(0)
const offsetStartPosition = ref(null)
const selectedTool = ref(null)

// --- Pad sizes (unique diameters across all PCBs) ---
const padSizes = computed(() => {
  const counts = new Map()
  for (const pcb of drillStore.pcbs) {
    const viaFilter = pcb.viaFilterDiameter ?? 0.4
    for (const d of pcb.drillData) {
      if (!d.solder) continue
      const diameter = parseDiameter(d.size)
      if (!Number.isFinite(diameter) || diameter <= viaFilter) continue
      const key = Math.round(diameter * 1000) / 1000
      if (!counts.has(key)) {
        counts.set(key, { diameter: key, area: getPadAreaFromDiameter(key), count: 0 })
      }
      counts.get(key).count++
    }
  }
  return [...counts.values()].sort((a, b) => a.diameter - b.diameter)
})

// --- Color map: diameter -> color ---
const padColorMap = computed(() => {
  const map = {}
  padSizes.value.forEach((ps, i) => {
    map[ps.diameter] = PALETTE[i % PALETTE.length]
  })
  return map
})

// --- Lagrange table (synced with store) ---
const lagrangeRows = ref([])
const lagrangeContextMenu = ref({ visible: false, rowIndex: -1, x: 0, y: 0 })

function toNumberOrDefault(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeLagrangeRows(rows) {
  const byArea = new Map()
  const sorted = [...rows].sort((a, b) => toNumberOrDefault(a.area) - toNumberOrDefault(b.area))
  for (const row of sorted) {
    const area = Math.max(0, toNumberOrDefault(row.area))
    byArea.set(area, {
      area,
      soak: toNumberOrDefault(row.soak),
      feed: toNumberOrDefault(row.feed),
      dwell: toNumberOrDefault(row.dwell)
    })
  }
  const normalized = [...byArea.values()]
  return normalized.length > 0 ? normalized : [{ area: 0, soak: 0, feed: 0, dwell: 0 }]
}

function buildLagrangeRowsFromStore(curves) {
  const soakCurve = curves?.soak ?? []
  const feedCurve = curves?.feed ?? []
  const dwellCurve = curves?.dwell ?? []
  const areas = new Set()
  soakCurve.forEach((p) => areas.add(toNumberOrDefault(p.area)))
  feedCurve.forEach((p) => areas.add(toNumberOrDefault(p.area)))
  dwellCurve.forEach((p) => areas.add(toNumberOrDefault(p.area)))
  const areaList = [...areas].sort((a, b) => a - b)
  if (areaList.length === 0) return [{ area: 0, soak: 0, feed: 0, dwell: 0 }]
  const soakByArea = new Map(
    soakCurve.map((p) => [toNumberOrDefault(p.area), toNumberOrDefault(p.value)])
  )
  const feedByArea = new Map(
    feedCurve.map((p) => [toNumberOrDefault(p.area), toNumberOrDefault(p.value)])
  )
  const dwellByArea = new Map(
    dwellCurve.map((p) => [toNumberOrDefault(p.area), toNumberOrDefault(p.value)])
  )
  return areaList.map((area) => ({
    area,
    soak: soakByArea.get(area) ?? 0,
    feed: feedByArea.get(area) ?? 0,
    dwell: dwellByArea.get(area) ?? 0
  }))
}

function syncLagrangeRowsFromStore() {
  lagrangeRows.value = buildLagrangeRowsFromStore(drillStore.lagrangeCurves)
}

function saveLagrangeRowsToStore() {
  const normalized = normalizeLagrangeRows(lagrangeRows.value)
  lagrangeRows.value = normalized
  drillStore.lagrangeCurves = {
    soak: normalized.map((row) => ({ area: row.area, value: row.soak })),
    feed: normalized.map((row) => ({ area: row.area, value: row.feed })),
    dwell: normalized.map((row) => ({ area: row.area, value: row.dwell }))
  }
}

function updateLagrangeCell(index, key, value) {
  if (!lagrangeRows.value[index]) return
  lagrangeRows.value[index][key] = toNumberOrDefault(value)
  saveLagrangeRowsToStore()
}

function addLagrangeRowBelow(index) {
  const current = lagrangeRows.value[index]
  const next = lagrangeRows.value[index + 1]
  const newArea = next
    ? (toNumberOrDefault(current.area) + toNumberOrDefault(next.area)) / 2
    : toNumberOrDefault(current.area) + 1
  lagrangeRows.value.splice(index + 1, 0, {
    area: Math.max(0, newArea),
    soak: toNumberOrDefault(current.soak),
    feed: toNumberOrDefault(current.feed),
    dwell: toNumberOrDefault(current.dwell)
  })
  saveLagrangeRowsToStore()
}

function deleteLagrangeRow(index) {
  if (lagrangeRows.value.length <= 1) return
  lagrangeRows.value.splice(index, 1)
  saveLagrangeRowsToStore()
}

function openLagrangeContextMenu(event, rowIndex) {
  event.preventDefault()
  lagrangeContextMenu.value = { visible: true, rowIndex, x: event.clientX, y: event.clientY }
}

function hideLagrangeContextMenu() {
  lagrangeContextMenu.value.visible = false
}

watch(
  () => drillStore.lagrangeCurves,
  () => {
    syncLagrangeRowsFromStore()
  },
  { deep: true, immediate: true }
)

function handleGlobalContextClick(e) {
  if (!e.target.closest('.lagrange-table') && !e.target.closest('.lagrange-context-menu')) {
    hideLagrangeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalContextClick)
  document.addEventListener('contextmenu', handleGlobalContextClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalContextClick)
  document.removeEventListener('contextmenu', handleGlobalContextClick)
})

// --- Helpers ---
function parseDiameter(sizeValue) {
  if (typeof sizeValue === 'number') return Number.isFinite(sizeValue) ? sizeValue : NaN
  if (typeof sizeValue !== 'string') return NaN
  const match = sizeValue.match(/[\d.]+/)
  return match ? Number(match[0]) : NaN
}

function getPadAreaFromDiameter(diameter) {
  return Math.PI * Math.pow(diameter / 2, 2)
}

async function sendCalibrationGcode(template) {
  if (!template || !template.trim()) return
  console.log('[Calibrate] Sending calibration gcode template')
  const profile = currentProfile.value
  const variables = {
    SAFE_Z: profile?.solderSafeZ ?? 10,
    RETRACT: profile?.retractAfterSolder ?? 0.25
  }
  const processed = processTemplate(template, variables)
  const lines = processed
    .split('\n')
    .map((l) => l.split(';')[0].trim())
    .filter((l) => l.length > 0)
  console.log('[Calibrate] Template resolved to', lines.length, 'lines')
  await printerCtrl.ensureAbsoluteMode()
  for (const line of lines) {
    try {
      console.log('[Calibrate] >>', line)
      await printerCtrl.serial?.send(line)
    } catch (err) {
      console.error('[Calibrate] G-code error:', err)
    }
  }
}

// --- Canvas point click ---
function handlePointClicked({ drill, pcb }) {
  if (phase.value !== 'idle') return
  const diameter = parseDiameter(drill.size)
  if (!Number.isFinite(diameter) || diameter <= 0) return
  selectedPad.value = { drill, pcb }
  console.log('[Calibrate] Point selected:', { id: drill.id, size: drill.size, pcb: pcb.filename })

  if (selectedTool.value === 'set-feed') {
    selectedTool.value = null
    startFeedCalibration()
  } else if (selectedTool.value === 'set-offset') {
    selectedTool.value = null
    startOffsetCalibration()
  }
}

function toggleTool(tool) {
  selectedTool.value = selectedTool.value === tool ? null : tool
}

// --- Feed calibration ---
async function startFeedCalibration() {
  if (!selectedPad.value || !printer.value.connected || !printer.value.homed) return
  console.log('[Calibrate] Starting feed calibration')
  calibrationType.value = 'feed'
  phase.value = 'jogging'
  extrudedAmount.value = 0

  phase.value = 'soldering'
  console.log('[Calibrate] Running solder sequence up to feed point')
  await runSolderSequenceUpToFeed(selectedPad.value.drill, selectedPad.value.pcb)
  phase.value = 'extruding'
  console.log('[Calibrate] Solder sequence complete — extrude phase ready')
}

async function runSolderSequenceUpToFeed(drill, pcb) {
  const profile = currentProfile.value
  if (!profile) return

  const padArea = Math.PI * Math.pow(parseFloat(drill.size) / 2, 2)
  const soakCurve = drillStore.lagrangeCurves.soak
  const soakTime = soakCurve.length > 0 ? interpolateLagrange(soakCurve, padArea) : drill.soak
  const prime = profile.feedPrime ?? 2.0
  const primeRetract = profile.feedRetract ?? 0.25
  const solderOffset = profile.solderOffset ?? 0.25
  const solderPrimeZ = profile.solderPrimeZ ?? 5
  const solderSafeZ = profile.solderSafeZ ?? 10
  const xOffset = drill.xOffset ?? 0
  const yOffset = drill.yOffset ?? 0
  const zOffset = (drill.zOffset ?? 0) + (pcb.originOffsetZ ?? 0)

  const angle = -(pcb.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const transformedX = drill.x * cos - drill.y * sin + pcb.originOffsetX
  const transformedY = drill.x * sin + drill.y * cos + pcb.originOffsetY

  console.log('[Calibrate] Solder sequence vars:', {
    SAFE_Z: solderSafeZ,
    X: transformedX + xOffset + solderOffset,
    Y: transformedY + yOffset,
    Z_OFFSET: zOffset,
    SOLDER_PRIME_Z: solderPrimeZ,
    PRIME: prime,
    PRIME_RETRACT: primeRetract,
    SOLDER_OFFSET: solderOffset,
    SOAK: soakTime
  })

  const vars = {
    SAFE_Z: solderSafeZ,
    X: transformedX + xOffset + solderOffset,
    Y: transformedY + yOffset,
    Z_OFFSET: zOffset,
    SOLDER_PRIME_Z: solderPrimeZ,
    PRIME: prime,
    PRIME_RETRACT: primeRetract,
    SOLDER_OFFSET: solderOffset,
    SOAK: soakTime
  }

  await printerCtrl.ensureAbsoluteMode()
  console.log('[Calibrate] >> M83 (set relative extruder mode)')
  await printerCtrl.serial?.send('M83')

  const template = profile.feedCalibrateBeforeGcode ?? ''
  const processed = processTemplate(template, vars)
  const lines = processed
    .split('\n')
    .map((l) => l.split(';')[0].trim())
    .filter((l) => l.length > 0)
  console.log('[Calibrate] Solder sequence:', lines.length, 'lines')
  for (const line of lines) {
    try {
      console.log('[Calibrate] >>', line)
      await printerCtrl.serial?.send(line)
    } catch (err) {
      console.error('[Calibrate] Solder sequence error:', err)
      phase.value = 'idle'
      return
    }
  }
  console.log('[Calibrate] >> M400 (wait for motion buffer)')
  await printerCtrl.serial?.send('M400')
  await printerCtrl.waitForOk(60000)
}

async function extrudeSolder(amount) {
  if (phase.value !== 'extruding') return
  console.log(
    `[Calibrate] Extruding ${amount.toFixed(2)}mm (total: ${(extrudedAmount.value + amount).toFixed(2)}mm)`
  )
  try {
    await printerCtrl.ensureAbsoluteMode()
    await printerCtrl.serial?.send('M83')
    await printerCtrl.serial?.send(`G1 E${amount.toFixed(2)} F600`)
    extrudedAmount.value += amount
  } catch (err) {
    console.error('[Calibrate] Extrude error:', err)
  }
}

async function retractSolder(amount) {
  if (phase.value !== 'extruding') return
  console.log(
    `[Calibrate] Retracting ${amount.toFixed(2)}mm (total: ${Math.max(0, extrudedAmount.value - amount).toFixed(2)}mm)`
  )
  try {
    await printerCtrl.ensureAbsoluteMode()
    await printerCtrl.serial?.send('M83')
    await printerCtrl.serial?.send(`G1 E-${amount.toFixed(2)} F800`)
    extrudedAmount.value = Math.max(0, extrudedAmount.value - amount)
  } catch (err) {
    console.error('[Calibrate] Retract error:', err)
  }
}

function confirmFeedCalibration() {
  if (!selectedPad.value || phase.value !== 'extruding') return
  const diameter = parseDiameter(selectedPad.value.drill.size)
  const area = getPadAreaFromDiameter(diameter)
  const feedValue = extrudedAmount.value
  console.log(
    `[Calibrate] Feed calibration confirmed: area=${area.toFixed(2)}mm², feed=${feedValue.toFixed(2)}mm`
  )

  const curves = { ...drillStore.lagrangeCurves }
  const feedCurve = [...(curves.feed || [])]
  const existingIdx = feedCurve.findIndex((p) => Math.abs(p.area - area) < 0.001)
  if (existingIdx >= 0) {
    feedCurve[existingIdx] = { area, value: feedValue }
    console.log('[Calibrate] Updated existing feed curve entry at area', area.toFixed(2))
  } else {
    feedCurve.push({ area, value: feedValue })
    feedCurve.sort((a, b) => a.area - b.area)
    console.log('[Calibrate] Added new feed curve entry at area', area.toFixed(2))
  }
  drillStore.lagrangeCurves = { ...curves, feed: feedCurve }

  const profile = currentProfile.value
  phase.value = 'idle'
  calibrationType.value = null
  selectedPad.value = null
  extrudedAmount.value = 0

  console.log('[Calibrate] Sending feed calibration after-gcode')
  sendCalibrationGcode(profile?.feedCalibrateAfterGcode)
}

// --- Offset calibration ---
async function startOffsetCalibration() {
  if (!selectedPad.value || !printer.value.connected || !printer.value.homed) return
  console.log('[Calibrate] Starting offset calibration')
  calibrationType.value = 'offset'
  phase.value = 'jogging'

  const { drill, pcb } = selectedPad.value
  const profile = currentProfile.value
  const safeZ = profile?.solderSafeZ ?? 10

  console.log('[Calibrate] Sending offset calibration before-gcode')
  await sendCalibrationGcode(profile?.offsetCalibrateBeforeGcode)
  await printerCtrl.ensureAbsoluteMode()
  console.log(`[Calibrate] Jogging to Z${safeZ}`)
  await printerCtrl.serial?.send(`G0 Z${safeZ} F800`)
  const bedCoords = drillStore.drillToBedSpace(drill, pcb)
  const x = bedCoords.x + (drill.xOffset ?? 0)
  const y = bedCoords.y + (drill.yOffset ?? 0)
  console.log(`[Calibrate] Moving to pad position: X${x.toFixed(2)} Y${y.toFixed(2)}`)
  await printerCtrl.moveTo(x, y)
  console.log('[Calibrate] >> M400 (wait for motion buffer)')
  await printerCtrl.serial?.send('M400')
  await printerCtrl.waitForOk(60000)

  offsetStartPosition.value = { x, y, z: safeZ }
  phase.value = 'offset-jogging'
  console.log('[Calibrate] Offset jogging phase — jog to correct position, then save')
}

function saveOffsetCalibration() {
  if (!selectedPad.value || !offsetStartPosition.value || phase.value !== 'offset-jogging') return
  const currentPos = printer.value.position
  const startPos = offsetStartPosition.value
  const deltaX = currentPos.x - startPos.x
  const deltaY = currentPos.y - startPos.y
  const deltaZ = currentPos.z - startPos.z
  console.log(
    `[Calibrate] Offset delta: deltaX=${deltaX.toFixed(3)}, deltaY=${deltaY.toFixed(3)}, deltaZ=${deltaZ.toFixed(3)}`
  )

  const drill = selectedPad.value.drill
  drill.xOffset = deltaX
  drill.yOffset = deltaY
  drill.zOffset = deltaZ
  console.log(`[Calibrate] Saved offsets to drill ${drill.id}`)

  const profile = currentProfile.value
  phase.value = 'idle'
  calibrationType.value = null
  selectedPad.value = null
  offsetStartPosition.value = null

  console.log('[Calibrate] Sending offset calibration after-gcode')
  sendCalibrationGcode(profile?.offsetCalibrateAfterGcode)
}

// --- Cancel ---
function cancelCalibration() {
  const profile = currentProfile.value
  const safeZ = profile?.solderSafeZ ?? 10
  const retract = profile?.retractAfterSolder ?? 0.25
  console.log(`[Calibrate] Calibration cancelled — retracting ${retract}mm, lifting to Z${safeZ}`)

  phase.value = 'idle'
  calibrationType.value = null
  selectedPad.value = null
  extrudedAmount.value = 0
  offsetStartPosition.value = null
  ;(async () => {
    try {
      await printerCtrl.ensureAbsoluteMode()
      await printerCtrl.serial?.send('M83')
      await printerCtrl.serial?.send(`G1 E-${retract} F800`)
    } catch {}
    try {
      await printerCtrl.serial?.send(`G0 Z${safeZ} F800`)
    } catch {}
    console.log('[Calibrate] Cancel gcode complete')
  })()
}

function handleJogXY({ dx, dy }) {
  if (phase.value !== 'offset-jogging') return
  printerCtrl.jogX(dx)
  printerCtrl.jogY(dy)
}

function handleJogZ({ dz }) {
  if (phase.value !== 'offset-jogging') return
  printerCtrl.jogZ(dz)
}

// --- Per-pad Lagrange lookup ---
function getLagrangeForPad(diameter) {
  const area = getPadAreaFromDiameter(diameter)
  const feedCurve = drillStore.lagrangeCurves.feed
  const soakCurve = drillStore.lagrangeCurves.soak
  const dwellCurve = drillStore.lagrangeCurves.dwell
  return {
    feed: feedCurve.length > 0 ? interpolateLagrange(feedCurve, area) : 0,
    soak: soakCurve.length > 0 ? interpolateLagrange(soakCurve, area) : 0,
    dwell: dwellCurve.length > 0 ? interpolateLagrange(dwellCurve, area) : 0
  }
}

function getPadColorForArea(area) {
  for (const ps of padSizes.value) {
    if (Math.abs(ps.area - area) < 0.001) return padColorMap.value[ps.diameter] || '#999'
  }
  return '#999'
}
</script>

<template>
  <div class="calibrate-tab">
    <!-- Prerequisites check -->
    <div
      v-if="!printer.connected || !printer.homed || drillStore.pcbs.length === 0"
      class="calibrate-placeholder"
    >
      <div class="text-center p-5">
        <i class="fa-solid fa-bullseye fa-3x text-muted mb-3"></i>
        <h4>Calibrate Feed & Offsets</h4>
        <p v-if="drillStore.pcbs.length === 0" class="text-muted">
          Load a PCB in the Path tab to begin calibration.
        </p>
        <p v-else-if="!printer.connected" class="text-muted">
          Connect to a printer in the Print tab to begin calibration.
        </p>
        <p v-else-if="!printer.homed" class="text-muted">
          Home the printer in the Print tab to begin calibration.
        </p>
      </div>
    </div>

    <!-- Main calibration UI -->
    <div v-else class="calibrate-layout">
      <!-- Canvas area -->
      <div class="calibrate-canvas-area">
        <div v-if="phase !== 'idle'" class="editing-disabled-banner">
          <i class="fa-solid fa-lock me-1"></i> Calibration in progress — point selection disabled
        </div>
        <div class="canvas-container">
          <CalibrateCanvas
            :selected-pad="selectedPad"
            :phase="phase"
            :printer-position="printer.position"
            :pad-color-map="padColorMap"
            @point-clicked="handlePointClicked"
          />
          <div class="tool-bar">
            <button
              class="btn btn-sm"
              :class="selectedTool === 'set-feed' ? 'btn-warning' : 'btn-outline-secondary'"
              :disabled="phase !== 'idle'"
              @click="toggleTool('set-feed')"
            >
              <i class="fa-solid fa-fire me-1"></i> Set Feed
            </button>
            <button
              class="btn btn-sm"
              :class="selectedTool === 'set-offset' ? 'btn-primary' : 'btn-outline-secondary'"
              :disabled="phase !== 'idle'"
              @click="toggleTool('set-offset')"
            >
              <i class="fa-solid fa-crosshairs me-1"></i> Set Offset
            </button>
          </div>

          <!-- Extrude bar overlay -->
          <ExtrudeBar
            v-if="calibrationType === 'feed' && (phase === 'soldering' || phase === 'extruding')"
            :extruded-amount="extrudedAmount"
            :pad-area="
              selectedPad ? getPadAreaFromDiameter(parseDiameter(selectedPad.drill.size)) : 0
            "
            :current-feed="
              selectedPad ? getLagrangeForPad(parseDiameter(selectedPad.drill.size)).feed : 0
            "
            :disabled="phase === 'soldering'"
            @extrude="extrudeSolder"
            @retract="retractSolder"
            @confirm="confirmFeedCalibration"
            @cancel="cancelCalibration"
          />

          <!-- Jog controls overlay -->
          <CalibrateJogControls
            v-if="
              calibrationType === 'offset' && (phase === 'jogging' || phase === 'offset-jogging')
            "
            :printer-position="printer.position"
            :disabled="phase === 'jogging'"
            @jog-xy="handleJogXY"
            @jog-z="handleJogZ"
            @save="saveOffsetCalibration"
            @cancel="cancelCalibration"
          />

          <!-- Cancel button overlay (only during soldering, since JogControls has its own cancel) -->
          <div v-if="phase === 'soldering'" class="cancel-overlay">
            <button class="btn btn-outline-danger" @click="cancelCalibration">
              <i class="fa-solid fa-xmark me-1"></i> Cancel
            </button>
          </div>

          <!-- Status overlay -->
          <div v-if="phase !== 'idle'" class="status-overlay">
            <div v-if="phase === 'jogging'" class="badge bg-info">
              <i class="fa-solid fa-spinner fa-spin me-1"></i> Jogging to pad...
            </div>
            <div v-else-if="phase === 'soldering'" class="badge bg-warning text-dark">
              <i class="fa-solid fa-fire me-1"></i> Running solder sequence...
            </div>
            <div v-else-if="phase === 'extruding'" class="badge bg-success">
              <i class="fa-solid fa-arrow-up me-1"></i> Extrude solder manually
            </div>
            <div v-else-if="phase === 'offset-jogging'" class="badge bg-info">
              <i class="fa-solid fa-arrows-up-down-left-right me-1"></i> Jog to correct position
            </div>
          </div>
        </div>
      </div>

      <!-- Right panel: Lagrange table -->
      <div class="calibrate-right">
        <h6 class="mb-2"><i class="fa-solid fa-table me-1"></i> Pad Area Parameter Table</h6>
        <p class="text-muted small mb-3">
          Map pad area (mm²) to soak/feed/dwell values. Right-click a row to add or delete.
        </p>

        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0 lagrange-table">
            <thead class="table-light">
              <tr>
                <th>Color</th>
                <th>Pad Area (mm²)</th>
                <th>Feed</th>
                <th>Soak</th>
                <th>Dwell</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in lagrangeRows"
                :key="`lagrange-row-${index}`"
                @contextmenu="openLagrangeContextMenu($event, index)"
              >
                <td>
                  <span
                    class="color-dot"
                    :style="{ backgroundColor: getPadColorForArea(row.area) }"
                  ></span>
                </td>
                <td>
                  <input
                    type="number"
                    class="form-control form-control-sm"
                    :value="row.area"
                    step="0.1"
                    min="0"
                    @change="updateLagrangeCell(index, 'area', $event.target.valueAsNumber)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="form-control form-control-sm"
                    :value="row.feed"
                    step="0.1"
                    min="0"
                    @change="updateLagrangeCell(index, 'feed', $event.target.valueAsNumber)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="form-control form-control-sm"
                    :value="row.soak"
                    step="0.1"
                    min="0"
                    @change="updateLagrangeCell(index, 'soak', $event.target.valueAsNumber)"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="form-control form-control-sm"
                    :value="row.dwell"
                    step="0.1"
                    min="0"
                    @change="updateLagrangeCell(index, 'dwell', $event.target.valueAsNumber)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Context menu -->
        <div
          v-if="lagrangeContextMenu.visible"
          class="lagrange-context-menu"
          :style="{ top: `${lagrangeContextMenu.y}px`, left: `${lagrangeContextMenu.x}px` }"
        >
          <button
            type="button"
            class="dropdown-item"
            @click="
              addLagrangeRowBelow(lagrangeContextMenu.rowIndex)
              hideLagrangeContextMenu()
            "
          >
            <i class="fa-solid fa-plus me-2"></i>Add Row Below
          </button>
          <button
            type="button"
            class="dropdown-item text-danger"
            :disabled="lagrangeRows.length <= 1"
            @click="
              deleteLagrangeRow(lagrangeContextMenu.rowIndex)
              hideLagrangeContextMenu()
            "
          >
            <i class="fa-solid fa-trash me-2"></i>Delete Row
          </button>
        </div>

        <!-- Legend -->
        <div class="mt-3">
          <h6 class="text-muted mb-2"><i class="fa-solid fa-palette me-1"></i> Legend</h6>
          <div class="d-flex flex-wrap gap-2">
            <div v-for="(ps, idx) in padSizes" :key="ps.diameter" class="legend-item">
              <span class="color-dot" :style="{ backgroundColor: padColorMap[ps.diameter] }"></span>
              <span class="small">{{ ps.diameter.toFixed(2) }}mm (×{{ ps.count }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calibrate-tab {
  display: flex;
  height: calc(100vh - 56px);
  overflow: hidden;
}

.calibrate-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.calibrate-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.calibrate-canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #e8e8e8;
}

.editing-disabled-banner {
  background: rgba(255, 193, 7, 0.15);
  color: #856404;
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 193, 7, 0.3);
  text-align: center;
  z-index: 20;
  position: relative;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.tool-bar {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  z-index: 10;
  pointer-events: none;
}

.tool-bar .btn {
  pointer-events: auto;
}

/* ExtrudeBar and CalibrateJogControls overlays */
.extrude-bar,
.calibrate-jog-controls {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 16px;
  min-width: 320px;
  max-width: 400px;
}

.status-overlay {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
}

.status-overlay .badge {
  font-size: 0.85rem;
  padding: 6px 14px;
}

@keyframes gcode-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.cancel-overlay {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 10;
  pointer-events: none;
}

.cancel-overlay .btn {
  pointer-events: auto;
}

.calibrate-right {
  width: 380px;
  min-width: 380px;
  border-left: 1px solid #dee2e6;
  overflow-y: auto;
  background: #fff;
  padding: 12px;
}

.lagrange-table input {
  min-width: 70px;
}

.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #333;
  flex-shrink: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lagrange-context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px 0;
  min-width: 160px;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 6px 16px;
  font-size: 0.875rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: #f0f7ff;
}

.dropdown-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
