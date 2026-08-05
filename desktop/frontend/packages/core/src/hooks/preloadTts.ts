import type { Word } from '../types'
import { del, get, set } from 'idb-keyval'
import { simplifyTransCn } from '../utils'
import { useSettingStore } from '../stores/setting'

/**
 * 朗读缓存(预加载 + 播放即缓存 + 跨会话持久化):
 * ① 练习页滑窗预加载:学当前词时后台提前合成后续词的发音/翻译,点朗读零等待
 * ② 播放即缓存:学过的词回头复习/重听零延迟
 * ③ IndexedDB 持久化:最近 400 条翻译音频存磁盘,重启软件后依然命中(隔天复习零延迟)
 * 退出练习页只清内存,磁盘缓存保留。
 */

const PRELOAD_COUNT = 8 // 预加载当前词后面几个词
const PRELOAD_CONCURRENCY = 3 // 并行合成上限(Edge TTS 是主进程连接,避免并发风暴)
const PERSIST_KEY = 'tts-trans-cache' // IndexedDB 键(idb-keyval)
const PERSIST_MAX = 400 // 持久化条数上限(每条约 20-40KB,约 10MB)
const PERSIST_DEBOUNCE = 1000 // 防抖:1 秒内多次写入合并为一次

/** word -> data URL(有道发音,主进程代理下载) */
const wordAudioCache = new Map<string, string>()
/** 释义文本(+音色/语速/时间) -> Edge TTS data URL */
const transAudioCache = new Map<string, { src: string; voice?: string; speed?: number; ts: number }>()
const transGenerating = new Set<string>()
let persistTimer: any = null
let persistLoaded = false

export function getCachedWordAudio(word: string): string | null {
  return wordAudioCache.get(word) ?? null
}

/** 命中缓存且音色/语速一致才返回(设置变更后自动失效,重新合成) */
export function getCachedTransAudio(text: string, voice?: string, speed?: number): string | null {
  // 兼容 v0.3.7 前的旧缓存:当时多释义用句号「。」连接,现用顿号「、」。
  // 新 key 未命中时查旧 key,避免升级后历史 400 条缓存全部浪费、首轮全部重新合成
  const candidates = text ? [text, text.replace(/、/g, '。')] : []
  for (const key of candidates) {
    const item = transAudioCache.get(key)
    if (!item) continue
    if (item.voice !== (voice ?? 'zh-CN-XiaoxiaoNeural')) continue
    if (Math.abs((item.speed ?? 1) - (speed ?? 1)) > 0.01) continue
    return item.src
  }
  return null
}

/** 内存缓存 → 待持久化列表(按时间倒序保留最新 PERSIST_MAX 条) */
function snapshotPersistList() {
  return Array.from(transAudioCache.entries())
    .map(([text, v]) => ({ text, src: v.src, voice: v.voice, speed: v.speed, ts: v.ts }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, PERSIST_MAX)
}

/** 把内存缓存异步写入 IndexedDB(防抖,保留最新 PERSIST_MAX 条) */
function schedulePersist() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const list = snapshotPersistList()
    if (list.length) set(PERSIST_KEY, list).catch(() => {})
  }, PERSIST_DEBOUNCE)
}

/**
 * 从 IndexedDB 恢复最近合成的翻译音频(隔天复习/重新进入练习页零延迟)。
 * 应用启动时调用一次(force=false);练习页 onMounted 每次进入都调用(force=true,
 * 因为退出练习页会清内存,必须重新从磁盘恢复)。
 */
export async function ensurePersistedCacheLoaded(force = false) {
  if (persistLoaded && !force) return
  persistLoaded = true
  try {
    const list = (await get(PERSIST_KEY)) as { text: string; src: string; voice?: string; speed?: number; ts: number }[] | undefined
    if (!Array.isArray(list)) return
    for (const item of list) {
      if (item?.text && item?.src && !transAudioCache.has(item.text)) {
        transAudioCache.set(item.text, { src: item.src, voice: item.voice, speed: item.speed, ts: item.ts ?? 0 })
      }
    }
  } catch {
    // IndexedDB 不可用时静默(缓存只是加速,非必需)
  }
}

/** 立即把内存缓存写入磁盘(不依赖防抖,退出/清缓存前调用) */
function flushPersistNow() {
  clearTimeout(persistTimer)
  persistTimer = null
  const list = snapshotPersistList()
  if (list.length) set(PERSIST_KEY, list).catch(() => {})
}

/** 播放/预加载后写入缓存(播放即缓存),并异步持久化到磁盘 */
export function cacheTransAudio(text: string, src: string, voice?: string, speed?: number) {
  if (!text || !src) return
  transAudioCache.set(text, { src, voice, speed, ts: Date.now() })
  schedulePersist()
}

/** 退出练习页:先把内存缓存刷入磁盘(防抖可能未触发,避免丢数据),再清内存 */
export function clearTtsCaches() {
  flushPersistNow()
  wordAudioCache.clear()
  transAudioCache.clear()
  transGenerating.clear()
  prefetchQueue.length = 0 // 丢弃待执行的预加载任务,避免残留合成写回已清缓存
}

/** 清空全部语音缓存(内存 + IndexedDB 持久化),下次播放重新合成(数据管理-清空语音缓存) */
export async function clearAllTtsCaches() {
  clearTtsCaches()
  try {
    await del(PERSIST_KEY)
  } catch {
    // 忽略:清理失败不影响主功能
  }
}

/**
 * 预下载单词发音(主进程代理下载有道在线音频 → data URL 缓存;绕开 CORS)。
 * 练习页滑窗预加载 + 播放未命中时的后台补缓存都用它。
 */
export async function prefetchWordAudio(word: string, soundType: string) {
  if (!word || wordAudioCache.has(word)) return
  try {
    const type = soundType === 'uk' ? 1 : 2
    const fetchAudio = (window as any).desktop?.fetchWordAudio
    if (typeof fetchAudio !== 'function') return
    const src = await fetchAudio(word, type)
    if (src && !wordAudioCache.has(word)) {
      wordAudioCache.set(word, src)
    }
  } catch {
    // 静默:断网/失败跳过,播放时走在线
  }
}

/** 预合成一段文本(Edge TTS 在线 → data URL 缓存;翻译/例句共用,缓存 key = 文本 + 音色/语速) */
async function prefetchEdgeTts(text: string, voice: string, speed: number) {
  if (!text || transAudioCache.has(text) || transGenerating.has(text)) return
  transGenerating.add(text)
  try {
    const speak = (window as any).desktop?.speakText
    if (typeof speak !== 'function') return
    const src = await speak(text, { lengthScale: speed, voice })
    if (src && !transAudioCache.has(text)) {
      transAudioCache.set(text, { src, voice, speed, ts: Date.now() })
      schedulePersist()
    }
  } catch {
    // 静默
  } finally {
    transGenerating.delete(text)
  }
}

/** 预合成中文翻译(Edge TTS 在线 → data URL 缓存) */
async function prefetchTransAudio(word: Word, voice: string, speed: number) {
  if (!word?.word) return
  // 与播放侧一致:关闭「显示详细翻译」时预加载也合成简化文本(缓存 key 一致)
  const showDetailed = useSettingStore().showDetailedTrans
  const zh = word.trans
    ?.map(t => (showDetailed ? t.cn : simplifyTransCn(t.cn)))
    .filter(Boolean)
    // 顿号连接(与 useWordPracticeAudio/WordDetail/TranslationList 一致,缓存 key 依赖它)
    .join('、')
  if (zh) await prefetchEdgeTts(zh, voice, speed)
}

/**
 * 全局预加载队列(默认 3 并发):
 * 所有 schedulePrefetch 的任务进同一个队列、共享同一池,避免每次切词新建并发池
 * 导致 3×N 路 Edge TTS 同时请求(主进程无限流,微软端会拒绝/超时,合成失败不写缓存)。
 */
const prefetchQueue: (() => Promise<void>)[] = []
let prefetchWorkers: Promise<void>[] | null = null

function enqueuePrefetch(tasks: (() => Promise<void>)[]) {
  if (tasks.length) prefetchQueue.push(...tasks)
  if (prefetchWorkers) return // 池已在跑,任务追加进队列即可
  prefetchWorkers = Array.from({ length: PRELOAD_CONCURRENCY }, async () => {
    while (prefetchQueue.length) {
      const task = prefetchQueue.shift()!
      try {
        await task()
      } catch {}
    }
  })
  Promise.all(prefetchWorkers).then(() => {
    prefetchWorkers = null
    if (prefetchQueue.length) enqueuePrefetch([]) // 收尾竞态:池结束瞬间又有新任务,补启动一轮
  })
}

/**
 * 滑窗预加载:单词发音 + 中文翻译 + 例句语音,在 3 并发池内排队合成。
 * 任务顺序:① 当前词例句最优先(正在看的词,点喇叭零等待) → ② 滑窗词发音/翻译 → ③ 滑窗词例句。
 * 例句与翻译共用 voice 音色、独立 sentenceSpeed 语速;去重由 prefetchEdgeTts 内部处理。
 * 注意:每个任务必须是 await 单条合成的 async 函数,否则并发控制失效(一次同步发出 N 条
 * Edge TTS 请求,主进程无限流,微软端拒绝/超时导致合成失败不写缓存)。
 */
export function schedulePrefetch(
  words: Word[],
  index: number,
  opts: { soundType: string; voice: string; speed: number; sentenceSpeed: number }
) {
  if (!Array.isArray(words) || !words.length) return
  const targets = words.slice(index + 1, index + 1 + PRELOAD_COUNT)
  const tasks: (() => Promise<void>)[] = []
  // ① 当前词例句最优先(学完停留看例句的场景,点击喇叭零等待)
  const current = words[index]
  if (current?.word) {
    for (const s of current.sentences ?? []) {
      if (s?.c) tasks.push(() => prefetchEdgeTts(s.c, opts.voice, opts.sentenceSpeed))
    }
  }
  // ② 滑窗词的发音/翻译(原有逻辑,缓存命中自动跳过)
  for (const w of targets) {
    if (!w?.word) continue
    if (!wordAudioCache.has(w.word)) tasks.push(() => prefetchWordAudio(w.word, opts.soundType))
    const showDetailed = useSettingStore().showDetailedTrans
    const transText = w.trans?.map(t => (showDetailed ? t.cn : simplifyTransCn(t.cn))).join('、') ?? ''
    // has 判断同样兼容旧缓存(句号 key),命中旧缓存就不重复合成
    if (transText && !transAudioCache.has(transText) && !transAudioCache.has(transText.replace(/、/g, '。'))) {
      tasks.push(() => prefetchTransAudio(w, opts.voice, opts.speed))
    }
  }
  // ③ 滑窗词的例句(低优先级,后台慢慢备好;每句一个任务,逐句 await,3 并发内)
  for (const w of targets) {
    if (!w?.word) continue
    for (const s of w.sentences ?? []) {
      if (s?.c) tasks.push(() => prefetchEdgeTts(s.c, opts.voice, opts.sentenceSpeed))
    }
  }
  enqueuePrefetch(tasks)
}
