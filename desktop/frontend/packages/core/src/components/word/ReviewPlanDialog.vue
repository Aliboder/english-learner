<script setup lang="ts">
// 复习计划:根据 FSRS 记忆曲线(due 时间)展示未来 7 天每天待复习卡片,
// 支持展开查看当天单词卡片、提前复习未来某天的内容;复习落卡后记忆曲线自动重新安排
import { computed, ref } from 'vue'
import { BaseButton, Dialog, Toast, VolumeIcon } from '@english-learner/base'
import { useBaseStore } from '../../stores/base.ts'
import { shuffle, useNav } from '../../utils'
import { flushStatToStore, usePracticeWordPersistence } from '../../composables/usePracticePersistence'
import { getPracticeWordCacheLocal } from '../../utils/cache.ts'
import { usePlayWordAudio } from '../../hooks/sound.ts'
import { getWordStatus, WORD_STATUS_INFO } from '../../hooks/wordStatus.ts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
// 组件自注册 utc 插件(dayjs.utc 依赖它;不能依赖其他页面加载的副作用)
dayjs.extend(utc)

const playWordAudio = usePlayWordAudio()

// 卡片状态色(已掌握/快遗忘/学习中/未学)
function cardStatus(w: any) {
  return WORD_STATUS_INFO[getWordStatus(w.word)]
}

const model = defineModel<boolean>({ default: false })
const store = useBaseStore()
const { nav } = useNav()
const wordPersistence = usePracticeWordPersistence()

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 当前展开查看的日期(YYYY-MM-DD),再次点击收起
let expandedDate = $ref('')

// 未来 7 天计划:每天 = 到期卡片数 + 单词(小写 key)
const plan = computed(() => {
  const now = dayjs()
  const todayStart = now.startOf('day')
  const days: { date: string; label: string; count: number; words: string[] }[] = []
  for (let i = 0; i < 7; i++) {
    const d = now.add(i, 'day')
    days.push({
      date: d.format('YYYY-MM-DD'),
      label: i === 0 ? '今天' : i === 1 ? '明天' : WEEK_LABELS[d.day()],
      count: 0,
      words: [],
    })
  }
  // 到期卡片按 due 落到对应天;已过期的归到今天(待复习)
  for (const [word, card] of Object.entries(store.fsrsData) as any) {
    const dueTime = dayjs.utc(card.due).valueOf()
    if (Number.isNaN(dueTime)) continue
    const dueDay = dayjs(dueTime).startOf('day')
    if (dueDay.isBefore(todayStart)) {
      days[0].count++
      days[0].words.push(word)
      continue
    }
    const idx = dueDay.diff(todayStart, 'day')
    if (idx >= 0 && idx < 7) {
      days[idx].count++
      days[idx].words.push(word)
    }
  }
  return days
})

const totalReview = computed(() => plan.value.reduce((s, d) => s + d.count, 0))

// 已加载词库的词映射(小写 → 词对象),供展开卡片/复习使用
const wordMap = computed(() => {
  const map = new Map<string, any>()
  for (const d of store.word.bookList) {
    for (const w of d.words ?? []) {
      if (w?.word && !map.has(w.word.toLowerCase())) map.set(w.word.toLowerCase(), w)
    }
  }
  return map
})

// 某天的词卡片列表
function getDayWords(day: { words: string[] }): any[] {
  return day.words.map(k => wordMap.value.get(k)).filter(Boolean)
}

function toggleDay(date: string) {
  expandedDate = expandedDate === date ? '' : date
}

// 复习某天内容:今天=立即复习,未来=提前复习
async function reviewDay(day: { date: string; count: number; words: string[] }) {
  if (!day.words.length) return
  if (!store.sdict?.id) {
    Toast.warning('请先在「选择词典」中开始学习')
    return
  }
  const words = getDayWords(day)
  if (!words.length) {
    Toast.warning('这些词不在已加载的词库中,请先切换到对应词典学习')
    return
  }
  // 与错词重练一致:先把进行中的练习统计落库,再清缓存
  const cache = await getPracticeWordCacheLocal()
  if (cache) {
    flushStatToStore((cache as any)?.statStoreData)
    await wordPersistence.clear()
  }
  model.value = false
  nav('practice-words/' + store.sdict.id, {}, {
    taskWords: { new: [], review: shuffle(words) },
    practiceData: null,
    statStoreData: null,
  })
}
</script>

<template>
  <Dialog v-model="model" title="复习计划" padding width="40rem">
    <div class="review-plan">
      <div class="plan-summary">
        {{ '未来 7 天共' }} <span class="num">{{ totalReview }}</span> {{ '个单词待复习,由记忆曲线自动安排' }}
      </div>
      <div
        v-for="(day, i) in plan"
        :key="day.date"
        class="plan-day"
        :class="{ today: i === 0, expanded: expandedDate === day.date }"
        @click="toggleDay(day.date)"
      >
        <div class="day-row">
          <div class="day-info">
            <span class="day-label">{{ day.label }}</span>
            <span class="day-date">{{ day.date.slice(5) }}</span>
            <span class="day-count" :class="{ zero: !day.count }">{{ day.count }} {{ '单词' }}</span>
          </div>
          <div class="day-actions">
            <BaseButton v-if="day.count" type="info" size="small" @click.stop="reviewDay(day)">
              {{ i === 0 ? '立即复习' : '提前复习' }}
            </BaseButton>
            <span v-else class="day-empty">{{ '无' }}</span>
            <IconFluentChevronDown20Filled class="chevron" :class="expandedDate === day.date && 'rotated'" />
          </div>
        </div>
        <!-- 展开:当天单词卡片(喇叭在前+单词+翻译,16:9,按掌握状态着色) -->
        <div v-if="expandedDate === day.date" class="day-words" @click.stop>
          <div v-if="getDayWords(day).length" class="words-list">
            <div v-for="w in getDayWords(day)" :key="w.word" class="word-card">
              <div class="card-head">
                <VolumeIcon class="card-volume" :time="200" @click="playWordAudio(w.word)" />
                <!-- 单词文字按掌握状态着色,完整显示不截断 -->
                <span class="card-word" :style="{ color: cardStatus(w).color }">{{ w.word }}</span>
              </div>
              <div class="card-trans">{{ w.trans?.[0]?.cn ?? '' }}</div>
            </div>
          </div>
          <div v-else class="words-empty">{{ '这些词尚未加载,请先切换到对应词典学习后查看' }}</div>
        </div>
      </div>
      <div class="plan-tip">{{ '点击日期可展开查看当天单词;提前复习后,记忆曲线会重新安排后续计划' }}</div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.review-plan {
  width: 100%;

  .plan-summary {
    @apply mb-3 text-sm;
    color: var(--color-sub-text);

    .num {
      @apply font-bold text-base;
      color: var(--color-select-bg);
    }
  }

  .plan-day {
    @apply rounded-lg mb-2;
    border: 1px solid var(--color-line);
    overflow: hidden;

    &.today {
      border-color: var(--color-select-bg);
    }

    &.expanded {
      border-color: var(--color-select-bg);
      background: var(--color-third);
    }

    .day-row {
      @apply flex items-center justify-between px-3 py-2 cursor-pointer;
      transition: background var(--anim-time, 0.2s);

      &:hover {
        background: var(--color-third);
      }

      .day-info {
        @apply flex items-center gap-3;

        .day-label {
          @apply font-bold;
          color: var(--color-main-text);
        }

        .day-date {
          font-size: 0.8rem;
          color: var(--color-sub-text);
        }

        .day-count {
          font-size: 0.85rem;
          color: var(--color-main-text);

          &.zero {
            color: var(--color-sub-gray);
          }
        }
      }

      .day-actions {
        @apply flex items-center gap-2;

        .day-empty {
          font-size: 0.85rem;
          color: var(--color-sub-gray);
        }

        .chevron {
          @apply cursor-pointer transition-transform;
          color: var(--color-sub-text);

          &.rotated {
            transform: rotate(180deg);
          }
        }
      }
    }

    // 展开的单词卡片区
    .day-words {
      border-top: 1px solid var(--color-line);
      padding: 0.5rem 0.75rem;
      background: var(--color-second);

      // 单词卡片:一行三列,固定 16:9 宽高比,喇叭在前
      .words-list {
        max-height: 18rem;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.4rem;

        .word-card {
          aspect-ratio: 16 / 9;
          @apply flex flex-col rounded-md px-2 py-1.5 overflow-hidden transition-all;
          border: 1px solid var(--color-line);
          background: var(--color-second);

          &:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
          }

          .card-head {
            @apply flex items-start gap-1 min-w-0;

            .card-volume {
              @apply shrink-0 cursor-pointer mt-px;
              color: var(--color-link);
            }

            // 单词文字颜色由掌握状态决定(内联 style),完整显示允许换行
            .card-word {
              @apply font-bold min-w-0 leading-4;
              word-break: break-all;
            }
          }

          .card-trans {
            @apply mt-0.5 text-xs leading-4 overflow-hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            color: var(--color-sub-text);
          }
        }
      }

      .words-empty {
        @apply py-2 text-sm text-center;
        color: var(--color-sub-gray);
      }
    }
  }

  .plan-tip {
    @apply mt-2 text-xs;
    color: var(--color-sub-gray);
  }
}
</style>