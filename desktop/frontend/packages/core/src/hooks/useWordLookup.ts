import { reactive } from 'vue'
import type { Word } from '../types'
import { normalizeWordForLookup, stripWordPunctuation } from '../utils/wordLookup.ts'
import { findWordGlobally } from './dictIndex.ts'

const cache = new Map<string, Word | null>()

export const wordLookupState = reactive({
  visible: false,
  loading: false,
  notFound: false,
  queryWord: '',
  data: null as Word | null,
  x: 0,
  y: 0,
})

function updatePosition(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  wordLookupState.x = rect.left + rect.width / 2
  wordLookupState.y = rect.bottom + 8
}

async function fetchWordData(rawWord: string) {
  const stripped = stripWordPunctuation(rawWord)
  if (!stripped) {
    wordLookupState.notFound = true
    wordLookupState.loading = false
    wordLookupState.data = null
    return
  }

  wordLookupState.queryWord = stripped

  if (cache.has(stripped)) {
    const cached = cache.get(stripped) ?? null
    wordLookupState.data = cached
    wordLookupState.notFound = !cached
    wordLookupState.loading = false
    return
  }

  const candidates = normalizeWordForLookup(rawWord)
  // 桌面版:已加载词库 + 全部内嵌词库索引,离线可用
  for (const candidate of candidates) {
    const found = await findWordGlobally(candidate)
    if (found) {
      cache.set(stripped, found)
      wordLookupState.data = found
      wordLookupState.notFound = false
      wordLookupState.loading = false
      return
    }
  }

  cache.set(stripped, null)
  wordLookupState.data = null
  wordLookupState.notFound = true
  wordLookupState.loading = false
}

export function closeWordLookup() {
  wordLookupState.visible = false
}

export async function lookupWord(e: MouseEvent, rawWord: string, playAudio?: (word: string) => void) {
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement | null
  if (!target) return

  updatePosition(target)
  wordLookupState.visible = true
  wordLookupState.loading = true
  wordLookupState.notFound = false
  wordLookupState.data = null

  const stripped = stripWordPunctuation(rawWord)
  if (stripped) {
    playAudio?.(stripped)
  }

  await fetchWordData(rawWord)
  if (wordLookupState.visible && target.isConnected) {
    updatePosition(target)
  }
}

export function useWordLookup() {
  return {
    state: wordLookupState,
    lookupWord,
    close: closeWordLookup,
  }
}
