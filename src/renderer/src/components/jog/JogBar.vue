<script setup>
const props = defineProps({
  disabled: { type: Boolean, default: false },
  stepSize: { type: Number, default: 1 },
  currentZ: { type: Number, default: 0 }
})

const emit = defineEmits(['jog'])

const layers = [0.1, 1, 5, 10, 50]
const barWidth = 60
const barHeight = 220
const segmentHeight = barHeight / layers.length

function handleJogUp(layerValue) {
  if (props.disabled) return
  emit('jog', { dz: layerValue })
}

function handleJogDown(layerValue) {
  if (props.disabled) return
  emit('jog', { dz: -layerValue })
}
</script>

<template>
  <div class="jog-bar-container" :class="{ disabled }">
    <div class="z-label">Z</div>
    <div class="z-position">{{ currentZ.toFixed(1) }}</div>
    <div class="bar-wrapper">
      <!-- Up segments (reversed so largest is at top) -->
      <div
        v-for="(layer, i) in [...layers].reverse()"
        :key="'up-' + i"
        class="bar-segment up"
        :style="{ height: segmentHeight + 'px' }"
        @click="handleJogUp(layer)"
      >
        <span class="segment-label">+{{ layer }}</span>
      </div>

      <!-- Center line -->
      <div class="center-line"></div>

      <!-- Down segments (largest at bottom) -->
      <div
        v-for="(layer, i) in layers"
        :key="'down-' + i"
        class="bar-segment down"
        :style="{ height: segmentHeight + 'px' }"
        @click="handleJogDown(layer)"
      >
        <span class="segment-label">-{{ layer }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jog-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  width: 60px;
}

.jog-bar-container.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.z-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #495057;
  margin-bottom: 2px;
}

.z-position {
  font-size: 0.7rem;
  color: #6c757d;
  margin-bottom: 4px;
}

.bar-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
}

.bar-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.1s ease;
  border-bottom: 1px solid #dee2e6;
}

.bar-segment.up {
  background: rgba(13, 110, 253, 0.06);
}

.bar-segment.up:hover {
  background: rgba(13, 110, 253, 0.15);
}

.bar-segment.down {
  background: rgba(220, 53, 69, 0.06);
}

.bar-segment.down:hover {
  background: rgba(220, 53, 69, 0.15);
}

.segment-label {
  font-size: 0.65rem;
  color: #495057;
  pointer-events: none;
}

.center-line {
  height: 2px;
  background: #6c757d;
}
</style>
