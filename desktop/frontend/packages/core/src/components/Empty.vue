<script setup lang="ts">
import { BaseButton } from '@english-learner/base'

defineProps<{
  text?: string
  showAdd?: boolean
}>()

defineEmits<{
  add: []
}>()

</script>

<template>
  <div class="empty">
    <NuxtImg src="/imgs/empty.svg" alt="" />
    <span>{{ text ?? '空荡荡的~' }}</span>
    <BaseButton v-if="showAdd" @click="$emit('add')">{{ '添加' }}</BaseButton>
  </div>
</template>

<style scoped lang="scss">
.empty {
  width: 100%;
  height: 100%;
  min-height: 18rem;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-size: .9rem;
  gap: 1.3rem;

  span {
    font-family: var(--font-family);
    color: var(--color-sub-text);
  }

  img {
    margin-top: -3rem;
    width: 9rem;
    opacity: 0.85;
  }
}
</style>
