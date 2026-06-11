<script setup>
import { ref } from 'vue'
import JogWheel from '@/components/jog/JogWheel.vue'
import JogBar from '@/components/jog/JogBar.vue'

defineProps({
  printerPosition: { type: Object, default: () => ({ x: 0, y: 0, z: 0 }) },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['jog-xy', 'jog-z', 'save', 'cancel'])

const jogStep = ref(1)
const stepOptions = [0.1, 1, 5, 10, 50, 100]

function handleJogXY({ dx, dy }) {
  emit('jog-xy', { dx, dy })
}

function handleJogZ({ dz }) {
  emit('jog-z', { dz })
}

function save() {
  emit('save')
}

function cancel() {
  emit('cancel')
}
</script>

<template>
  <div class="calibrate-jog-controls" :class="{ disabled: disabled }">
    <div v-if="disabled" class="disabled-banner">
      <i class="fa-solid fa-spinner fa-spin me-1"></i> Running gcode...
    </div>
    <h6 class="mb-2"><i class="fa-solid fa-arrows-up-down-left-right me-1"></i> Jog to Position</h6>

    <p class="small text-muted mb-3">
      Jog down to the correct position for this pad, then click "Save Offset".
    </p>

    <!-- Position display -->
    <div class="d-flex align-items-center justify-content-center gap-3 mb-3">
      <div class="text-center">
        <small class="text-muted d-block">X</small>
        <span class="font-monospace">{{ printerPosition.x.toFixed(2) }}</span>
      </div>
      <div class="text-center">
        <small class="text-muted d-block">Y</small>
        <span class="font-monospace">{{ printerPosition.y.toFixed(2) }}</span>
      </div>
      <div class="text-center">
        <small class="text-muted d-block">Z</small>
        <span class="font-monospace">{{ printerPosition.z.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Jog controls -->
    <div class="d-flex justify-content-center gap-3 mb-3">
      <JogWheel
        :step-size="jogStep"
        :disabled="disabled"
        @jog="handleJogXY"
      />
      <JogBar
        :step-size="jogStep"
        :current-z="printerPosition.z"
        :disabled="disabled"
        @jog="handleJogZ"
      />
    </div>

    <!-- Step size selector -->
    <div class="btn-group w-100 mb-3">
      <button
        v-for="step in stepOptions"
        :key="step"
        class="btn btn-sm"
        :class="jogStep === step ? 'btn-primary' : 'btn-outline-secondary'"
        :disabled="disabled"
        @click="jogStep = step"
      >
        {{ step }}
      </button>
    </div>

    <!-- Save / Cancel -->
    <div class="d-flex gap-2">
      <button class="btn btn-success flex-grow-1" :disabled="disabled" @click="save">
        <i class="fa-solid fa-save me-1"></i> Save Offset
      </button>
      <button class="btn btn-outline-danger flex-grow-1" :disabled="disabled" @click="cancel">
        <i class="fa-solid fa-xmark me-1"></i> Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.calibrate-jog-controls h6 {
  font-weight: 700;
}

.calibrate-jog-controls.disabled {
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
