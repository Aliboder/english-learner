<script setup lang="ts">
// 词典卡片网格:一行 5 列,点击进入词典详情
import type { DictResource } from '../../types'

defineProps<{
  list: DictResource[]
  selectId?: string
}>()

const emit = defineEmits<{
  selectDict: [val: { dict: DictResource; index: number }]
}>()
</script>

<template>
  <div class="dict-card-grid">
    <div
      v-for="(dict, index) in list"
      :key="dict.id"
      class="dict-card"
      :class="{ selected: selectId === dict.id }"
      @click="emit('selectDict', { dict, index })"
    >
      <div class="gradient-bar"></div>
      <div class="card-body">
        <div class="card-head">
          <span class="card-name">{{ dict.name }}</span>
          <span class="card-length">{{ dict.length }} {{ '单词' }}</span>
        </div>
        <div class="card-desc">{{ dict.description || dict.category }}</div>
        <div class="card-tags">
          <span v-for="t in dict.tags" :key="t" class="tag">{{ t }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dict-card-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.6rem;

  .dict-card {
    @apply relative flex flex-col overflow-hidden rounded-lg cursor-pointer;
    border-radius: var(--radius-card);
    border: 1px solid var(--color-line);
    background: var(--color-second);
    box-shadow: var(--shadow-card);
    transition: all var(--anim-time, 0.2s);

    &:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-card-hover);
      border-color: var(--color-select-bg);
    }

    &.selected {
      border-color: var(--color-select-bg);
    }

    // 渐变顶部条
    .gradient-bar {
      height: 0.4rem;
      background: var(--color-select-bg);
    }

    .card-body {
      @apply flex flex-col gap-1 flex-1 min-w-0;
      padding: 0.6rem 0.7rem 0.7rem;

      .card-head {
        @apply flex items-center justify-between gap-1 min-w-0;

        .card-name {
          @apply font-bold truncate;
          color: var(--color-main-text);
        }

        .card-length {
          @apply shrink-0 text-xs;
          color: var(--color-sub-text);
        }
      }

      .card-desc {
        @apply text-xs leading-4 overflow-hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        color: var(--color-sub-text);
        min-height: 2rem;
      }

      .card-tags {
        @apply flex flex-wrap gap-1 mt-auto;

        .tag {
          font-size: 0.65rem;
          padding: 0.05rem 0.45rem;
          border-radius: 2rem;
          color: var(--color-link, #409eff);
          background: rgba(79, 142, 247, 0.12);
        }
      }
    }
  }
}

// 移动端:2 列
@media (max-width: 768px) {
  .dict-card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
