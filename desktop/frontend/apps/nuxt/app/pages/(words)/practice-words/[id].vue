<script setup lang="ts">
import { onMounted, onUnmounted, provide, watch } from 'vue'
import Statistics from '@english-learner/core/components/word/Statistics.vue'
import { emitter, EventKey, useEvents } from '@english-learner/core/utils/eventBus.ts'
import { useSettingStore } from '@english-learner/core/stores/setting.ts'
import { useRuntimeStore } from '@english-learner/core/stores/runtime.ts'
import type { Dict, PracticeData, TaskWords, Word } from '@english-learner/core/types/types.ts'
import { useStartKeyboardEventListener } from '@english-learner/core/hooks/event.ts'
import { schedulePrefetch, clearTtsCaches, ensurePersistedCacheLoaded } from '@english-learner/core/hooks/preloadTts.ts'
import { cancelWordPracticeAudio } from '@english-learner/core/hooks/sound.ts'
import useTheme from '@english-learner/core/hooks/theme.ts'
import { getCurrentStudyWord, useWordOptions } from '@english-learner/core/hooks/dict.ts'
import { openWordCollectPicker } from '@english-learner/core/hooks/useWordCollectPicker.ts'
import {
  _getDictDataByUrl,
  cloneDeep,
  debounce,
  getShufflePracticeWords,
  resourceWrap,
  shuffle,
  throttle,
} from '@english-learner/core/utils'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import TopToolbar from '@english-learner/core/components/word/TopToolbar.vue'
import Panel from '@english-learner/core/components/Panel.vue'
import { BaseIcon, Toast, ToastComponent, Tooltip } from '@english-learner/base'
import WordList from '@english-learner/core/components/list/WordList.vue'
import TypeWord from '@english-learner/core/components/word/TypeWord.vue'
import Empty from '@english-learner/core/components/Empty.vue'
import { useBaseStore } from '@english-learner/core/stores/base.ts'
import { usePracticeStore } from '@english-learner/core/stores/practice.ts'
import { getDefaultDict, getDefaultWord } from '@english-learner/core/types/func.ts'
import PracticeLayout from '@english-learner/core/components/PracticeLayout.vue'
import { DICT_LIST, WordPracticeModeStageMap } from '@english-learner/core/config/env.ts'
import GroupList from '@english-learner/core/components/word/GroupList.vue'
import { useDataSyncPersistence } from '@english-learner/core/composables/useDataSyncPersistence.ts'
import { flushStatToStore, usePracticeWordPersistence } from '@english-learner/core/composables/usePracticePersistence.ts'
import {
  IdentifyMethod,
  ShortcutKey,
  WordPracticeMode,
  WordPracticeStage,
  WordPracticeType,
} from '@english-learner/core/types/enum.ts'
import { createEmptyCard, Rating } from 'ts-fsrs'
import { useGetGradeByWrongTimes, useNextCard } from '@english-learner/core/hooks/fsrs.ts'
import WordMarkPickList, { type WordMarkPickResult } from '@english-learner/core/components/word/WordMarkPickList.vue'
import { buildQuestion } from '@english-learner/core/utils/word-test.ts'

const { isWordSimple, toggleWordSimple } = useWordOptions()
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const { toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()
const store = useBaseStore()
const statStore = usePracticeStore()
const dataSync = useDataSyncPersistence()
const wordPersistence = usePracticeWordPersistence()
let { getGradeByWrongTimes } = useGetGradeByWrongTimes()
let { nextCard } = useNextCard()
const typingRef: any = $ref()
let isComplete = $ref(false)
let loading = $ref(false)
let settling = $ref(false)
let timer = $ref<any>(-1)
/** 仅用于 visibilitychange 内 fetch：与 `!document.hidden` 一致 */
let isFocus = true
const IDLE_MS = 3 * 60 * 1000
let lastKeyActivity = Date.now()
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
})

//watch 实例列表，用于本地代码修改hrm后，导致重复watch
let watchRefList = []

function getDefaultPracticeData(origin?: Partial<PracticeData>, val?: Partial<PracticeData>): PracticeData {
  return Object.assign(origin, {
    index: 0,
    words: [],
    wrongWords: [],
    excludeWords: [],
    allWrongWords: [],
    wrongTimesMap: {},
    ratingMap: {},
    wrongTimes: 0,
    isTypingWrongWord: false,
    question: null,
    ...val,
  })
}
let data = $ref<PracticeData>(getDefaultPracticeData({}))

watch(
  () => data.words,
  () => {
    updateQuestion()
    handleResumeTimer()
    schedulePrefetch(data.words, data.index, {
      soundType: settingStore.soundType,
      voice: settingStore.ttsVoice,
      speed: settingStore.transSoundSpeed,
      sentenceSpeed: settingStore.sentenceSoundSpeed,
    })
  }
)
watch(
  () => data.index,
  () => {
    updateQuestion()
    handleResumeTimer()
    // 词位置推进 → 预加载滑窗跟着滑动(后台提前合成后续词的发音/翻译/例句)
    schedulePrefetch(data.words, data.index, {
      soundType: settingStore.soundType,
      voice: settingStore.ttsVoice,
      speed: settingStore.transSoundSpeed,
      sentenceSpeed: settingStore.sentenceSoundSpeed,
    })
  }
)

// 练习类型/测验方式切换(如进入单词测验阶段)时,同步重建或清空 question
watch(
  [() => settingStore.wordPracticeType, () => settingStore.identifyMethod],
  () => updateQuestion()
)

function isIdentifyLikeMode(mode: WordPracticeMode) {
  return mode === WordPracticeMode.IdentifyOnly
}

function updateQuestion() {
  // 惰性构建:仅单词测验(四选一)模式需要 question。打字/默写/听写/自评等模式无需,
  // 避免每次切词对超大词库(如 ECDICT 84 万词)做多次 O(n) 遍历过滤造成切词卡顿
  if (
    settingStore.wordPracticeType !== WordPracticeType.Identify ||
    settingStore.identifyMethod !== IdentifyMethod.WordTest
  ) {
    data.question = null
    return
  }
  if (data.words?.[data.index]) {
    const currentWord = data.words[data.index]
    data.question = buildQuestion(currentWord, allWords)
  }
}

provide('practiceData', data)
provide('practiceTaskWords', taskWords)

function bumpPracticeTimerActivity() {
  lastKeyActivity = Date.now()
}
provide('bumpPracticeTimerActivity', bumpPracticeTimerActivity)

function handleResumeTimer() {
  if (!isFocus) return
  if (statStore.timerPaused) {
    statStore.resumeTimer()
    Toast.success('已恢复计时')
  }
  bumpPracticeTimerActivity()
}

async function loadDict() {
  let dict = getDefaultDict()
  let dictId = route.params.id
  if (dictId) {
    //先在自己的词典列表里面找，如果没有再在资源列表里面找
    dict = store.word.bookList.find(v => v.id === dictId)
    // 本地已找到时无需联网拉资源列表(断网也能练本地词库);只有本地找不到才需要
    if (!dict) {
      try {
        let r = await fetch(resourceWrap(DICT_LIST.WORD.ALL))
        let dict_list = await r.json()
        dict = dict_list.flat().find(v => v.id === dictId) as Dict
      } catch {
        router.push('/words')
        return Toast.warning('获取词库列表失败,请检查网络')
      }
    }
    if (dict && dict.id) {
      //如果是不是自定义词典，就请求数据
      if (!dict.custom) {
        try {
          dict = await _getDictDataByUrl(dict)
        } catch {
          router.push('/words')
          return Toast.warning('加载词库失败,请检查网络')
        }
      }
      if (!dict.words.length) {
        router.push('/words')
        return Toast.warning('没有单词可学习！')
      }
      store.changeDict(dict)
      await initData(null, true)
      loading = false
    } else {
      router.push('/words')
    }
  } else {
    router.push('/words')
  }
}

watch(
  [() => store.load, () => loading],
  ([a, b]) => {
    if (a && b) loadDict()
  },
  { immediate: true }
)

const onvisibilitychange = async () => {
  isFocus = !document.hidden
  if (isFocus) {
    bumpPracticeTimerActivity()
    if (statStore.timerPaused && statStore.timerPauseReason === 'auto_visibility') {
      //特意延迟提示用户，让用户看到，免得用户焦虑，以为没暂停
      setTimeout(() => {
        statStore.resumeTimer()
        Toast.success('已自动恢复计时')
      }, 1500)
    }
    if (runtimeStore.globalLoading) return
    runtimeStore.globalLoading = true
    try {
      //todo 这里如果另一台机器学完了，这里的d可能为空
      const d = await wordPersistence.fetch()
      if (d) {
        taskWords = Object.assign(taskWords, d.taskWords)
        data = Object.assign(data, d.practiceData)
        statStore.$patch(d.statStoreData)
        // 恢复缓存后，若计时状态为"未暂停"，需重新开启一个新片段
        // 因为上次保存到现在有时间间隔，不能续在旧片段上
        if (!statStore.timerPaused) {
          const now = Date.now()
          statStore.segments.push([now, now])
        }
      }
    } finally {
      runtimeStore.globalLoading = false
    }
  } else {
    statStore.pauseTimer('auto_visibility')
  }
}

onMounted(async () => {
  // 每次进入练习页都从磁盘恢复朗读缓存(上次退出时清空了内存)
  ensurePersistedCacheLoaded(true)
  //如果是从单词学习主页过来的，就直接使用；否则等待加载
  if (runtimeStore.routeData) {
    await initData(null, true)
  } else {
    loading = true
  }
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  savePracticeData.cancel?.() // 取消防抖中未触发的保存,避免卸载后定时器二次写入
  savePracticeDataIns('onUnmounted').catch(e => console.error('退出时保存练习状态失败', e)) // 保存进行中的练习状态(内部自带未开始/已结算守卫,无需判缓存)
  timer && clearInterval(timer)
  watchRefList.map(v => v?.stop())
  cancelWordPracticeAudio() // 退出练习页:停止正在播放的单词/翻译语音,避免回到主页还在读
  clearTtsCaches() // 退出练习页:先刷盘再清内存缓存
})

let allWords: Word[] = []

let isIniting = ref(true)
async function initData(initVal?: TaskWords, init: boolean = false) {
  isIniting.value = true
  // 只有初始化时,才读取本地缓存
  if (init) {
    let d = runtimeStore.routeData
    if (!d) {
      d = await wordPersistence.load()
    }
    if (!d) {
      initData(getCurrentStudyWord())
      return
    }
    if (!(d.practiceData && d.statStoreData)) {
      initData(d.taskWords)
      return
    }
    taskWords = Object.assign(taskWords, d.taskWords)
    //这里直接赋值的话，provide后的inject获取不到最新值
    data = getDefaultPracticeData(data, d.practiceData)
    statStore.$patch(d.statStoreData)
    // 恢复缓存后，若计时状态为"未暂停"，需重新开启一个新片段
    // 因为上次保存到现在有时间间隔，不能续在旧片段上
    if (!statStore.timerPaused) {
      const now = Date.now()
      statStore.segments.push([now, now])
    }
  } else {
    // taskWords = initVal
    //不能直接赋值，会导致 inject 的数据为默认值
    taskWords = Object.assign(taskWords, initVal)

    if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
      settingStore.wordPracticeType = WordPracticeType.Dictation
      data = getDefaultPracticeData(data, { words: taskWords.review })
      statStore.stage = WordPracticeStage.Shuffle
      statStore.total = taskWords.review.length
      statStore.newWordNumber = 0
      statStore.reviewWordNumber = 0
    } else if (settingStore.wordPracticeMode === WordPracticeMode.Review) {
      if (taskWords.review.length) {
        data = getDefaultPracticeData(data, { words: taskWords.review })
        statStore.stage = WordPracticeStage.IdentifyReview
      }
      statStore.total = taskWords.review.length
      statStore.newWordNumber = 0
      statStore.reviewWordNumber = taskWords.review.length
    } else {
      if (taskWords.new.length === 0) {
        if (taskWords.review.length) {
          data = getDefaultPracticeData(data, { words: taskWords.review })
          if (settingStore.wordPracticeMode === WordPracticeMode.System) {
            statStore.stage = WordPracticeStage.IdentifyReview
          } else if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
            statStore.stage = WordPracticeModeStageMap[settingStore.wordPracticeMode][0]
          } else if (isIdentifyLikeMode(settingStore.wordPracticeMode)) {
            statStore.stage = WordPracticeStage.IdentifyReview
          } else if (settingStore.wordPracticeMode === WordPracticeMode.DictationOnly) {
            statStore.stage = WordPracticeStage.DictationReview
          } else if (settingStore.wordPracticeMode === WordPracticeMode.ListenOnly) {
            statStore.stage = WordPracticeStage.ListenReview
          }
        } else {
          Toast.warning('没有可学习的单词！')
          router.push('/words')
        }
      } else {
        data = getDefaultPracticeData(data, { words: taskWords.new })
        statStore.stage = WordPracticeModeStageMap[settingStore.wordPracticeMode][0]
      }
      statStore.total = taskWords.review.length + taskWords.new.length
      statStore.newWordNumber = taskWords.new.length
      statStore.reviewWordNumber = taskWords.review.length
    }

    statStore.startDate = Date.now()
    statStore.inputWordNumber = 0
    statStore.wrong = 0
    statStore.spend = 0
    statStore.segments = []
    statStore.resumeTimer() // 同时 push 第一条片段 [now, now]
    watchStage(statStore.stage)
    watchPracticeType(settingStore.wordPracticeType)
  }

  // 初始化 Question
  let dictId: any = route.params.id
  let d = store.word.bookList.find(v => v.id === dictId)
  if (!d) d = store.sdict
  if (!d?.id) return router.push('/words')
  allWords = shuffle(d.words)
  updateQuestion()

  clearInterval(timer)
  bumpPracticeTimerActivity()
  timer = setInterval(() => {
    if (!isFocus) return
    if (statStore.timerPaused) return

    const now = Date.now()
    if (now - lastKeyActivity >= IDLE_MS) {
      return statStore.pauseTimer('auto_idle')
    }
    statStore.spend += 1000
  }, 1000)
  isIniting.value = false
  settling = isComplete = false
}

const word = $computed<Word>(() => {
  return data.words[data.index] ?? getDefaultWord()
})
const prevWord: Word = $computed(() => {
  return data.words?.[data.index - 1] ?? undefined
})
const nextWord: Word = $computed(() => {
  return data.words?.[data.index + 1] ?? undefined
})

//因为有时要从缓存里面读数据，这时的状态、进度保持原样，所以只能惰性监听，所以没缓存时主动调用一个，以更新为符合当前进度的状态、模式
//比如，每个阶段都有错误复习这个流程，当正在错词复习时，如果执行state监听，就可能恢复成stage默认的配置项（模式、dictation、translate）
function watchStage(n: WordPracticeStage) {
  switch (n) {
    case WordPracticeStage.DictationNewWord:
    case WordPracticeStage.DictationReview:
    case WordPracticeStage.Shuffle:
      settingStore.wordPracticeType = WordPracticeType.Dictation
      break
    case WordPracticeStage.ListenNewWord:
    case WordPracticeStage.ListenReview:
      settingStore.wordPracticeType = WordPracticeType.Listen
      break
    case WordPracticeStage.FollowWriteNewWord:
    case WordPracticeStage.FollowWriteReview:
      settingStore.wordPracticeType = WordPracticeType.FollowWrite
      break
    case WordPracticeStage.IdentifyNewWord:
    case WordPracticeStage.IdentifyReview:
      settingStore.wordPracticeType = WordPracticeType.Identify
      break
  }
}

function watchPracticeType(n: WordPracticeType) {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) return
  switch (n) {
    case WordPracticeType.Spell:
    case WordPracticeType.Dictation:
      settingStore.dictation = true
      settingStore.translate = true
      break
    case WordPracticeType.Listen:
      settingStore.dictation = true
      settingStore.translate = false
      break
    case WordPracticeType.FollowWrite:
      settingStore.dictation = false
      settingStore.translate = true
      break
    case WordPracticeType.Identify:
      settingStore.dictation = false
      settingStore.translate = false
      break
  }
}

const groupSize = 7

function wordLoop() {
  // 全局回退:推进前记录当前状态(词表/下标/阶段/类型/错词标志)
  pushNav()
  // 学习模式
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite) {
    data.index++
    // 到达一个组末尾，就切换到拼写模式
    if (data.index % groupSize === 0) {
      settingStore.wordPracticeType = WordPracticeType.Spell
      data.index -= groupSize // 回到刚学单词开头
    }
  } else {
    // 拼写模式
    data.index++
    // 拼写走完一组，切回跟写模式
    if (data.index % groupSize === 0) {
      settingStore.wordPracticeType = WordPracticeType.FollowWrite
    }
  }
}

function nextStage(originList: Word[]) {
  // 全局回退:阶段切换前记录当前状态(回退可跨阶段)
  pushNav()
  //每次都判断，因为每次都可能新增已掌握的单词
  let list = originList.filter(v => !checkWordIsNeedNext(v))
  statStore.stage = statStore.nextStage
  if (list.length) {
    data.words = list
    data.index = 0
  } else {
    // 清空列表并直接结算。不递归 next(false):空词路径上 $ref 在多实例切换后可能失效
    // (vue-macros 模块级 $ref 在组件卸载时弹栈),且此处 next() 的语义与 complete() 等价
    data.words = []
    data.index = 0
    complete()
  }
}

async function complete() {
  if (!isComplete) {
    let start = Date.now()
    isComplete = true
    settling = true
    runtimeStore.globalLoading = true
    clearInterval(timer)

    //如果 shuffle 数组不为空，就说明是复习，不用修改 lastLearnIndex
    if (settingStore.wordPracticeMode !== WordPracticeMode.Shuffle) {
      store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
      // 检查已忽略的单词数量，是否全部完成
      let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
      // 忽略单词数:用 Set 匹配,避免「忽略列表 × 剩余词库」双重循环
      // (一直点跳过时 ignoreList 可能上万条,ECDICT 词库 84 万词,双重循环会卡死结算)
      const remainingSet = new Set(
        store.sdict.words.slice(store.sdict.lastLearnIndex).map(w => w.word.toLowerCase())
      )
      const ignoreCount = ignoreList.filter(word => remainingSet.has(word)).length
      // 如果lastLearnIndex已经超过可学单词数，则判定完成
      if (store.sdict.lastLearnIndex + ignoreCount >= store.sdict.length) {
        store.sdict.complete = true
        store.sdict.lastLearnIndex = store.sdict.length
      }
    }

    // 结算前先将最后一条片段的 end 定格为当前时刻（segments 已是最新，无需临时快照）
    if (!statStore.timerPaused && statStore.segments.length > 0) {
      statStore.segments[statStore.segments.length - 1][1] = Date.now()
    }

    // 按自然日对 segments 分组，每天生成一条 Statistics 记录，落库到 store.sdict.statistics
    flushStatToStore(statStore.$state)

    // 落卡:跳过/忽略的词不落卡(不进复习队列,落卡纯属白算且会卡死结算——
    // 一直跳过时 wrongTimesMap 可达上万条,每次 setWordCard 都有 FSRS 计算 + 响应式写入)
    const skipped = new Set(data.excludeWords)
    for (const [word, wrongTimes] of Object.entries(data.wrongTimesMap)) {
      if (skipped.has(word)) continue
      let rating = data.ratingMap[word]
      if (rating !== undefined) {
        setWordCard(rating, word)
      } else {
        // 复习词(已有卡且已到期)答错 → 遗忘,直接 Again 重学,间隔重置;
        // 新词仍按错误次数换算评级
        const card = store.fsrsData[word]
        const isReviewWord = card && dayjs(card.due).valueOf() <= Date.now()
        setWordCard(isReviewWord ? Rating.Again : getGradeByWrongTimes(wrongTimes), word)
      }
    }

    try {
      await dataSync.saveDictState(store.$state, { pullWhenRemoteNewer: false })
      await wordPersistence.clear()
    } catch (e) {
      // 保存失败(磁盘满/配额):isComplete 已置 true 防重复结算,内存中的卡/进度已生成,
      // store 的 $subscribe 防抖仍会尝试落盘;此处兜底提示,界面不卡死
      console.error('结算数据保存失败', e)
      Toast.error('结算数据保存失败,请检查磁盘空间后重试')
    }

    let trackData = {
      funSpend: Date.now() - start,
      name: store.sdict.name,
      spend: Number(statStore.spend / 1000 / 60).toFixed(1),
      index: store.sdict.lastLearnIndex,
      per: store.sdict.perDayStudyNumber,
      custom: store.sdict.custom,
      complete: store.sdict.complete,
      str: '',
    }
    trackData.str = `name:${trackData.name},per:${trackData.per},spend:${trackData.spend},index:${trackData.index},funSpend:${trackData.funSpend}`
    window.umami?.track('endStudyWord', trackData)
    settling = false
    runtimeStore.globalLoading = false
  }
}

function next(isTyping: boolean = true, ignoreLoop = false) {
  // 防御:页面切换/会话结束时的残留触发。用数据源直接读取,不依赖 word 计算属性
  const currentWord = data.words?.[data.index]
  if (!currentWord) {
    // complete() 内部自带 isComplete 防重入
    complete()
    return
  }
  let temp = currentWord.word.toLowerCase()
  let preTimes = data.wrongTimesMap[temp] ?? 0

  // 优化：为了加快流程，将一次拼写成功的单词移出错词列表，后续不再安排重复练习
  // 如果在拼写阶段，一次拼写成功，并且之前有错误记录的。将单词从错词列表里面移除
  if (settingStore.wordPracticeType === WordPracticeType.Spell && data.wrongTimes === 0 && preTimes) {
    let rIndex = data.wrongWords.findIndex(v => v.word.toLowerCase() === temp)
    if (rIndex >= 0) {
      data.wrongWords.splice(rIndex, 1)
    }
  }

  data.wrongTimesMap[temp] = preTimes + data.wrongTimes
  data.wrongTimes = 0

  if (isTyping) statStore.inputWordNumber++
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
    if (data.index === data.words.length - 1) {
      data.wrongWords = data.wrongWords.filter(v => !data.excludeWords.includes(v.word))
      if (data.wrongWords.length) {
        pushNav()
        data.isTypingWrongWord = true
        settingStore.wordPracticeType = WordPracticeType.FollowWrite
        data.words = shuffle(cloneDeep(data.wrongWords))
        data.index = 0
        data.wrongWords = []
      } else {
        data.isTypingWrongWord = false
        complete()
      }
    } else {
      pushNav()
      data.index++
    }
  } else {
    // 无词或已是最后一个词：走阶段推进/完成逻辑（nextStage 空列表时会把 words 清空，需一并处理）
    if (data.words.length === 0 || data.index === data.words.length - 1) {
      // 有词时才做「回到最后一组」等依赖当前词的处理；无词时直接走错词/阶段逻辑
      if (data.words.length) {
        if ((statStore.stage === WordPracticeStage.FollowWriteNewWord || data.isTypingWrongWord) && !ignoreLoop) {
          if (settingStore.wordPracticeType !== WordPracticeType.Spell) {
            //回到最后一组的开始位置
            data.index = Math.floor(data.index / groupSize) * groupSize
            emitter.emit(EventKey.resetWord)
            settingStore.wordPracticeType = WordPracticeType.Spell
            if (checkWordIsNeedNext(currentWord)) next(false, ignoreLoop)
            return
          }
        }
      }
      data.wrongWords = data.wrongWords.filter(v => !checkWordIsNeedNext(v))
      if (data.wrongWords.length) {
        pushNav()
        data.isTypingWrongWord = true
        settingStore.wordPracticeType = WordPracticeType.FollowWrite
        data.words = shuffle(cloneDeep(data.wrongWords))
        data.index = 0
        data.wrongWords = []
      } else {
        data.isTypingWrongWord = false

        if (settingStore.wordPracticeMode === WordPracticeMode.System) {
          if (statStore.stage === WordPracticeStage.FollowWriteNewWord) {
            nextStage(shuffle(taskWords.new))
          } else if (statStore.stage === WordPracticeStage.ListenNewWord) {
            nextStage(shuffle(taskWords.new))
          } else if (statStore.stage === WordPracticeStage.DictationNewWord) {
            nextStage(taskWords.review)
          } else if (statStore.stage === WordPracticeStage.IdentifyReview) {
            nextStage(shuffle(taskWords.review))
          } else if (statStore.stage === WordPracticeStage.ListenReview) {
            nextStage(shuffle(taskWords.review))
          } else if (statStore.stage === WordPracticeStage.DictationReview) {
            complete()
          }
        } else if (settingStore.wordPracticeMode === WordPracticeMode.ListenOnly) {
          if (statStore.stage === WordPracticeStage.ListenNewWord) {
            nextStage(taskWords.review)
          } else if (statStore.stage === WordPracticeStage.ListenReview) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.DictationOnly) {
          if (statStore.stage === WordPracticeStage.DictationNewWord) {
            nextStage(taskWords.review)
          } else if (statStore.stage === WordPracticeStage.DictationReview) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.IdentifyOnly) {
          if (statStore.stage === WordPracticeStage.IdentifyNewWord) {
            nextStage(taskWords.review)
          } else if (statStore.stage === WordPracticeStage.IdentifyReview) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
          if (statStore.stage === WordPracticeStage.Shuffle) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.Review) {
          if (statStore.stage === WordPracticeStage.IdentifyReview) {
            nextStage(shuffle(taskWords.review))
          } else if (statStore.stage === WordPracticeStage.ListenReview) {
            nextStage(shuffle(taskWords.review))
          } else if (statStore.stage === WordPracticeStage.DictationReview) complete()
        }
      }
    } else {
      if (statStore.stage === WordPracticeStage.FollowWriteNewWord) {
        wordLoop()
      } else {
        if (data.isTypingWrongWord) wordLoop()
        else {
          pushNav()
          data.index++
        }
      }
    }
  }

  // 仅在有当前词列表时再检查是否需跳过当前词，避免 words 被清空后用默认 word 误触发 next
  if (data.words.length > 0 && checkWordIsNeedNext(currentWord)) next(false, ignoreLoop)
}

//检查单词是否跳过
//如果单词是已掌握的/或者主动跳过的，则略过
function checkWordIsNeedNext(word: Word) {
  if (!word.word) return false
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  return isWordSimple(word) || rIndex > -1
}

function skipStep() {
  data.index = data.words.length - 1
  data.wrongWords = []
  next(false, true)
}

function addExcludeWord() {
  //标记模式时，用户认识的单词加入到排除里面，后续不再复习
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex < 0) {
    data.excludeWords.push(word.word)
  }
}

function onWordKnow() {
  //"我认识“强制更新了Good，因为点”已掌握“才会设置Easy
  data.ratingMap[word.word.toLowerCase()] = Rating.Good
  addExcludeWord()
}

function onTypeWrong() {
  data.wrongTimes++
  //这里的代码暂时不能移动，因为要实时把错词加入到列表里面，从而更新toolbar里面的错词数
  //todo 后续可以优化
  let temp = word.word.toLowerCase()
  if (!data.allWrongWords.find(v => v === temp)) {
    data.allWrongWords.push(temp)
    statStore.wrong++
  }
  if (!store.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
    store.wrong.words.push(word)
    store.wrong.length = store.wrong.words.length
  }
  if (!data.wrongWords.find((v: Word) => v.word.toLowerCase() === temp)) {
    data.wrongWords.push(word)
  }
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex > -1) {
    data.excludeWords.splice(rIndex, 1)
  }
  savePracticeData('wrong')
}

//设置单词卡片
function setWordCard(rating: number, wordStr = word.word) {
  let card = store.fsrsData[wordStr]
  if (!card) {
    card = createEmptyCard()
  }
  card = nextCard(card, rating)
  store.fsrsData[wordStr] = card
}

async function savePracticeDataIns(where?) {
  const stages = WordPracticeModeStageMap[settingStore.wordPracticeMode]
  // 未开始练习:首词未输入且无任何错词记录时,不保存空会话。
  // 首词已打错(错词有记录)必须保存——否则第一个词没打完就退出,错词记录会丢
  const noTypingProgress = Object.keys(data.wrongTimesMap).length === 0 && data.wrongWords.length === 0
  if (
    data.index === 0 &&
    statStore.stage === stages[0] &&
    settingStore.wordPracticeType === WordPracticeType.FollowWrite &&
    noTypingProgress
  ) {
    //未开始练习
    return
  }
  if (isComplete) return
  if (runtimeStore.globalLoading) return
  runtimeStore.globalLoading = true
  try {
    // 若计时未暂停，将最后一条片段的 end 更新为当前时刻，确保保存内容最新
    if (!statStore.timerPaused && statStore.segments.length > 0) {
      statStore.segments[statStore.segments.length - 1][1] = Date.now()
    }
    await wordPersistence.save({
      taskWords,
      practiceData: data,
      statStoreData: statStore.$state,
    })
  } catch (e) {
    // 保存失败(磁盘满/IndexedDB 配额):不卡死界面,提示用户
    console.error('练习状态保存失败', e)
    Toast.warning('练习状态保存失败,请检查磁盘空间')
  } finally {
    runtimeStore.globalLoading = false
  }
}

const savePracticeData = debounce(savePracticeDataIns, 500)

function repeat() {
  savePracticeData.cancel?.() // 先取消防抖中未触发的保存,避免旧会话缓存回灌覆盖 clear
  wordPersistence.clear()
  let temp = cloneDeep(taskWords)
  let ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
  //随机练习单独处理
  if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
    temp.review = shuffle(temp.review.filter(v => !ignoreSet.has(v.word)))
  } else {
    //将学习进度减回去
    store.sdict.lastLearnIndex = store.sdict.lastLearnIndex - statStore.newWordNumber
    //排除已掌握单词
    temp.new = temp.new.filter(v => !ignoreSet.has(v.word))
    temp.review = temp.review.filter(v => !ignoreSet.has(v.word))
  }
  emitter.emit(EventKey.resetWord)
  initData(temp)
}

// ---- 全局回退:导航快照栈(每次推进前压栈,prev 弹栈恢复,可跨阶段/错词循环/分组循环回退) ----
type NavSnapshot = {
  words: Word[]
  index: number
  stage: number
  type: number
  isTypingWrongWord: boolean
}
const navStack: NavSnapshot[] = []

function pushNav() {
  navStack.push({
    words: data.words,
    index: data.index,
    stage: statStore.stage,
    type: settingStore.wordPracticeType,
    isTypingWrongWord: data.isTypingWrongWord,
  })
}

function prev() {
  const snap = navStack.pop()
  if (!snap) {
    Toast.warning('已经是第一个了~')
    return
  }
  // 恢复导航状态(学习数据/统计不回滚,回退只是导航回看)
  // 注意:不 emit resetWord——word 变化已由 TypeWord 的 watch 触发 resetState(NewWord),
  // 再 emit 会二次 resetState 导致 单词+翻译+翻译 三连播
  data.words = snap.words
  data.index = snap.index
  statStore.stage = snap.stage as WordPracticeStage
  settingStore.wordPracticeType = snap.type as WordPracticeType
  data.isTypingWrongWord = snap.isTypingWrongWord
}

function skip() {
  addExcludeWord()
  next(false)
}

function show(e: KeyboardEvent) {
  typingRef?.showWord?.()
}

function collect(e: KeyboardEvent) {
  const anchor = typingRef?.getCollectAnchor?.() as HTMLElement | null | undefined
  openWordCollectPicker(
    word,
    anchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 },
    { excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined }
  )
}

function play() {
  typingRef?.play?.()
}

function toggleWordSimpleWrapper() {
  if (!isWordSimple(word)) {
    setTimeout(() => next(false))
  }
  toggleWordSimple(word)
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex > -1) {
    data.excludeWords.splice(rIndex, 1)
  } else {
    data.excludeWords.push(word.word)
  }
}

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

async function continueStudy() {
  savePracticeData.cancel?.() // 先取消防抖中未触发的保存,避免旧会话缓存回灌覆盖 clear
  wordPersistence.clear()
  let temp = cloneDeep(taskWords)
  let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
  //随机练习单独处理
  if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
    const ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
    temp.review = getShufflePracticeWords(
      store.sdict.words,
      {
        total: runtimeStore.routeData?.total ?? temp.review.length,
        range: runtimeStore.routeData?.shuffleRange ?? { start: 0, end: store.sdict.lastLearnIndex },
      },
      ignoreSet
    ).words
  } else {
    //这里判断是否显示结算弹框，如果显示了结算弹框的话，就不用加进度了
    if (!isComplete) {
      store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
      // 忽略单词数
      const ignoreCount = ignoreList.filter(word => store.sdict.words.some(w => w.word.toLowerCase() === word)).length
      // 如果lastLearnIndex已经超过可学单词数，则判定完成
      if (store.sdict.lastLearnIndex + ignoreCount >= store.sdict.length) {
        store.sdict.complete = true
        store.sdict.lastLearnIndex = store.sdict.length
      }
    }

    temp = getCurrentStudyWord()
  }
  emitter.emit(EventKey.resetWord)
  initData(temp)
}

async function jumpToGroup(group: number) {
  window?.umami?.track('jumpToGroup')
  savePracticeData.cancel?.() // 先取消防抖中未触发的保存,避免旧会话缓存回灌覆盖 clear
  wordPersistence.clear()
  store.sdict.lastLearnIndex = (group - 1) * store.sdict.perDayStudyNumber
  emitter.emit(EventKey.resetWord)
  initData(getCurrentStudyWord())
}

function randomWrite() {
  window?.umami?.track('randomWrite')
  data.words = shuffle(data.words)
  data.index = 0
  settingStore.dictation = true
}

useStartKeyboardEventListener()

watch(isIniting, n => {
  if (!n) {
    watchRefList = [
      watch(() => statStore.stage, watchStage),
      watch(() => settingStore.wordPracticeType, watchPracticeType),
      watch(() => data.index, savePracticeData),
      // 监听 statStore.spend，每过10秒自动保存数据
      watch(
        () => statStore.spend,
        curr => {
          if (curr % (30 * 1000) === 0 && curr !== 0) {
            savePracticeData('spend')
          }
        }
      ),
    ]
  }
})

/** 返回词库列表(练习中退出);onUnmounted 会保存会话缓存,回来可继续 */
function goBack() {
  router.push('/words')
}

function onWordMarkPickComplete(result: WordMarkPickResult) {
  result.know.map(word => {
    data.ratingMap[word.word.toLowerCase()] = Rating.Good
    data.excludeWords.push(word.word)
  })
  result.mastered.map(word => {
    data.excludeWords.push(word.word)
  })
  if (result.unknown.length > 0) {
    data.isTypingWrongWord = true
    settingStore.wordPracticeType = WordPracticeType.FollowWrite
    data.words = shuffle(cloneDeep(result.unknown))
    data.index = 0
    data.wrongWords = []

    data.allWrongWords = data.allWrongWords.concat(result.unknown.map(v => v.word.toLowerCase()))
    result.unknown.forEach(v => {
      data.wrongTimesMap[v.word.toLowerCase()] = 1
    })
  } else {
    data.words = []
    next(false)
  }
}

useEvents([
  [EventKey.onTyping, handleResumeTimer],
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, continueStudy],
  //当默写时，执行 show 会标记为错误，并更新卡片
  [ShortcutKey.ShowWord, throttle(show, 300)],
  [ShortcutKey.Previous, prev],
  [ShortcutKey.Next, throttle(() => next(false), 300)],
  [ShortcutKey.Ignore, throttle(skip, 300)],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.ToggleSimple, toggleWordSimpleWrapper],
  [ShortcutKey.PlayWordPronunciation, play],

  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.NextChapter, continueStudy],
  [ShortcutKey.NextStep, skipStep],
  [ShortcutKey.ToggleShowTranslate, () => (settingStore.translate = !settingStore.translate)],
  [ShortcutKey.ToggleDictation, () => (settingStore.dictation = !settingStore.dictation)],
  [ShortcutKey.ToggleTheme, toggleTheme],
  [ShortcutKey.ToggleConciseMode, toggleConciseMode],
  [ShortcutKey.TogglePanel, () => (settingStore.showPanel = !settingStore.showPanel)],
  [ShortcutKey.RandomWrite, randomWrite],
])
</script>

<template>
  <PracticeLayout v-loading="loading" panelLeft="var(--word-panel-margin-left)">
    <template v-slot:practice>
      <!-- padding-top 为顶部固定工具栏让位(工具栏 fixed 悬浮,流内容从工具栏下方开始,避免遮挡) -->
      <div class="practice-word" style="padding-top: 3.25rem">
        <!-- 顶部固定工具栏:进度条 + 操作按钮(替代原底部底栏) -->
        <TopToolbar @skipStep="skipStep" @back="goBack" />
        <div class="fixed z-99999 center mt-3" v-if="statStore.timerPaused">
          <ToastComponent
            :duration="0"
            :anim="statStore.timerPauseReason !== 'auto_visibility'"
            :shadow="false"
            :showClose="true"
            :message="statStore.timerPauseReason === 'auto_idle' ? '已连续 3 分钟无键盘操作，计时已暂停' : '计时已暂停'"
            @close="statStore.resumeTimer"
          />
        </div>

        <WordMarkPickList
          v-else-if="
            settingStore.wordPracticeType === WordPracticeType.Identify &&
            data.wrongWords.length === 0 &&
            settingStore.identifyMethod === IdentifyMethod.QuickIdentify
          "
          :words="data.words"
          @complete="onWordMarkPickComplete"
        />

        <div class="mb-46 w-full" v-else>
          <!-- prevWord/nextWord 仅用于切词动画方向判断(左滑/右滑),左右词不渲染 -->
          <TypeWord
            ref="typingRef"
            :word="word"
            :question="data.question"
            :prev-word="prevWord"
            :next-word="nextWord"
            @wrong="onTypeWrong"
            @complete="next"
            @mastered="toggleWordSimpleWrapper"
            @know="onWordKnow"
            @skip="skip"
            @toggle-simple="toggleWordSimpleWrapper"
          />
        </div>
      </div>
    </template>
    <template v-slot:panel>
      <Panel>
        <template v-slot:title>
          <div class="center gap-1">
            <span>{{ store.sdict.name }}</span>

            <GroupList
              @click="jumpToGroup"
              v-if="taskWords.new.length && settingStore.wordPracticeMode !== WordPracticeMode.Shuffle"
            />
            <BaseIcon
              v-if="
                taskWords.new.length &&
                ![WordPracticeMode.Review, WordPracticeMode.Shuffle].includes(settingStore.wordPracticeMode)
              "
              @click="continueStudy"
              :title="`${'下一组'}(${settingStore.shortcutKeyMap[ShortcutKey.NextChapter]})`"
            >
              <IconFluentArrowRight16Regular class="arrow" width="22" />
            </BaseIcon>

            <BaseIcon @click="randomWrite" :title="`${'随机默写'}(${settingStore.shortcutKeyMap[ShortcutKey.RandomWrite]})`">
              <IconFluentArrowShuffle16Regular class="arrow" width="22" />
            </BaseIcon>
          </div>
        </template>
        <div class="panel-page-item pl-4">
          <WordList
            v-if="data.words.length"
            :is-active="settingStore.showPanel"
            :static="false"
            :show-word="!settingStore.dictation"
            :show-translate="settingStore.translate"
            :list="data.words"
            :activeIndex="data.index"
            :excludeWords="data.excludeWords"
            :exclude-dict-id="store.sdict.id ? String(store.sdict.id) : undefined"
            @click="(val: any) => (data.index = val.index)"
          >
          </WordList>
          <Empty v-else />
        </div>
      </Panel>
    </template>
  </PracticeLayout>
  <Statistics v-model="isComplete" :loading="settling" />
</template>

<style scoped lang="scss">
.practice-wrapper {
  @apply w-full h-full flex justify-center overflow-hidden;
}

.practice-word {
  @apply h-full flex flex-col justify-between items-center relative;
  // 宽度跟随练习区(wrap 的 practiceAreaWidth 固定宽度),不随单词内容变化;
  // 上游遗留的 var(--toolbar-width) 会让翻译长短改变整列宽度,导致布局跳动
  width: 100%;
}

// 移动端适配
@media (max-width: 768px) {
  .practice-word {
    width: 100%;

    .absolute.z-1.top-4 {
      z-index: 100; // 提高层级，确保不被遮挡

      .center.gap-2.cursor-pointer {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        .word {
          pointer-events: none; // 文字不拦截点击
        }

        .arrow {
          pointer-events: none; // 箭头图标不拦截点击
        }
      }
    }
  }
}

.word-panel-wrapper {
  position: absolute;
  left: var(--panel-margin-left);
  //left: 0;
  top: 0.8rem;
  z-index: 1;
  height: calc(100% - 1.5rem);
}
</style>