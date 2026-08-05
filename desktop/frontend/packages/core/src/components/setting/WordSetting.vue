<script setup lang="ts">
import { InputNumber, Slider, Switch, Radio, RadioGroup } from '@typewords/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { IdentifyMethod } from '../../types';

const settingStore = useSettingStore()
</script>

<template>
  <div>
    <SettingItem title="显示上一个/下一个单词" desc="开启后，练习中会在上方显示上一个/下一个单词">
      <Switch v-model="settingStore.showNearWord" />
    </SettingItem>

    <SettingItem title="输入错误时，清空已输入内容">
      <Switch v-model="settingStore.inputWrongClear" />
    </SettingItem>

    <SettingItem title="练习例句">
      <Switch v-model="settingStore.practiceSentence" />
    </SettingItem>

    <SettingItem title="单词循环设置(仅跟写生效)" class="gap-0!">
      <RadioGroup v-model="settingStore.repeatCount">
        <Radio :value="1" size="default">1</Radio>
        <Radio :value="2" size="default">2</Radio>
        <Radio :value="3" size="default">3</Radio>
        <Radio :value="5" size="default">5</Radio>
        <Radio :value="100" size="default">{{ '自定义' }}</Radio>
      </RadioGroup>
      <div class="ml-2 center gap-space" v-if="settingStore.repeatCount === 100">
        <span>{{ '循环次数' }}</span>
        <InputNumber v-model="settingStore.repeatCustomCount" :min="6" :max="15" type="number" />
      </div>
    </SettingItem>

    <SettingItem
      title="复习比"
      desc="复习词数量 = 每日新词数 × 此数值。默认 3:每学 1 个新词搭配复习 3 个旧词;设为 0 则只学新词不安排复习"
    >
      <InputNumber :min="0" :max="10" v-model="settingStore.wordReviewRatio" />
    </SettingItem>

    <SettingItem
      title="自测方式"
      desc="「识别」练习的判定方式:自评=点「认识/不认识」按钮自己判断;单词测验=四选一选正确答案;快速自测=看单词直接按键判断"
    >
      <RadioGroup v-model="settingStore.identifyMethod">
        <Radio :value="IdentifyMethod.SelfAssessment" size="default">{{ '自我评估' }}</Radio>
        <Radio :value="IdentifyMethod.WordTest" size="default">{{ '单词测试' }}</Radio>
        <Radio :value="IdentifyMethod.QuickIdentify" size="default">{{ '快速自测' }}</Radio>
      </RadioGroup>
    </SettingItem>

    <SettingItem title="显示词源和相关词" desc="单词的词源和相关词可能有误，请谨慎使用">
      <Switch v-model="settingStore.showEtymologyAndRelWords" />
    </SettingItem>

    <SettingItem
      title="显示详细翻译"
      desc="关闭后翻译不显示括号补充内容(如 <非正式>、(Good)、（人）等)，翻译更简洁"
    >
      <Switch v-model="settingStore.showDetailedTrans" />
    </SettingItem>

    <!--          自动切换-->
    <div class="line"></div>
    <SettingItem mainTitle="自动切换" />
    <SettingItem title="自动切换下一个单词" desc="开启:输完单词后自动跳转下一个;关闭:输完停留并显示完整信息,按空格或「下一个」快捷键(可在快捷键设置中修改)切换到下一个(仅跟写、拼写生效)">
      <Switch v-model="settingStore.autoNextWord" />
    </SettingItem>

    <SettingItem v-if="settingStore.autoNextWord" title="自动切换下一个单词时间" desc="正确输入单词后，自动跳转下一个单词的时间">
      <InputNumber
        v-model="settingStore.waitTimeForChangeWord"
        :min="0"
        :max="10000"
        :step="50"
        type="number"
      />
      <span class="ml-4">{{ '毫秒' }}</span>
    </SettingItem>

    <SettingItem
      v-else
      title="空格冷却时间"
      desc="关闭自动切换时，单词完成后为避免同时按下最后一个字母和空格键时跳过，忽略空格键的时间"
    >
      <InputNumber
        v-model="settingStore.spaceCooldownTime"
        :disabled="settingStore.autoNextWord"
        :min="0"
        :max="10000"
        :step="50"
        type="number"
      />
      <span class="ml-4">{{ '毫秒' }}</span>
    </SettingItem>

    <!--          字体设置-->
    <div class="line"></div>
    <SettingItem mainTitle="字体设置" />
    <SettingItem title="外语字体">
      <Slider :min="10" :max="100" v-model="settingStore.fontSize.wordForeignFontSize" showText showValue unit="px" />
    </SettingItem>
    <SettingItem title="中文字体">
      <Slider :min="10" :max="100" v-model="settingStore.fontSize.wordTranslateFontSize" showText showValue unit="px" />
    </SettingItem>
    <SettingItem title="字符间距" desc="练习页单词字母间距(px),更换全局字体后可手动微调至最佳观感">
      <Slider :min="0" :max="24" :step="1" v-model="settingStore.wordLetterSpacing" showText showValue unit="px" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss"></style>