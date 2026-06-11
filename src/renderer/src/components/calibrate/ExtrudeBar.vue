<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  extrudedAmount: { type: Number, default: 0 },
  padArea: { type: Number, default: 0 },
  currentFeed: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['extrude', 'retract', 'confirm', 'cancel'])

const stepSize = ref(0.1)
const stepOptions = [0.05, 0.1, 0.25, 0.5, 1.0]

// Extrude layers (like JogBar for Z)
const layers = [
  { label: '0.1', amount: 0.1 },
  { label: '0.5', amount: 0.5 },
  { label: '1.0', amount: 1.0 },
  { label: '2.0', amount: 2.0 },
  { label: '5.0', amount: 5.0 }
]

function extrude(amount) {
  emit('extrude', amount)
}

function retract(amount) {
  emit('retract', amount)
}

function confirm() {
  emit('confirm')
}

function cancel() {
  emit('cancel')
}

const extrusionDifference = computed(() => {
  return props.extrudedAmount - props.currentFeed
})
</script>

<template>
  <div class="extrude-bar" :class="{ disabled: disabled }">
    <div v-if="disabled" class="disabled-banner">
      <i class="fa-solid fa-spinner fa-spin me-1"></i> Running gcode...
    </div>
    <h6 class="mb-2"><i class="fa-solid fa-arrow-up me-1"></i> Extrude Solder</h6>

    <!-- Current values -->
    <div class="mb-3 p-2 bg-light rounded">
      <div class="d-flex justify-content-between small">
        <span class="text-muted">Pad Area:</span>
        <span class="fw-semibold">{{ padArea.toFixed(2) }} mm²</span>
      </div>
      <div class="d-flex justify-content-between small">
        <span class="text-muted">Current Feed:</span>
        <span class="fw-semibold">{{ currentFeed.toFixed(2) }} mm</span>
      </div>
      <div class="d-flex justify-content-between small">
        <span class="text-muted">Extruded:</span>
        <span class="fw-semibold" :class="extrudedAmount > 0 ? 'text-success' : ''">
          {{ extrudedAmount.toFixed(2) }} mm
        </span>
      </div>
      <div v-if="extrusionDifference !== 0" class="d-flex justify-content-between small">
        <span class="text-muted">Difference:</span>
        <span :class="extrusionDifference > 0 ? 'text-success' : 'text-danger'">
          {{ extrusionDifference > 0 ? '+' : '' }}{{ extrusionDifference.toFixed(2) }} mm
        </span>
      </div>
    </div>

    <!-- Step size selector -->
    <div class="mb-3">
      <label class="form-label small text-muted">Step Size (mm)</label>
      <div class="btn-group w-100">
        <button
          v-for="step in stepOptions"
          :key="step"
          class="btn btn-sm"
          :class="stepSize === step ? 'btn-primary' : 'btn-outline-secondary'"
          :disabled="disabled"
          @click="stepSize = step"
        >
          {{ step }}
        </button>
      </div>
    </div>

    <!-- Extrude bar (vertical, like JogBar) -->
    <div class="extrude-controls mb-3">
      <div class="extrude-buttons">
        <button
          v-for="layer in [...layers].reverse()"
          :key="'extrude-' + layer.label"
          class="btn btn-sm btn-outline-success extrude-btn"
          :disabled="disabled"
          @click="extrude(layer.amount)"
        >
          <i class="fa-solid fa-arrow-up me-1"></i> {{ layer.label }}
        </button>
      </div>

      <div class="extrude-value-display">
        <div class="extrude-value">{{ extrudedAmount.toFixed(2) }}</div>
        <div class="small text-muted">mm extruded</div>
      </div>

      <div class="extrude-buttons">
        <button
          v-for="layer in layers"
          :key="'retract-' + layer.label"
          class="btn btn-sm btn-outline-danger extrude-btn"
          :disabled="disabled"
          @click="retract(layer.amount)"
        >
          <i class="fa-solid fa-arrow-down me-1"></i> {{ layer.label }}
        </button>
      </div>
    </div>

    <!-- Fine-tune buttons -->
    <div class="d-flex gap-2 mb-3">
      <button class="btn btn-sm btn-outline-success flex-grow-1" :disabled="disabled" @click="extrude(stepSize)">
        <i class="fa-solid fa-plus me-1"></i> +{{ stepSize }}
      </button>
      <button class="btn btn-sm btn-outline-danger flex-grow-1" :disabled="disabled" @click="retract(stepSize)">
        <i class="fa-solid fa-minus me-1"></i> -{{ stepSize }}
      </button>
    </div>

    <!-- Confirm / Cancel -->
    <div class="d-flex gap-2">
      <button
        class="btn btn-success flex-grow-1"
        :disabled="disabled || extrudedAmount <= 0"
        @click="confirm"
      >
        <i class="fa-solid fa-check me-1"></i> Save Feed
      </button>
      <button class="btn btn-outline-danger flex-grow-1" :disabled="disabled" @click="cancel">
        <i class="fa-solid fa-xmark me-1"></i> Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.extrude-bar h6 {
  font-weight: 700;
}

.extrude-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.extrude-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.extrude-btn {
  width: 100%;
  padding: 4px 8px;
  font-size: 0.8rem;
}

.extrude-value-display {
  text-align: center;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  min-width: 100px;
}

.extrude-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #198754;
  font-family: monospace;
}

.extrude-bar.disabled {
  opacity: 0.5;
  pointer-events: none;
  filter: grayscale(0.4);
}

.disabled-banner {
  background: rgba(13, 110, 253, 0.1);
  color: #0d6efd;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 8px;
  text-align: center;
  animation: gcode-pulse 1.5s ease-in-out infinite;
}

@keyframes gcode-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
