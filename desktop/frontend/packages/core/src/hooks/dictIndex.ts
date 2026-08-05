import type { Word } from '../types'
import { useBaseStore } from '../stores/base'
import { fetchDictJson } from '../utils'

// 内嵌词库查词索引(public/dicts/index.json(.z),构建期由 scripts/generate-dict-index.py 生成)
// 模块级缓存:主界面查词与练习页例句查词共用,避免重复下载
export type DictIndexItem = { w: string; d: string; t?: string }

let dictIndex: DictIndexItem[] | null = null
let dictIndexPromise: Promise<DictIndexItem[]> | null = null
const dictWordsCache = new Map<string, Word[]>()

/**
 * 获取内嵌词库索引(首次调用才 fetch,之后内存缓存;优先加载压缩版 .z,体积约 1/4)。
 * 用 promise 缓存:并发调用共享同一次加载,不会出现「加载中返回空数组」导致下拉短暂空白。
 */
export function ensureDictIndex(): Promise<DictIndexItem[]> {
  if (dictIndex) return Promise.resolve(dictIndex)
  if (!dictIndexPromise) {
    dictIndexPromise = (async () => {
      try {
        // 压缩版索引用 fetchDictJson 解压;不存在时回退旧版纯 JSON
        dictIndex = await fetchDictJson('/dicts/index.json.z').catch(() => fetch('/dicts/index.json').then(r => r.json()))
      } catch {
        dictIndex = []
      }
      return dictIndex
    })()
  }
  return dictIndexPromise
}

/** 按词库文件名加载完整词条(缓存),支持 .json.z 压缩词库 */
export async function loadDictWords(dictFile: string): Promise<Word[]> {
  if (!dictWordsCache.has(dictFile)) {
    const words = await fetchDictJson(`/dicts/en/word/${dictFile}`)
    dictWordsCache.set(dictFile, words)
  }
  return dictWordsCache.get(dictFile)!
}

/** 从已加载词库(bookList,含自建词库)精确查找 */
export function findWordInLoadedDicts(word: string): Word | null {
  const store = useBaseStore()
  const allWords = store.word.bookList.flatMap(d => d.words ?? [])
  return allWords.find(w => w.word?.toLowerCase() === word.toLowerCase()) ?? null
}

/** 全量查找:已加载词库优先,未命中再从内嵌词库索引查找(按需加载词库文件) */
export async function findWordGlobally(word: string): Promise<Word | null> {
  const local = findWordInLoadedDicts(word)
  if (local) return local
  const index = await ensureDictIndex()
  const item = index?.find(it => it.w.toLowerCase() === word.toLowerCase())
  if (!item?.d) return null
  const words = await loadDictWords(item.d)
  return words.find(w => w.word?.toLowerCase() === word.toLowerCase()) ?? null
}
