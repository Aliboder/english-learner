import { checkAndUpgradeSaveDict, checkAndUpgradeSaveSetting } from '../utils'
import {
  getPracticeArticleCacheLocal,
  getPracticeArticleCacheLocalWithMeta,
  getPracticeWordCacheLocal,
  getPracticeWordCacheLocalWithMeta,
  PRACTICE_ARTICLE_CACHE,
  PRACTICE_WORD_CACHE,
  type PracticeArticleCache,
  type PracticeWordCacheStored,
  setPracticeArticleCacheLocal,
  setPracticeWordCacheLocal,
} from '../utils/cache'
import {
  APP_VERSION,
  BACKUP_INDEX_KEY,
  BACKUP_KEY,
  SAVE_DICT_KEY,
  SAVE_SETTING_KEY,
  WEBSITE_VERSION_HASH,
} from '../config/env'
import { type BaseState, getDefaultBaseState, getDefaultSettingState, useBaseStore, useSettingStore } from '../stores'
import { BackupData, SaveData, Snapshot } from '../types'
import { SyncDataType } from '../types/enum'
import { del, get, set } from 'idb-keyval'

type LocalPersistMeta = {
  updated_at?: string
  version?: number
}

function getDataVersion(type: SyncDataType): number {
  switch (type) {
    case SyncDataType.dict:
      return SAVE_DICT_KEY.version
    case SyncDataType.setting:
      return SAVE_SETTING_KEY.version
    case SyncDataType.practice_word:
      return PRACTICE_WORD_CACHE.version
    case SyncDataType.practice_article:
      return PRACTICE_ARTICLE_CACHE.version
  }
}

function getPersistKey(type: SyncDataType): string {
  return type === SyncDataType.dict ? SAVE_DICT_KEY.key : SAVE_SETTING_KEY.key
}

async function getLocalPersistMeta(type: SyncDataType): Promise<LocalPersistMeta | null> {
  if (type === SyncDataType.practice_word) {
    return await getPracticeWordCacheLocalWithMeta()
  }
  if (type === SyncDataType.practice_article) {
    return await getPracticeArticleCacheLocalWithMeta()
  }
  const raw = await get(getPersistKey(type))
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function persistLocalState(type: SyncDataType, val: unknown, updated_at?: string): Promise<void> {
  // console.log('persistLocalState',type,updated_at)
  if (type === SyncDataType.practice_word) {
    await setPracticeWordCacheLocal(val as PracticeWordCacheStored, updated_at)
    return
  }
  if (type === SyncDataType.practice_article) {
    await setPracticeArticleCacheLocal(val as PracticeArticleCache, updated_at)
    return
  }
  let payload = val
  if (type === SyncDataType.dict) {
    // 词库 words 冗余且可能巨大(ECDICT 84 万词),全量序列化会同步阻塞主线程(结算页"一直结算中")。
    // 非自定义词典的 words 保存时清空,加载时按 url 重新获取(init 已有该逻辑);自定义词典(用户编辑)保留。
    const state = val as BaseState
    payload = {
      ...state,
      word: {
        ...state.word,
        bookList: state.word.bookList.map(b => (b.custom ? b : { ...b, words: [] })),
      },
    }
  }
  await set(
    getPersistKey(type),
    JSON.stringify({
      val: payload,
      version: getDataVersion(type),
      updated_at,
    })
  )
}

type HashBackupIndexItem = {
  hash: string
  key: string
  createdAt: number
}

function normalizeHash(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  return v.length > 0 ? v : null
}

export async function ensureHashGuardBeforeInit() {
  //@ts-ignore
  const runtimeConfig = useRuntimeConfig()

  try {
    const currentHash = normalizeHash(runtimeConfig?.public?.latestCommitHash)
    if (!currentHash) return

    const localHash = normalizeHash(await get(WEBSITE_VERSION_HASH))
    let res = true
    if (localHash !== currentHash) {
      res = await saveHashSnapshot(localHash ?? currentHash, '')
    }
    res && (await set(WEBSITE_VERSION_HASH, currentHash))
  } catch (e) {
    console.warn('init hash guard failed', e)
  }
}

export async function saveHashSnapshot(currentHash: string, previousHash: string | null): Promise<boolean> {
  const backupKey = `${BACKUP_KEY}${currentHash}`
  const createdAt = Date.now()

  const snapshot: Snapshot = {
    meta: {
      currentHash,
      previousHash,
      createdAt,
    },
    data: {
      dict: await get(SAVE_DICT_KEY.key),
      setting: await get(SAVE_SETTING_KEY.key),
      [PRACTICE_WORD_CACHE.key]: (await get(PRACTICE_WORD_CACHE.key)) ?? null,
      [PRACTICE_ARTICLE_CACHE.key]: (await get(PRACTICE_ARTICLE_CACHE.key)) ?? null,
    },
  }
  if (!snapshot.data.dict) {
    return false
  }
  await set(backupKey, snapshot)

  const rawIndex = (await get(BACKUP_INDEX_KEY)) as HashBackupIndexItem[] | undefined
  const index = Array.isArray(rawIndex)
    ? rawIndex.filter(item => item && typeof item.hash === 'string' && typeof item.key === 'string')
    : []

  let rIndex = index.findIndex(item => item.hash === currentHash)
  if (rIndex === -1) {
    index.push({ hash: currentHash, key: backupKey, createdAt })
  } else {
    index[rIndex] = { hash: currentHash, key: backupKey, createdAt }
  }

  if (index.length > 15) {
    index.sort((a, b) => a.createdAt - b.createdAt)
    const removed = index.splice(0, index.length - 10)
    for (const item of removed) {
      await del(item.key)
    }
  }
  await set(BACKUP_INDEX_KEY, index)
  return true
}

export function useDataSyncPersistence() {
  const store = useBaseStore()
  const settingStore = useSettingStore()

  // 桌面版无云端，远程拉取恒返回 null(本地数据永远为最新)
  async function pullIfRemoteNewer(type: SyncDataType): Promise<null> {
    return null
  }

  // 保存到本地 IndexedDB(桌面版无云端同步)
  async function saveLocalAndSync(type: SyncDataType, data: unknown, options?: any) {
    await persistLocalState(type, data, new Date().toISOString())
  }

  async function saveDictState(state: BaseState = store.$state, options?: any) {
    await saveLocalAndSync(SyncDataType.dict, state, options)
  }

  // 导入/恢复历史数据:整体写入本地,返回成功
  async function forcePushLocalDataToRemote(data: BackupData['val']): Promise<boolean> {
    const updated_at = new Date().toISOString()
    await persistLocalState(SyncDataType.dict, data.dict.val, updated_at)
    await persistLocalState(SyncDataType.setting, data.setting.val, updated_at)
    //@ts-ignore
    await persistLocalState(SyncDataType.practice_word, data?.[PRACTICE_WORD_CACHE.key]?.val ?? null, updated_at)
    //@ts-ignore
    await persistLocalState(SyncDataType.practice_article, data?.[PRACTICE_ARTICLE_CACHE.key]?.val ?? null, updated_at)
    return true
  }

  async function getLocalCompactDataByType(type: SyncDataType) {
    if (type === SyncDataType.practice_word) return await getPracticeWordCacheLocal()
    if (type === SyncDataType.practice_article) return await getPracticeArticleCacheLocal()
    if (type === SyncDataType.dict) return store.$state
    if (type === SyncDataType.setting) return settingStore.$state
  }

  async function clear() {
    let d = getDefaultBaseState()
    d.load = true
    let d1 = getDefaultSettingState()
    d1.load = true
    let data: any = {
      dict: { val: d },
      setting: { val: d1 },
      [PRACTICE_WORD_CACHE.key]: null,
      [PRACTICE_ARTICLE_CACHE.key]: null,
      // @deprecated 大版本5废弃
      [APP_VERSION.key]: null,
    }
    store.setState(d)
    settingStore.setState(d1)
    return await forcePushLocalDataToRemote(data)
  }

  return {
    pullIfRemoteNewer,
    saveLocalAndSync,
    saveDictState,
    forcePushLocalDataToRemote,
    getLocalCompactDataByType,
    clear,
  }
}
