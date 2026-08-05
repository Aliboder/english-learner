<script setup lang="ts">
import type {Dict} from '../../types';

defineProps<{
  list?: Partial<Dict>[],
  selectId?: string
  quantifier?: string
}>()

const emit = defineEmits<{
  selectDict: [val: { dict: any, index: number }]
  del: [val: { dict: any, index: number }]
  detail: [],
  add: []
}>()

</script>

<template>
  <div class="dict-list">
    <div
      v-for="(dict, index) in list"
      :key="dict.id"
      class="dict-row"
      :class="{ selected: selectId && String(dict.id) === String(selectId) }"
      @click="emit('selectDict', { dict, index })"
    >
      <div class="flex-1 min-w-0">
        <div class="name truncate">{{ dict.name }}</div>
        <div v-if="dict.description" class="desc truncate">{{ dict.description }}</div>
      </div>
      <div class="count shrink-0">{{ dict.length }}{{ quantifier }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dict-list {
  @apply space-y-1;
}

.dict-row {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent cursor-pointer;
  transition: background var(--anim-time);

  &:hover {
    background: var(--color-second);
  }

  &.selected {
    background: var(--color-fifth);
    border-color: var(--color-select-bg);
  }

  .name {
    font-weight: 600;
    color: var(--color-main-text);
  }

  .desc {
    font-size: 0.8rem;
    color: var(--color-sub-text);
  }

  .count {
    font-size: 0.85rem;
    color: var(--color-sub-text);
  }
}
</style>
