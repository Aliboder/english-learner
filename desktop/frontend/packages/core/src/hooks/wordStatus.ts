import { useBaseStore } from '../stores/base'
import dayjs from 'dayjs'

/**
 * 单词掌握状态(参考墨墨背单词的记忆状态可视化):
 * - mastered 已掌握(在已掌握集合,FSRS 卡已移除)
 * - due      快遗忘(有 FSRS 卡且已到期,需复习)
 * - learning 学习中(有 FSRS 卡,未到期)
 * - new      未学(无卡)
 */
export type WordStatus = 'mastered' | 'due' | 'learning' | 'new'

// 颜色用 CSS 变量引用(main.scss 定义,深浅色各一套,勿硬编码具体色值)
export const WORD_STATUS_INFO: Record<WordStatus, { label: string; color: string; desc: string }> = {
  mastered: { label: '已掌握', color: 'var(--color-success)', desc: '已在掌握列表中' },
  due: { label: '快遗忘', color: 'var(--color-error)', desc: '已到期,建议立即复习' },
  learning: { label: '学习中', color: 'var(--color-info)', desc: '已按记忆曲线安排复习' },
  new: { label: '未学', color: 'var(--color-muted)', desc: '尚未学习' },
}

/** 获取单个单词的掌握状态(小写匹配,与 fsrsData/knownWords 一致) */
export function getWordStatus(word: string): WordStatus {
  const store = useBaseStore()
  const key = word.trim().toLowerCase()
  if (!key) return 'new'
  if (store.knownWordsSet.has(key)) return 'mastered'
  const card = store.fsrsData[key]
  if (card) {
    // due 字段序列化后为字符串,需转时间戳比较
    const due = dayjs(card.due as any).valueOf()
    if (!Number.isNaN(due) && due <= Date.now()) return 'due'
    return 'learning'
  }
  return 'new'
}

/**
 * 统计一组单词的状态分布(用于词库详情/报告)。
 * 大词库(ECDICT 84 万词)下必须内联判断:逐词调 getWordStatus 会重复构造 dayjs,统计会卡顿。
 */
export function countWordStatuses(words: { word: string }[]): Record<WordStatus, number> {
  const store = useBaseStore()
  const result: Record<WordStatus, number> = { mastered: 0, due: 0, learning: 0, new: 0 }
  const now = Date.now()
  for (const w of words) {
    const key = (w.word ?? '').trim().toLowerCase()
    if (!key) {
      result.new++
      continue
    }
    if (store.knownWordsSet.has(key)) {
      result.mastered++
    } else {
      const card = store.fsrsData[key]
      if (card) {
        const due = new Date(card.due as any).getTime()
        if (!Number.isNaN(due) && due <= now) result.due++
        else result.learning++
      } else {
        result.new++
      }
    }
  }
  return result
}
