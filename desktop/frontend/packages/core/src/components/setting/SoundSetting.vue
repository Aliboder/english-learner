<script setup lang="ts">
import { Option, Select, Switch, VolumeIcon } from '@english-learner/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { ENV, SoundFileOptions } from '../../config/env.ts'
import { getAudioFileUrl, usePlayAudio } from '../../hooks/sound.ts'

const settingStore = useSettingStore()
</script>

<template>
  <div>

    <!-- 音效区:开关已合并到顶部「总音量」对应行,这里只留选择与说明 -->
    <SettingItem mainTitle="音效" />
    <SettingItem title="按键音效" desc="开关与音量在顶部「总音量」的「按键音量」行">
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
