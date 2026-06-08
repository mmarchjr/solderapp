<script setup>
import { computed } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  stepSize: { type: Number, default: 1 }
})

const emit = defineEmits(['jog'])

const rings = [0.1, 1, 5, 10, 50, 100]
const size = 240
const center = size / 2
const d = Math.cos(Math.PI / 4) // cos(45°) for diagonal X pattern

function ringRadius(index) {
  return 22 + index * 17
}

function getQuadrantLabel(ring, direction) {
  return `${ring}mm ${direction}`
}

function handleJog(direction) {
  if (props.disabled) return
  let dx = 0
  let dy = 0
  switch (direction) {
    case '+x':
      dx = props.stepSize
      break
    case '-x':
      dx = -props.stepSize
      break
    case '+y':
      dy = props.stepSize
      break
    case '-y':
      dy = -props.stepSize
      break
  }
  emit('jog', { dx, dy })
}

function handleRingJog(direction, ringValue) {
  if (props.disabled) return
  let dx = 0
  let dy = 0
  switch (direction) {
    case '+x':
      dx = ringValue
      break
    case '-x':
      dx = -ringValue
      break
    case '+y':
      dy = ringValue
      break
    case '-y':
      dy = -ringValue
      break
  }
  emit('jog', { dx, dy })
}
</script>

<template>
  <div class="jog-wheel-container" :class="{ disabled }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <!-- Rings -->
      <circle
        v-for="(ring, i) in rings"
        :key="'ring-' + i"
        :cx="center"
        :cy="center"
        :r="ringRadius(i)"
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        stroke-width="1"
      />

      <!-- Diagonal X divider lines -->
      <line
        :x1="center - ringRadius(rings.length - 1) * d"
        :y1="center - ringRadius(rings.length - 1) * d"
        :x2="center + ringRadius(rings.length - 1) * d"
        :y2="center + ringRadius(rings.length - 1) * d"
        stroke="rgba(0,0,0,0.08)"
        stroke-width="1"
      />
      <line
        :x1="center + ringRadius(rings.length - 1) * d"
        :y1="center - ringRadius(rings.length - 1) * d"
        :x2="center - ringRadius(rings.length - 1) * d"
        :y2="center + ringRadius(rings.length - 1) * d"
        stroke="rgba(0,0,0,0.08)"
        stroke-width="1"
      />

      <!-- Clickable cardinal-direction wedge segments -->
      <template v-for="(ring, i) in rings" :key="'seg-' + i">
        <!-- +Y (top wedge: upper-right diagonal to upper-left diagonal through top) -->
        <path
          :d="`M ${center + ringRadius(i) * d} ${center - ringRadius(i) * d} A ${ringRadius(i)} ${ringRadius(i)} 0 0 0 ${center - ringRadius(i) * d} ${center - ringRadius(i) * d} L ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} A ${i > 0 ? ringRadius(i - 1) : 0} ${i > 0 ? ringRadius(i - 1) : 0} 0 0 1 ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} Z`"
          class="jog-segment"
          :class="{ disabled }"
          @click="handleRingJog('+y', ring)"
          @mouseenter="(e) => (e.target.style.fill = 'rgba(0,0,0,0.08)')"
          @mouseleave="(e) => (e.target.style.fill = 'transparent')"
        />
        <!-- +X (right wedge: upper-right diagonal to lower-right diagonal through right) -->
        <path
          :d="`M ${center + ringRadius(i) * d} ${center - ringRadius(i) * d} A ${ringRadius(i)} ${ringRadius(i)} 0 0 1 ${center + ringRadius(i) * d} ${center + ringRadius(i) * d} L ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} A ${i > 0 ? ringRadius(i - 1) : 0} ${i > 0 ? ringRadius(i - 1) : 0} 0 0 0 ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} Z`"
          class="jog-segment"
          :class="{ disabled }"
          @click="handleRingJog('+x', ring)"
          @mouseenter="(e) => (e.target.style.fill = 'rgba(0,0,0,0.08)')"
          @mouseleave="(e) => (e.target.style.fill = 'transparent')"
        />
        <!-- -Y (bottom wedge: lower-right diagonal to lower-left diagonal through bottom) -->
        <path
          :d="`M ${center + ringRadius(i) * d} ${center + ringRadius(i) * d} A ${ringRadius(i)} ${ringRadius(i)} 0 0 1 ${center - ringRadius(i) * d} ${center + ringRadius(i) * d} L ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} A ${i > 0 ? ringRadius(i - 1) : 0} ${i > 0 ? ringRadius(i - 1) : 0} 0 0 0 ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} Z`"
          class="jog-segment"
          :class="{ disabled }"
          @click="handleRingJog('-y', ring)"
          @mouseenter="(e) => (e.target.style.fill = 'rgba(0,0,0,0.08)')"
          @mouseleave="(e) => (e.target.style.fill = 'transparent')"
        />
        <!-- -X (left wedge: lower-left diagonal to upper-left diagonal through left) -->
        <path
          :d="`M ${center - ringRadius(i) * d} ${center + ringRadius(i) * d} A ${ringRadius(i)} ${ringRadius(i)} 0 0 1 ${center - ringRadius(i) * d} ${center - ringRadius(i) * d} L ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} A ${i > 0 ? ringRadius(i - 1) : 0} ${i > 0 ? ringRadius(i - 1) : 0} 0 0 0 ${center - (i > 0 ? ringRadius(i - 1) : 0) * d} ${center + (i > 0 ? ringRadius(i - 1) : 0) * d} Z`"
          class="jog-segment"
          :class="{ disabled }"
          @click="handleRingJog('-x', ring)"
          @mouseenter="(e) => (e.target.style.fill = 'rgba(0,0,0,0.08)')"
          @mouseleave="(e) => (e.target.style.fill = 'transparent')"
        />
      </template>

      <!-- Ring labels (positioned in +Y wedge) -->
      <template v-for="(ring, i) in rings" :key="'label-' + i">
        <text
          :x="center + 4"
          :y="center - ringRadius(i) + 10"
          class="ring-label"
          text-anchor="start"
        >
          {{ ring }}
        </text>
      </template>

      <!-- Direction arrows -->
      <text :x="center" :y="14" class="direction-label" text-anchor="middle">+Y</text>
      <text :x="center" :y="size - 6" class="direction-label" text-anchor="middle">-Y</text>
      <text :x="size - 6" :y="center + 4" class="direction-label" text-anchor="end">+X</text>
      <text :x="10" :y="center + 4" class="direction-label" text-anchor="start">-X</text>

      <!-- Center dot -->
      <circle :cx="center" :cy="center" r="3" fill="rgba(0,0,0,0.3)" />
    </svg>
    <div class="step-indicator">
      Step: <strong>{{ stepSize }}mm</strong>
    </div>
  </div>
</template>

<style scoped>
.jog-wheel-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
}

.jog-wheel-container.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.jog-segment {
  fill: transparent;
  cursor: pointer;
  transition: fill 0.1s ease;
}

.jog-segment.disabled {
  cursor: not-allowed;
}

.ring-label {
  font-size: 9px;
  fill: rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.direction-label {
  font-size: 10px;
  fill: rgba(0, 0, 0, 0.6);
  font-weight: 600;
  pointer-events: none;
}

.step-indicator {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #6c757d;
}
</style>
