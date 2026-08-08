<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useSettingStore } from '../../stores/setting.ts'
import { getWordStatus, WORD_STATUS_INFO } from '../../hooks/wordStatus.ts'
import TranslationList from './TranslationList.vue'
import { Tooltip } from '@english-learner/base'
import type { Word } from '../../types'

/**
 * 横向流式词表(练习页右侧面板):词块从左到右流式排列,超宽换行。
 * 词块 = 掌握状态点 + 单词 + 常驻翻译(单行截断),点击跳转,当前词高亮。
 */
const props = withDefaults(
  defineProps<{
    list?: Word[]
    activeIndex?: number
    showWord?: boolean // 默写遮挡:false 时单词模糊
    showTranslate?: boolean
    excludeWords?: string[]
    isActive?: boolean // 面板是否可见(可见时才滚动跟随)
    static?: boolean // 静态模式:不滚动跟随当前词
  }>(),
  {
    list: [],
    activeIndex: -1,
    showWord: true,
    showTranslate: true,
    excludeWords: [],
    isActive: false,
    static: true,
  }
)

const emit = defineEmits<{ click: [index: number] }>()
const settingStore = useSettingStore()
const activeRef = ref<HTMLElement | null>(null)

/** 当前词滚动到可视区(仅动态模式 + 面板可见时) */
function scrollToActive() {
  if (props.static || !settingStore.showPanel) return
  nextTick(() => {
    activeRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

watch(
  () => props.activeIndex,
  () => scrollToActive(),
  { immediate: true }
)

watch(
  () => props.isActive,
  (n: boolean) => {
    if (n) setTimeout(() => scrollToActive(), 300)
  }
)
</script>

<template>
  <div class="word-flow">
    <div
      v-for="(item, index) in list"
      :key="index"
      class="word-chip"
      :class="{
        active: index === activeIndex,
        disabled: excludeWords.includes(item.word),
      }"
      :ref="el => (index === activeIndex ? (activeRef = el as HTMLElement) : null)"
      @click="emit('click', index)"
    >
      <div class="chip-head">
        <Tooltip
          :title="`${WORD_STATUS_INFO[getWordStatus(item.word)].label}：${WORD_STATUS_INFO[getWordStatus(item.word)].desc}`"
        >
          <span class="status-dot" :style="{ background: WORD_STATUS_INFO[getWordStatus(item.word)].color }"></span>
        </Tooltip>
        <span class="chip-word" :class="!showWord && 'word-shadow'">{{ item.word }}</span>
      </div>
      <div class="chip-trans" v-if="showTranslate">
        <TranslationList :word="item" :compact="true" :pos-space="false" :showFull="showWord" :show-play="false" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.word-flow {
  // 始终单列:纵向排列,窗口大小不影响列数(面板宽度响应式变化不再导致列数跳变)
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem 0.6rem;
  height: 100%;
  overflow: auto;
}

.word-chip {
  // 词块撑满整行,无右侧空白
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-item-border);
  border-radius: 0.5rem;
  background: var(--color-third);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  // 单词行:状态点与单词垂直居中,长单词完整显示(允许换行,不截断)
  .chip-head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;

    .status-dot {
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .chip-word {
      font-size: 0.95rem;
      line-height: 1.3;
      word-break: break-word;
      color: var(--color-main-text);
    }
  }

  // 翻译:单行截断,词性淡化、释义为主色,层级清晰
  .chip-trans {
    font-size: 0.78rem;
    line-height: 1.4;
    min-width: 0;

    :deep(.trans-list.compact .pos) {
      color: var(--color-sub-text);
      opacity: 0.75;
    }

    :deep(.trans-text) {
      color: var(--color-translate-main);
    }
  }

  &.disabled {
    opacity: 0.5;
  }

  &.active {
    background: var(--color-fifth);
    border-color: var(--color-select-bg);
  }

  &:hover {
    border-color: var(--color-select-bg);
  }
}
</style>
