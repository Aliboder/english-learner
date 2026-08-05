<script setup lang="ts">
import { BaseButton, Option, Select, Slider, Switch, Textarea } from '@typewords/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { useBaseStore } from '../../stores/base.ts'
import { setTheme } from '../../hooks/theme.ts'
import { ShortcutKey } from '../../types'

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
const store = useBaseStore()

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

const simpleWords = $computed({
  get: () => store.simpleWords.join(','),
  set: v => {
    try {
      store.simpleWords = v.split(',')
    } catch (e) {}
  },
})
</script>

<template>
  <div>
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
    <div class="line"></div>

    <SettingItem title="练习区宽度" desc="练习页内容区固定宽度(px):翻译长短不再改变布局,窗口窄时自动收窄">
      <Slider v-model="settingStore.practiceAreaWidth" showText showValue :min="480" :max="960" :step="20" unit="px" />
    </SettingItem>

    <SettingItem title="全局字体" desc="整个软件界面统一使用的字体(含练习页单词/翻译/例句),内置 MiSans 10 个字重;音标保持固定字体(MiSans 开源免费)">
      <Select v-model="settingStore.wordFont" class="w-full!">
        <Option v-for="opt in wordFontOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
      </Select>
    </SettingItem>

    <SettingItem title="窗口置顶" desc="开启后软件窗口始终显示在其他窗口最上层(边学边看其他窗口时方便)">
      <Switch v-model="settingStore.alwaysOnTop" />
    </SettingItem>
    <div class="line"></div>

    <SettingItem title="忽略大小写" desc="开启后，输入时不区分大小写，如输入“hello”和“Hello”都会被认为是正确的">
      <Switch v-model="settingStore.ignoreCase" />
    </SettingItem>

    <SettingItem
      title="允许默写模式下显示提示"
      :desc="`${'开启后，可以通过将鼠标移动到单词上或者按快捷键显示正确答案'} ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]}`"
    >
      <Switch v-model="settingStore.allowWordTip" />
    </SettingItem>

    <div class="line"></div>
    <SettingItem title="简单词过滤" desc="开启后，练习的单词中不会包含简单词；文章统计的总词数中不会包含简单词">
      <Switch v-model="settingStore.ignoreSimpleWord" />
    </SettingItem>

    <SettingItem title="简单词列表" class="items-start!" v-if="settingStore.ignoreSimpleWord">
      <Textarea
        placeholder="多个单词用英文逗号隔号"
        v-model="simpleWords"
        :autosize="{ minRows: 6, maxRows: 10 }"
      />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss"></style>