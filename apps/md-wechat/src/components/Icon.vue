<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="path"
  ></svg>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '../lib/icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
})

const def = computed(() => icons[props.name] || '')
const isObj = computed(() => typeof def.value === 'object' && def.value !== null)
const path = computed(() => (isObj.value ? def.value.d : def.value))
const filled = computed(() => isObj.value && !!def.value.fill)
</script>
