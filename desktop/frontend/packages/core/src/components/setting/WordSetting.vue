<script setup lang="ts">
import { InputNumber, Slider, Switch, Radio, RadioGroup, Textarea } from '@english-learner/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '../../stores/setting.ts'
import { useBaseStore } from '../../stores/base.ts'
import { IdentifyMethod } from '../../types'
import { ShortcutKey } from '../../types'

const settingStore = useSettingStore()
const store = useBaseStore()

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
    <!-- 输入行为 -->
    <SettingItem mainTitle="输入行为" />
    <SettingItem title="忽略大小写" desc="开启后，输入时不区分大小写，如输入“hello”和“Hello”都会被认为是正确的">
      <Switch v-model="settingStore.ignoreCase" />
    </SettingItem>
    <SettingItem title="输入错误时，清空已输入内容">
      <Switch v-model="settingStore.inputWrongClear" />
    </SettingItem>

    <!-- 显示选项 -->
    <div class="line"></div>
    <SettingItem mainTitle="显示选项" />
    <SettingItem title="自测方式" desc="「识别」练习的判定方式:自评=点「认识/不认识」按钮自己判断;单词测验=四选一选正确答案;快速自测=看单词直接按键判断">
      <RadioGroup v-model="settingStore.identifyMethod">
        <Radio :value="IdentifyMethod.SelfAssessment" size="default">{{ '自我评估' }}</Radio>
        <Radio :value="IdentifyMethod.WordTest" size="default">{{ '单词测试' }}</Radio>
        <Radio :value="IdentifyMethod.QuickIdentify" size="default">{{ '快速自测' }}</Radio>
      </RadioGroup>
    </SettingItem>
    <SettingItem title="显示详细翻译" desc="关闭后翻译不显示括号补充内容(如 <非正式>、(Good)、（人）等)，翻译更简洁">
      <Switch v-model="settingStore.showDetailedTrans" />
    </SettingItem>
    <SettingItem title="显示词源和相关词" desc="单词的词源和相关词可能有误，请谨慎使用">
      <Switch v-model="settingStore.showEtymologyAndRelWords" />
    </SettingItem>
    <SettingItem
      title="允许默写模式下显示提示"
      :desc="`${'开启后，可以通过将鼠标移动到单词上或者按快捷键显示正确答案'} ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]}`"
    >
      <Switch v-model="settingStore.allowWordTip" />
    </SettingItem>
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

    <!-- 自动切换 -->
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

    <!-- 练习内容 -->
    <div class="line"></div>
    <SettingItem mainTitle="练习内容" />
    <SettingItem title="练习例句" desc="跟写模式输完单词后,接着跟打例句(逐句输入)">
      <Switch v-model="settingStore.practiceSentence" />
    </SettingItem>
    <SettingItem v-if="settingStore.practiceSentence" title="例句练习数量" desc="每个单词跟打几条例句(单词例句不足时按实际数量,全部练完后进入下一个单词)">
      <InputNumber v-model="settingStore.practiceSentenceCount" :min="1" :max="10" type="number" />
      <span class="ml-4">{{ '条' }}</span>
    </SettingItem>
    <SettingItem v-if="settingStore.practiceSentence" title="例句纯字母输入" desc="开启:只需输入例句中的字母,空格/标点/数字自动跳过;关闭:需输入完整语句(含空格和标点)">
      <Switch v-model="settingStore.practiceSentenceLettersOnly" />
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

    <!-- 字体 -->
    <div class="line"></div>
    <SettingItem mainTitle="练习字体" />
    <SettingItem title="外语字体" desc="练习页单词/例句字号">
      <Slider :min="10" :max="100" v-model="settingStore.fontSize.wordForeignFontSize" showText showValue unit="px" />
    </SettingItem>
    <SettingItem title="中文字体" desc="练习页翻译/例句中文字号">
      <Slider :min="10" :max="100" v-model="settingStore.fontSize.wordTranslateFontSize" showText showValue unit="px" />
    </SettingItem>
    <SettingItem title="测试选项卡字号" desc="单词测试页选项卡卡片里的翻译/词性文字大小">
      <Slider :min="10" :max="40" v-model="settingStore.testTransFontSize" showText showValue unit="px" />
    </SettingItem>
    <SettingItem title="字符间距" desc="练习页单词字母间距(px),更换全局字体后可手动微调至最佳观感">
      <Slider :min="0" :max="24" :step="1" v-model="settingStore.wordLetterSpacing" showText showValue unit="px" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss">
.line {
  border-bottom: 1px solid var(--color-line);
  margin: 0.8rem 0;
}
</style>
