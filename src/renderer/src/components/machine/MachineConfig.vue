<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import ProfileManager from './ProfileManager.vue'
import GcodeEditor from '@/components/gcode/GcodeEditor.vue'
import PadAreaMap from '@/components/ui/PadAreaMap.vue'

import { useDrillStore } from '@/stores/store'

const drillStore = useDrillStore()
const settingsFileInput = ref(null)

// Serial settings
const baudRate = computed({
  get: () => drillStore.profiles[drillStore.currentProfile]?.baudRate ?? 115200,
  set: (val) => {
    drillStore.updateCurrentProfileSettings({ baudRate: val })
    localStorage.setItem('solderBaudRate', val)
  }
})

const lineEnding = computed({
  get: () => {
    const ending = drillStore.profiles[drillStore.currentProfile]?.lineEnding ?? '\n'
    if (ending === '\r\n') return 'CRLF'
    if (ending === '\r') return 'CR'
    if (ending === '') return 'None'
    return 'LF'
  },
  set: (val) => {
    const map = { LF: '\n', CRLF: '\r\n', CR: '\r', None: '' }
    const actual = map[val] ?? '\n'
    drillStore.updateCurrentProfileSettings({ lineEnding: actual })
    localStorage.setItem('solderLineEnding', val)
  }
})

const baudRateOptions = [9600, 19200, 38400, 57600, 115200, 250000]
const lineEndingOptions = ['LF', 'CRLF', 'CR', 'None']

// Profile selection
const selectedProfile = computed({
  get: () => drillStore.currentProfile,
  set: (val) => drillStore.setCurrentProfile(val)
})

const profileNames = computed(() => Object.keys(drillStore.profiles))

// Homing inputs
const homeX = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].homeX,
  set: (val) => drillStore.updateCurrentProfileSettings({ homeX: val })
})
const homeY = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].homeY,
  set: (val) => drillStore.updateCurrentProfileSettings({ homeY: val })
})
const homeZ = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].homeZ,
  set: (val) => drillStore.updateCurrentProfileSettings({ homeZ: val })
})

const pcbThickness = computed({
  get: () => drillStore.pcbThickness,
  set: (val) => {
    drillStore.pcbThickness = val
  }
})

const bedWidth = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].bedWidth ?? 235,
  set: (val) => {
    drillStore.updateCurrentProfileSettings({ bedWidth: val })
    drillStore.triggerCanvasUpdate()
  }
})

const bedHeight = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].bedHeight ?? 235,
  set: (val) => {
    drillStore.updateCurrentProfileSettings({ bedHeight: val })
    drillStore.triggerCanvasUpdate()
  }
})

const startSafeZ = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].startSafeZ,
  set: (val) => drillStore.updateCurrentProfileSettings({ startSafeZ: val })
})

const solderSafeZ = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].solderSafeZ,
  set: (val) => drillStore.updateCurrentProfileSettings({ solderSafeZ: val })
})

const solderPrimeZ = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].solderPrimeZ,
  set: (val) => drillStore.updateCurrentProfileSettings({ solderPrimeZ: val })
})

const endSafeZ = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].endSafeZ,
  set: (val) => drillStore.updateCurrentProfileSettings({ endSafeZ: val })
})

const solderFeedMultiplier = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].solderFeedMultiplier,
  set: (val) => drillStore.updateCurrentProfileSettings({ solderFeedMultiplier: val })
})

const feedPrime = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].feedPrime,
  set: (val) => drillStore.updateCurrentProfileSettings({ feedPrime: val })
})

const feedRetract = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].feedRetract,
  set: (val) => drillStore.updateCurrentProfileSettings({ feedRetract: val })
})

const retractAfterSolder = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].retractAfterSolder,
  set: (val) => drillStore.updateCurrentProfileSettings({ retractAfterSolder: val })
})

const playBeep = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].playBeep,
  set: (val) => drillStore.updateCurrentProfileSettings({ playBeep: val })
})

const startGcode = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].startGcode,
  set: (val) => drillStore.updateCurrentProfileSettings({ startGcode: val })
})

const perPointGcode = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].perPointGcode,
  set: (val) => drillStore.updateCurrentProfileSettings({ perPointGcode: val })
})

const endGcode = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].endGcode,
  set: (val) => drillStore.updateCurrentProfileSettings({ endGcode: val })
})

const betweenBoardGcode = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].betweenBoardGcode,
  set: (val) => drillStore.updateCurrentProfileSettings({ betweenBoardGcode: val })
})

const periodicGcode = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].periodicGcode,
  set: (val) => drillStore.updateCurrentProfileSettings({ periodicGcode: val })
})

const periodicHoleCount = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].periodicHoleCount ?? 0,
  set: (val) => drillStore.updateCurrentProfileSettings({ periodicHoleCount: val })
})

const periodicAtStart = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].periodicAtStart ?? false,
  set: (val) => drillStore.updateCurrentProfileSettings({ periodicAtStart: val })
})

const periodicAtEnd = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].periodicAtEnd ?? false,
  set: (val) => drillStore.updateCurrentProfileSettings({ periodicAtEnd: val })
})

// Add new computed property for point offset X
const solderOffset = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].solderOffset ?? 0,
  set: (val) => drillStore.updateCurrentProfileSettings({ solderOffset: val })
})

const leftMoveWarningDistance = computed({
  get: () => drillStore.profiles[drillStore.currentProfile].leftMoveWarningDistance ?? 10,
  set: (val) => drillStore.updateCurrentProfileSettings({ leftMoveWarningDistance: val })
})

function resetToDefaults() {
  drillStore.resetCurrentProfileToDefault()
}

function exportSettings() {
  const payload = {
    version: 1,
    type: 'solder-app-settings',
    exportedAt: new Date().toISOString(),
    currentProfile: drillStore.currentProfile,
    profiles: drillStore.profiles
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'solder-settings.json'
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImportSettings() {
  settingsFileInput.value?.click()
}

function importSettings(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result)

      if (parsed?.profiles && typeof parsed.profiles === 'object') {
        drillStore.loadProfilesFromProject(parsed.profiles, parsed.currentProfile)
        drillStore.saveProfilesToStorage()
        alert('Settings imported successfully.')
        return
      }

      if (parsed?.profileSettings && parsed?.currentProfile) {
        drillStore.loadProfilesFromProject(
          { [parsed.currentProfile]: parsed.profileSettings },
          parsed.currentProfile
        )
        drillStore.saveProfilesToStorage()
        alert('Settings imported successfully.')
        return
      }

      throw new Error('Invalid settings file format')
    } catch (error) {
      alert(`Failed to import settings: ${error.message}`)
    }
  }
  reader.readAsText(file)
}

const splineRows = ref([])
const splineContextMenu = ref({
  visible: false,
  rowIndex: -1,
  x: 0,
  y: 0
})

function toNumberOrDefault(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSplineRows(rows) {
  const byArea = new Map()
  const sortedRows = [...rows].sort((a, b) => toNumberOrDefault(a.area) - toNumberOrDefault(b.area))

  for (const row of sortedRows) {
    const area = Math.max(0, toNumberOrDefault(row.area))
    byArea.set(area, {
      area,
      soak: toNumberOrDefault(row.soak),
      feed: toNumberOrDefault(row.feed),
      dwell: toNumberOrDefault(row.dwell)
    })
  }

  const normalized = [...byArea.values()]
  if (normalized.length === 0) {
    return [{ area: 0, soak: 0, feed: 0, dwell: 0 }]
  }

  return normalized
}

function buildSplineRowsFromStore(curves) {
  const soakCurve = curves?.soak ?? []
  const feedCurve = curves?.feed ?? []
  const dwellCurve = curves?.dwell ?? []
  const areas = new Set()

  soakCurve.forEach((p) => areas.add(toNumberOrDefault(p.area)))
  feedCurve.forEach((p) => areas.add(toNumberOrDefault(p.area)))
  dwellCurve.forEach((p) => areas.add(toNumberOrDefault(p.area)))

  const areaList = [...areas].sort((a, b) => a - b)
  if (areaList.length === 0) {
    return [{ area: 0, soak: 0, feed: 0, dwell: 0 }]
  }

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

function syncSplineRowsFromStore() {
  splineRows.value = buildSplineRowsFromStore(drillStore.splineCurves)
}

function saveSplineRowsToStore() {
  const normalized = normalizeSplineRows(splineRows.value)
  splineRows.value = normalized
  drillStore.splineCurves = {
    soak: normalized.map((row) => ({ area: row.area, value: row.soak })),
    feed: normalized.map((row) => ({ area: row.area, value: row.feed })),
    dwell: normalized.map((row) => ({ area: row.area, value: row.dwell }))
  }
}

function updateSplineCell(index, key, value) {
  if (!splineRows.value[index]) return
  splineRows.value[index][key] = toNumberOrDefault(value)
  saveSplineRowsToStore()
}

function addSplineRowBelow(index) {
  const current = splineRows.value[index]
  const next = splineRows.value[index + 1]
  const newArea = next
    ? (toNumberOrDefault(current.area) + toNumberOrDefault(next.area)) / 2
    : toNumberOrDefault(current.area) + 1
  splineRows.value.splice(index + 1, 0, {
    area: Math.max(0, newArea),
    soak: toNumberOrDefault(current.soak),
    feed: toNumberOrDefault(current.feed),
    dwell: toNumberOrDefault(current.dwell)
  })
  saveSplineRowsToStore()
}

function deleteSplineRow(index) {
  if (splineRows.value.length <= 1) return
  splineRows.value.splice(index, 1)
  saveSplineRowsToStore()
}

function openSplineContextMenu(event, rowIndex) {
  event.preventDefault()
  splineContextMenu.value = {
    visible: true,
    rowIndex,
    x: event.clientX,
    y: event.clientY
  }
}

function hideSplineContextMenu() {
  if (!splineContextMenu.value.visible) return
  splineContextMenu.value.visible = false
}

function handleGlobalClick() {
  hideSplineContextMenu()
}

watch(
  () => drillStore.splineCurves,
  () => {
    syncSplineRowsFromStore()
  },
  { deep: true, immediate: true }
)

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div id="machineConfigModal" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable modal-fullscreen-ish">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="fa-solid fa-gears"></i> Advanced Settings</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body">
          <div class="container-fluid">
            <div class="mb-3 d-flex align-items-center flex-wrap gap-2">
              <label class="me-2">Profile:</label>
              <ProfileManager />
              <button class="btn btn-outline-secondary ms-3" @click="resetToDefaults">
                Reset to Defaults
              </button>
              <button class="btn btn-outline-primary" @click="exportSettings">
                Export Settings
              </button>
              <button class="btn btn-outline-primary" @click="triggerImportSettings">
                Import Settings
              </button>
              <input
                ref="settingsFileInput"
                type="file"
                accept=".json"
                class="d-none"
                @change="importSettings"
              />
            </div>

            <!-- Serial Connection -->
            <div class="row">
              <div class="col-md-6">
                <h5 class="mt-3"><i class="fa-solid fa-plug"></i> Serial Connection</h5>
                <p class="text-muted small">Configure serial communication with the printer.</p>

                <label class="form-label mt-3">Baud Rate</label>
                <select v-model="baudRate" class="form-select">
                  <option v-for="rate in baudRateOptions" :key="rate" :value="rate">
                    {{ rate }}
                  </option>
                </select>

                <label class="form-label mt-3">Line Ending</label>
                <select v-model="lineEnding" class="form-select">
                  <option v-for="ending in lineEndingOptions" :key="ending" :value="ending">
                    {{ ending }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <div class="mt-5 p-3 bg-light bg-opacity-10 rounded">
                  <h6>Serial Port Info</h6>
                  <p class="small text-muted mb-1"><strong>Baud Rate:</strong> {{ baudRate }}</p>
                  <p class="small text-muted mb-1">
                    <strong>Line Ending:</strong> {{ lineEnding }} ({{
                      lineEnding === 'LF'
                        ? '\\n'
                        : lineEnding === 'CRLF'
                          ? '\\r\\n'
                          : lineEnding === 'CR'
                            ? '\\r'
                            : 'None'
                    }})
                  </p>
                  <p class="small text-muted mb-0">
                    Connect to your printer in the Print tab after configuring these settings.
                  </p>
                </div>
              </div>
            </div>

            <hr class="my-4" />

            <!-- Start G-code Settings + GcodeEditor in same row -->
            <div class="row">
              <div class="col-md-6">
                <h5 class="mt-3"><i class="fa-solid fa-play"></i> Start G-code</h5>

                <label class="form-label mt-3" title="{PCB_THICKNESS}">PCB Thickness (mm)</label>
                <input v-model="pcbThickness" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3">Bed Size (mm)</label>
                <div class="row">
                  <div class="col-6">
                    <label class="form-label form-label-sm">Width</label>
                    <input
                      v-model.number="bedWidth"
                      type="number"
                      class="form-control"
                      step="1"
                      min="1"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label form-label-sm">Height</label>
                    <input
                      v-model.number="bedHeight"
                      type="number"
                      class="form-control"
                      step="1"
                      min="1"
                    />
                  </div>
                </div>

                <label class="form-label mt-3" title="{START_SAFE_Z}">Start Safe Z</label>
                <input v-model="startSafeZ" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3" title="{MULTIPLIER}">Solder Feed Multiplier</label>
                <input
                  v-model="solderFeedMultiplier"
                  type="number"
                  class="form-control"
                  step="0.1"
                />
              </div>

              <div class="col-md-6">
                <GcodeEditor
                  :code="startGcode"
                  title="Start G-code"
                  icon="fa-play"
                  @update:code="startGcode = $event"
                />
              </div>
            </div>

            <!-- Per Point + End Settings remain grouped -->
            <div class="row mt-4">
              <div class="col-md-6">
                <h5><i class="fa-solid fa-crosshairs"></i> Per Point G-code</h5>

                <label class="form-label mt-3" title="{PRIME}">Solder Prime</label>
                <input v-model="feedPrime" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3" title="{PRIME_RETRACT}">Solder Prime Retract</label>
                <input v-model="feedRetract" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3" title="{SOLDER_OFFSET}">Solder Offset</label>
                <input v-model="solderOffset" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3" title="{RETRACT}">Solder Retract</label>
                <input v-model="retractAfterSolder" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3" title="{SOLDER_SAFE_Z}">Solder Prime Z</label>
                <input v-model="solderPrimeZ" type="number" class="form-control" step="0.1" />

                <label class="form-label mt-3" title="{SOLDER_SAFE_Z}">Solder Safe Z</label>
                <input v-model="solderSafeZ" type="number" class="form-control" step="0.1" />

                <label
                  class="form-label mt-3"
                  title="Minimum distance for leftward moves between pads. Warns about potential solder bridging if the nozzle moves left from a point closer than this."
                  >Left Move Warning Distance (mm)</label
                >
                <input
                  v-model.number="leftMoveWarningDistance"
                  type="number"
                  class="form-control"
                  step="0.5"
                  min="0"
                />
                <div class="form-text">
                  Set to 0 to disable. Warns when the nozzle moves left between pads closer than
                  this distance, which may bridge solder.
                </div>
              </div>

              <div class="col-md-6">
                <GcodeEditor
                  :code="perPointGcode"
                  title="Per-Point G-code"
                  icon="fa-crosshairs"
                  @update:code="perPointGcode = $event"
                />
              </div>
            </div>

            <div class="row mt-4">
              <div class="col-md-6">
                <h5><i class="fa-solid fa-arrow-right-arrow-left"></i> Between Board G-code</h5>
                <p class="text-muted small">G-code executed when transitioning between PCBs.</p>
              </div>
              <div class="col-md-6">
                <GcodeEditor
                  :code="betweenBoardGcode"
                  title="Between Board G-code"
                  icon="fa-arrow-right-arrow-left"
                  @update:code="betweenBoardGcode = $event"
                />
              </div>
            </div>

            <div class="row mt-4">
              <div class="col-md-6">
                <h5><i class="fa-solid fa-rotate"></i> Periodic G-code</h5>
                <p class="text-muted small">G-code executed after every N holes.</p>

                <label class="form-label mt-3">Hole Count Interval (0 = disabled)</label>
                <input
                  v-model="periodicHoleCount"
                  type="number"
                  class="form-control"
                  step="1"
                  min="0"
                />

                <div class="form-check mt-3">
                  <input v-model="periodicAtStart" class="form-check-input" type="checkbox" />
                  <label class="form-check-label">Run before first hole</label>
                </div>

                <div class="form-check mt-3">
                  <input v-model="periodicAtEnd" class="form-check-input" type="checkbox" />
                  <label class="form-check-label">Run after last hole</label>
                </div>
              </div>
              <div class="col-md-6">
                <GcodeEditor
                  :code="periodicGcode"
                  title="Periodic G-code"
                  icon="fa-rotate"
                  @update:code="periodicGcode = $event"
                />
              </div>
            </div>

            <div class="row mt-4">
              <div class="col-md-6">
                <h5><i class="fa-solid fa-stop"></i> End G-code</h5>
                <label class="form-label" title="{END_SAFE_Z}">End Safe Z</label>
                <input v-model="endSafeZ" type="number" class="form-control" step="0.1" />

                <div class="form-check mt-3">
                  <input v-model="playBeep" class="form-check-input" type="checkbox" />
                  <label class="form-check-label" title="{BEEP}">Play Beep</label>
                </div>
              </div>

              <div class="col-md-6">
                <GcodeEditor
                  :code="endGcode"
                  title="End G-code"
                  icon="fa-stop"
                  @update:code="endGcode = $event"
                />
              </div>
            </div>

            <!-- Spline Table -->
            <div class="row mt-4">
              <div class="col-12">
                <h5><i class="fa-solid fa-table"></i> Pad Area Parameter Table</h5>
                <p class="text-muted small">
                  Map pad area (mm²) to soak/feed/dwell values. Interpolation is still applied
                  between rows during G-code generation. Right-click a row to add one below it or
                  delete it.
                </p>
              </div>

              <div class="col-md-7">
                <PadAreaMap />
              </div>

              <div class="col-md-5">
                <div class="table-responsive">
                  <table class="table table-sm table-bordered align-middle mb-0 spline-table">
                    <thead class="table-light">
                      <tr>
                        <th>Pad Area (mm²)</th>
                        <th>Soak</th>
                        <th>Feed</th>
                        <th>Dwell</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, index) in splineRows"
                        :key="`spline-row-${index}`"
                        @contextmenu="openSplineContextMenu($event, index)"
                      >
                        <td>
                          <input
                            type="number"
                            class="form-control form-control-sm"
                            :value="row.area"
                            step="0.1"
                            min="0"
                            @change="updateSplineCell(index, 'area', $event.target.valueAsNumber)"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="form-control form-control-sm"
                            :value="row.soak"
                            step="0.1"
                            @change="updateSplineCell(index, 'soak', $event.target.valueAsNumber)"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="form-control form-control-sm"
                            :value="row.feed"
                            step="0.1"
                            @change="updateSplineCell(index, 'feed', $event.target.valueAsNumber)"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="form-control form-control-sm"
                            :value="row.dwell"
                            step="0.1"
                            @change="updateSplineCell(index, 'dwell', $event.target.valueAsNumber)"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                v-if="splineContextMenu.visible"
                class="spline-context-menu"
                :style="{ top: `${splineContextMenu.y}px`, left: `${splineContextMenu.x}px` }"
              >
                <button
                  type="button"
                  class="dropdown-item"
                  @click="
                    addSplineRowBelow(splineContextMenu.rowIndex)
                    hideSplineContextMenu()
                  "
                >
                  <i class="fa-solid fa-plus me-2"></i>Add Row Below
                </button>
                <button
                  type="button"
                  class="dropdown-item text-danger"
                  :disabled="splineRows.length <= 1"
                  @click="
                    deleteSplineRow(splineContextMenu.rowIndex)
                    hideSplineContextMenu()
                  "
                >
                  <i class="fa-solid fa-trash me-2"></i>Delete Row
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-fullscreen-ish {
  max-width: 95vw;
  max-height: 95vh;
  margin: 2.5vh auto;
}

.modal-fullscreen-ish .modal-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.modal-fullscreen-ish .modal-body {
  flex: 1;
  overflow-y: auto;
}

.gcode-textarea {
  min-height: 18vh;
  resize: vertical;
}

.spline-table input {
  min-width: 90px;
}

.spline-context-menu {
  position: fixed;
  z-index: 1080;
  min-width: 180px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  padding: 0.25rem 0;
}

.spline-context-menu .dropdown-item {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0.375rem 0.75rem;
}

.spline-context-menu .dropdown-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
