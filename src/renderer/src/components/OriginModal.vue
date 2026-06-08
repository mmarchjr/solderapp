<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'
import JogWheel from './JogWheel.vue'
import JogBar from './JogBar.vue'

const props = defineProps({
  pcb: { type: Object, default: null }
})

const emit = defineEmits(['set', 'cancel'])

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()

const showModal = ref(false)
const isHomed = ref(false)
const currentStep = ref(1)
const localPosition = ref({ x: 0, y: 0, z: 0 })

watch(
  () => printerCtrl.printer.position,
  (pos) => {
    if (showModal.value) {
      localPosition.value = { ...pos }
    }
  },
  { deep: true }
)

function open() {
  showModal.value = true
  isHomed.value = false
  localPosition.value = { ...printerCtrl.printer.position }
}

function close() {
  showModal.value = false
  emit('cancel')
}

async function handleHome() {
  await printerCtrl.home()
  isHomed.value = true
  localPosition.value = { ...printerCtrl.printer.position }
}

function handleJogXY({ dx, dy }) {
  const newX = localPosition.value.x + dx
  const newY = localPosition.value.y + dy
  const bedW = drillStore.currentBedWidth || 235
  const bedH = drillStore.currentBedHeight || 235
  if (newX < 0 || newX > bedW || newY < 0 || newY > bedH) return
  printerCtrl.jogX(dx)
  printerCtrl.jogY(dy)
  localPosition.value.x = newX
  localPosition.value.y = newY
}

function handleJogZ({ dz }) {
  printerCtrl.jogZ(dz)
  localPosition.value.z += dz
}

function handleSet() {
  if (!props.pcb) return
  drillStore.setPcbOrigin(props.pcb.id, localPosition.value.x, localPosition.value.y)
  emit('set')
  showModal.value = false
}

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <div v-if="showModal" class="modal-backdrop-custom" @click.self="close">
      <div class="modal-dialog modal-dialog-centered" style="max-width: 480px">
        <div class="modal-content">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">
              <i class="fa-solid fa-crosshairs me-2"></i>
              Set Origin for: {{ pcb?.filename || 'Unknown PCB' }}
            </h5>
            <button type="button" class="btn-close" @click="close"></button>
          </div>
          <div class="modal-body">
            <div v-if="!isHomed" class="text-center py-4">
              <p class="mb-3">Home the printer first to enable jogging.</p>
              <button class="btn btn-primary btn-lg" @click="handleHome">
                <i class="fa-solid fa-house me-2"></i> Home (G28)
              </button>
            </div>
            <div v-else class="jog-layout">
              <div class="coordinates-display mb-3">
                <div class="coord-item">
                  <span class="coord-label">X</span>
                  <span class="coord-value">{{ localPosition.x.toFixed(2) }}</span>
                </div>
                <div class="coord-item">
                  <span class="coord-label">Y</span>
                  <span class="coord-value">{{ localPosition.y.toFixed(2) }}</span>
                </div>
                <div class="coord-item">
                  <span class="coord-label">Z</span>
                  <span class="coord-value">{{ localPosition.z.toFixed(2) }}</span>
                </div>
              </div>
              <div class="jog-controls-row">
                <JogWheel :stepSize="currentStep" :disabled="!isHomed" @jog="handleJogXY" />
                <JogBar
                  :stepSize="currentStep"
                  :currentZ="localPosition.z"
                  :disabled="!isHomed"
                  @jog="handleJogZ"
                />
              </div>
              <div class="step-selector mt-3">
                <label class="form-label text-muted mb-1">Step Size</label>
                <div class="btn-group w-100">
                  <button
                    v-for="step in [0.1, 1, 5, 10, 50, 100]"
                    :key="step"
                    class="btn btn-sm"
                    :class="currentStep === step ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="currentStep = step"
                  >
                    {{ step }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
            <button type="button" class="btn btn-success" :disabled="!isHomed" @click="handleSet">
              <i class="fa-solid fa-check me-1"></i> Set Origin
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop-custom {
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
}

.coordinates-display {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.coord-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.coord-label {
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 600;
}

.coord-value {
  font-size: 1.2rem;
  font-family: monospace;
  color: #0d6efd;
}

.jog-controls-row {
  display: flex;
  justify-content: center;
  gap: 24px;
  align-items: center;
}
</style>
