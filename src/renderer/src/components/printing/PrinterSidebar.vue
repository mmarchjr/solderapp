<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'
import JogWheel from '@/components/jog/JogWheel.vue'
import JogBar from '@/components/jog/JogBar.vue'
import PrintConsole from './PrintConsole.vue'

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
const fanPercent = ref(0)

const activePcbs = computed(() => drillStore.pcbs.filter((p) => p.path.length > 0))

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

function handleFanChange() {
  printerCtrl.setFanSpeed(fanPercent.value)
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
      <!-- 1. Jog Controls -->
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
          :disabled="!printer.connected || printer.printing || printer.isHoming || printer.isHomeCoolingDown"
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
        <div class="fan-control mt-2">
          <label class="form-label text-muted small mb-1">
            Fan: {{ fanPercent }}%
          </label>
          <div class="d-flex align-items-center gap-2">
            <input
              v-model.number="fanPercent"
              type="range"
              class="form-range flex-grow-1"
              min="0"
              max="100"
              step="1"
              :disabled="!printer.connected"
              @change="handleFanChange"
            />
            <input
              v-model.number="fanPercent"
              type="number"
              class="form-control form-control-sm"
              style="width: 60px"
              min="0"
              max="100"
              :disabled="!printer.connected"
              @change="handleFanChange"
            />
          </div>
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
      <div
        v-if="showEstopModal"
        style="
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
        "
        tabindex="0"
        @click.self="showEstopModal = false"
        @keydown.escape="showEstopModal = false"
      >
        <div class="modal-dialog modal-dialog-centered" style="max-width: 400px; margin: 2rem">
          <div
            class="modal-content"
            style="background: #fff; border-radius: 0.5rem; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3)"
          >
            <div class="modal-header border-danger" style="padding: 1.25rem 1.5rem">
              <h5 class="modal-title text-danger">
                <i class="fa-solid fa-circle-exclamation me-2"></i> Emergency Stop
              </h5>
              <button type="button" class="btn-close" @click="showEstopModal = false"></button>
            </div>
            <div class="modal-body" style="padding: 1.5rem">
              <p>
                Motors will be disabled immediately. Printer will disconnect. Position will be lost.
              </p>
            </div>
            <div class="modal-footer border-danger" style="padding: 1rem 1.5rem">
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

</style>
