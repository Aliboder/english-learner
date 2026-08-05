<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { BaseIcon, Close } from '@typewords/base'
import CommonSetting from './CommonSetting.vue'
import WordSetting from './WordSetting.vue'
import SoundSetting from './SoundSetting.vue'
import { useDisableEventListener } from '@typewords/utils'

const props = withDefaults(
  defineProps<{
    type: 'article' | 'word'
    /** 外部传入时直接打开到指定 tab(3 = 音效设置) */
    initialTab?: number
    /** 触发按钮旁的文字标签(整个触发区域可点击) */
    label?: string
  }>(),
  { initialTab: undefined, label: undefined }
)

const emit = defineEmits<{
  (e: 'open'): void
}>()

let tabIndex = $ref(1)
let show = $ref(false)

useDisableEventListener(() => show)

/** 供外部调用:打开弹框并跳转到音效设置 tab */
function openSoundTab() {
  tabIndex = 3
  show = true
}

defineExpose({ openSoundTab })

// ---- 可拖拽浮窗:无遮罩,不遮挡练习内容,可实时预览调节效果;位置记忆到 localStorage ----
function loadPos() {
  try {
    return JSON.parse(localStorage.getItem('page-setting-pos') || '') || null
  } catch {
    return null
  }
}

// 默认位置:窗口右侧居中
function defaultPos() {
  return { x: Math.max(16, window.innerWidth - 560), y: Math.max(48, Math.round(window.innerHeight / 2 - 260)) }
}

// SSR 无 window,位置初始化放到 onMounted(客户端)
let pos = $ref({ x: 0, y: 0 })
let dragging = false
let dragOffset = { x: 0, y: 0 }

onMounted(() => {
  pos = loadPos() || defaultPos()
})

function startDrag(e: PointerEvent) {
  // 交互控件不触发拖拽
  if ((e.target as HTMLElement).closest('button, input, .no-drag, .slider')) return
  dragging = true
  dragOffset.x = e.clientX - pos.x
  dragOffset.y = e.clientY - pos.y
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
}

function onDragMove(e: PointerEvent) {
  if (!dragging) return
  pos.x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 520))
  pos.y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 200))
}

function endDrag() {
  dragging = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  localStorage.setItem('page-setting-pos', JSON.stringify(pos))
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
})

function open() {
  show = true
  tabIndex = props.initialTab ?? 1
}
</script>

<template>
  <!-- 可拖拽浮窗:无遮罩,不遮挡下方内容,可实时预览(字体/间距/音量等)调节效果 -->
  <Teleport to="body">
    <div v-if="show" class="page-setting-float" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
      <header class="float-header" @pointerdown="startDrag">
        <span>{{ '设置' }}</span>
        <Close class="no-drag" @click="show = false" />
      </header>
      <div class="float-tabs">
        <div class="tab" :class="tabIndex === 1 && 'active'" @click="tabIndex = 1">
          <IconFluentTextUnderlineDouble20Regular width="16" />
          <span>{{ '单词设置' }}</span>
        </div>
        <div class="tab" :class="tabIndex === 0 && 'active'" @click="tabIndex = 0">
          <IconFluentSettings20Regular width="16" />
          <span>{{ '通用设置' }}</span>
        </div>
        <div class="tab" :class="tabIndex === 3 && 'active'" @click="tabIndex = 3">
          <IconClarityVolumeUpLine width="16" />
          <span>{{ '音效设置' }}</span>
        </div>
      </div>
      <div class="float-content">
        <CommonSetting v-if="tabIndex === 0" />
        <WordSetting v-if="tabIndex === 1" />
        <SoundSetting v-if="tabIndex === 3" />
      </div>
    </div>
  </Teleport>

  <div class="trigger" @click="open">
    <BaseIcon title="设置">
      <IconFluentSettings20Regular />
    </BaseIcon>
    <span v-if="label">{{ label }}</span>
  </div>
</template>

<style scoped lang="scss">
// 触发按钮:图标 + 文字标签,整个区域可点击
.trigger {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.page-setting-float {
  position: fixed;
  z-index: 9999;
  width: 33rem;
  max-width: calc(100vw - 2rem);
  background: var(--color-second);
  border: 1px solid var(--color-item-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card-hover);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 86vh;

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
    flex-shrink: 0;
  }

  .float-tabs {
    display: flex;
    gap: 0.35rem;
    padding: 0.55rem 0.9rem 0;
    border-bottom: 1px solid var(--color-item-border);
    flex-shrink: 0;

    .tab {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.8rem;
      font-size: 0.95rem;
      border-radius: 0.45rem 0.45rem 0 0;
      color: var(--color-font-2);
      transition: all 0.3s;

      &:hover {
        background: var(--color-third);
      }

      &.active {
        background: var(--btn-primary);
        color: white;
      }
    }
  }

  .float-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.4rem 1rem 0.8rem;
    min-height: 0;
  }
}
</style>