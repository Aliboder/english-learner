<script setup lang="ts">
import { GITHUB } from '../config/env.ts'

// 桌面版版本号由 preload 暴露(app.getVersion());SSR 阶段无 window,浏览器环境无 desktop 时回退为 '—'
const version = typeof window !== 'undefined' ? (window as any).desktop?.version ?? '—' : '—'
</script>

<template>
  <div class="w-full max-w-160">
    <h1 class="text-2xl font-bold mb-2">{{ 'EnglishLearner 英语学习' }}</h1>
    <p class="text-xl mb-4">{{ '基于 TypeWords 的本地英语学习桌面应用' }}</p>
    <div class="flex flex-col gap-2">
      <p><span class="font-bold">{{ '版本：' }}</span>v{{ version }}</p>
      <p><span class="font-bold">{{ '用途：' }}</span>{{ '打字背单词，支持跟打 / 听写 / 自测 / 默写，FSRS 记忆曲线自动安排复习' }}</p>
      <p><span class="font-bold">{{ '数据：' }}</span>{{ '全部保存在本机，支持导入 / 导出备份，卸载重装不丢失' }}</p>
      <p><span class="font-bold">{{ '词库：' }}</span>{{ '内置中考 / 高考 / 四六级 / 考研 / 专升本 / 雅思 / 托福 / 人教版教材同步等 30+ 词库 + ECDICT 英汉词典（84 万高频词）+ 无道词典（9.6 万词），开箱即用' }}</p>
    </div>
    <div class="line my-6"></div>
    <p class="text-sm text-gray-500">
      {{ '本软件基于开源项目' }}
      <a :href="GITHUB" target="_blank" class="color-link">TypeWords</a>
      {{ '（GPL-3.0）修改，以 GPL-3.0 协议开源，完整源码见项目 README。' }}<br />
      {{ '「ECDICT 英汉词典」数据来源于' }}
      <a href="https://github.com/skywind3000/ECDICT" target="_blank" class="color-link">ECDICT</a>
      {{ '（MIT 协议）；「无道词典」词库数据来源于' }}
      <a href="https://github.com/ChestnutHeng/Wudao-dict" target="_blank" class="color-link">Wudao-dict</a>
      {{ '，特此致谢。' }}
    </p>
  </div>
</template>

<style scoped lang="scss"></style>
