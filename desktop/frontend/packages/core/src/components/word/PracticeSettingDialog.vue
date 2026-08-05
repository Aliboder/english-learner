<script setup lang="ts">
import { _getAccomplishDays } from '../../utils'
import { BaseButton, Close, InputNumber, Slider, Tooltip, Toast } from '@english-learner/base'
import { onMounted, onUnmounted, watch } from 'vue'
import { useSettingStore } from '../../stores/setting'
import ChangeLastPracticeIndexDialog from './ChangeLastPracticeIndexDialog.vue'
import { useRuntimeStore } from '../../stores/runtime'
import { BaseInput } from '@english-learner/base'

const settings = useSettingStore()
const runtimeStore = useRuntimeStore()

const model = defineModel()

const props = defineProps<{
  showLeftOption: boolean
  onConfirm?: () => Promise<void | boolean>
}>()

const emit = defineEmits<{
  ok: []
}>()

let tempPerDayStudyNumber = $ref(0)
let tempWordReviewRatio = $ref(0)
let tempLastLearnIndex = $ref(0)
let show = $ref(false)

// ---- 拖拽浮窗:无遮罩不遮挡练习内容,位置记忆到 localStorage,可实时预览调节效果 ----
function loadPos() {
  try {
    return JSON.parse(localStorage.getItem('practice-setting-pos') || '') || null
  } catch {
    return null
  }
}

// 默认位置:窗口右上角(首次打开时按当前视口计算)
function defaultPos() {
  return { x: Math.max(16, window.innerWidth - 420), y: 72 }
}

// SSR 无 window,位置初始化放到 onMounted(客户端)
let floatPos = $ref({ x: 0, y: 0 })
let dragging = false
let dragOffset = { x: 0, y: 0 }

onMounted(() => {
  floatPos = loadPos() || defaultPos()
})

function startDrag(e: PointerEvent) {
  // 交互控件不触发拖拽
  if ((e.target as HTMLElement).closest('button, input, .no-drag, .slider')) return
  dragging = true
  dragOffset.x = e.clientX - floatPos.x
  dragOffset.y = e.clientY - floatPos.y
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
}

function onDragMove(e: PointerEvent) {
  if (!dragging) return
  floatPos.x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 380))
  floatPos.y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 140))
}

function endDrag() {
  dragging = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  localStorage.setItem('practice-setting-pos', JSON.stringify(floatPos))
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
})

async function changePerDayStudyNumber() {
  runtimeStore.editDict.perDayStudyNumber = Number(tempPerDayStudyNumber)
  runtimeStore.editDict.lastLearnIndex = Number(tempLastLearnIndex)
  settings.wordReviewRatio = tempWordReviewRatio
  return props?.onConfirm?.()
}

watch(
  () => model.value,
  n => {
    if (n) {
      if (runtimeStore.editDict.id) {
        tempPerDayStudyNumber = runtimeStore.editDict.perDayStudyNumber
        tempLastLearnIndex = runtimeStore.editDict.lastLearnIndex
        if (tempLastLearnIndex >= runtimeStore.editDict.length) tempLastLearnIndex = runtimeStore.editDict.length
        tempWordReviewRatio = settings.wordReviewRatio
        // 首次打开时按当前视口定默认位置(右上角)
        if (!loadPos()) floatPos = defaultPos()
      } else {
        Toast.warning('请先选择一本词典')
      }
    }
  }
)
</script>

<template>
  <!-- 可拖拽浮窗:无遮罩,不遮挡下方内容,可实时预览字符间距等调节效果 -->
  <Teleport to="body">
    <div
      v-if="model"
      class="practice-setting-float"
      :style="{ left: floatPos.x + 'px', top: floatPos.y + 'px' }"
    >
      <header class="float-header" @pointerdown="startDrag">
        <span>{{ '学习设置' }}</span>
        <Close class="no-drag" @click="model = false" />
      </header>

      <div class="float-body">
        <div class="text-center mt-1">
          <span
            >{{ '共' }}<span class="target-number mx-2">{{ runtimeStore.editDict.length }}</span
            >{{ '个单词' }}，</span
          >
          <span
            >{{ '预计' }}<span class="target-number mx-2">{{
              _getAccomplishDays(runtimeStore.editDict.length - tempLastLearnIndex, tempPerDayStudyNumber)
            }}</span
            >{{ '天完成' }}</span
          >
        </div>

        <div class="text-center mt-3 mb-4 flex gap-1 items-end justify-center flex-wrap">
          <span>{{ '从第' }}</span>
          <div class="w-20">
            <BaseInput class="target-number" v-model="tempLastLearnIndex" />
          </div>
          <span>{{ '个开始，每日' }}</span>
          <div class="w-16">
            <BaseInput class="target-number" v-model="tempPerDayStudyNumber" />
          </div>
          <span>{{ '个新词' }}</span>
          <span>{{ '，最多复习' }}</span>
          <div class="target-number mx-2">
            {{ tempPerDayStudyNumber * tempWordReviewRatio || '-' }}
          </div>
          <span>{{ '单词' }}</span>
        </div>

        <div class="mb-3 space-y-2">
          <div class="flex items-center gap-space">
            <Tooltip title="复习词与新词的比例">
              <div class="flex items-center gap-1 w-20 break-keep">
                <span>{{ '复习比' }}</span>
                <IconFluentQuestionCircle20Regular />
              </div>
            </Tooltip>
            <InputNumber :min="0" :max="10" v-model="tempWordReviewRatio" />
          </div>
          <div class="flex" v-if="!tempWordReviewRatio">
            <div class="w-23 flex-shrink-0"></div>
            <div class="text-sm text-gray-500">
              <div>{{ '未完成学习时，复习数量按照设置的复习比生成，为0则不复习' }}</div>
              <div>{{ '完成学习后，新词数量固定为0，复习数量按照比例生成（若复习比小于1，以 1 计算）' }}</div>
            </div>
          </div>
        </div>

        <div class="flex mb-3 gap-space items-center">
          <span class="shrink-0 w-20">{{ '每日学习' }}</span>
          <Slider show-text class="mt-1 flex-1" :max="500" v-model="tempPerDayStudyNumber" />
        </div>
        <div class="flex mb-3 gap-space items-center">
          <span class="shrink-0 w-20">{{ '学习进度' }}</span>
          <div class="flex-1 flex items-center gap-2">
            <Slider
              :min="0"
              :step="10"
              show-text
              class="my-1 flex-1"
              :max="runtimeStore.editDict.words.length"
              v-model="tempLastLearnIndex"
            />
            <BaseButton size="small" @click="show = true">{{ '从词典选起始位置' }}</BaseButton>
          </div>
        </div>

        <div class="line"></div>

        <!-- 字符间距:实时预览练习页上方单词的字母间距(换字体后可手动优化) -->
        <div class="flex gap-space items-center">
          <span class="shrink-0 w-20">{{ '字符间距' }}</span>
          <Slider
            class="flex-1"
            :min="0"
            :max="24"
            :step="1"
            show-text
            v-model="settings.wordLetterSpacing"
          />
        </div>
      </div>

      <footer class="float-footer">
        <BaseButton size="large" @click="model = false">{{ '取消' }}</BaseButton>
        <BaseButton size="large" type="primary" @click="changePerDayStudyNumber(); emit('ok'); model = false">{{ '确定' }}</BaseButton>
      </footer>
    </div>
  </Teleport>
  <ChangeLastPracticeIndexDialog
    v-model="show"
    @ok="
      e => {
        tempLastLearnIndex = e
        show = false
      }
    "
  />
</template>

<style scoped lang="scss">
.practice-setting-float {
  position: fixed;
  z-index: 9999;
  width: 26rem;
  max-width: calc(100vw - 2rem);
  background: var(--color-second);
  border: 1px solid var(--color-item-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card-hover);
  overflow: hidden;

  .float-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.9rem;
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-font-1);
    background: var(--color-third);
    cursor: move;
    user-select: none;
  }

  .float-body {
    padding: 0.8rem 0.9rem 0.4rem;
    font-size: 0.95rem;
  }

  .float-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.6rem 0.9rem;
    border-top: 1px solid var(--color-item-border);
  }

  .line {
    border-bottom: 1px solid var(--color-item-border);
    margin: 0.7rem 0;
  }

  .target-number {
    font-weight: 600;
    color: var(--color-primary);
  }
}
</style>