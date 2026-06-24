<template>
  <div v-if="visible" class="optimizer-progress-overlay">
    <div class="optimizer-progress-card">
      <div class="optimizer-header">
        <strong>{{ algorithmLabel }}</strong>
        <span v-if="bestCost > 0" class="optimizer-status">
          Best: {{ bestCost.toFixed(1) }}mm
        </span>
      </div>

      <div v-if="totalClusters > 1" class="optimizer-details">
        <span>Cluster {{ clustersDone + 1 }}/{{ totalClusters }}</span>
        <span
          v-if="activeCluster !== null"
          class="cluster-indicator"
          :style="{ backgroundColor: clusterColors[activeCluster] || '#999' }"
        >
        </span>
        <span>Layer {{ currentDepth }}/{{ totalLayers }}</span>
      </div>

      <div v-else class="optimizer-details">
        <span>Depth {{ currentDepth }}/{{ totalLayers }}</span>
      </div>

      <div class="optimizer-bar-container">
        <div class="optimizer-bar" :style="{ width: progressPct + '%' }"></div>
      </div>

      <div class="optimizer-actions">
        <button class="btn btn-sm btn-outline-warning" :disabled="stopping" @click="handleStop">
          <i class="fa-solid fa-stop"></i> {{ stopping ? 'Confirm Stop...' : 'Stop' }}
        </button>
      </div>

      <div v-if="stopping" class="optimizer-confirm">
        <p>Stop optimization? Current best path will be used.</p>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-danger" @click="confirmStop">
            <i class="fa-solid fa-check"></i> Stop
          </button>
          <button class="btn btn-sm btn-secondary" @click="cancelStop">
            <i class="fa-solid fa-xmark"></i> Resume
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  bestCost: { type: Number, default: 0 },
  currentDepth: { type: Number, default: 0 },
  totalLayers: { type: Number, default: 0 },
  clustersDone: { type: Number, default: 0 },
  totalClusters: { type: Number, default: 1 },
  activeCluster: { type: Number, default: null },
  clusterColors: { type: Array, default: () => [] }
})

const emit = defineEmits(['stop', 'resume', 'cancel'])

const stopping = ref(false)

const algorithmLabel = computed(() => {
  return props.totalClusters > 1 ? 'BFS — clustered' : 'BFS — exhaustive'
})

const progressPct = computed(() => {
  if (props.totalLayers === 0) return 0
  return Math.min(100, Math.round((props.currentDepth / props.totalLayers) * 100))
})

function handleStop() {
  stopping.value = true
  emit('stop')
}

function confirmStop() {
  stopping.value = false
  emit('cancel')
}

function cancelStop() {
  stopping.value = false
  emit('resume')
}
</script>

<style scoped>
.optimizer-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10000;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.optimizer-progress-card {
  background: #333;
  color: #fff;
  padding: 12px 20px;
  font-family: sans-serif;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  min-width: 320px;
  pointer-events: auto;
}

.optimizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.optimizer-status {
  color: #4fc3f7;
  font-weight: bold;
}

.optimizer-details {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #ccc;
}

.cluster-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.optimizer-bar-container {
  width: 100%;
  height: 6px;
  background: #555;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.optimizer-bar {
  height: 100%;
  background: #4fc3f7;
  transition: width 0.15s;
}

.optimizer-actions {
  display: flex;
  justify-content: flex-end;
}

.optimizer-confirm {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #555;
  text-align: center;
}

.optimizer-confirm p {
  margin-bottom: 8px;
  font-size: 12px;
  color: #ffcc80;
}
</style>
