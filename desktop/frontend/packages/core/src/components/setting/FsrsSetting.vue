<script setup lang="ts">
import { InputNumber } from '@typewords/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { BaseButton, Collapse, Switch } from '@typewords/base'
import { useRouter } from 'vue-router'
const settingStore = useSettingStore()
const router = useRouter()
</script>

<template>
  <!-- 说明 + 学习记录按钮并排,不再孤立占一行 -->
  <div class="flex items-center justify-between gap-4">
    <p class="flex-1 min-w-0">{{ '基于“艾宾浩斯遗忘曲线”设计，系统会根据你的记忆情况，自动安排最合适的复习时间。\n不再机械重复，让你用更少时间记住更多单词。\n记得越牢，复习间隔越长；容易忘的内容，会更频繁出现。' }}</p>
    <BaseButton type="info" class="shrink-0" @click="router.push('/fsrs')">{{ '学习记录' }}</BaseButton>
  </div>

  <div class="line mt-4 mb-4"></div>

  {{ '在学习过程中对每个单词错误次数进行评级，共有四个评级，Again,Hard,Good,Easy，遗忘曲线算法会使用评级来计算这个单词下一次需要复习的时间。' }}

  <SettingItem title="Easy评级判定标准">
    {{ '小于等于' }}
    <InputNumber :min="0" :max="settingStore.fsrsGoodLimit" v-model="settingStore.fsrsEasyLimit" />
    {{ '次' }}
    {{ '错误' }}
  </SettingItem>
  <SettingItem title="Good评级判定标准">
    {{ '小于等于' }}
    <InputNumber
      :min="settingStore.fsrsEasyLimit"
      :max="settingStore.fsrsHardLimit"
      v-model="settingStore.fsrsGoodLimit"
    />
    {{ '次' }}
    {{ '错误' }}
  </SettingItem>
  <SettingItem title="Hard评级判定标准">
    {{ '小于等于' }}
    <InputNumber :min="settingStore.fsrsGoodLimit" :max="10" v-model="settingStore.fsrsHardLimit" />
    {{ '次' }}
    {{ '错误' }}
  </SettingItem>

  <div class="line mt-4 mb-4"></div>

  <!-- 高级参数:改用项目 Collapse 组件(行为一致,样式统一) -->
  <Collapse q="高级设置">
    <div class="pl-2">
      <SettingItem title="为下次复习时间引入一定的随机" desc="通过引入随机,可以避免大量单词需要在同一天复习">
        <Switch v-model="settingStore.fsrsParameters.enable_fuzz" />
      </SettingItem>

      <SettingItem title="希望的最小回忆概率">
        <InputNumber v-model="settingStore.fsrsParameters.request_retention" :min="0" :max="1" />
      </SettingItem>

      <SettingItem title="最大间隔天数限制">
        <InputNumber v-model="settingStore.fsrsParameters.maximum_interval" :min="0" />
      </SettingItem>

      <Collapse q="权重">
        <!-- 19 个权重横向排列(每行 5 个),不再竖排一列 -->
        <div class="grid grid-cols-5 gap-2">
          <InputNumber
            v-for="(_, index) in settingStore.fsrsParameters.w"
            :key="index"
            v-model="settingStore.fsrsParameters.w[index]"
          />
        </div>
      </Collapse>
    </div>
  </Collapse>

  <div class="line mt-4 mb-4"></div>
</template>

<style scoped lang="scss"></style>
