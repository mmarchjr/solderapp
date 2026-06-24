<script setup>
import { ref } from 'vue'

const emit = defineEmits(['select', 'cancel'])

const ports = ref([])
const loading = ref(false)
const error = ref('')
const selectedIndex = ref(-1)

async function loadPorts() {
  loading.value = true
  error.value = ''
  ports.value = []
  selectedIndex.value = -1
  try {
    ports.value = await window.api.serial.getPorts()
    if (ports.value.length === 0) {
      error.value = 'No serial devices detected. Plug in your device and try refreshing.'
    }
  } catch (err) {
    error.value = 'Failed to list serial ports: ' + err.message
  } finally {
    loading.value = false
  }
}

function selectPort() {
  if (selectedIndex.value < 0) return
  const port = ports.value[selectedIndex.value]
  emit('select', port)
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    emit('cancel')
  } else if (e.key === 'Enter') {
    selectPort()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < ports.value.length - 1) {
      selectedIndex.value++
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  }
}

defineExpose({ loadPorts })
</script>

<template>
  <Teleport to="body">
    <div
      ref="modalEl"
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
      @click.self="$emit('cancel')"
      @keydown="handleKeydown"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 480px; margin: 2rem">
        <div
          class="modal-content"
          style="background: #fff; border-radius: 0.5rem; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3)"
        >
          <div class="modal-header" style="padding: 1.25rem 1.5rem">
            <h5 class="modal-title">
              <i class="fa-solid fa-plug me-2"></i>
              Select Serial Port
            </h5>
            <button type="button" class="btn-close" @click="$emit('cancel')"></button>
          </div>
          <div class="modal-body" style="padding: 1.5rem">
            <div v-if="loading" class="text-center py-4">
              <div class="spinner-border text-primary mb-2" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="text-muted mb-0">Scanning for serial ports...</p>
            </div>

            <div v-else-if="error" class="text-center py-3">
              <i class="fa-solid fa-triangle-exclamation text-warning fa-2x mb-2"></i>
              <p class="text-muted mb-2">{{ error }}</p>
              <button class="btn btn-sm btn-outline-primary" @click="loadPorts">
                <i class="fa-solid fa-rotate me-1"></i> Retry
              </button>
            </div>

            <div v-else-if="ports.length > 0">
              <p class="text-muted small mb-2">Choose a port to connect:</p>
              <div class="port-list">
                <button
                  v-for="(port, index) in ports"
                  :key="port.portId"
                  class="port-item"
                  :class="{ active: selectedIndex === index }"
                  @click="selectedIndex = index"
                  @dblclick="((selectedIndex = index), selectPort())"
                >
                  <i class="fa-solid fa-microchip port-icon"></i>
                  <div class="port-details">
                    <span class="port-name">{{ port.displayName }}</span>
                    <span class="port-path">{{ port.portName }}</span>
                  </div>
                  <i v-if="selectedIndex === index" class="fa-solid fa-check port-check"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="padding: 1rem 1.5rem">
            <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
            <button
              type="button"
              class="btn btn-outline-primary btn-sm"
              :disabled="loading"
              @click="loadPorts"
            >
              <i class="fa-solid fa-rotate me-1"></i> Refresh
            </button>
            <button
              type="button"
              class="btn btn-success"
              :disabled="selectedIndex < 0"
              @click="selectPort"
            >
              <i class="fa-solid fa-plug me-1"></i> Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.port-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.port-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
}

.port-item:hover {
  border-color: #adb5bd;
  background: #f8f9fa;
}

.port-item.active {
  border-color: #198754;
  background: #f0fdf4;
}

.port-icon {
  color: #6c757d;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.port-item.active .port-icon {
  color: #198754;
}

.port-details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.port-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: #212529;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.port-path {
  font-size: 0.72rem;
  color: #6c757d;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.port-check {
  color: #198754;
  font-size: 0.9rem;
  flex-shrink: 0;
}
</style>
