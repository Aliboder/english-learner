<script setup lang="ts">
import { computed } from 'vue'
import { Option, Select, Slider, Switch, VolumeIcon } from '@typewords/base'
import SettingItem from './SettingItem.vue'
import SoundMasterControl from './SoundMasterControl.vue'
import TtsEngineSettings from './TtsEngineSettings.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { ENV, SoundFileOptions } from '../../config/env.ts'
import { getAudioFileUrl, usePlayAudio } from '../../hooks/sound.ts'
import {
  useSoundMasterSettings,
  SOUND_VOLUME_ITEMS,
  SOUND_SPEED_ITEMS,
} from '../../composables/useSoundMasterSettings.ts'

const settingStore = useSettingStore()
const {
  volumeExpanded,
  volumeIsUnified,
  volumeMaster,
  volumeToggleExpanded,
  speedExpanded,
  speedIsUnified,
  speedMaster,
  speedToggleExpanded,
} = useSoundMasterSettings()

const showVolumeSubsInSections = computed(() => !volumeIsUnified.value && !volumeExpanded.value)
const showVolumeSubsInMaster = computed(() => volumeExpanded.value)
const showSpeedSubsInSections = computed(() => !speedIsUnified.value && !speedExpanded.value)
const showSpeedSubsInMaster = computed(() => speedExpanded.value)
</script>

<template>
  <div>
    <!-- 总音量 / 总倍速 -->
    <SoundMasterControl
      v-model="volumeMaster"
      type="volume"
      :is-unified="volumeIsUnified"
      :expanded="volumeExpanded"
      :show-subs-in-master="showVolumeSubsInMaster"
      :items="SOUND_VOLUME_ITEMS"
      @toggle-expanded="volumeToggleExpanded()"
    />
    <SoundMasterControl
      v-model="speedMaster"
      type="speed"
      :is-unified="speedIsUnified"
      :expanded="speedExpanded"
      :show-subs-in-master="showSpeedSubsInMaster"
      :items="SOUND_SPEED_ITEMS"
      @toggle-expanded="speedToggleExpanded()"
    />

    <div class="line"></div>

    <!-- 单词发音 -->
    <SettingItem mainTitle="单词发音" />
    <SettingItem title="单词/句子发音口音" desc="仅单词生效，文章固定美音">
      <Select v-model="settingStore.soundType" placeholder="请选择" class="w-full!">
        <Option label="美音" value="us" />
        <Option label="英音" value="uk" />
      </Select>
    </SettingItem>
    <SettingItem title="单词自动发音">
      <Switch v-model="settingStore.wordSound" />
    </SettingItem>
    <SettingItem title="自动朗读中文翻译" desc="单词发音结束后,紧接着自动朗读中文释义(仅练习页)">
      <Switch v-model="settingStore.autoPlayTrans" />
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" title="音量">
      <Slider v-model="settingStore.wordSoundVolume" showText showValue unit="%" />
    </SettingItem>
    <SettingItem v-if="showSpeedSubsInSections" title="语速">
      <Slider v-model="settingStore.wordSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue />
    </SettingItem>

    <!-- 中文翻译朗读(微软 Edge TTS 在线;单词发音走在线有道) -->
    <TtsEngineSettings
      title="中文翻译朗读"
      :sample="'坚持,就是胜利。每天进步一点点。'"
      :volume="settingStore.wordSoundVolume"
      :speed="settingStore.transSoundSpeed"
      :show-speed="showSpeedSubsInSections"
    />

    <!-- 例句朗读(微软 Edge TTS 在线,与翻译共用音色;预加载缓存,点击例句后喇叭播放) -->
    <div class="line"></div>
    <SettingItem mainTitle="例句朗读" desc="微软 Edge TTS 在线朗读单词例句,与翻译共用音色(需联网);练习中后台预加载例句语音,点击例句后的喇叭播放" />
    <SettingItem title="例句语速" desc="例句朗读语速,独立于单词发音与翻译语速">
      <Slider v-model="settingStore.sentenceSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue />
    </SettingItem>

    <!-- 按键音效 -->
    <div class="line"></div>
    <SettingItem mainTitle="按键音效" />
    <SettingItem title="按键音">
      <Switch v-model="settingStore.keyboardSound" />
    </SettingItem>
    <SettingItem title="按键音效">
      <Select v-model="settingStore.keyboardSoundFile" placeholder="请选择" class="w-full!">
        <Option v-for="item in SoundFileOptions" :key="item.value" :label="item.label" :value="item.value">
          <div class="flex justify-between items-center w-full">
            <span>{{ item.label }}</span>
            <VolumeIcon :time="100" @click="usePlayAudio(getAudioFileUrl(item.value)[0])" />
          </div>
        </Option>
      </Select>
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" title="音量">
      <Slider v-model="settingStore.keyboardSoundVolume" showText showValue unit="%" />
    </SettingItem>

    <!-- 效果音 -->
    <div class="line"></div>
    <SettingItem mainTitle="效果音" />
    <SettingItem title="效果音（输入错误、完成时的音效）">
      <Switch v-model="settingStore.effectSound" />
    </SettingItem>
    <SettingItem v-if="showVolumeSubsInSections" title="效果音量">
      <Slider v-model="settingStore.effectSoundVolume" showText showValue unit="%" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss">
.line {
  border-bottom: 1px solid var(--color-line);
  margin: 0.8rem 0;
}
</style>