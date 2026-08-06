<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { BaseIcon, Option, Select, Switch, VolumeIcon } from '@english-learner/base'
import { SoundFileOptions } from '../../config/env.ts'
import { useWindowClick } from '../../hooks/event.ts'
import { getAudioFileUrl, usePlayAudio } from '../../hooks/sound.ts'
import { useSettingStore } from '../../stores/setting.ts'
import { emitter, EventKey } from '../../utils/eventBus'

const props = withDefaults(
  defineProps<{
    /** 触发按钮旁的文字标签(悬停整个区域都触发菜单) */
    label?: string
  }>(),
  { label: undefined }
)

const settingStore = useSettingStore()
let timer = 0
//停止切换事件，因为hover到select时会跳出mini-dialog
let selectIsOpen = false
let show = $ref(false)

// 弹出面板:Teleport 到 body 用 fixed 定位(不受父级 overflow 裁剪;浮窗/顶栏内也能正常显示)
const PANEL_W = 288
const PANEL_H = 300
const triggerRef = ref<HTMLElement | null>(null)
let panelStyle = $ref({ left: '0px', top: '0px' })

function updatePanelPos() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_W - 8))
  let top = rect.bottom + 8
  // 底部空间不足时翻到触发元素上方
  if (top + PANEL_H > window.innerHeight) top = Math.max(8, rect.top - PANEL_H - 8)
  panelStyle = { left: left + 'px', top: top + 'px' }
}

useWindowClick(() => {
  if (selectIsOpen) {
    selectIsOpen = false
  } else {
    show = false
  }
})

function toggle(val: boolean) {
  if (selectIsOpen) return
  clearTimeout(timer)
  if (val) {
    emitter.emit(EventKey.closeOther)
    show = val
    nextTick(updatePanelPos)
  } else {
    timer = setTimeout(() => {
      show = val
    }, 100)
  }
}

function selectToggle(e: boolean) {
  //这里要延时设置，因为关闭的时候，如果太早设置了false了，useWindowClick的事件就会把弹框关闭
  setTimeout(() => (selectIsOpen = e))
}

function eventCheck(e) {
  const isSelfOrChild = e.currentTarget.contains(e.target)
  if (isSelfOrChild) {
    //如果下拉框打开的情况就不拦截
    if (selectIsOpen) return
    e.stopPropagation()
  }
}
</script>

<template>
  <div ref="triggerRef" class="setting" @mouseenter="toggle(true)" @mouseleave="toggle(false)" @click="eventCheck">
    <BaseIcon>
      <IconClarityVolumeUpLine />
    </BaseIcon>
    <span v-if="label" class="label">{{ label }}</span>
    <!-- Teleport 到 body:fixed 定位跟随触发按钮,不受父级 overflow 裁剪 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="show"
          class="mini-modal"
          :style="{ width: PANEL_W + 'px', left: panelStyle.left, top: panelStyle.top, transform: 'none' }"
          @mouseenter="toggle(true)"
          @mouseleave="toggle(false)"
        >
          <div class="mini-row-title">{{ '音效设置' }}</div>
          <div class="mini-row">
            <label class="item-title">{{ '单词自动发音' }}</label>
            <div class="wrapper">
              <Switch v-model="settingStore.wordSound" inline-prompt active-text="开" inactive-text="关" />
            </div>
          </div>
          <div class="mini-row">
            <label class="item-title">{{ '单词发音口音' }}</label>
            <div class="wrapper">
              <Select v-model="settingStore.soundType" @toggle="selectToggle" placeholder="请选择" size="small">
                <Option label="美音" value="us" />
                <Option label="英音" value="uk" />
              </Select>
            </div>
          </div>
          <div class="mini-row">
            <label class="item-title">{{ '按键音' }}</label>
            <div class="wrapper">
              <Switch v-model="settingStore.keyboardSound" inline-prompt active-text="开" inactive-text="关" />
            </div>
          </div>
          <div class="mini-row">
            <label class="item-title">{{ '按键音效' }}</label>
            <div class="wrapper">
              <Select v-model="settingStore.keyboardSoundFile" @toggle="selectToggle" placeholder="请选择" size="small">
                <Option v-for="item in SoundFileOptions" :key="item.value" :label="item.label" :value="item.value">
                  <div class="el-option-row">
                    <span>{{ item.label }}</span>
                    <VolumeIcon :time="100" @click="usePlayAudio(getAudioFileUrl(item.value)[0])" />
                  </div>
                </Option>
              </Select>
            </div>
          </div>
          <div class="mini-row">
            <label class="item-title">{{ '效果音' }}</label>
            <div class="wrapper">
              <Switch v-model="settingStore.effectSound" inline-prompt active-text="开" inactive-text="关" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.wrapper {
  width: 50%;
  position: relative;
  text-align: right;
}

.setting {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.label {
  font-size: 0.875rem;
  color: var(--color-main-text);
  white-space: nowrap;
}

.el-option-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .icon-wrapper {
    transform: translateX(10rem);
  }
}
</style>
