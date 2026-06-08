<script setup>
import { ref, provide } from 'vue'
import Header from '@/components/Header.vue'
import ToolpathEditor from '@/components/ToolpathEditor.vue'
import MachineConfig from '@/components/MachineConfig.vue'
import PrintTab from '@/components/PrintTab.vue'
import PrintStatus from '@/components/PrintStatus.vue'
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
