<script setup lang="ts">
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { BaseButton } from '@typewords/base'
import { msToHourMinute } from '@typewords/core/utils'
import { usePracticeWordPersistence } from '@typewords/core/composables/usePracticePersistence'
import dayjs from 'dayjs'
import isToday from 'dayjs/plugin/isToday' // ES 2015
import utc from 'dayjs/plugin/utc'
import Header from '@typewords/core/components/Header.vue'

dayjs.extend(isToday)
dayjs.extend(utc)

const baseStore = useBaseStore()
const wordPersistence = usePracticeWordPersistence()
let type = $ref('today')

// 进行中练习的缓存数据(尚未落库),用于周小结补全
let practiceCache = $ref<any>(null)

onMounted(async () => {
  practiceCache = await wordPersistence.fetch()
})

// 将 fsrsData 转换为数组
const fsrsList = computed(() => {
  return Object.entries(baseStore.fsrsData)
    .filter(([word, card]) => {
      return type === 'today' ? dayjs.utc(card.last_review).local().isToday() : true
    })
    .map(([word, card]: [string, any]) => ({
      word,
      ...card,
    }))
  // .sort((a, b) => dayjs.utc(b.due).valueOf() - dayjs.utc(a.due).valueOf())
})

// 本周起点(周一):startOf('week') 默认周日,加 1 天即为周一
const weekStart = dayjs().startOf('week').add(1, 'day')

// 本周小结:已落库统计 + 进行中练习缓存(未落库部分)
const weekSummary = $computed(() => {
  const days = new Set<string>()
  let spend = 0
  let newWords = 0
  let reviewWords = 0

  for (const book of baseStore.word.bookList) {
    for (const s of book.statistics ?? []) {
      const d = dayjs(s.startDate)
      if (d.isBefore(weekStart)) continue
      days.add(d.format('YYYY-MM-DD'))
      spend += s.spend ?? 0
      newWords += s.new ?? 0
      reviewWords += s.review ?? 0
    }
  }

  // 进行中练习:时间片段按天归入,新词/复习数若练习在本周开始则计入
  const st = practiceCache?.statStoreData
  if (st?.segments?.length) {
    for (const [start, end] of st.segments) {
      const d = dayjs(start)
      if (d.isBefore(weekStart)) continue
      days.add(d.format('YYYY-MM-DD'))
      spend += end - start
    }
    const stStart = dayjs(st.startDate)
    if (!stStart.isBefore(weekStart)) {
      newWords += st.newWordNumber ?? 0
      reviewWords += st.reviewWordNumber ?? 0
    }
  }

  return {
    days: days.size,
    spend,
    newWords,
    reviewWords,
  }
})

// 本周复习过的卡片数(FSRS)
const weekReviewCards = $computed(() => {
  let n = 0
  for (const card of Object.values(baseStore.fsrsData) as any[]) {
    if (dayjs.utc(card.last_review).isAfter(weekStart)) n++
  }
  return n
})

// ===== 记忆曲线:全库卡片状态分布 + 近 14 天复习趋势 =====
const memoryReport = $computed(() => {
  let learning = 0
  let due = 0
  const now = Date.now()
  const todayStart = dayjs().startOf('day')
  for (const card of Object.values(baseStore.fsrsData) as any[]) {
    const dueTime = dayjs.utc(card.due).valueOf()
    if (!Number.isNaN(dueTime) && dueTime <= now) {
      due++
    } else {
      learning++
    }
  }

  // 近 14 天复习趋势(每天复习过的卡数)
  const trend: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    trend.push({ date: dayjs().subtract(i, 'day').format('MM-DD'), count: 0 })
  }
  for (const card of Object.values(baseStore.fsrsData) as any[]) {
    const lr = dayjs.utc(card.last_review)
    const key = lr.format('MM-DD')
    const item = trend.find(t => t.date === key)
    if (item) item.count++
  }

  const total = Object.keys(baseStore.fsrsData).length
  const mastered = baseStore.knownWordsSet.size
  // 今日待复习:今天之内到期(含今天已到期)
  const todayDue = Object.values(baseStore.fsrsData).filter((card: any) => {
    const dueTime = dayjs.utc(card.due).valueOf()
    return !Number.isNaN(dueTime) && dueTime >= todayStart.valueOf() && dueTime <= now
  }).length
  const maxTrend = Math.max(1, ...trend.map(t => t.count))
  return { learning, due, mastered, total, todayDue, trend, maxTrend }
})
</script>

<template>
  <div class="p-4 box-border h-screen flex flex-col">
    <Header title="学习记录" />

    <!-- 左侧:记忆曲线 / 右侧:本周学习小结(总结栏) -->
    <div class="flex gap-4 flex-wrap summary-row">
      <!-- 记忆曲线:卡片状态分布 + 复习趋势 -->
      <div class="card mb-4 p-4 flex-1 min-w-0">
        <div class="font-bold text-xl mb-3">{{ '记忆曲线' }}</div>
        <div class="flex gap-4 flex-wrap mb-4">
          <div class="stat-item">
            <div class="num" style="color: var(--color-success)">{{ memoryReport.mastered }}</div>
            <div class="txt">{{ '已掌握' }}</div>
          </div>
          <div class="stat-item">
            <div class="num" style="color: var(--color-error)">{{ memoryReport.due }}</div>
            <div class="txt">{{ '快遗忘(到期)' }}</div>
          </div>
          <div class="stat-item">
            <div class="num" style="color: var(--color-info)">{{ memoryReport.learning }}</div>
            <div class="txt">{{ '学习中' }}</div>
          </div>
          <div class="stat-item">
            <div class="num">{{ memoryReport.total }}</div>
            <div class="txt">{{ '记忆卡片' }}</div>
          </div>
          <div class="stat-item">
            <div class="num" style="color: var(--color-warning)">{{ memoryReport.todayDue }}</div>
            <div class="txt">{{ '今日待复习' }}</div>
          </div>
        </div>
        <div class="font-bold mb-1">{{ '近 14 天复习趋势' }}</div>
        <div class="bar-chart">
          <div
            v-for="d in memoryReport.trend"
            :key="d.date"
            class="bar-col"
            :title="`${d.date}: ${'复习'} ${d.count} ${'卡'}`"
          >
            <div class="bar" :style="{ height: Math.max(2, (d.count / memoryReport.maxTrend) * 60) + 'px' }"></div>
            <div class="bar-label">{{ d.date }}</div>
          </div>
        </div>
        <div
          v-if="!memoryReport.trend.some(d => d.count > 0)"
          class="text-sm mt-1"
          style="color: var(--color-sub-text)"
        >
          {{ '近 14 天暂无复习记录,开始学习后这里会显示复习趋势' }}
        </div>
      </div>

      <!-- 本周学习小结 -->
      <div class="card mb-4 p-4 flex-1 min-w-0">
        <div class="font-bold text-xl mb-3">{{ '本周学习小结' }}</div>
        <div class="flex gap-4 flex-wrap">
          <div class="stat-item">
            <div class="num">{{ weekSummary.days }}</div>
            <div class="txt">{{ '学习天数' }}</div>
          </div>
          <div class="stat-item">
            <div class="num">{{ msToHourMinute(weekSummary.spend) }}</div>
            <div class="txt">{{ '学习时长' }}</div>
          </div>
          <div class="stat-item">
            <div class="num">{{ weekSummary.newWords }}</div>
            <div class="txt">{{ '新学单词' }}</div>
          </div>
          <div class="stat-item">
            <div class="num">{{ weekSummary.reviewWords }}</div>
            <div class="txt">{{ '复习单词' }}</div>
          </div>
          <div class="stat-item">
            <div class="num">{{ weekReviewCards }}</div>
            <div class="txt">{{ '复习卡片' }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end items-center mb-4">
      <span class="mr-4">{{ '共' }} {{ fsrsList.length }} {{ '条记录' }}</span>
      <BaseButton :type="type === 'today' ? 'primary' : 'info'" @click="type = 'today'">{{ '今日学习' }}</BaseButton>
      <BaseButton :type="type === 'all' ? 'primary' : 'info'" @click="type = 'all'">{{ '所有记录' }}</BaseButton>
    </div>

    <FsrsRecordsTable :rows="fsrsList" />
  </div>
</template>

<style scoped lang="scss">
// 总结栏:记忆曲线(左)与本周小结(右)并排,移动端堆叠
.summary-row {
  > .card {
    min-width: 20rem;
  }
}

.stat-item {
  @apply flex flex-col items-center px-4 py-2 rounded-xl bg-[var(--bg-history)] border border-[var(--color-line)] min-w-24;

  .num {
    @apply text-2xl font-bold color-[var(--color-info)];
  }

  .txt {
    @apply text-sm color-gray-500;
  }
}

// 复习趋势柱状图
.bar-chart {
  @apply flex items-end gap-1.5 mt-2;
  height: 5.5rem;
  overflow-x: auto;

  .bar-col {
    @apply flex flex-col items-center justify-end gap-0.5 flex-shrink-0;
    width: 1.5rem;

    .bar {
      @apply w-full rounded-sm;
      min-height: 2px;
      background: var(--color-select-bg);
    }

    .bar-label {
      font-size: 0.6rem;
      color: var(--color-sub-text);
    }
  }
}
</style>