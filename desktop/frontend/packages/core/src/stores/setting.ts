import { defineStore } from 'pinia'
import { checkAndUpgradeSaveDict, checkAndUpgradeSaveSetting, cloneDeep, parseJsonStr } from '../utils'
import { get, set } from 'idb-keyval'
import { APP_VERSION, DefaultShortcutKeyMap, SAVE_SETTING_KEY } from '../config/env'
import { IdentifyMethod, type SaveData, WordPracticeMode, WordPracticeType } from '../types'
import type { FSRSParameters } from 'ts-fsrs'

export interface SettingState {
  soundType: string

  wordSound: boolean
  wordSoundVolume: number
  wordSoundSpeed: number // 单词发音倍速(播放倍速,越大越快)
  transSoundSpeed: number // 中文翻译朗读倍速(Edge TTS rate,与单词发音独立,越大越快)
  wordReviewRatio: number // 单词复习比例

  keyboardSound: boolean
  keyboardSoundVolume: number
  keyboardSoundFile: string

  effectSound: boolean
  effectSoundVolume: number

  repeatCount: number // 重复次数
  repeatCustomCount?: number // 自定义重复次数
  dictation: boolean // 显示默写
  translate: boolean // 显示翻译
  showNearWord: boolean // 显示上/下一个词
  ignoreCase: boolean // 忽略大小写
  allowWordTip: boolean // 默写时时否允许查看提示
  waitTimeForChangeWord: number // 切下一个词的等待时间（自动模式）
  spaceCooldownTime: number // 空格冷却时间（手动模式，单词完成后忽略空格键的时间）
  fontSize: {
    articleForeignFontSize: number
    articleTranslateFontSize: number
    wordForeignFontSize: number
    wordTranslateFontSize: number
  }
  showToolbar: boolean //收起/展开工具栏
  showPanel: boolean // 收起/展开面板
  sideExpand: boolean // 收起/展开左侧侧边栏
  autoBackup: boolean // 退出时自动备份到「文档/EnglishLearner备份」
  theme: string
  shortcutKeyMap: Record<string, string>
  first: boolean
  firstTime: number
  webAppVersion: number
  load: boolean
  conflictNotice: boolean // 其他脚本/插件冲突提示
  showConflictNotice2: boolean // 其他脚本/插件冲突提示
  showUsageTips: boolean //  显示使用提示
  ignoreSimpleWord: boolean // 忽略简单词
  wordPracticeMode: WordPracticeMode // 单词练习模式
  wordPracticeType: WordPracticeType // 单词练习类型
  autoNextWord: boolean // 自动切换下一个单词(仅跟写、拼写生效;关闭时输完停留显示完整信息,按空格切换)
  inputWrongClear: boolean // 单词输入错误，清空已输入内容
  mobileNavCollapsed: boolean // 移动端底部导航栏收缩状态
  ignoreSymbol: boolean // 过滤符号
  practiceSentence: boolean // 练习例句

  fsrsEasyLimit: number // 小于等于fsrsEasyLimit的卡片会评估为Easy
  fsrsGoodLimit: number // 小于等于fsrsEasyLimit且小于等于fsrsHardLimit的卡片会评估为Good
  fsrsHardLimit: number // 小于等于fsrsHardLimit的卡片会评估为Hard
  fsrsParameters: FSRSParameters

  identifyMethod: IdentifyMethod
  _ignoreWatch: boolean //忽略监听，避免重复保存和上传
  showEtymologyAndRelWords:boolean // 显示词源和相关词

  ttsVoice: string // 中文朗读音色(微软 Edge TTS 音色 ID,默认晓晓;例句朗读共用此音色)
  autoPlayTrans: boolean // 单词发音结束后自动朗读中文翻译
  sentenceSoundSpeed: number // 例句朗读语速(与单词/翻译语速独立;例句朗读共用 ttsVoice 音色)
  practiceAreaWidth: number // 练习页内容区固定宽度(px,窗口窄时自动收窄)
  showDetailedTrans: boolean // 显示详细翻译(括号补充内容;关闭后翻译更简洁)
  wordFont: string // 全局字体(内置 MiSans 字重名,默认 'MiSans-Semibold',作用于整个界面 + 练习页)
  wordLetterSpacing: number // 练习页单词字符间距(px,换字体后可手动微调)
  alwaysOnTop: boolean // 窗口置顶(软件窗口始终显示在最上层)
}

export const getDefaultSettingState = (): SettingState => ({
  soundType: 'us',

  wordSound: true,
  wordSoundVolume: 100,
  wordSoundSpeed: 1,
  transSoundSpeed: 1,
  sentenceSoundSpeed: 1,
  wordReviewRatio: 3,

  keyboardSound: true,
  keyboardSoundVolume: 100,
  keyboardSoundFile: '笔记本键盘',

  effectSound: true,
  effectSoundVolume: 100,

  repeatCount: 1,
  repeatCustomCount: null,
  dictation: false,
  translate: true,
  showNearWord: true,
  ignoreCase: true,
  allowWordTip: true,
  waitTimeForChangeWord: 300,
  spaceCooldownTime: 300,
  fontSize: {
    articleForeignFontSize: 48,
    articleTranslateFontSize: 20,
    wordForeignFontSize: 48,
    wordTranslateFontSize: 20,
  },
  showToolbar: true,
  showPanel: true,
  sideExpand: true,
  autoBackup: true,
  theme: 'auto',
  shortcutKeyMap: cloneDeep(DefaultShortcutKeyMap),
  first: true,
  firstTime: Date.now(),
  webAppVersion: APP_VERSION.version,
  load: false,
  conflictNotice: true,
  showConflictNotice2: true,
  showUsageTips: true,
  ignoreSimpleWord: false,
  wordPracticeMode: WordPracticeMode.System,
  wordPracticeType: WordPracticeType.FollowWrite,
  autoNextWord: true,
  inputWrongClear: false,
  mobileNavCollapsed: false,
  ignoreSymbol: true,
  practiceSentence: false,
  fsrsEasyLimit: 0,
  fsrsGoodLimit: 3,
  fsrsHardLimit: 6,

  fsrsParameters: {
    request_retention: 0.9,
    maximum_interval: 36500,
    w: [
      0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
      1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ],
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  },

  identifyMethod: IdentifyMethod.SelfAssessment,
  _ignoreWatch: false,
  showEtymologyAndRelWords: false,
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  autoPlayTrans: true,
  practiceAreaWidth: 640,
  showDetailedTrans: true,
  wordFont: 'MiSans-Semibold',
  wordLetterSpacing: 6,
  alwaysOnTop: false,
})

export const useSettingStore = defineStore('setting', {
  state: (): SettingState => {
    return getDefaultSettingState()
  },
  actions: {
    setState(obj: any) {
      this.$patch(obj)
    },
    async init(): Promise<SaveData | null> {
      return new Promise(async resolve => {
        try {
          let jsonStr = await get(SAVE_SETTING_KEY.key)
          if (jsonStr) {
            let result = await parseJsonStr(jsonStr, checkAndUpgradeSaveSetting)

            //如果升级了，那么要保持本地比线上新，不然会被覆盖
            const shouldRefreshUpdatedAt = (result.val as any)?.__updateLocalData ?? false
            delete (result.val as any)?.__updateLocalData
            if (shouldRefreshUpdatedAt) {
              await set(SAVE_SETTING_KEY.key, JSON.stringify(result))
            }

            this.setState(result.val)
            resolve(result)
          }
          resolve(null)
        } catch (e) {
          console.error('读取本地设置数据失败', e)
          resolve(null)
        }
      })
    },
  },
})
