<script setup lang="ts">
import BaseIcon from '../BaseIcon.vue'

const props = withDefaults(
  defineProps<{
    time?: number
    simple?: boolean
    title?: string
    cb?: Function
  }>(),
  {
    time: 300,
    simple: false,
  }
)
const emit = defineEmits(['click'])

let step = $ref(2)
let count = $ref(0)

function runAnimation(reset = false, time = props.time) {
  if (reset) {
    step = 2
    count = 0
  }
  count++
  setTimeout(() => {
    if (step === 2) {
      if (count === 1) {
        step = 0
        runAnimation(false, time + 100)
      } else {
        count = 0
      }
    } else {
      step++
      runAnimation(false, time + 100)
    }
  }, time)
}

function play(handle: boolean = false, reset = false, time = props.time) {
  if (reset) {
    step = 2
    count = 0
  }
  if (count === 0) {
    props?.cb?.(handle)
  }
  runAnimation(false, time)
}

function animateOnly(reset = false, time = props.time) {
  runAnimation(reset, time)
}

function click(event: MouseEvent) {
  emit('click', event)
  play(true)
}

defineExpose({ play, animateOnly })
</script>

<template>
  <template v-if="props.simple">
    <BaseIcon :title="title" @click.stop="click" no-bg>
      <IconBxVolume v-if="step === 0" />
      <IconBxVolumeLow v-if="step === 1" />
      <IconBxVolumeFull v-if="step === 2" />
    </BaseIcon>
  </template>
  <template v-else>
    <BaseIcon :title="title" @click.stop="click">
      <IconBxVolume v-if="step === 0" />
      <IconBxVolumeLow v-if="step === 1" />
      <IconBxVolumeFull v-if="step === 2" />
    </BaseIcon>
  </template>
</template>

<style scoped lang="scss"></style>
