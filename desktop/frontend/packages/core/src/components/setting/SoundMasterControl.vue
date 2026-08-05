<script setup lang="ts">
import { computed } from 'vue'
import { Slider, Switch, VolumeIcon } from '@english-learner/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting'
import type { SettingState } from '../../stores/setting'
import { getAudioFileUrl } from '../../hooks/sound'

const props = defineProps<{
  type: 'volume' | 'speed'
  isUnified: boolean
  expanded: boolean
  showSubsInMaster: boolean
  /** 隐藏总调节条:只显示小节标题 + 子项(子项恒显示) */
  hideMaster?: boolean
  /** 子项定义:key=设置字段,labelKey=显示名, sample=点击喇叭试听的示例文本(仅 speed 类型) */
  items: { key: keyof SettingState; labelKey: string; sample?: string }[]
}>()

const emit = defineEmits<{
  toggleExpanded: []
}>()

const modelValue = defineModel<number>({ required: true })

const settingStore = useSettingStore()

// 子项中文名(labelKey → 中文,单语言直接映射)
const labelMap: Record<string, string> = {
  word_pronunciation: '单词发音',
  keyboard_volume: '按键音量',
  effect_volume: '效果音量',
  word_speed: '单词语速',
  trans_speed: '翻译语速',
  sentence_speed: '例句语速',
}


const titleKey = computed(() => (props.type === 'volume' ? '总音量' : '总倍速'))
const isVolume = computed(() => props.type === 'volume')

// 语速试听:内置音频文件(离线可用),用 playbackRate 变速 —— 调好语速立即点喇叭听效果
const PREVIEW_URLS: Record<string, string> = {
  word_speed: '/sound/speed-preview/word.mp3',
  trans_speed: '/sound/speed-preview/trans.mp3',
  sentence_speed: '/sound/speed-preview/sentence.mp3',
}

// 音量行对应的开关字段(开关与滑条合并在一行:关=该声音静音)
const SOUND_KEYS: Record<string, keyof SettingState> = {
  word_pronunciation: 'wordSound',
  keyboard_volume: 'keyboardSound',
  effect_volume: 'effectSound',
}

let previewAudio: HTMLAudioElement | null = null

/** 音量试听:按键音量用当前选中的按键音效文件,其余用内置音频 */
function volumePreviewUrl(labelKey: string) {
  if (labelKey === 'keyboard_volume') return getAudioFileUrl(settingStore.keyboardSoundFile)[0]
  if (labelKey === 'effect_volume') return '/sound/correct.wav'
  return '/sound/speed-preview/word.mp3'
}

function preview(item: { key: keyof SettingState; labelKey: string; sample?: string }) {
  const isVolume = props.type === 'volume'
  const url = isVolume ? volumePreviewUrl(item.labelKey) : PREVIEW_URLS[item.labelKey]
  if (!url) return
  previewAudio?.pause()
  const a = new Audio(url)
  if (isVolume) {
    a.volume = (settingStore[item.key] as number) / 100
  } else {
    a.playbackRate = settingStore[item.key] as number
  }
  a.play()
  previewAudio = a
}
</script>

<template>
  <div>
    <!-- 小节标题(hideMaster 时作为独立小节;否则为总条标题) -->
    <SettingItem
      :mainTitle="hideMaster ? titleKey : undefined"
      :title="hideMaster ? undefined : titleKey"
      :desc="isVolume ? undefined : '统一调节单词语速 / 翻译语速 / 例句语速,展开可单独设置并试听'"
    >
      <!-- 总调节条(hideMaster 时隐藏,子项已可单独调) -->
      <template v-if="!hideMaster">
        <div class="flex items-center gap-2 w-full">
          <Slider
            v-model="modelValue"
            class="flex-1"
            :disabled="!isUnified"
            :step="isVolume ? 1 : 0.1"
            :min="isVolume ? 0 : 0.5"
            :max="isVolume ? 100 : 3"
            showText
            showValue
            :unit="isVolume ? '%' : undefined"
          />
          <IconFluentChevronDown20Regular
            class="flex-shrink-0 text-lg cursor-pointer transition-transform duration-200"
            :class="{ 'rotate-180': expanded }"
            title="展开详细设置"
            @click="emit('toggleExpanded')"
          />
        </div>
      </template>
    </SettingItem>

    <!-- 子项行:每个声音一行 = 名称 + 试听喇叭(+ 开关,仅音量) + 滑条 -->
    <div v-if="hideMaster || showSubsInMaster" class="flex flex-col gap-3 w-full">
      <div
        v-for="item in items"
        :key="String(item.key)"
        class="flex items-center gap-2 w-full"
      >
        <span class="text-sm text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 truncate">
          {{ labelMap[item.labelKey] }}
        </span>
        <!-- 试听喇叭:音量行 = 内置/按键音效文件按当前音量播放;倍速行 = 内置音频按当前倍速播放 -->
        <VolumeIcon
          v-if="isVolume ? volumePreviewUrl(item.labelKey) : PREVIEW_URLS[item.labelKey]"
          class="flex-shrink-0 cursor-pointer text-gray-400 hover:text-[var(--color-link)]"
          :title="'试听' + labelMap[item.labelKey]"
          @click="preview(item)"
        />
        <!-- 音量行:开关与滑条合并(关 = 该声音静音) -->
        <Switch
          v-if="isVolume && SOUND_KEYS[item.labelKey]"
          v-model="settingStore[SOUND_KEYS[item.labelKey]]"
          size="small"
          class="flex-shrink-0"
        />
        <Slider
          v-model="settingStore[item.key] as number"
          class="flex-1"
          :step="isVolume ? 1 : 0.1"
          :min="isVolume ? 0 : 0.5"
          :max="isVolume ? 100 : 3"
          showText
          showValue
          :unit="isVolume ? '%' : undefined"
        />
      </div>
    </div>
  </div>
</template>
