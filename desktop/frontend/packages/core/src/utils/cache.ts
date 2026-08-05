import type { PracticeData, TaskWords } from '../types'
import type { PracticeState } from '../stores'
import { get, set } from 'idb-keyval'

type CacheConfig = { key: string; version: number }

export const PRACTICE_WORD_CACHE: CacheConfig = {
  key: 'PracticeSaveWord',
  version: 1,
}
export const PRACTICE_ARTICLE_CACHE: CacheConfig = {
  key: 'PracticeSaveArticle',
  version: 1,
}

export type PracticeWordCache = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
}

export type PracticeWordTaskWordsStr = {
  new: string[]
  review: string[]
}

export type PracticeWordDataCompact = Omit<PracticeData, 'words' | 'wrongWords'> & {
  wordsStr: string[]
  wrongWordsStr: string[]
}

export type PracticeWordCacheCompact = {
  taskWordsStr: PracticeWordTaskWordsStr
  practiceData: PracticeWordDataCompact
  statStoreData: PracticeState
}

export type PracticeWordCacheStored = PracticeWordCache | PracticeWordCacheCompact

export type PracticeArticleCache = {
  practiceData: {
    sectionIndex: number
    sentenceIndex: number
    wordIndex: number
  }
  statStoreData: PracticeState
}

export type LocalCacheResult<T> = { val: T; updated_at?: string; version: number }

/**
 * 尝试从 localStorage 迁移老数据到 IndexedDB。
 * 如果 idb 中无数据，但 localStorage 中有，则迁移并删除 localStorage 中的 key。
 * 老数据是 JSON 字符串格式，迁移时解析为对象再存入 idb。
 */
async function migrateFromLocalStorage<T>(config: CacheConfig): Promise<LocalCacheResult<T> | null> {
  try {
    const raw = localStorage.getItem(config.key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalCacheResult<T>
    // 迁移到 idb
    await set(config.key, raw)
    // 删除 localStorage 中的老数据
    localStorage.removeItem(config.key)
    return parsed
  } catch {
    return null
  }
}

/** 从 idb 读取带 meta 的缓存；无数据或解析失败返回 null */
async function getLocalWithMeta<T>(config: CacheConfig): Promise<LocalCacheResult<T> | null> {
  const raw = await get(config.key)
  if (raw) {
    // 兼容旧版本写入的 JSON 字符串格式
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as LocalCacheResult<T>
      } catch {
        return null
      }
    }
    return raw as LocalCacheResult<T>
  }
  // idb 中没有数据，尝试从 localStorage 迁移（兼容老数据）
  return migrateFromLocalStorage<T>(config)
}

async function getLocal<T>(config: CacheConfig): Promise<T | null> {
  const result = await getLocalWithMeta<T>(config)
  if (result?.val) {
    if (Object.keys(result.val).length > 0) return result.val
  }
  return null
}

async function setLocal<T>(config: CacheConfig, val: T | null, updated_at: string): Promise<void> {
  // idb 原生支持对象存储，直接存对象，无需 JSON.stringify
  const payload: LocalCacheResult<T> = {
    version: config.version,
    val,
    updated_at,
  }
  await set(config.key, JSON.stringify(payload))
}

export async function getPracticeWordCacheLocal(): Promise<PracticeWordCacheStored | null> {
  return getLocal<PracticeWordCacheStored>(PRACTICE_WORD_CACHE)
}

export async function getPracticeWordCacheLocalWithMeta(): Promise<LocalCacheResult<PracticeWordCacheStored> | null> {
  return getLocalWithMeta<PracticeWordCacheStored>(PRACTICE_WORD_CACHE)
}

export async function setPracticeWordCacheLocal(
  cache: PracticeWordCacheStored | null,
  updated_at?: string
): Promise<void> {
  await setLocal(PRACTICE_WORD_CACHE, cache, updated_at)
}

export async function getPracticeArticleCacheLocal(): Promise<PracticeArticleCache | null> {
  return getLocal<PracticeArticleCache>(PRACTICE_ARTICLE_CACHE)
}

export async function getPracticeArticleCacheLocalWithMeta(): Promise<LocalCacheResult<PracticeArticleCache> | null> {
  return getLocalWithMeta<PracticeArticleCache>(PRACTICE_ARTICLE_CACHE)
}

export async function setPracticeArticleCacheLocal(
  cache: PracticeArticleCache | null,
  updated_at?: string
): Promise<void> {
  await setLocal(PRACTICE_ARTICLE_CACHE, cache, updated_at)
}
