<script setup lang="ts">
import { computed } from 'vue'
import { Option, Select, Slider, Switch, VolumeIcon } from '@english-learner/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { ENV, SoundFileOptions } from '../../config/env.ts'
import { getAudioFileUrl, usePlayAudio } from '../../hooks/sound.ts'

const settingStore = useSettingStore()

// 倍数兜底:合法范围 10~100;旧数据(百分比/过渡版倍数)不在范围内一律按最低 10 倍处理(与 usePlayKeyboardAudio 一致)
const keyboardGain = computed(() => {
  const raw = settingStore.keyboardSoundVolume
  return raw >= 10 && raw <= 100 ? raw : 10
})

// 试听按键音:按当前倍数放大播放(音量超过原始音量时 audio.volume 无效,需走 AudioContext gain)
let previewCtx: AudioContext | null = null
let previewEl: HTMLAudioElement | null = null
function previewKeyboard() {
  previewEl?.pause()
  previewEl = null
  previewCtx?.close()
  const url = getAudioFileUrl(settingStore.keyboardSoundFile)[0]
  const ctx = new AudioContext()
  previewCtx = ctx
  const audio = new Audio(url)
  previewEl = audio
  const src = ctx.createMediaElementSource(audio)
  const gain = ctx.createGain()
  gain.gain.value = keyboardGain.value
  src.connect(gain).connect(ctx.destination)
  audio.play().catch(() => {})
}
</script>

<template>
  <div>

    <!-- 音效区:按键音开关/倍数在此独立设置(不参与总音量) -->
    <SettingItem mainTitle="音效" />
    <SettingItem title="按键音量" desc="按键音的放大倍数:10 倍起,最大 100 倍(轴体声音偏轻可调大)">
      <div class="flex items-center gap-2 w-full">
        <VolumeIcon :title="'试听(按当前倍数)'" @click="previewKeyboard" />
        <Switch v-model="settingStore.keyboardSound" />
        <Slider
          v-model="settingStore.keyboardSoundVolume"
          class="flex-1"
          :min="10"
          :max="100"
          :step="5"
          showText
          showValue
          unit="x"
        />
      </div>
    </SettingItem>
    <SettingItem title="按键音效" desc="选择轴体声音,下拉中可点击喇叭试听(试听为原始音量)">
      <Select v-model="settingStore.keyboardSoundFile" placeholder="请选择" class="w-full!">
        <Option v-for="item in SoundFileOptions" :key="item.value" :label="item.label" :value="item.value">
          <div class="flex justify-between items-center w-full">
            <span>{{ item.label }}</span>
            <VolumeIcon :time="100" @click="usePlayAudio(getAudioFileUrl(item.value)[0])" />
          </div>
        </Option>
      </Select>
    </SettingItem>
    <SettingItem title="效果音" desc="输错/完成时的提示音;开关与音量在顶部「总音量」的「效果音量」行" />
  </div>
</template>

<style scoped lang="scss">
.line {
  border-bottom: 1px solid var(--color-line);
  margin: 0.8rem 0;
}
</style>
