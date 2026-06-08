<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'
import JogWheel from '@/components/jog/JogWheel.vue'
import JogBar from '@/components/jog/JogBar.vue'
import PrintConsole from './PrintConsole.vue'
import SerialPortPicker from '@/components/machine/SerialPortPicker.vue'

const props = defineProps({
  selectedTool: { type: String, default: null }
})

const emit = defineEmits(['jog-to-point', 'solder-point'])

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()
const printer = printerCtrl.printer

const currentStep = ref(1)
const manualCommand = ref('')
const showEstopModal = ref(false)
const estopDismissed = ref(false)
const feedOverride = ref(100)
const showPortPicker = ref(false)
const portPickerRef = ref(null)

const activePcbs = computed(() => drillStore.pcbs.filter((p) => p.path.length > 0))

function handleConnect() {
  if (printer.connected) {
    printerCtrl.disconnect()
  } else {
    showPortPicker.value = true
    setTimeout(() => portPickerRef.value?.loadPorts(), 50)
  }
}

async function handlePortSelected(port) {
  showPortPicker.value = false
  try {
    window.api.serial.selectPort(port.portId)
    await printerCtrl.connect()
  } catch (err) {
    console.error('Connection failed:', err)
  }
}

function handlePortPickerCancel() {
  showPortPicker.value = false
}

function handleHome() {
  printerCtrl.home()
}

async function handlePrint() {
  if (!drillStore.canPrint) return
  await printerCtrl.startPrint()
}

async function handleEstop() {
  showEstopModal.value = true
  estopDismissed.value = false
}

async function confirmEstop() {
  showEstopModal.value = false
  estopDismissed.value = true
  await printerCtrl.emergencyStop()
}

function handleJog({ dx, dy }) {
  if (dx !== 0) printerCtrl.jogX(dx)
  if (dy !== 0) printerCtrl.jogY(dy)
}

function handleJogZ({ dz }) {
  printerCtrl.jogZ(dz)
}

function handleFeedOverride() {
  printerCtrl.setFeedOverride(feedOverride.value)
}

function sendCommand() {
  if (!manualCommand.value.trim()) return
  printerCtrl.sendManualCommand(manualCommand.value)
  manualCommand.value = ''
}

function selectJogTool() {
  emit('jog-to-point')
}

function selectSolderTool() {
  emit('solder-point')
}

function toggleTool(tool) {
  emit(tool === 'jog-to-point' ? 'jog-to-point' : 'solder-point')
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if (!printer.connected) return

  if (e.key === 'Escape') {
    e.preventDefault()
    handleEstop()
    return
  }

  if (!printer.homed) return

  if (e.key === ' ' && printer.printing) {
    e.preventDefault()
    if (printer.paused) {
      printerCtrl.resumePrint()
    } else {
      printerCtrl.pausePrint()
    }
    return
  }

  if (printer.printing) return

  const step = currentStep.value
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      printerCtrl.jogX(-step)
      break
    case 'ArrowRight':
      e.preventDefault()
      printerCtrl.jogX(step)
      break
    case 'ArrowUp':
      e.preventDefault()
      printerCtrl.jogY(step)
      break
    case 'ArrowDown':
      e.preventDefault()
      printerCtrl.jogY(-step)
      break
    case 'PageUp':
      e.preventDefault()
      printerCtrl.jogZ(step)
      break
    case 'PageDown':
      e.preventDefault()
      printerCtrl.jogZ(-step)
      break
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="printer-sidebar-root">
    <div class="printer-sidebar">
      <!-- 1. Connection -->
      <div class="sidebar-section">
        <h6 class="section-title"><i class="fa-solid fa-plug me-1"></i> Connection</h6>
        <div class="connection-row">
          <button
            class="btn btn-sm flex-grow-1"
            :class="printer.connected ? 'btn-outline-danger' : 'btn-success'"
            @click="handleConnect"
          >
            <i class="fa-solid me-1" :class="printer.connected ? 'fa-unplug' : 'fa-plug'"></i>
            {{ printer.connected ? 'Disconnect' : 'Connect' }}
          </button>
          <span class="led-indicator" :class="{ green: printer.connected, red: false }"></span>
        </div>
        <div v-if="printer.connected" class="connection-info">
          <small class="text-muted">
            <i class="fa-solid fa-microchip me-1"></i>
            {{ printer.firmware || 'Connected' }}
          </small>
        </div>
      </div>

      <!-- 2. Status -->
      <div class="sidebar-section">
        <h6 class="section-title"><i class="fa-solid fa-circle-info me-1"></i> Status</h6>
        <div class="status-row">
          <span
            class="badge"
            :class="{
              'bg-success': !printer.printing && printer.connected,
              'bg-warning': printer.printing && !printer.paused,
              'bg-secondary': !printer.connected,
              'bg-info': printer.paused
            }"
          >
            {{
              !printer.connected
                ? 'Disconnected'
                : printer.printing
                  ? printer.paused
                    ? 'Paused'
                    : 'Printing'
                  : 'Idle'
            }}
          </span>
          <span v-if="printer.homed" class="badge bg-success-subtle text-success">Homed</span>
          <span v-else class="badge bg-danger-subtle text-danger">Not Homed</span>
        </div>
        <div v-if="printer.printing" class="print-progress mt-2">
          <div class="progress" style="height: 6px">
            <div
              class="progress-bar bg-warning"
              :style="{
                width: (printer.currentPoint / Math.max(printer.totalPoints, 1)) * 100 + '%'
              }"
            ></div>
          </div>
          <small class="text-muted mt-1 d-block">
            {{ printer.currentPoint }}/{{ printer.totalPoints }} points | Elapsed
            {{ formatTime(printer.elapsed) }}
          </small>
        </div>
      </div>

      <!-- 3. Jog Controls -->
      <div class="sidebar-section">
        <h6 class="section-title">
          <i class="fa-solid fa-arrows-up-down-left-right me-1"></i> Jog
        </h6>
        <div class="jog-layout">
          <JogWheel
            :step-size="currentStep"
            :disabled="!printer.connected || !printer.homed || printer.printing"
            @jog="handleJog"
          />
          <JogBar
            :step-size="currentStep"
            :current-z="printer.position.z"
            :disabled="!printer.connected || !printer.homed || printer.printing"
            @jog="handleJogZ"
          />
        </div>
        <div class="btn-group w-100 mt-2">
          <button
            v-for="step in [0.1, 1, 5, 10, 50, 100]"
            :key="step"
            class="btn btn-sm"
            :class="currentStep === step ? 'btn-primary' : 'btn-outline-secondary'"
            @click="currentStep = step"
          >
            {{ step }}
          </button>
        </div>
        <div class="preset-buttons mt-2">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="!printer.connected || !printer.homed"
            @click="printerCtrl.moveToPreset('front-left')"
          >
            FL
          </button>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="!printer.connected || !printer.homed"
            @click="printerCtrl.moveToPreset('front-right')"
          >
            FR
          </button>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="!printer.connected || !printer.homed"
            @click="printerCtrl.moveToPreset('back-left')"
          >
            BL
          </button>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="!printer.connected || !printer.homed"
            @click="printerCtrl.moveToPreset('back-right')"
          >
            BR
          </button>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="!printer.connected || !printer.homed"
            @click="printerCtrl.moveToPreset('center')"
          >
            Center
          </button>
        </div>
        <button
          class="btn btn-sm btn-outline-primary w-100 mt-2"
          :disabled="!printer.connected || printer.printing"
          @click="handleHome"
        >
          <i class="fa-solid fa-house me-1"></i> Home All Axes
        </button>
      </div>

      <!-- 4. Print Controls -->
      <div class="sidebar-section">
        <h6 class="section-title"><i class="fa-solid fa-print me-1"></i> Print Controls</h6>
        <div class="control-buttons">
          <button
            v-if="!printer.printing"
            class="btn btn-success w-100"
            :disabled="!drillStore.canPrint"
            @click="handlePrint"
          >
            <i class="fa-solid fa-play me-1"></i> Print
          </button>
          <template v-else>
            <button
              v-if="!printer.paused"
              class="btn btn-warning w-100"
              @click="printerCtrl.pausePrint"
            >
              <i class="fa-solid fa-pause me-1"></i> Pause
            </button>
            <button v-else class="btn btn-info w-100" @click="printerCtrl.resumePrint">
              <i class="fa-solid fa-play me-1"></i> Resume
            </button>
            <button class="btn btn-outline-danger w-100 mt-1" @click="printerCtrl.cancelPrint">
              <i class="fa-solid fa-stop me-1"></i> Cancel
            </button>
          </template>
          <button class="btn btn-danger w-100 mt-2 estop-btn" @click="handleEstop">
            <i class="fa-solid fa-circle-exclamation me-1"></i> E-Stop
          </button>
        </div>
        <div class="feed-override mt-2">
          <label class="form-label text-muted small mb-1">
            Feed Override: {{ feedOverride }}%
          </label>
          <input
            v-model.number="feedOverride"
            type="range"
            class="form-range"
            min="0"
            max="200"
            step="5"
            @change="handleFeedOverride"
          />
        </div>
      </div>

      <!-- 5. Solder Tools -->
      <div class="sidebar-section">
        <h6 class="section-title"><i class="fa-solid fa-fire me-1"></i> Solder Tools</h6>
        <div class="btn-group w-100">
          <button
            class="btn btn-sm"
            :class="selectedTool === 'jog-to-point' ? 'btn-primary' : 'btn-outline-secondary'"
            :disabled="!printer.connected || !printer.homed || printer.printing"
            @click="toggleTool('jog-to-point')"
          >
            <i class="fa-solid fa-arrows-up-down-left-right me-1"></i> Jog to Point
          </button>
          <button
            class="btn btn-sm"
            :class="selectedTool === 'solder-point' ? 'btn-warning' : 'btn-outline-secondary'"
            :disabled="!printer.connected || !printer.homed || printer.printing"
            @click="toggleTool('solder-point')"
          >
            <i class="fa-solid fa-fire me-1"></i> Solder Point
          </button>
        </div>
      </div>

      <!-- 6. Console -->
      <div class="sidebar-section console-section">
        <PrintConsole :disabled="!printer.connected || printer.printing" />
      </div>
    </div>

    <Teleport to="body">
      <SerialPortPicker
        v-if="showPortPicker"
        ref="portPickerRef"
        @select="handlePortSelected"
        @cancel="handlePortPickerCancel"
      />

      <div
        v-if="showEstopModal"
        class="modal-backdrop-custom"
        @click.self="
          () => {
            showEstopModal = false
          }
        "
      >
        <div class="modal-dialog" style="max-width: 400px">
          <div class="modal-content">
            <div class="modal-header border-danger">
              <h5 class="modal-title text-danger">
                <i class="fa-solid fa-circle-exclamation me-2"></i> Emergency Stop
              </h5>
              <button type="button" class="btn-close" @click="showEstopModal = false"></button>
            </div>
            <div class="modal-body">
              <p>
                Motors will be disabled immediately. Printer will disconnect. Position will be lost.
              </p>
            </div>
            <div class="modal-footer border-danger">
              <button class="btn btn-secondary" @click="showEstopModal = false">Abort</button>
              <button class="btn btn-danger" @click="confirmEstop">
                <i class="fa-solid fa-bolt me-1"></i> E-Stop Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.printer-sidebar-root {
  overflow-y: auto;
  min-height: 0;
}

.printer-sidebar {
  width: 340px;
  min-width: 340px;
  background: #f8f9fa;
  border-left: 1px solid #dee2e6;
  padding: 8px 0;
}

.sidebar-section {
  padding: 8px 12px;
  border-bottom: 1px solid #dee2e6;
}

.section-title {
  color: #495057;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.connection-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.led-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}

.led-indicator.green {
  background: #4caf50;
  box-shadow: 0 0 6px #4caf50;
}

.led-indicator.red {
  background: #f44336;
}

.connection-info {
  margin-top: 4px;
}

.status-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.jog-layout {
  display: flex;
  justify-content: center;
  gap: 16px;
  align-items: center;
}

.preset-buttons {
  display: flex;
  gap: 4px;
}

.preset-buttons .btn {
  flex: 1;
  font-size: 0.7rem;
  padding: 2px 0;
}

.control-buttons {
  display: flex;
  flex-direction: column;
}

.estop-btn {
  font-size: 1rem;
  font-weight: 700;
  padding: 8px;
}

.feed-override {
  margin-top: 4px;
}

.console-section {
  flex: 1;
  min-height: 120px;
}

.print-button-section {
  border-bottom: none;
}

.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
</style>
