<script setup lang="ts">
import { usePracticeStore } from '../../stores/practice'
import { useSettingStore } from '../../stores/setting'
import type { PracticeData } from '../../types'
import { ShortcutKey, WordPracticeMode, WordPracticeStage } from '../../types'
import { BaseIcon, Tooltip } from '@english-learner/base'
import SettingDialog from '../setting/SettingDialog.vue'
import VolumeSettingMiniDialog from './VolumeSettingMiniDialog.vue'
import StageProgress from '../StageProgress.vue'
import { WordPracticeModeNameMap, WordPracticeStageNameMap } from '../../config/env'
import { useI18n } from 'vue-i18n'

const statStore = usePracticeStore()
const settingStore = useSettingStore()
const { t: $t } = useI18n()

defineProps<{
  showEdit?: boolean
}>()

const emit = defineEmits<{
  edit: []
  skipStep: []
  back: []
}>()

let practiceData = inject<PracticeData>('practiceData')
const bumpPracticeTimerActivity = inject<(() => void) | undefined>('bumpPracticeTimerActivity', undefined)

function onTimerRowClick() {
  if (statStore.timerPaused) {
    statStore.resumeTimer()
    bumpPracticeTimerActivity?.()
  } else {
    statStore.pauseTimer('manual')
  }
}

function format(val: number, suffix: string = '', check: number = -1) {
  return val === check ? '-' : val + suffix
}

const status = $computed(() => {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) return '自由练习'
  if (practiceData.isTypingWrongWord) return '复习错词'
  // 新增学习形式:显示 (新词|复习)：模式名,而不是"自测新词"等打字阶段名
  if (isSingleStageMode(settingStore.wordPracticeMode)) {
    const isNew = statStore.stage === WordPracticeStage.IdentifyNewWord
    return `${isNew ? '新词' : '复习'}：${WordPracticeModeNameMap[settingStore.wordPracticeMode]}`
  }
  return statStore.getStageName
})

// 单阶段模式(新词→复习 两段进度条)
function isSingleStageMode(mode: WordPracticeMode) {
  return [
    WordPracticeMode.IdentifyOnly,
    WordPracticeMode.DictationOnly,
    WordPracticeMode.ListenOnly,
  ].includes(mode)
}

const stages = $computed(() => {
  let DEFAULT_BAR = {
    name: '',
    ratio: 100,
    percentage: (practiceData.index / practiceData.words.length) * 100,
    active: true,
  }
  if ([WordPracticeMode.Shuffle, WordPracticeMode.Free].includes(settingStore.wordPracticeMode)) {
    return [DEFAULT_BAR]
  } else {
    // 阶段映射：将 WordPracticeStage 映射到 stageIndex 和 childIndex
    const stageMap: Partial<Record<WordPracticeStage, { stageIndex: number; childIndex: number }>> = {
      [WordPracticeStage.FollowWriteNewWord]: { stageIndex: 0, childIndex: 0 },
      [WordPracticeStage.IdentifyNewWord]: { stageIndex: 0, childIndex: 0 },
      [WordPracticeStage.ListenNewWord]: { stageIndex: 0, childIndex: 1 },
      [WordPracticeStage.DictationNewWord]: { stageIndex: 0, childIndex: 2 },
      [WordPracticeStage.IdentifyReview]: { stageIndex: 1, childIndex: 0 },
      [WordPracticeStage.ListenReview]: { stageIndex: 1, childIndex: 1 },
      [WordPracticeStage.DictationReview]: { stageIndex: 1, childIndex: 2 },
    }

    // console.log('statStore.stage',statStore.stage)
    // 获取当前阶段的配置
    const currentStageConfig = stageMap[statStore.stage]
    if (!currentStageConfig) {
      return [DEFAULT_BAR]
    }
    const { stageIndex, childIndex } = currentStageConfig
    const currentProgress = (practiceData.index / practiceData.words.length) * 100

    if (isSingleStageMode(settingStore.wordPracticeMode)) {
      const stages = [
        {
          name: `${'新词'}：${WordPracticeModeNameMap[settingStore.wordPracticeMode]}`,
          ratio: 49,
          percentage: 0,
          active: false,
        },
        {
          name: `${'复习'}：${WordPracticeModeNameMap[settingStore.wordPracticeMode]}`,
          ratio: 49,
          percentage: 0,
          active: false,
        },
      ]

      // 设置已完成阶段的百分比和比例
      for (let i = 0; i < stageIndex; i++) {
        stages[i].percentage = 100
        stages[i].ratio = 49
      }

      // 设置当前激活的阶段
      stages[stageIndex].active = true
      stages[stageIndex].percentage = (practiceData.index / practiceData.words.length) * 100
      return stages
    } else {
      // 阶段配置：定义每个阶段组的基础信息
      const stageConfigs = [
        {
          name: '新词',
          ratio: 70,
          children: [
            { name: WordPracticeStageNameMap[WordPracticeStage.FollowWriteNewWord] },
            { name: WordPracticeStageNameMap[WordPracticeStage.ListenNewWord] },
            { name: WordPracticeStageNameMap[WordPracticeStage.DictationNewWord] },
          ],
        },
        {
          name: '复习',
          ratio: 30,
          children: [
            { name: WordPracticeStageNameMap[WordPracticeStage.IdentifyReview] },
            { name: WordPracticeStageNameMap[WordPracticeStage.ListenReview] },
            { name: WordPracticeStageNameMap[WordPracticeStage.DictationReview] },
          ],
        },
      ]

      // 初始化 stages
      const stages = stageConfigs.map(config => ({
        name: config.name,
        percentage: 0,
        ratio: config.ratio,
        active: false,
        children: config.children.map(child => ({
          name: child.name,
          percentage: 0,
          ratio: 33,
          active: false,
        })),
      }))

      // 设置已完成阶段的百分比和比例
      for (let i = 0; i < stageIndex; i++) {
        stages[i].percentage = 100
        stages[i].ratio = 30
      }

      // 设置当前激活的阶段
      stages[stageIndex].ratio = 70
      stages[stageIndex].active = true

      // 根据类型设置子阶段的进度
      const currentStageChildren = stages[stageIndex].children

      if (childIndex === 0) {
        // 跟写/自测：只激活第一个子阶段
        currentStageChildren[0].active = true
        currentStageChildren[0].percentage = currentProgress
      } else if (childIndex === 1) {
        // 听写：第一个完成，第三个未开始，第二个进行中
        currentStageChildren[0].active = false
        currentStageChildren[1].active = true
        currentStageChildren[2].active = false
        currentStageChildren[0].percentage = 100
        currentStageChildren[1].percentage = currentProgress
        currentStageChildren[2].percentage = 0
      } else if (childIndex === 2) {
        // 默写：前两个完成，第三个进行中
        currentStageChildren[0].active = false
        currentStageChildren[1].active = false
        currentStageChildren[2].active = true
        currentStageChildren[0].percentage = 100
        currentStageChildren[1].percentage = 100
        currentStageChildren[2].percentage = currentProgress
      }

      if (settingStore.wordPracticeMode === WordPracticeMode.System) {
        return stages
      }
      if (settingStore.wordPracticeMode === WordPracticeMode.Review) {
        stages.shift()
        if (stageIndex === 1) stages[0].ratio = 100
        return stages
      }
    }
  }
  return [DEFAULT_BAR]
})
</script>

<template>
  <div class="footer">
    <div class="bottom" :class="!settingStore.showToolbar && 'collapsed'">
      <!-- 行1:操作按钮(图标+文字,可折叠) -->
      <div class="toolbar-actions">
        <Tooltip title="返回主页">
          <div class="action" @click="emit('back')">
            <IconFluentHome20Regular />
            <span>{{ '返回' }}</span>
          </div>
        </Tooltip>

        <div class="action" title="设置">
          <SettingDialog type="word" label="设置" />
        </div>

        <div class="action" title="音效设置">
          <VolumeSettingMiniDialog label="发音" />
        </div>

        <Tooltip
          v-if="settingStore.wordPracticeMode !== WordPracticeMode.Free"
          :title="`${'跳到下一阶段'}:${WordPracticeStageNameMap[statStore.nextStage]}(${settingStore.shortcutKeyMap[ShortcutKey.NextStep]})`"
        >
          <div class="action" @click="emit('skipStep')">
            <IconFluentArrowRight16Regular />
            <span>{{ '跳过' }}</span>
          </div>
        </Tooltip>

        <div
          class="action"
          @click="settingStore.dictation = !settingStore.dictation"
          :title="`${'开关默写模式'}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleDictation]})`"
        >
          <IconFluentEyeOff16Regular v-if="settingStore.dictation" />
          <IconFluentEye16Regular v-else />
          <span>{{ '默写' }}</span>
        </div>

        <div
          class="action"
          @click="settingStore.translate = !settingStore.translate"
          :title="`${'开关释义显示'}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleShowTranslate]})`"
        >
          <IconPhTranslate v-if="settingStore.translate" />
          <IconFluentTranslateOff16Regular v-else />
          <span>{{ '翻译' }}</span>
        </div>

        <div
          class="action"
          @click="settingStore.showPanel = !settingStore.showPanel"
          :title="`${'词表'}(${settingStore.shortcutKeyMap[ShortcutKey.TogglePanel]})`"
        >
          <IconFluentTextListAbcUppercaseLtr20Regular />
          <span>{{ '词表' }}</span>
        </div>

      </div>

      <!-- 行2:状态 + 进度条 + 数字(始终显示) -->
      <div class="toolbar-info">
        <span class="status shrink-0">{{ status }}</span>
        <StageProgress :stages="stages" class="flex-1 min-w-0" />
        <span class="nums shrink-0">
          <span>{{ practiceData.index + 1 }}/{{ practiceData.words.length }} {{ '单词' }}</span>
          <span class="line"></span>
          <Tooltip title="点击可暂停或恢复学习计时">
            <span class="cursor-pointer" @click="onTimerRowClick">
              {{ statStore.timerPaused ? '⏸' : Math.floor(statStore.spend / 1000 / 60) }}{{ '分钟' }}
            </span>
          </Tooltip>
          <span class="line"></span>
          <span>{{ '错误' }} {{ format(practiceData.wrongWords.length, '', 0) }}</span>
        </span>

        <!-- 折叠/展开按钮:始终显示,收起后也能展开 -->
        <Tooltip
          :title="`${settingStore.showToolbar ? '收起' : '展开'}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleToolbar]})`"
        >
          <span
            class="collapse-btn"
            @click="settingStore.showToolbar = !settingStore.showToolbar"
          >
            <IconFluentChevronLeft20Filled class="arrow" :class="!settingStore.showToolbar && 'down'" />
          </span>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.footer {
  flex-shrink: 0;
  width: var(--toolbar-width);
  position: relative;
  z-index: 20;
}

.bottom {
  @apply relative w-full box-border rounded-xl bg-second shadow-lg z-10 mb-3;
  padding: 0.4rem var(--space);

  &.collapsed {
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;

    .toolbar-actions {
      display: none;
    }
  }
}

.toolbar-actions {
  @apply flex items-center justify-center gap-3 flex-wrap;
  padding-bottom: 0.4rem;
  margin-bottom: 0.4rem;
  border-bottom: 1px solid var(--color-line);

  .action {
    @apply flex items-center gap-1 cursor-pointer rounded-md px-1.5 py-0.5 text-sm;
    color: var(--color-main-text);

    &:hover {
      background: var(--color-third);
    }

    svg {
      font-size: 1.15rem;
    }

    .arrow {
      transform: rotate(-90deg);
      transition: transform 0.3s;

      &.down {
        transform: rotate(90deg);
      }
    }
  }
}

.toolbar-info {
  @apply flex items-center gap-3;

  .status {
    font-size: 0.85rem;
    color: var(--color-sub-text);
  }

  .nums {
    @apply flex items-center gap-2 text-sm;
    color: var(--color-sub-text);

    .line {
      width: 1px;
      height: 1rem;
      background: var(--color-sub-gray);
    }
  }

  // 折叠/展开按钮(始终可见)
  .collapse-btn {
    @apply flex items-center cursor-pointer rounded-md px-1 py-0.5;
    color: var(--color-main-text);

    &:hover {
      background: var(--color-third);
    }

    .arrow {
      transform: rotate(-90deg);
      transition: transform 0.3s;

      &.down {
        transform: rotate(90deg);
      }
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .footer {
    width: 100%;
  }

  .toolbar-actions {
    gap: 0.2rem;

    .action {
      padding: 0.3rem 0.4rem;
      font-size: 0.8rem;

      svg {
        font-size: 1rem;
      }
    }
  }

  .toolbar-info {
    flex-wrap: wrap;
    gap: 0.5rem;

    .status {
      width: 100%;
    }
  }
}
</style>