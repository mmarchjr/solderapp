<script setup>
import { ref, provide } from 'vue'
import Header from '@/components/ui/Header.vue'
import ToolpathEditor from '@/components/gcode/ToolpathEditor.vue'
import MachineConfig from '@/components/machine/MachineConfig.vue'
import PrintTab from '@/components/printing/PrintTab.vue'
import CalibrateTab from '@/components/calibrate/CalibrateTab.vue'
import PrintStatus from '@/components/printing/PrintStatus.vue'
import { useDrillStore } from '@/stores/store'
import { usePrinterControl } from '@/composables/usePrinterControl'

const drillStore = useDrillStore()
const printerCtrl = usePrinterControl()
const activeTab = ref('path')

provide('activeTab', activeTab)
</script>

<template>
  <div class="home-view">
    <Header :active-tab="activeTab" @switch-tab="activeTab = $event" />
    <PrintStatus v-if="printerCtrl.printer.printing" />
    <ToolpathEditor v-if="activeTab === 'path'" :read-only="printerCtrl.printer.printing" />
    <PrintTab v-if="activeTab === 'print'" />
    <CalibrateTab v-if="activeTab === 'calibrate'" />
    <MachineConfig />
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
</style>
