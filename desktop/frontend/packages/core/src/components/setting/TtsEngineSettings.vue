<script setup lang="ts">
import { Option, Select, Slider, VolumeIcon } from '@typewords/base'
import SettingItem from './SettingItem.vue'
import { playEdgeTts } from '../../hooks/sound.ts'
import { useSettingStore } from '../../stores/setting'

const props = defineProps<{
  /** 分组标题 */
  title: string
  /** 试听文本 */
  sample: string
  /** 试听音量(0-100) */
  volume: number
  /** 翻译朗读语速(transSoundSpeed,与单词发音 wordSoundSpeed 独立,合成变速,音调不变) */
  speed: number
  /** 显示翻译语速滑条(顶部「总倍速」展开后隐藏,避免重复) */
  showSpeed?: boolean
}>()

const settingStore = useSettingStore()

/** 微软 Edge TTS 中文音色列表 */
const EDGE_TTS_ZH_VOICES = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓(女,推荐)' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊(女)' },
  { value: 'zh-CN-YunxiNeural', label: '云希(男)' },
  { value: 'zh-CN-YunyangNeural', label: '云扬(男)' },
  { value: 'zh-CN-YunjianNeural', label: '云健(男)' },
  { value: 'zh-CN-YunxiaNeural', label: '云夏(男)' },
]

function preview() {
  playEdgeTts(props.sample, {
    volume: props.volume / 100,
    engine: { lengthScale: props.speed, voice: settingStore.ttsVoice },
  })
}
</script>

<template>
  <div>
    <SettingItem
      :mainTitle="title"
      desc="微软 Edge TTS 在线朗读(音质最佳,需联网);仅朗读单词翻译,语速与单词发音相互独立(下方可调,顶部「总倍速」可统一调节)"
    />
    <SettingItem title="试听" desc="按当前音色朗读示例,点击右侧喇叭">
      <div class="flex items-center gap-2 w-full">
        <span class="flex-1 text-sm" style="color: var(--color-sub-text)">{{ sample }}</span>
        <VolumeIcon :time="200" @click="preview" />
      </div>
    </SettingItem>
    <SettingItem title="音色" desc="微软 Edge TTS 中文音色">
      <Select v-model="settingStore.ttsVoice" class="w-full!">
        <Option v-for="v in EDGE_TTS_ZH_VOICES" :key="v.value" :value="v.value" :label="v.label" />
      </Select>
    </SettingItem>
    <SettingItem v-if="showSpeed" title="翻译语速" desc="中文翻译朗读语速,与单词发音独立">
      <Slider v-model="settingStore.transSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss"></style>