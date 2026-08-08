<script setup lang="ts">
import type { Word } from '../../types'
import { usePlayWordAudio } from '../../hooks/sound.ts'
import { BaseIcon, Tooltip, VolumeIcon } from '@english-learner/base'
import { useWordOptions } from '../../hooks/dict.ts'
import { getWordStatus, WORD_STATUS_INFO } from '../../hooks/wordStatus.ts'
import { openWordCollectPicker } from '../../hooks/useWordCollectPicker.ts'
import TranslationList from './TranslationList.vue'

const props = withDefaults(
  defineProps<{
    item: Word
    showTranslate?: boolean
    showWord?: boolean
    showTransPop?: boolean
    showOption?: boolean
    showCollectIcon?: boolean
    showMarkIcon?: boolean
    index?: number
    active?: boolean
    disabled?: boolean
    excludeDictId?: string
    compact?: boolean // 词表紧凑横向模式:单词与翻译同行,条目更矮更密
  }>(),
  {
    showTranslate: true,
    showWord: true,
    showTransPop: true,
    showOption: true,
    showCollectIcon: true,
    showMarkIcon: true,
    active: false,
    disabled: false,
    compact: false,
  }
)

const playWordAudio = usePlayWordAudio()

const { isWordSimple, toggleWordSimple } = useWordOptions()

function openCollectPicker(e: MouseEvent) {
  openWordCollectPicker(props.item, e.currentTarget as HTMLElement, {
    excludeDictId: props.excludeDictId || undefined,
  })
}
</script>

<template>
  <div class="common-list-item" :class="{ active, disabled, compact }">
    <div class="left">
      <slot name="prefix" :item="item"></slot>
      <div class="title-wrapper">
        <div class="item-title">
          <!-- 掌握状态点(未学/学习中/快遗忘/已掌握) -->
          <Tooltip :title="`${WORD_STATUS_INFO[getWordStatus(item.word)].label}：${WORD_STATUS_INFO[getWordStatus(item.word)].desc}`">
            <span
              class="status-dot"
              :style="{ background: WORD_STATUS_INFO[getWordStatus(item.word)].color }"
            ></span>
          </Tooltip>
          <span class="text-sm translate-y-0.5 text-gray-500" v-if="index != undefined">{{ index }}.</span>
          <span class="word" :class="!showWord && 'word-shadow'">{{ item.word }}</span>
          <span class="phonetic text-gray" :class="!showWord && 'word-shadow'">{{ item.phonetic0 }}</span>
          <VolumeIcon class="volume" @click="playWordAudio(item.word)"></VolumeIcon>
        </div>
        <TranslationList :pos-space="false" :compact="compact" :word="item" :showFull="showWord" v-if="showTranslate" />
      </div>
    </div>
    <div class="right" v-if="showOption">
      <slot name="suffix" :item="item"></slot>
      <BaseIcon
        v-if="showCollectIcon"
        class="collect"
        @click.stop="openCollectPicker"
        title="收藏到词典"
      >
        <IconFluentStar16Regular />
      </BaseIcon>

      <BaseIcon
        v-if="showMarkIcon"
        :class="!isWordSimple(item) ? 'collect' : 'fill'"
        @click.stop="toggleWordSimple(item)"
        :title="!isWordSimple(item) ? '标记为已掌握' : '取消标记已掌握'"
      >
        <IconFluentCheckmarkCircle16Regular v-if="!isWordSimple(item)" />
        <IconFluentCheckmarkCircle16Filled v-else />
      </BaseIcon>
    </div>
  </div>
</template>

<style scoped lang="scss">
// 掌握状态点
.status-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

// 词表紧凑横向模式(仅练习页词表启用):单词/音标/发音与翻译同行横向排列,条目更矮更密
.common-list-item.compact {
  padding: 0.35rem 0.6rem;
  align-items: center;
  gap: 0.75rem;

  // 单词行与翻译同一行 baseline 对齐,翻译超出整行截断
  .title-wrapper {
    @apply flex-row items-baseline;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .item-title {
    white-space: nowrap;
    flex-shrink: 0;
  }

  .phonetic {
    font-size: 0.8rem;
  }

  // 右侧图标(收藏/掌握,hover 显示)改为横排
  .right {
    flex-direction: row;
    align-items: center;
  }
}
</style>
