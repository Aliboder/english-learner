<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Toast, Tooltip } from '@english-learner/base'
import { usePracticeStore } from '../../stores/practice'
import { useSettingStore } from '../../stores/setting'
import type { PracticeData } from '../../types'
import { ShortcutKey, WordPracticeMode, WordPracticeStage, WordPracticeType } from '../../types'
import SettingDialog from '../setting/SettingDialog.vue'
import VolumeSettingMiniDialog from './VolumeSettingMiniDialog.vue'
import StageProgress from '../StageProgress.vue'
import { WordPracticeModeNameMap, WordPracticeStageNameMap } from '../../config/env'

const statStore = usePracticeStore()
const settingStore = useSettingStore()

const emit = defineEmits<{
  skipStep: []
  back: []
}>()

let practiceData = inject<PracticeData>('practiceData')

// 组大小(与练习页 [id].vue 的 groupSize 一致:跟写打完一组切拼写重打本组)
const GROUP_SIZE = 7

// 阶段进度(新词/复习分段,与展示一致):从原底部底栏迁移,保持分阶段显示
function isSingleStageMode(mode: WordPracticeMode) {
  return [
    WordPracticeMode.IdentifyOnly,
    WordPracticeMode.DictationOnly,
    WordPracticeMode.ListenOnly,
  ].includes(mode)
}

/** 跟写新词阶段的连续组进度:每词打两遍(跟写+拼写),进度连续前进不回退
 *  (index 会在组循环回退,直接用 index/words.length 会导致进度条一进一退)
 *  按"已完成词数"计算(inGroup = index % 7 + 1):最后一个词完成时进度正好 100%,
 *  否则结算时(index 停在最后一个词位置)进度停在 (len-1)/len 不满 */
function loopGroupProgress(index: number, wordsLength: number) {
  if (!wordsLength) return 0
  const groupCount = Math.ceil(wordsLength / GROUP_SIZE)
  const lastGroupSize = wordsLength % GROUP_SIZE || GROUP_SIZE
  const totalSlots = (groupCount - 1) * GROUP_SIZE * 2 + lastGroupSize * 2
  const groupNo = Math.floor(index / GROUP_SIZE)
  const inGroup = (index % GROUP_SIZE) + 1 // 已完成的本组词数(1-7)
  const isSpell = settingStore.wordPracticeType === WordPracticeType.Spell
  const currentSlot = groupNo * GROUP_SIZE * 2 + (isSpell ? GROUP_SIZE + inGroup : inGroup)
  return Math.min(100, Math.round((currentSlot / totalSlots) * 100))
}

/** 跟写新词阶段(System 模式):组循环内当前的位置文字(组内第几个/第几组) */
const inLoopGroup = $computed(() => {
  const i = practiceData.index
  const groupNo = Math.floor(i / GROUP_SIZE) + 1
  const inGroup = (i % GROUP_SIZE) + 1
  const typeName = settingStore.wordPracticeType === WordPracticeType.Spell ? '拼写' : '跟写'
  return { typeName, inGroup, groupNo }
})

// 右侧数字:跟写阶段显示组内位置(拼写重打不显得倒退),其他阶段显示词表位置
const numsText = $computed(() => {
  const i = practiceData.index + 1
  const total = practiceData.words.length
  if (
    statStore.stage === WordPracticeStage.FollowWriteNewWord &&
    settingStore.wordPracticeMode === WordPracticeMode.System &&
    (settingStore.wordPracticeType === WordPracticeType.FollowWrite ||
      settingStore.wordPracticeType === WordPracticeType.Spell)
  ) {
    const { typeName, inGroup, groupNo } = inLoopGroup
    return `${typeName} ${inGroup}/${GROUP_SIZE} · 第${groupNo}组`
  }
  return `${i}/${total} ${'单词'}`
})

// 状态行:当前阶段名(旧词→复习,更易懂);无阶段流转的模式(自由/随机)直接显示模式名
const statusText = $computed(() => {
  if ([WordPracticeMode.Free, WordPracticeMode.Shuffle].includes(settingStore.wordPracticeMode)) {
    return WordPracticeModeNameMap[settingStore.wordPracticeMode]
  }
  const stageName = WordPracticeStageNameMap[statStore.stage]?.replace('旧词', '复习')
  if (stageName) return stageName
  return WordPracticeModeNameMap[settingStore.wordPracticeMode]
})

// 阶段/类型切换提示:让用户清楚流程走到哪(跟写↔拼写组内切换 + 阶段推进)
watch(
  [() => statStore.stage, () => settingStore.wordPracticeType],
  ([newStage, newType], [oldStage, oldType]) => {
    if (oldStage === undefined || newStage === oldStage) {
      // 组内切换:跟写↔拼写
      if (oldType === WordPracticeType.FollowWrite && newType === WordPracticeType.Spell) {
        Toast.info('跟写完成,本组开始拼写')
      } else if (oldType === WordPracticeType.Spell && newType === WordPracticeType.FollowWrite) {
        Toast.info('拼写完成,开始下一组跟写')
      }
    } else {
      const from = WordPracticeStageNameMap[oldStage]?.replace('旧词', '复习')
      const to = WordPracticeStageNameMap[newStage]?.replace('旧词', '复习')
      if (from && to && from !== to) Toast.info(`${from}完成,进入${to}`)
    }
  }
)

const stages = $computed(() => {
  let DEFAULT_BAR = {
    name: '',
    ratio: 100,
    // 已完成词数(index+1):结算时(index 停在最后一个词)进度才能到 100%
    percentage: ((practiceData.index + 1) / practiceData.words.length) * 100,
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

    const currentStageConfig = stageMap[statStore.stage]
    if (!currentStageConfig) {
      return [DEFAULT_BAR]
    }
    const { stageIndex, childIndex } = currentStageConfig
    // 跟写新词阶段(组内跟写+拼写循环)用连续组进度,index 回退不体现在进度条上;其他阶段用已完成词数
    const currentProgress =
      statStore.stage === WordPracticeStage.FollowWriteNewWord &&
      settingStore.wordPracticeMode === WordPracticeMode.System
        ? loopGroupProgress(practiceData.index, practiceData.words.length)
        : ((practiceData.index + 1) / practiceData.words.length) * 100

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

      for (let i = 0; i < stageIndex; i++) {
        stages[i].percentage = 100
        stages[i].ratio = 49
      }

      stages[stageIndex].active = true
      stages[stageIndex].percentage = ((practiceData.index + 1) / practiceData.words.length) * 100
      return stages
    } else {
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

      for (let i = 0; i < stageIndex; i++) {
        stages[i].percentage = 100
        stages[i].ratio = 30
      }

      stages[stageIndex].ratio = 70
      stages[stageIndex].active = true

      const currentStageChildren = stages[stageIndex].children

      if (childIndex === 0) {
        currentStageChildren[0].active = true
        currentStageChildren[0].percentage = currentProgress
      } else if (childIndex === 1) {
        currentStageChildren[0].active = false
        currentStageChildren[1].active = true
        currentStageChildren[2].active = false
        currentStageChildren[0].percentage = 100
        currentStageChildren[1].percentage = currentProgress
        currentStageChildren[2].percentage = 0
      } else if (childIndex === 2) {
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

// ---- 悬停展开/收起:鼠标悬浮工具栏时展开操作按钮,移出后自动收起(只留进度条) ----
let expanded = $ref(false)
let collapseTimer: ReturnType<typeof setTimeout> | null = null

function onEnter() {
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  expanded = true
}

function onLeave() {
  if (collapseTimer) clearTimeout(collapseTimer)
  // 延迟收起,避免鼠标短暂移出导致的抖动
  collapseTimer = setTimeout(() => {
    expanded = false
    collapseTimer = null
  }, 200)
}

onUnmounted(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
})
</script>

<template>
  <!-- 顶部固定工具栏:上行阶段进度条(始终显示)+ 下行操作按钮(鼠标悬浮展开,移出收起) -->
  <div class="top-toolbar" @mouseenter="onEnter" @mouseleave="onLeave">
    <!-- 行1:阶段进度条 + 位置数字(跟写阶段显示"跟写 4/7 · 第2组",其他显示词表位置) -->
    <div class="progress-row">
      <StageProgress :stages="stages" class="flex-1 min-w-0" />
      <span class="nums shrink-0">{{ numsText }}</span>
    </div>
    <!-- 行0:当前阶段状态(如"跟写新词""复习 · 默写"),让用户清楚流程走到哪 -->
    <div class="status-row">{{ statusText }}</div>

    <!-- 行2:操作按钮平放横排(按工具栏宽度均分,悬浮展开) -->
    <Transition name="toolbar">
    <div v-show="expanded" class="btn-row">
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
    </Transition>
  </div>
</template>

<style scoped lang="scss">
// 顶部固定工具栏:固定页面最顶部,居中限宽(与练习区一致),进度条与按钮同宽组合
.top-toolbar {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(var(--toolbar-width), calc(100vw - 2rem));
  background: var(--color-second);
  border: 1px solid var(--color-item-border);
  border-top: none;
  border-radius: 0 0 var(--radius-card) var(--radius-card);
  box-shadow: var(--shadow-card-hover);
  z-index: 9999;
  overflow: hidden;
  font-size: 0.85rem;
  user-select: none;
}

// 行0:当前阶段状态(小字,悬浮展开时显示,让用户清楚流程走到哪)
.status-row {
  padding: 0.1rem 0.9rem 0.15rem;
  font-size: 0.75rem;
  color: var(--color-sub-text);
  text-align: center;
  border-bottom: 1px solid var(--color-line);
}

// 行1:阶段进度条(尽量窄) + 单词数
.progress-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.15rem 0.9rem;
  border-bottom: 1px solid var(--color-line);

  .nums {
    font-size: 0.75rem;
    color: var(--color-sub-text);
    white-space: nowrap;
  }
}

// 行2:操作按钮平放横排,按工具栏宽度均分间距
.btn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  padding: 0.15rem 0.8rem;

  .action {
    @apply flex items-center gap-1 cursor-pointer rounded-md px-2 py-0.5;
    color: var(--color-main-text);
    flex: 1;
    justify-content: center;

    &:hover {
      background: var(--color-third);
    }

    svg {
      font-size: 0.95rem;
    }

    span {
      font-size: 0.8rem;
      white-space: nowrap;
    }
  }
}

// 展开/收起过渡动画
.toolbar-enter-active,
.toolbar-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

// 窄屏:按钮只显示图标
@media (max-width: 768px) {
  .btn-row {
    padding: 0.2rem 0.5rem;

    .action {
      padding: 0.25rem 0.3rem;

      span {
        display: none;
      }
    }
  }
}
</style>
