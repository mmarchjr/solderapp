<script setup>
import { ref } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'
import PrinterSidebar from './PrinterSidebar.vue'
import PrintCanvas from './PrintCanvas.vue'

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()

const selectedTool = ref(null)

function handlePointClick(point) {
  if (!printerCtrl.printer.connected) return
  if (selectedTool.value === 'jog-to-point') {
    if (!printerCtrl.printer.homed) return
    printerCtrl.jogToPoint(point.data, point.pcb)
  } else if (selectedTool.value === 'solder-point') {
    printerCtrl.solderPoint(point.data, point.pcb)
  }
}

function handleToolSelect(tool) {
  if (selectedTool.value === tool) {
    selectedTool.value = null
  } else {
    selectedTool.value = tool
  }
}
</script>

<template>
  <div class="print-tab">
    <div class="print-canvas-area">
      <div v-if="printerCtrl.printer.printing" class="editing-disabled-banner">
        <i class="fa-solid fa-lock me-1"></i>
        Print in progress — editing disabled
      </div>
      <div class="canvas-container">
        <PrintCanvas :selectedTool="selectedTool" @point-click="handlePointClick" />
      </div>
      <div class="tool-bar">
        <button
          class="btn btn-sm"
          :class="selectedTool === 'jog-to-point' ? 'btn-primary' : 'btn-outline-secondary'"
          @click="handleToolSelect('jog-to-point')"
          :disabled="
            !printerCtrl.printer.connected ||
            !printerCtrl.printer.homed ||
            printerCtrl.printer.printing
          "
        >
          <i class="fa-solid fa-arrows-up-down-left-right me-1"></i> Jog to Point
        </button>
        <button
          class="btn btn-sm"
          :class="selectedTool === 'solder-point' ? 'btn-warning' : 'btn-outline-secondary'"
          @click="handleToolSelect('solder-point')"
          :disabled="
            !printerCtrl.printer.connected ||
            !printerCtrl.printer.homed ||
            printerCtrl.printer.printing
          "
        >
          <i class="fa-solid fa-fire me-1"></i> Solder Point
        </button>
      </div>
    </div>
    <PrinterSidebar
      :selectedTool="selectedTool"
      @jog-to-point="selectedTool = 'jog-to-point'"
      @solder-point="selectedTool = 'solder-point'"
    />
  </div>
</template>

<style scoped>
.print-tab {
  display: flex;
  height: calc(100vh - 56px);
  overflow: hidden;
}

.print-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.editing-disabled-banner {
  background: rgba(255, 193, 7, 0.15);
  color: #856404;
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 193, 7, 0.3);
  text-align: center;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #e8e8e8;
}

.tool-bar {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  z-index: 10;
}
</style>
