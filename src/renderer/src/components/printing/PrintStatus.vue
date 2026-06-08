<script setup>
import { usePrinterControl } from '@/composables/usePrinterControl'

const { printer, pausePrint, resumePrint, emergencyStop } = usePrinterControl()

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-if="printer.printing" class="print-status-bar">
    <div class="status-content">
      <span class="status-label">
        <i class="fa-solid fa-print me-1"></i>
        {{ printer.paused ? 'Paused' : 'Printing' }}: Point {{ printer.currentPoint }}/{{
          printer.totalPoints
        }}
        | Line {{ printer.currentLine }}/{{ printer.totalLines }} | Elapsed
        {{ formatTime(printer.elapsed) }}
      </span>
    </div>
    <div class="status-actions">
      <button v-if="!printer.paused" class="btn btn-sm btn-warning" @click="pausePrint">
        <i class="fa-solid fa-pause me-1"></i> Pause
      </button>
      <button v-else class="btn btn-sm btn-success" @click="resumePrint">
        <i class="fa-solid fa-play me-1"></i> Resume
      </button>
      <button class="btn btn-sm btn-danger" @click="emergencyStop">
        <i class="fa-solid fa-circle-exclamation me-1"></i> E-Stop
      </button>
    </div>
  </div>
</template>

<style scoped>
.print-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff3cd;
  color: #856404;
  padding: 6px 16px;
  font-size: 0.85rem;
  border-bottom: 2px solid #ffc107;
  z-index: 1000;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-label {
  font-weight: 500;
}

.status-actions {
  display: flex;
  gap: 8px;
}
</style>
