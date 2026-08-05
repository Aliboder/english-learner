<script setup lang="ts">
import { BaseButton, Option, Select, Slider, Switch } from '@english-learner/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { setTheme } from '../../hooks/theme.ts'

// 内置练习字体:MiSans 子集化 woff2(10 个字重),默认半粗
const wordFontOptions = [
  { value: 'MiSans-Thin', label: 'MiSans 极细' },
  { value: 'MiSans-ExtraLight', label: 'MiSans 特细' },
  { value: 'MiSans-Light', label: 'MiSans 轻体' },
  { value: 'MiSans-Normal', label: 'MiSans 常规' },
  { value: 'MiSans-Regular', label: 'MiSans 标准' },
  { value: 'MiSans-Medium', label: 'MiSans 中等' },
  { value: 'MiSans-Demibold', label: 'MiSans 半粗' },
  { value: 'MiSans-Semibold', label: 'MiSans 中粗' },
  { value: 'MiSans-Bold', label: 'MiSans 粗体' },
  { value: 'MiSans-Heavy', label: 'MiSans 特粗' },
]

const settingStore = useSettingStore()

// 主题:跟随系统 / 浅色 / 深色(settingStore.theme 已持久化)
const themeOptions = [
  { label: '跟随系统', value: 'auto' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

function setThemeValue(val: string) {
  settingStore.theme = val
  setTheme(val)
}
</script>

<template>
  <div>
    <!-- 外观 -->
    <SettingItem mainTitle="外观" />
    <SettingItem title="主题" desc="选择界面外观模式，跟随系统会随系统明暗自动切换">
      <div class="flex gap-2">
        <BaseButton
          v-for="opt in themeOptions"
          :key="opt.value"
          size="small"
          :type="settingStore.theme === opt.value ? 'primary' : 'info'"
          @click="setThemeValue(opt.value)"
        >
          {{ opt.label }}
        </BaseButton>
      </div>
    </SettingItem>
    <SettingItem title="全局字体" desc="整个软件界面统一使用的字体(含练习页单词/翻译/例句),内置 MiSans 10 个字重;音标保持固定字体(MiSans 开源免费)">
      <Select v-model="settingStore.wordFont" class="w-full!">
        <Option v-for="opt in wordFontOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
      </Select>
    </SettingItem>

    <!-- 窗口 -->
    <div class="line"></div>
    <SettingItem mainTitle="窗口" />
    <SettingItem title="窗口置顶" desc="开启后软件窗口始终显示在其他窗口最上层(边学边看其他窗口时方便)">
      <Switch v-model="settingStore.alwaysOnTop" />
    </SettingItem>

    <!-- 练习区布局 -->
    <div class="line"></div>
    <SettingItem mainTitle="练习区布局" />
    <SettingItem title="练习区宽度" desc="练习页内容区固定宽度(px):翻译长短不再改变布局,窗口窄时自动收窄">
      <Slider v-model="settingStore.practiceAreaWidth" showText showValue :min="480" :max="960" :step="10" unit="px" />
    </SettingItem>
    <SettingItem title="练习区顶部间距" desc="练习页内容区与窗口顶部的间距(px):输完单词的提示悬浮在操作按钮上方,间距越大越靠下">
      <Slider v-model="settingStore.practiceTopGap" showText showValue :min="100" :max="400" :step="10" unit="px" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss">
.line {
  border-bottom: 1px solid var(--color-line);
  margin: 0.8rem 0;
}
</style>
