<script setup>
import { ref, onUnmounted, nextTick, onMounted } from 'vue'
import { usePrinterControl } from '@/composables/usePrinterControl'
import { useSerial } from '@/composables/useSerial'

const props = defineProps({
  disabled: { type: Boolean, default: false }
})

const printerCtrl = usePrinterControl()
const serial = useSerial()
const logEntries = ref([])
const manualCommand = ref('')
const logContainer = ref(null)

let unsubLog = null
let unsubSent = null

onMounted(() => {
  unsubLog = serial.onData((line) => {
    logEntries.value.push({
      type: line.startsWith('ok') ? 'ok' : line.startsWith('Error') ? 'error' : 'recv',
      text: line,
      time: new Date()
    })
    if (logEntries.value.length > 100) {
      logEntries.value = logEntries.value.slice(-100)
    }
    scrollToBottom()
  })

  unsubSent = printerCtrl.onSent((line) => {
    logEntries.value.push({
      type: 'sent',
      text: line,
      time: new Date()
    })
    if (logEntries.value.length > 100) {
      logEntries.value = logEntries.value.slice(-100)
    }
    scrollToBottom()
  })
})

onUnmounted(() => {
  if (unsubLog) unsubLog()
  if (unsubSent) unsubSent()
})

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

async function sendCommand() {
  if (!manualCommand.value.trim()) return
  logEntries.value.push({
    type: 'sent',
    text: manualCommand.value.trim(),
    time: new Date()
  })
  await printerCtrl.sendManualCommand(manualCommand.value)
  manualCommand.value = ''
  scrollToBottom()
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<template>
  <div class="print-console">
    <h6 class="section-title"><i class="fa-solid fa-terminal me-1"></i> Console</h6>
    <div ref="logContainer" class="log-container">
      <div v-for="(entry, i) in logEntries" :key="i" class="log-entry" :class="'log-' + entry.type">
        <span class="log-time">{{ formatTime(entry.time) }}</span>
        <span class="log-text">{{ entry.text }}</span>
      </div>
      <div v-if="logEntries.length === 0" class="text-muted small">No serial data yet.</div>
    </div>
    <div class="command-input">
      <input
        v-model="manualCommand"
        type="text"
        class="form-control form-control-sm"
        placeholder="Send G-code command..."
        :disabled="disabled"
        @keydown.enter="sendCommand"
      />
      <button
        class="btn btn-sm btn-primary"
        :disabled="disabled || !manualCommand.trim()"
        @click="sendCommand"
      >
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.print-console {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.section-title {
  color: #495057;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #f1f3f5;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 6px;
  font-family: monospace;
  font-size: 0.7rem;
  max-height: 200px;
  min-height: 80px;
}

.log-entry {
  display: flex;
  gap: 6px;
  padding: 1px 0;
}

.log-time {
  color: #adb5bd;
  flex-shrink: 0;
}

.log-text {
  word-break: break-all;
}

.log-sent .log-text {
  color: #64b5f6;
}

.log-recv .log-text {
  color: #495057;
}

.log-ok .log-text {
  color: #81c784;
}

.log-error .log-text {
  color: #ef5350;
}

.command-input {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.command-input .form-control {
  font-family: monospace;
  font-size: 0.75rem;
}
</style>
