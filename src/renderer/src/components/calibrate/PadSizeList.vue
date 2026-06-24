<script setup>
defineProps({
  padSizes: { type: Array, default: () => [] },
  selected: { type: Object, default: null },
  phase: { type: String, default: 'idle' },
  currentValues: { type: Object, default: () => ({ feed: 0, soak: 0, dwell: 0 }) }
})

const emit = defineEmits(['select', 'test-feed'])

const PALETTE = [
  '#e6194b',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#42d4f4',
  '#f032e6',
  '#bfef45',
  '#fabed4',
  '#469990',
  '#dcbeff',
  '#9A6324',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000075',
  '#a9a9a9',
  '#000000',
  '#e6beff'
]

function getColor(index) {
  return PALETTE[index % PALETTE.length]
}
</script>

<template>
  <div class="pad-size-list">
    <h6 class="mb-2"><i class="fa-solid fa-ruler-combined me-1"></i> Pad Sizes</h6>

    <div v-if="padSizes.length === 0" class="text-muted small fst-italic">
      No solder pads found on loaded PCBs.
    </div>

    <div
      v-for="(entry, idx) in padSizes"
      :key="entry.diameter"
      class="pad-size-item"
      :class="{
        active: selected?.diameter === entry.diameter,
        disabled: phase !== 'idle'
      }"
      @click="emit('select', entry)"
    >
      <div class="d-flex align-items-center gap-2 mb-1">
        <span class="pad-color-swatch" :style="{ backgroundColor: getColor(idx) }"></span>
        <span class="fw-semibold">{{ entry.diameter.toFixed(2) }} mm</span>
        <span class="badge bg-secondary ms-auto">{{ entry.count }}</span>
      </div>
      <div class="small text-muted">Area: {{ entry.area.toFixed(2) }} mm²</div>
      <div class="small text-muted">
        Feed: {{ currentValues.feed.toFixed(1) }}mm | Soak: {{ currentValues.soak.toFixed(1) }}s |
        Dwell: {{ currentValues.dwell.toFixed(1) }}s
      </div>
      <div class="mt-1 d-flex gap-1">
        <button
          class="btn btn-sm btn-outline-primary w-100"
          :disabled="phase !== 'idle' || !selected"
          @click.stop="emit('test-feed')"
        >
          <i class="fa-solid fa-fire me-1"></i> Test Feed
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pad-size-list h6 {
  font-weight: 700;
}

.pad-size-item {
  padding: 8px 10px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #fff;
}

.pad-size-item:hover:not(.disabled) {
  background: #f0f7ff;
  border-color: #86b7fe;
}

.pad-size-item.active {
  background: #cfe2ff;
  border-color: #86b7fe;
}

.pad-size-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pad-color-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #333;
  flex-shrink: 0;
}
</style>
