<script setup lang="ts">
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useRouter } from 'vue-router'
import {
  BaseButton,
  BaseIcon,
  BaseInput,
  BasePage,
  Calendar,
  Checkbox,
  Dialog,
  OptionButton,
  PopConfirm,
  Progress,
  Toast,
} from '@typewords/base'
import {
  _getAccomplishDate,
  _getDictDataByUrl,
  debounce,
  msToHourMinute,
  getShufflePracticeWords,
  resourceWrap,
  type ShufflePracticeSetting,
  total,
  useNav,
} from '@typewords/core/utils'
import type { DictResource, Statistics, Word } from '@typewords/core/types/types.ts'
import WordDetail from '@typewords/core/components/word/WordDetail.vue'
import { ensureDictIndex, loadDictWords } from '@typewords/core/hooks/dictIndex'
import { inject, watch } from 'vue'
import { getCurrentStudyWord } from '@typewords/core/hooks/dict.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import Empty from '@typewords/core/components/Empty.vue'
import { getDefaultDict } from '@typewords/core/types/func.ts'
import { DeleteIcon } from '@typewords/base'
import PracticeSettingDialog from '@typewords/core/components/word/PracticeSettingDialog.vue'
import ChangeLastPracticeIndexDialog from '@typewords/core/components/word/ChangeLastPracticeIndexDialog.vue'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useFetch } from '@vueuse/core'
import {
  APP_NAME,
  DICT_LIST,
  WordPracticeModeNameMap,
  WordPracticeModeUrlMap,
} from '@typewords/core/config/env.ts'
import PracticeWordListDialog from '@typewords/core/components/word/PracticeWordListDialog.vue'
import ReviewPlanDialog from '@typewords/core/components/word/ReviewPlanDialog.vue'
import ReleaseBanner from '@typewords/core/components/ReleaseBanner.vue'
import ShufflePracticeSettingDialog from '@typewords/core/components/word/ShufflePracticeSettingDialog.vue'
import { flushStatToStore, usePracticeWordPersistence } from '@typewords/core/composables/usePracticePersistence'
import { useDataSyncPersistence } from '@typewords/core/composables/useDataSyncPersistence'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type { PracticeWordCache } from '@typewords/core/utils/cache.ts'
import dayjs from 'dayjs'

const { t } = useI18n()

// 缓存主页:从其他页面返回时不重新挂载(避免初始空态闪烁)
definePageMeta({ keepalive: true })

const store = useBaseStore()
const settingStore = useSettingStore()
const openSettings = inject('openSettings', () => {})
const wordPersistence = usePracticeWordPersistence()
const dataSync = useDataSyncPersistence()
const router = useRouter()
const { nav } = useNav()
const runtimeStore = useRuntimeStore()
let loading = $ref(true)
let isSaveData = $ref(false)

const shouldShowDialogPracticeMode = [WordPracticeMode.Shuffle, WordPracticeMode.ShuffleWordsTest]

useHead({
  title: APP_NAME + ' ' + '单词',
})

let practiceData = $ref<PracticeWordCache>({
  taskWords: {
    new: [],
    review: [],
  },
  practiceData: null,
  statStoreData: null,
} as any)

async function resetCacheData() {
  isSaveData && flushStatToStore(practiceData.statStoreData)
  isSaveData = false
  practiceData.practiceData = null
  practiceData.statStoreData = null
  await wordPersistence.clear()
}

// runtimeStore.globalLoading练习界面，退出时会调用一个保存，可能会卡住。当调用完成再init
//  immediate: true 比 onUmMounted 先执行，只能延时执行
watch(
  [() => store.load, () => runtimeStore.globalLoading],
  debounce(([a, b]) => {
    if (a && !b) {
      init()
    }
  }),
  { immediate: true }
)

async function onvisibilitychange() {
  if (!document.hidden) {
    //当页面可见时，检查是否需要从远程拉取数据
    const d = await wordPersistence.fetch()
    if (d) {
      practiceData = d
      isSaveData = true
    }
  }
}

async function init() {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)

  let studyIndex = store.word.studyIndex
  if (studyIndex >= 3) {
    if (!store.sdict.custom && !store.sdict.words.length) {
      try {
        let dictList = await fetch(resourceWrap(DICT_LIST.WORD.ALL)).then(r => r.json())
        let dict = await _getDictDataByUrl(store.sdict)
        let r = dictList.find(v => [v.enName, v.id].includes(store.sdict.id))
        if (r) {
          store.word.bookList[studyIndex].words = dict.words
          store.word.bookList[studyIndex].id = r.id
          store.word.bookList[studyIndex].enName = r.enName
          store.word.bookList[studyIndex].cover = r.cover
          store.word.bookList[studyIndex].category = r.category
          store.word.bookList[studyIndex].tags = r.tags
          store.word.bookList[studyIndex].url = r.url
          store.word.bookList[studyIndex].description = r.description
          store.word.bookList[studyIndex].name = r.name
        } else {
          store.word.bookList[studyIndex] = dict
        }
        store.word.bookList[studyIndex].length = dict.words.length
        let s = store.word.bookList[studyIndex]
        if (s.lastLearnIndex > s.length) {
          store.word.bookList[studyIndex].lastLearnIndex = s.length
          store.word.bookList[studyIndex].complete = true
          await resetCacheData()
        }
      } catch {
        // 断网/词库文件缺失:跳过词库加载,主页其余功能不受影响(loading 在函数末尾照常置位)
      }
    }
  }

  if (!practiceData?.taskWords.new.length && store.sdict.words.length) {
    const d = await wordPersistence.load()
    if (d) {
      practiceData = d
      isSaveData = true
    } else {
      practiceData.taskWords = getCurrentStudyWord()
    }
  }
  loading = false
}

async function startPractice(practiceMode: WordPracticeMode, resetCache: boolean = false): void {
  if (resetCache) await resetCacheData()

  if (shouldShowDialogPracticeMode.includes(practiceMode) && !isSaveData) {
    editingWordPracticeMode = practiceMode
    showShufflePracticeSettingDialog = true
    return
  }

  if (store.sdict.id) {
    if (!store.sdict.words.length) {
      Toast.warning('没有单词可学习！')
      return
    }

    settingStore.wordPracticeMode = practiceMode

    window.umami?.track('startStudyWord', {
      name: store.sdict.name,
      index: store.sdict.lastLearnIndex,
      perDayStudyNumber: store.sdict.perDayStudyNumber,
      custom: store.sdict.custom,
      complete: store.sdict.complete,
      wordPracticeMode: settingStore.wordPracticeMode,
    })
    nav(WordPracticeModeUrlMap[practiceMode] + '/' + store.sdict.id, {}, practiceData)
  } else {
    window.umami?.track('no-dict')
    Toast.warning('请先选择一本词典')
  }
}

function freePractice() {
  startPractice(WordPracticeMode.Free, settingStore.wordPracticeMode !== WordPracticeMode.Free)
}

function systemPractice() {
  startPractice(
    settingStore.wordPracticeMode === WordPracticeMode.Free ? WordPracticeMode.System : settingStore.wordPracticeMode,
    settingStore.wordPracticeMode === WordPracticeMode.Free
  )
}

let editingWordPracticeMode = $ref(0)

let showPracticeSettingDialog = $ref(false)
let showShufflePracticeSettingDialog = $ref(false)
let showReviewPlanDialog = $ref(false)
let showChangeLastPracticeIndexDialog = $ref(false)
let showPracticeWordListDialog = $ref(false)

type StudyDayRow = Statistics & { dictName: string }

let showStudyDayDialog = $ref(false)
let selectedStudyDateKey = $ref('')
let studyDayRecords = $ref<StudyDayRow[]>([])

const allWordStatistics = $computed(() => store.word.bookList.flatMap(book => book.statistics ?? []))

const cacheSpendMs = $computed(() => practiceData.statStoreData?.spend ?? 0)

const todayDateKey = $computed(() => dayjs().format('YYYY-MM-DD'))

/**
 * 缓存记录中每一天对应的学习毫秒数 Map<'YYYY-MM-DD', spendMs>
 * 有 segments 时按片段精确分组，否则退回到 startDate + spend 整体归一天
 */
const cacheDaySpendMap = $computed((): Map<string, number> => {
  const st = practiceData.statStoreData
  const map = new Map<string, number>()
  if (!st?.spend) return map
  if (Array.isArray(st.segments) && st.segments.length > 0) {
    for (const [segStart, segEnd] of st.segments) {
      const key = dayjs(segStart).format('YYYY-MM-DD')
      map.set(key, (map.get(key) ?? 0) + (segEnd - segStart))
    }
  } else {
    // 老数据 / 无 segments：全部归到 startDate 那天
    map.set(dayjs(st.startDate).format('YYYY-MM-DD'), st.spend)
  }
  // console.log('map',map,practiceData.statStoreData)
  return map
})

const todayCacheMs = $computed(() => cacheDaySpendMap.get(todayDateKey) ?? 0)

const calendarHighlightDates = $computed(() => {
  const set = new Set<string>()
  for (const s of allWordStatistics) {
    set.add(dayjs(s.startDate).format('YYYY-MM-DD'))
  }
  // 把缓存记录中所有出现过的天都高亮（支持跨天）
  for (const key of cacheDaySpendMap.keys()) {
    set.add(key)
  }
  return [...set]
})

/** 已落库统计总毫秒（全 bookList） */
const persistedTotalMs = $computed(() => total(allWordStatistics, 'spend'))

const totalSpend = $computed(() => {
  const sum = persistedTotalMs + cacheSpendMs
  if (!sum) return 0
  return msToHourMinute(sum)
})

const todayTotalSpend = $computed(() => {
  const todayPersistedMs = total(
    allWordStatistics.filter(v => dayjs(v.startDate).isSame(dayjs(), 'day')),
    'spend'
  )
  const sum = todayPersistedMs + todayCacheMs
  if (!sum) return 0
  return msToHourMinute(sum)
})

const totalDay = $computed(() => {
  const set = new Set(allWordStatistics.map(v => dayjs(v.startDate).format('YYYY-MM-DD')))
  // 把缓存记录中所有出现过的天都计入（支持跨天）
  for (const key of cacheDaySpendMap.keys()) {
    set.add(key)
  }
  return set.size
})

// 今日新学/复习词数(已落库统计 + 进行中练习缓存)
const todayNewReview = $computed(() => {
  let todayNew = 0
  let todayReview = 0
  for (const s of allWordStatistics) {
    if (dayjs(s.startDate).isSame(dayjs(), 'day')) {
      todayNew += s.new ?? 0
      todayReview += s.review ?? 0
    }
  }
  const st = practiceData.statStoreData
  if (st?.startDate && dayjs(st.startDate).isSame(dayjs(), 'day')) {
    todayNew += st.newWordNumber ?? 0
    todayReview += st.reviewWordNumber ?? 0
  }
  return { new: todayNew, review: todayReview }
})

// 累计学习词数(所有新学统计 + 进行中缓存)
const totalWords = $computed(() => {
  let n = total(allWordStatistics, 'new')
  n += practiceData.statStoreData?.newWordNumber ?? 0
  return n
})

// 连续学习天数:截至今天(今天未学则从昨天起算,不算断签)
const streakDays = $computed(() => {
  const set = new Set(allWordStatistics.map(v => dayjs(v.startDate).format('YYYY-MM-DD')))
  for (const key of cacheDaySpendMap.keys()) set.add(key)
  let cursor = dayjs()
  if (!set.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day')
  let streak = 0
  while (set.has(cursor.format('YYYY-MM-DD'))) {
    streak++
    cursor = cursor.subtract(1, 'day')
  }
  return streak
})

const studyDayDialogTitle = $computed(() =>
  selectedStudyDateKey ? dayjs(selectedStudyDateKey).format('YYYY-MM-DD') + ' 学习记录' : ''
)

function isStudyDayKeyToday(dateKey: string) {
  return dateKey === dayjs().format('YYYY-MM-DD')
}

function onSelectCalendarDate(dateKey: string) {
  selectedStudyDateKey = dateKey
  const rows: StudyDayRow[] = []
  for (const book of store.word.bookList) {
    for (const stat of book.statistics ?? []) {
      if (dayjs(stat.startDate).format('YYYY-MM-DD') === dateKey) {
        rows.push({ ...stat, dictName: book.name })
      }
    }
  }
  const st = practiceData.statStoreData
  // 缓存记录跨天时，只要该天在 cacheDaySpendMap 中有记录就展示
  if (st?.spend && cacheDaySpendMap.has(dateKey)) {
    const daySpend = cacheDaySpendMap.get(dateKey)!
    const cacheKeys = [...cacheDaySpendMap.keys()]
    const keyIdx = cacheKeys.indexOf(dateKey)
    const isMultiDay = cacheKeys.length > 1
    // 推算该天在整次练习中的角色（练习未结束，最后一天标为"学习中"而非"学习结束"）
    let sessionRole: StudyDayRow['sessionRole']
    if (!isMultiDay) {
      sessionRole = 'single'
    } else if (keyIdx === 0) {
      sessionRole = 'start'
    } else if (keyIdx === cacheKeys.length - 1) {
      sessionRole = 'middle' // 最后一天仍在进行中，用 middle 表示
    } else {
      sessionRole = 'middle'
    }
    rows.push({
      ...st,
      spend: daySpend,
      new: st.newWordNumber,
      review: st.reviewWordNumber,
      dictName: store.sdict.name,
      sessionRole,
    })
  }
  if (!rows.length) return Toast.info('无学习记录')
  studyDayRecords = rows
  showStudyDayDialog = true
}

// 快速查词:搜索范围 = 已加载词库(bookList) + 全部内嵌词库(public/dicts/index.json),离线可用
type SuggestionItem = { word: string; trans: string; dictFile?: string }

let searchWord = $ref('')
let searchResult = $ref<Word | null>(null)
let searchNotFound = $ref(false)
let searchLoading = $ref(false)
let searchSuggestions = $ref<SuggestionItem[]>([])
let showSuggestions = $ref(false)
let searchExpanded = $ref(true)
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 已加载词库的全部单词(自建词库 + 打开过的官方词库)
const allLoadedWords = $computed(() => store.word.bookList.flatMap(d => d.words ?? []))

// 计算匹配列表:前缀优先,其次包含,最多 30 条(已加载词库优先,再补内嵌索引)
async function refreshSuggestions(q: string) {
  const prefix: SuggestionItem[] = []
  const contains: SuggestionItem[] = []
  const push = (word: string, trans: string, dictFile?: string) => {
    const key = word.toLowerCase()
    if (key.startsWith(q)) prefix.push({ word, trans, dictFile })
    else if (key.includes(q)) contains.push({ word, trans, dictFile })
  }

  // 1. 已加载词库(本地优先,点击可直接用完整词条)
  const localMap = new Map<string, Word>()
  for (const w of allLoadedWords) {
    const key = w.word?.toLowerCase()
    if (key && !localMap.has(key)) localMap.set(key, w)
  }
  for (const [key, w] of localMap) {
    const t = w.trans?.[0] ? (w.trans[0].pos ?? '') + (w.trans[0].cn ?? '') : ''
    push(w.word!, t)
  }

  // 2. 内嵌词库索引(跳过本地已覆盖的词)
  const index = await ensureDictIndex()
  if (index) {
    for (const it of index) {
      if (localMap.has(it.w.toLowerCase())) continue
      push(it.w, it.t ?? '', it.d)
      if (prefix.length >= 30 && contains.length >= 30) break
    }
  }

  searchSuggestions = [...prefix, ...contains].slice(0, 30)
  showSuggestions = searchSuggestions.length > 0
}

// 输入实时匹配(防抖 150ms)
// 注意:vue-macros 下 watch 参数必须是 getter 形式,直接传 $ref 变量不会触发
watch(
  () => searchWord,
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    const q = searchWord.trim().toLowerCase()
    if (!q) {
      searchSuggestions = []
      showSuggestions = false
      return
    }
    searchTimer = setTimeout(() => refreshSuggestions(q), 150)
  }
)

// 点击搜索栏(聚焦)时立即展开当前匹配结果
function onSearchFocus() {
  const q = searchWord.trim().toLowerCase()
  if (!q) return
  if (searchTimer) clearTimeout(searchTimer)
  refreshSuggestions(q)
}

// 点击列表以外区域 → 收起结果列表
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.suggestion-list') || target.closest('.base-input')) return
  showSuggestions = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// 点击下拉列表项 → 显示该词详情(索引词需按需加载词库文件)
async function selectSuggestion(item: SuggestionItem) {
  // 不填充搜索框,保持用户输入原样
  showSuggestions = false
  searchExpanded = true
  searchLoading = true
  searchNotFound = false
  searchResult = null
  try {
    const local = allLoadedWords.find(w => w.word?.toLowerCase() === item.word.toLowerCase())
    if (local) {
      searchResult = local
    } else if (item.dictFile) {
      const words = await loadDictWords(item.dictFile)
      searchResult = words.find(w => w.word?.toLowerCase() === item.word.toLowerCase()) ?? null
    }
    searchNotFound = !searchResult
  } finally {
    searchLoading = false
  }
}

// (查词按钮已移除:实时列表展示所有匹配结果,点击单词即可查看详情)

async function goDictDetail(val: DictResource) {
  if (!val.id) return nav('dict-list')
  runtimeStore.editDict = getDefaultDict(val)
  nav('/dict', {})
}

/** 我的词典列表行的进度百分比 */
function myDictProgress(item: any) {
  if (!item?.length) return 0
  return Number((((item.lastLearnIndex ?? 0) / item.length) * 100).toFixed())
}

/** 我的词典行点击:管理模式下勾选(checkbox 处已 stop 防双击),否则进词库详情 */
function onMyDictClick(item: any, j: number) {
  if (isManageDict && j >= 3) {
    toggleSelect(item)
  } else {
    goDictDetail(item)
  }
}

let isManageDict = $ref(false)
let selectIds = $ref([])

async function handleBatchDel() {
  selectIds.forEach(id => {
      let r = store.word.bookList.findIndex(v => v.id === id)
      if (r !== -1) {
        if (store.word.studyIndex === r) {
          store.word.studyIndex = -1
        }
        if (store.word.studyIndex > r) {
          store.word.studyIndex--
        }
        store.word.bookList.splice(r, 1)
      }
    })
  selectIds = []
  Toast.success('删除成功！')
}

function toggleSelect(item) {
  let rIndex = selectIds.findIndex(v => v === item.id)
  if (rIndex > -1) {
    selectIds.splice(rIndex, 1)
  } else {
    selectIds.push(item.id)
  }
}

const progressTextLeft = $computed(() => {
  if (store.sdict.complete) return '已学完，进入总复习阶段'
  return '当前进度：已学 ' + store.currentStudyProgress + '%'
})

function check(cb: Function) {
  if (!store.sdict.id) {
    Toast.warning('请先选择一本词典')
  } else {
    runtimeStore.editDict = getDefaultDict(store.sdict)
    cb()
  }
}

async function savePracticeSetting() {
  await resetCacheData()
  await store.changeDict(runtimeStore.editDict)
  practiceData.taskWords = getCurrentStudyWord()
  Toast.success('修改成功')
}

async function onShufflePracticeSettingOk(setting: ShufflePracticeSetting) {
  await dataSync.saveDictState()
  await resetCacheData()
  settingStore.wordPracticeMode = editingWordPracticeMode

  window.umami?.track('startStudyWord', {
    name: store.sdict.name,
    index: store.sdict.lastLearnIndex,
    perDayStudyNumber: store.sdict.perDayStudyNumber,
    custom: store.sdict.custom,
    complete: store.sdict.complete,
    wordPracticeMode: settingStore.wordPracticeMode,
  })

  let ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
  const result = getShufflePracticeWords(store.sdict.words, setting, ignoreSet)
  practiceData.taskWords.review = result.words
  nav(
    WordPracticeModeUrlMap[editingWordPracticeMode] + '/' + store.sdict.id,
    {},
    {
      ...practiceData,
      total: result.words.length, //用于再来一组时，随机出正确的长度，因为练习中可能会点击已掌握，导致重学一遍之后长度变少，如果再来一组，此时长度就不正确
      shuffleRange: result.range,
    }
  )
}

async function saveLastPracticeIndex(e) {
  runtimeStore.editDict.lastLearnIndex = e
  // runtimeStore.editDict.complete = e >= runtimeStore.editDict.length - 1
  showChangeLastPracticeIndexDialog = false
  await resetCacheData()
  await store.changeDict(runtimeStore.editDict)
  practiceData.taskWords = getCurrentStudyWord()
  Toast.success('修改成功')
}

// 全部词典:主页默认显示前 4 个,点"更多"进入卡片式全部词典列表(dict-list)
const { data: allDictList, isFetching } = useFetch(resourceWrap(DICT_LIST.WORD.ALL)).json()

// 列表默认折叠,只显示 4 项,点"更多"展开全部
let myDictExpanded = $ref(false)

const recommendAllList = $computed(() => (allDictList as any)?.value ?? [])
const showMyDictList = $computed(() => (myDictExpanded ? store.word.bookList : store.word.bookList.slice(0, 4)))
const showRecommendList = $computed(() => recommendAllList.slice(0, 4))

const systemPracticeText = $computed(() => {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
    return '开始学习'
  } else {
    return isSaveData
      ? '继续' + WordPracticeModeNameMap[settingStore.wordPracticeMode]
      : '开始' + WordPracticeModeNameMap[settingStore.wordPracticeMode]
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
})

// keepalive 缓存页面:首次挂载后每次从其他页面返回都会触发,刷新练习任务数据
// (练习页结束学习回到主页时,数据已落库/清缓存,这里重新拉取)
onActivated(async () => {
  const d = await wordPersistence.fetch()
  if (d) {
    practiceData = d
    isSaveData = true
  }
})
</script>

<template>
  <BasePage>
    <ReleaseBanner />

    <!-- 快速查词(搜索范围 = 已加载词库 + 全部内嵌词库,离线可用) -->
    <div class="card flex flex-col">
      <div class="flex items-center gap-2 flex-wrap">
        <IconFluentSearch24Regular class="text-xl color-link" />
        <span class="font-bold">{{ '查词' }}</span>
        <div class="relative flex-1 min-w-50">
          <BaseInput
            v-model="searchWord"
            clearable
            placeholder="输入英文单词，实时匹配，点击单词查看详情"
            @focus="onSearchFocus"
          />
          <ul v-if="showSuggestions" class="suggestion-list">
            <li v-for="w in searchSuggestions" :key="w.word" @mousedown.prevent="selectSuggestion(w)">
              <span class="word">{{ w.word }}</span>
              <span class="trans text-gray text-sm truncate" :title="w.trans">{{ w.trans }}</span>
            </li>
          </ul>
        </div>
      </div>
      <div
        v-if="searchResult"
        class="mt-4 pt-4 border-t"
        style="border-color: var(--color-item-border)"
      >
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold">{{ searchResult.word }} {{ '详情' }}</span>
          <span class="color-link cursor-pointer text-sm" @click="searchExpanded = !searchExpanded">
            {{ searchExpanded ? '收起' : '展开' }}
          </span>
        </div>
        <WordDetail v-if="searchExpanded" :word="searchResult" show-actions three-cols />
      </div>
      <div v-else-if="searchNotFound" class="mt-3 text-sm text-gray">
        {{ '词库中未找到该单词（可先打开对应词库加载后再查询）' }}
      </div>
    </div>

    <div class="card flex flex-col md:flex-row gap-4">
      <div class="flex-1 flex flex-col justify-between">
        <div class="flex gap-3">
          <div class="p-1 center rounded-full" style="background: var(--color-second)">
            <IconFluentBookNumber20Filled class="text-xl color-link" />
          </div>
          <div @click="goDictDetail(store.sdict)" class="text-2xl font-bold cursor-pointer">
            {{ store.sdict.name || '当前无正在学习的词典' }}
          </div>
          <div class="ml-auto flex items-center gap-2">
            <BaseButton size="small" type="info" @click="openSettings()">{{ '设置' }}</BaseButton>
          </div>
        </div>

        <template v-if="store.sdict.id">
          <div class="mt-4 space-y-2">
            <div class="text-sm flex justify-between">
              <span v-opacity="store.sdict.id && store.sdict.lastLearnIndex < store.sdict.length">
                {{ '预计完成日期' }}：{{
                  _getAccomplishDate(
                    store.sdict.words.length - store.sdict.lastLearnIndex,
                    store.sdict.perDayStudyNumber
                  )
                }}
              </span>
            </div>
            <Progress size="large" :percentage="store.currentStudyProgress" :show-text="false"></Progress>

            <div class="text-sm flex justify-between">
              <span>{{ progressTextLeft }}</span>
              <span> {{ store.sdict?.lastLearnIndex }} / {{ store.sdict.length }} {{ '单词' }}</span>
            </div>
          </div>
          <div class="flex items-center mt-4 gap-4">
            <BaseButton type="info" size="small" @click="router.push('/dict-list')">
              <div class="center gap-1">
                <IconFluentArrowSwap20Regular />
                <span>{{ '选择词典' }}</span>
              </div>
            </BaseButton>
            <PopConfirm
              :disabled="!isSaveData"
              title="当前存在未完成的学习任务，修改会重新生成学习任务，是否继续？"
              @confirm="check(() => (showChangeLastPracticeIndexDialog = true))"
            >
              <BaseButton type="info" size="small" v-if="store.sdict.id">
                <div class="center gap-1">
                  <IconFluentSlideTextTitleEdit20Regular />
                  <span>{{ '更改进度' }}</span>
                </div>
              </BaseButton>
            </PopConfirm>

            <BaseButton type="info" size="small" @click="router.push('/fsrs')"> 学习记录</BaseButton>
            <BaseButton type="info" size="small" @click="showReviewPlanDialog = true">
              <div class="center gap-1">
                <IconFluentCalendarClock24Regular />
                <span>{{ '复习计划' }}</span>
              </div>
            </BaseButton>
          </div>
        </template>

        <div class="flex items-center gap-4 mt-2 flex-1" v-else>
          <div class="title">{{ '请选择一本词典开始学习' }}</div>
          <BaseButton id="step1" type="primary" size="large" @click="router.push('/dict-list')">
            <div class="center gap-1">
              <IconFluentAdd16Regular />
              <span>{{ '选择词典' }}</span>
            </div>
          </BaseButton>
        </div>
      </div>
      <div class="flex-1 mt-4 md:mt-0" :class="!store.sdict.id && 'opacity-30 cursor-not-allowed'">
        <div class="flex justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 center rounded-full" style="background: var(--color-second)">
              <IconFluentStar20Filled class="text-lg color-amber" />
            </div>
            <div class="text-xl font-bold">
              {{ isSaveData ? '上次任务' : '今日任务' }}
            </div>
            <span class="color-link cursor-pointer" v-if="store.sdict.id" @click="showPracticeWordListDialog = true">{{ '词表' }}</span>
          </div>
          <div class="flex gap-1 items-center" v-if="store.sdict.id">
            {{ '每日目标' }}
            <div style="color: var(--color-accent)" class="bg-third px-2 h-10 flex center text-2xl rounded">
              {{ store.sdict.id ? store.sdict.perDayStudyNumber : 0 }}
            </div>
            {{ '个单词' }}
            <PopConfirm
              :disabled="!isSaveData"
              title="当前存在未完成的学习任务，修改会重新生成学习任务，是否继续？"
              @confirm="check(() => (showPracticeSettingDialog = true))"
            >
              <BaseButton type="info" size="small">{{ '更改' }}</BaseButton>
            </PopConfirm>
          </div>
        </div>
        <div class="flex mt-4 justify-between">
          <div class="stat">
            <div class="num">{{ practiceData?.taskWords?.new?.length }}</div>
            <div class="txt">{{ '新词' }}</div>
          </div>
          <div class="stat">
            <div class="num">{{ practiceData?.taskWords?.review?.length }}</div>
            <div class="txt">{{ '复习' }}</div>
          </div>
        </div>
        <div class="flex items-end mt-4 gap-4 btn-no-margin">
          <OptionButton
            :class="settingStore.wordPracticeMode !== WordPracticeMode.Free ? 'flex-1 orange-btn' : 'primary-btn'"
          >
            <BaseButton
              size="large"
              :type="settingStore.wordPracticeMode !== WordPracticeMode.Free ? 'orange' : 'primary'"
              :disabled="!store.sdict.id"
              :loading="loading"
              @click="systemPractice"
            >
              <div class="flex items-center gap-2">
                <span class="line-height-[2]">{{ systemPracticeText }}</span>
                <IconFluentArrowCircleRight16Regular class="text-xl" />
              </div>
            </BaseButton>
            <template #options>
              <BaseButton
                class="w-full"
                v-if="
                  settingStore.wordPracticeMode !== WordPracticeMode.System &&
                  settingStore.wordPracticeMode !== WordPracticeMode.Free
                "
                @click="startPractice(WordPracticeMode.System, true)"
              >
                {{ '智能学习' }}
              </BaseButton>

              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.Review"
                :disabled="!practiceData?.taskWords?.review?.length"
                @click="startPractice(WordPracticeMode.Review, true)"
              >
                {{ '复习' }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.Shuffle"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.Shuffle, true)"
              >
                {{ '随机复习' }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ReviewWordsTest"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.ReviewWordsTest, true)"
              >
                {{ '单词' }}{{ '测试' }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ShuffleWordsTest"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.ShuffleWordsTest, true)"
              >
                {{ '随机单词测试' }}
              </BaseButton>

              <!--              <BaseButton-->
              <!--                class="w-full"-->
              <!--                v-if="settingStore.wordPracticeMode !== WordPracticeMode.IdentifyOnly"-->
              <!--                @click="startPractice(WordPracticeMode.IdentifyOnly, true)"-->
              <!--              >-->
              <!--                {{ WordPracticeModeNameMap[WordPracticeMode.IdentifyOnly] }}-->
              <!--              </BaseButton>-->
              <!--              <BaseButton-->
              <!--                class="w-full"-->
              <!--                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ListenOnly"-->
              <!--                @click="startPractice(WordPracticeMode.ListenOnly, true)"-->
              <!--              >-->
              <!--                {{ WordPracticeModeNameMap[WordPracticeMode.ListenOnly] }}-->
              <!--              </BaseButton>-->
              <!--              <BaseButton-->
              <!--                class="w-full"-->
              <!--                v-if="settingStore.wordPracticeMode !== WordPracticeMode.DictationOnly"-->
              <!--                @click="startPractice(WordPracticeMode.DictationOnly, true)"-->
              <!--              >-->
              <!--                {{ WordPracticeModeNameMap[WordPracticeMode.DictationOnly] }}-->
              <!--              </BaseButton>-->
            </template>
          </OptionButton>

          <BaseButton
            :class="settingStore.wordPracticeMode === WordPracticeMode.Free ? 'flex-1' : ''"
            :type="settingStore.wordPracticeMode === WordPracticeMode.Free ? 'orange' : 'primary'"
            size="large"
            :loading="loading"
            @click="freePractice()"
          >
            <div class="flex items-center gap-2">
              <span class="line-height-[2]">
                {{ settingStore.wordPracticeMode === WordPracticeMode.Free && isSaveData
                    ? '继续自由练习'
                    : '自由练习' }}
              </span>
              <IconStreamlineColorPenDrawFlat class="text-xl" />
            </div>
          </BaseButton>
        </div>

      </div>
    </div>

    <div class="card flex flex-col md:flex-row gap-4 xl:gap-20 p-4 md:p-6">
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        <div class="flex justify-between items-center">
          <div class="title">{{ '统计' }}</div>
          <span class="color-link cursor-pointer text-sm" @click="router.push('/fsrs')">
            {{ '学习记录' }} →
          </span>
        </div>
        <div class="flex gap-3 items-center w-full">
          <div class="stat2" title="今日学习详情，点击查看" @click="router.push('/fsrs')">
            <div class="num primary">{{ todayTotalSpend }}</div>
            <div class="txt">{{ '今日学习时长' }}</div>
            <div class="sub">{{ '新学' }} {{ todayNewReview.new }} · {{ '复习' }} {{ todayNewReview.review }}</div>
          </div>
          <div class="stat2" title="学习天数详情，点击查看" @click="router.push('/fsrs')">
            <div class="num">{{ totalDay }}</div>
            <div class="txt">{{ '总学习天数' }}</div>
            <div class="sub">{{ '连续 ' + streakDays + ' 天' }}</div>
          </div>
          <div class="stat2" title="累计学习详情，点击查看" @click="router.push('/fsrs')">
            <div class="num">{{ totalSpend }}</div>
            <div class="txt">{{ '总学习时长' }}</div>
            <div class="sub">{{ '累计 ' + totalWords + ' 词' }}</div>
          </div>
        </div>
      </div>
      <div class="shrink-0 flex items-center">
        <Calendar
          :highlighted-dates="calendarHighlightDates"
          @select-date="onSelectCalendarDate"
          weekHeaderTitle="本周学习记录"
        >
        </Calendar>
      </div>
    </div>

    <div class="card flex flex-col">
      <div class="flex justify-between items-center">
        <div class="title">{{ '词典' }}</div>
        <BaseButton size="small" type="info" @click="nav('/import', { type: 'word' })">
          <div class="center gap-1">
            <IconFluentArrowDownload20Regular />
            <span>{{ '导入' }}</span>
          </div>
        </BaseButton>
      </div>

      <div class="flex flex-col md:flex-row gap-4 mt-4">
        <!-- 我的词典(列表) -->
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-2">
            <div class="font-bold">{{ '我的词典' }}</div>
            <div class="flex gap-4 items-center">
              <PopConfirm title="确认删除所有选中词典？" @confirm="handleBatchDel" v-if="selectIds.length">
                <BaseIcon class="del" title="删除">
                  <DeleteIcon />
                </BaseIcon>
              </PopConfirm>

              <div
                class="color-link cursor-pointer"
                v-if="store.word.bookList.length > 3"
                @click="
                  () => {
                    isManageDict = !isManageDict
                    selectIds = []
                  }
                "
              >
                {{ isManageDict ? '取消' : '管理词典' }}
              </div>
              <div class="color-link cursor-pointer" @click="nav('/dict', { isAdd: true })">
                {{ '创建个人词典' }}
              </div>
              <div
                class="color-link cursor-pointer"
                v-if="store.word.bookList.length > 4"
                @click="myDictExpanded = !myDictExpanded"
              >
                {{ myDictExpanded ? '收起' : '更多' }}
              </div>
            </div>
          </div>

          <ul class="dict-list">
            <li
              v-for="(item, j) in showMyDictList"
              :key="item.id"
              class="dict-row"
              :class="[isManageDict && j >= 3 && selectIds.includes(item.id) && 'row-selected']"
              @click="onMyDictClick(item, j)"
            >
              <span v-if="isManageDict && j >= 3" class="shrink-0" @click.stop>
                <Checkbox :model-value="selectIds.includes(item.id)" @change="toggleSelect(item)" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="truncate">{{ item.name }}</span>
                  <span class="dict-badge" v-if="item.custom">{{ '自定义' }}</span>
                  <span class="dict-badge system" v-else-if="item.system">{{ '内置' }}</span>
                </div>
                <Progress
                  v-if="item.lastLearnIndex"
                  :percentage="myDictProgress(item)"
                  :show-text="false"
                  class="mt-1.5"
                />
              </div>
              <div class="shrink-0 text-sm text-gray text-right">
                <div>{{ item.lastLearnIndex ? item.lastLearnIndex + ' / ' : '' }}{{ item.length }} {{ '单词' }}</div>
                <div class="text-xs" v-if="item.lastLearnIndex">{{ myDictProgress(item) }}%</div>
              </div>
            </li>

            <li v-if="!store.word.bookList.length" class="py-1 px-2 text-sm text-gray">{{ '还没有词典' }}</li>
            <li class="dict-row add-row" @click="router.push('/dict-list')">
              <IconFluentAdd16Regular />
              <span class="text-gray">{{ '选择词典' }}</span>
            </li>
          </ul>
        </div>

        <!-- 全部词典(列表) -->
        <div class="flex-1 min-w-0 dict-column-divider pt-3 md:pt-0 md:pl-5">
          <div class="flex justify-between items-center mb-2">
            <div class="font-bold">{{ '全部词典' }}</div>
            <div
              class="color-link cursor-pointer"
              v-if="recommendAllList.length > 4"
              @click="router.push('/dict-list')"
            >
              {{ '更多' }} →
            </div>
          </div>

          <div v-loading="isFetching" class="min-h-30">
            <ul class="dict-list" v-if="showRecommendList.length">
              <li
                v-for="item in showRecommendList"
                :key="item.id"
                class="dict-row"
                @click="goDictDetail(item)"
              >
                <div class="flex-1 min-w-0">
                  <div class="truncate">{{ item.name }}</div>
                  <div class="text-xs text-gray truncate">
                    {{ item.category }}
                    <template v-if="item.tags?.length"> · {{ item.tags.join('/') }}</template>
                  </div>
                </div>
                <div class="shrink-0 text-sm text-gray">{{ item.length }} {{ '单词' }}</div>
              </li>
            </ul>
            <Empty v-else-if="!isFetching" text="暂无词典" />
          </div>
        </div>
      </div>
    </div>
  </BasePage>

  <PracticeSettingDialog
    :show-left-option="false"
    v-model="showPracticeSettingDialog"
    :onConfirm="savePracticeSetting"
  />

  <ChangeLastPracticeIndexDialog v-model="showChangeLastPracticeIndexDialog" @ok="saveLastPracticeIndex" />

  <ReviewPlanDialog v-model="showReviewPlanDialog" />

  <PracticeWordListDialog :data="practiceData?.taskWords" v-model="showPracticeWordListDialog" />

  <ShufflePracticeSettingDialog
    v-model="showShufflePracticeSettingDialog"
    :onConfirm="onShufflePracticeSettingOk"
    :wordPracticeMode="editingWordPracticeMode"
  />

  <Dialog v-model="showStudyDayDialog" :title="studyDayDialogTitle" :footer="false" :padding="true">
    <div
      v-if="!studyDayRecords.length && !(isStudyDayKeyToday(selectedStudyDateKey) && todayCacheMs > 0)"
      class="text-gray-500 py-6 text-center"
    >
      {{ '当日无学习记录' }}
    </div>
    <ul v-if="studyDayRecords.length" class="study-day-list max-h-70vh overflow-y-auto space-y-3">
      <li v-for="(row, idx) in studyDayRecords" :key="idx" class="border-b border-[var(--color-line)] pb-3 last:border-0">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ row.dictName }}</span>
          <span
            v-if="row.sessionRole && row.sessionRole !== 'single'"
            class="text-xs px-1.5 py-0.5 rounded-full"
            :class="{
              'tag-success': row.sessionRole === 'start',
              'tag-info': row.sessionRole === 'middle',
              'tag-warning': row.sessionRole === 'end',
            }"
          >
            {{ { start: '学习开始', middle: '学习中', end: '学习结束' }[row.sessionRole] }}
          </span>
        </div>
        <div class="text-sm text-gray-600 mt-1">
          {{ '时长' }} {{ msToHourMinute(row.spend) }} · {{ '新学' }} {{ row.new }} · {{ '复习' }} {{ row.review }} · {{ '错词' }} {{ row.wrong }}
          <template v-if="row.total"> · {{ '共' }} {{ row.total }} {{ '单词' }}</template>
        </div>
      </li>
    </ul>
  </Dialog>
</template>

<style scoped lang="scss">
// 查词实时匹配下拉列表
.suggestion-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 0.25rem;
  max-height: 23rem;
  overflow-y: auto;
  background: var(--color-card-bg);
  border: 1px solid var(--color-item-border);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0.25rem 0;

  li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.35rem 0.75rem;
    cursor: pointer;

    // 单词列固定宽度:所有行的单词、翻译分别左对齐,长单词截断
    .word {
      font-weight: 600;
      flex-shrink: 0;
      width: 9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .trans {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.08);
    }
  }
}

html.dark {
  .suggestion-list li:hover {
    background: rgba(255, 255, 255, 0.12);
  }
}

.dict-list {
  @apply space-y-1;
}

.dict-row {
  @apply flex items-center gap-2 px-2 py-2 rounded-lg border border-transparent cursor-pointer;
  transition: background var(--anim-time);

  &:hover {
    background: var(--color-second);
  }
}

.dict-row.add-row {
  border: 1px dashed var(--color-item-border);
  color: var(--color-sub-text);
  justify-content: center;
  gap: 0.3rem;

  &:hover {
    background: var(--color-second);
  }
}

.row-selected {
  background: var(--color-fifth);
  border-color: var(--color-select-bg);
}

.dict-badge {
  @apply shrink-0 text-[11px] leading-none px-1.5 py-1 rounded-md;
  background: var(--color-select-bg);
  color: white;
}

.dict-column-divider {
  border-color: var(--color-item-border);
  border-top-width: 1px;

  @media (min-width: 768px) {
    border-top-width: 0;
    border-left-width: 1px;
  }
}

.stat {
  @apply w-49% box-border flex flex-col items-center justify-center rounded-xl p-2 bg-[var(--bg-history)];
  border: 1px solid var(--color-item-border);

  .num {
    @apply color-[var(--color-info)] text-4xl font-bold;
  }

  .txt {
    @apply color-gray-500;
  }
}

.stat2 {
  @extend .stat;
  @apply py-4 flex-1 cursor-pointer;
  width: unset;
  border-color: transparent;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  transition: all var(--anim-time);

  &:hover {
    background: var(--color-third);
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover);
  }

  // 数字:主题主色 + 加粗
  .num {
    @apply text-2xl break-keep font-bold;
    color: var(--color-select-bg);
  }

  // 副信息:今日词数/连续天数/累计词数
  .sub {
    @apply mt-0.5 text-xs;
    color: var(--color-sub-text);
  }
}
</style>