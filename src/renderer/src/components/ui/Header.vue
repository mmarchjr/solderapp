<template>
  <div class="header-root">
    <header class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center logo" href="#">
          <span style="color: white; font-size: 1.5rem; font-weight: 700">Soldering App</span>
        </a>

        <div class="tab-group me-3">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'path' }"
            @click="$emit('switch-tab', 'path')"
          >
            <i class="fa-solid fa-route me-1"></i> Path
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'calibrate' }"
            @click="$emit('switch-tab', 'calibrate')"
          >
            <i class="fa-solid fa-bullseye me-1"></i> Calibrate
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'print' }"
            @click="$emit('switch-tab', 'print')"
          >
            <i class="fa-solid fa-print me-1"></i> Print
          </button>
        </div>

        <UploadDrillFile v-if="activeTab === 'path'" @open-zip="handleZipFile" />
        <button
          v-if="drillStore.pcbs.length > 0 && activeTab === 'path'"
          class="btn btn-outline-light btn-sm nav-link"
          @click="saveProject"
        >
          <i class="fa-solid fa-file-arrow-down"></i> Save Project
        </button>

        <button
          class="btn btn-outline-light btn-sm nav-link"
          data-bs-toggle="modal"
          data-bs-target="#machineConfigModal"
        >
          <i class="fa-solid fa-gears me-1"></i> Advanced Settings
        </button>

        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div id="navbarNav" class="collapse navbar-collapse">
          <ul class="navbar-nav"></ul>
        </div>

        <div class="printer-status-group">
          <div class="d-flex align-items-center gap-2">
            <span class="led-indicator" :class="{ green: printer.connected }"></span>
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
            <span v-if="printer.connected" class="badge bg-success-subtle text-success">
              {{ printer.homed ? 'Homed' : 'Not Homed' }}
            </span>
            <span v-if="printer.connected && printer.printing" class="badge bg-dark-subtle text-dark">
              {{ printer.currentPoint }}/{{ printer.totalPoints }} | {{ formatTime(printer.elapsed) }}
            </span>
          </div>
          <button
            class="btn btn-sm btn-outline-primary"
            :disabled="!printer.connected || printer.printing || printer.isHoming || printer.isHomeCoolingDown"
            @click="printerCtrl.home()"
          >
            <i class="fa-solid fa-house me-1"></i> Home
          </button>
          <button
            class="btn btn-sm"
            :class="printer.connected ? 'btn-outline-danger' : 'btn-success'"
            @click="handleConnect"
          >
            <i class="fa-solid me-1" :class="printer.connected ? 'fa-unplug' : 'fa-plug'"></i>
            {{ printer.connected ? 'Disconnect' : 'Connect' }}
          </button>
        </div>
      </div>
    </header>

    <ImportWizard ref="importWizardRef" />
    <Teleport to="body">
      <SerialPortPicker
        v-if="showPortPicker"
        ref="portPickerRef"
        @select="handlePortSelected"
        @cancel="handlePortPickerCancel"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'
import UploadDrillFile from '@/components/import/UploadDrillFile.vue'
import SerialPortPicker from '@/components/machine/SerialPortPicker.vue'
const ImportWizard = defineAsyncComponent(() => import('@/components/import/ImportWizard.vue'))
import { useFileHandlers } from '@/composables/useFileHandlers'
const { saveProject } = useFileHandlers()

defineProps({
  activeTab: { type: String, default: 'path' }
})

defineEmits(['switch-tab'])

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()
const printer = printerCtrl.printer
const importWizardRef = ref(null)
const showPortPicker = ref(false)
const portPickerRef = ref(null)

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

const handleZipFile = (file) => {
  if (importWizardRef.value) {
    importWizardRef.value.openZipFile(file)
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.nav-link {
  height: 60px !important;
  font-size: 1.25rem !important;
  padding: 0rem 1rem !important;
}

.donate-button {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 5px 12px;
  white-space: nowrap;
}

.logo {
  margin-left: 1.5rem;
}

.tab-group {
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tab-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 16px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.tab-btn.active {
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.printer-status-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  padding: 0 12px;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  height: 60px;
  flex-shrink: 0;
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
</style>
