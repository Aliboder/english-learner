<script setup lang="ts">
import { Option, Select, Switch } from '@english-learner/base'
import SettingItem from './SettingItem.vue'
import SoundMasterControl from './SoundMasterControl.vue'
import TtsEngineSettings from './TtsEngineSettings.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { useSpeechSoundSettings } from '../../composables/useSoundMasterSettings.ts'

const settingStore = useSettingStore()
const { volumeMaster, speedMaster } = useSpeechSoundSettings()

// 总音量:单词发音 + 按键音量 + 效果音量统一(每行:试听喇叭 + 开关 + 滑条);总倍速:单词发音 + 翻译朗读 + 例句朗读统一
const VOLUME_ITEMS = [
  { key: 'wordSoundVolume', labelKey: 'word_pronunciation' },
  { key: 'keyboardSoundVolume', labelKey: 'keyboard_volume' },
  { key: 'effectSoundVolume', labelKey: 'effect_volume' },
]
const SPEED_ITEMS = [
  { key: 'wordSoundSpeed', labelKey: 'word_speed' },
  { key: 'transSoundSpeed', labelKey: 'trans_speed' },
  { key: 'sentenceSoundSpeed', labelKey: 'sentence_speed' },
]
</script>

<template>
  <div>
    <!-- 总音量 / 总倍速:两个独立小节,子项直接展示(总调节条已隐藏) -->
    <SoundMasterControl v-model="volumeMaster" type="volume" hide-master :items="VOLUME_ITEMS" />

    <div class="line"></div>

    <SoundMasterControl v-if="speedMaster !== null" v-model="speedMaster" type="speed" hide-master :items="SPEED_ITEMS" />

    <div class="line"></div>

    <!-- 发音朗读区 -->
    <SettingItem mainTitle="发音朗读" />
    <SettingItem title="单词/句子发音口音" desc="仅单词生效，文章固定美音">
      <Select v-model="settingStore.soundType" placeholder="请选择" class="w-full!">
        <Option label="美音" value="us" />
        <Option label="英音" value="uk" />
      </Select>
    </SettingItem>
    <SettingItem title="自动朗读中文翻译" desc="单词发音结束后,紧接着自动朗读中文释义(仅练习页)">
      <Switch v-model="settingStore.autoPlayTrans" />
    </SettingItem>

    <!-- 中文翻译朗读(微软 Edge TTS 在线;单词发音走在线有道) -->
    <TtsEngineSettings
      title="中文翻译朗读"
      :sample="'坚持,就是胜利。每天进步一点点。'"
      :volume="settingStore.wordSoundVolume"
      :speed="settingStore.transSoundSpeed"
    />

    <!-- 例句朗读:无独立设置项(音量与单词发音共用,语速在总倍速),仅说明 -->
    <div class="line"></div>
    <SettingItem title="例句朗读" desc="微软 Edge TTS 在线朗读单词例句,与翻译共用音色(需联网);练习中后台预加载例句语音,点击例句后的喇叭播放。音量与单词发音共用,语速在顶部「总倍速」中调节" />
  </div>
</template>

<style scoped lang="scss">
.line {
  border-bottom: 1px solid var(--color-line);
  margin: 0.8rem 0;
}
</style>
