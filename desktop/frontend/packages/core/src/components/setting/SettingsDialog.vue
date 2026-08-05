<script setup lang="ts">
import { defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { getDefaultSettingState, useSettingStore } from '../../stores/setting'
import { getShortcutKey, useEventListener } from '../../hooks/event'
import {
  checkAndUpgradeSaveDict,
  checkAndUpgradeSaveSetting,
  cloneDeep,
  isEmpty,
  loadJsLib,
} from '../../utils'
import { BaseButton, Collapse, PopConfirm, Switch, Toast, UploadButton } from '@english-learner/base'
import { getDefaultBaseState, useBaseStore } from '../../stores/base'
import {
  APP_NAME,
  APP_VERSION,
  BACKUP_INDEX_KEY,
  DefaultShortcutKeyMap,
  LIB_JS_URL,
  LOCAL_FILE_KEY,
} from '../../config/env'
import { get, set } from 'idb-keyval'
import { useRuntimeStore } from '../../stores/runtime'
import { useExport } from '../../hooks/export'
import Log from './Log.vue'
import About from '../About.vue'
import CommonSetting from './CommonSetting.vue'
import FsrsSetting from './FsrsSetting.vue'
import WordSetting from './WordSetting.vue'
import SoundSetting from './SoundSetting.vue'
import { PRACTICE_ARTICLE_CACHE, PRACTICE_WORD_CACHE } from '../../utils/cache'
import { useDataSyncPersistence } from '../../composables/useDataSyncPersistence'
import SettingItem from './SettingItem.vue'
import { clearAllTtsCaches } from '../../hooks/preloadTts'
import type { BackupData, Snapshot } from '../../types'

const Dialog = defineAsyncComponent(() => import('@english-learner/base/Dialog'))

type HistoryBackupIndexItem = {
  hash: string
  key: string
  createdAt: number
}

type HistoryBackupMeta = HistoryBackupIndexItem & {
  previousHash?: string | null
}

const show = defineModel<boolean>({ default: false })
const { t } = useI18n()

function open() {
  show.value = true
}
defineExpose({ open })

const tabIndex = $ref(0)
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const store = useBaseStore()
const dataSyncPersistence = useDataSyncPersistence()

let editShortcutKey = $ref('')

const disabledDefaultKeyboardEvent = $computed(() => {
  return editShortcutKey && tabIndex === 5
})

// 监听编辑快捷键状态变化，自动聚焦输入框
watch(
  () => editShortcutKey,
  newVal => {
    if (newVal) {
      // 使用nextTick确保DOM已更新
      nextTick(() => {
        focusShortcutInput()
      })
    }
  }
)

useEventListener('keydown', (e: KeyboardEvent) => {
  if (!disabledDefaultKeyboardEvent) return

  // 确保阻止浏览器默认行为
  e.preventDefault()
  e.stopPropagation()

  let shortcutKey = getShortcutKey(e)

  if (editShortcutKey) {
    if (shortcutKey === 'Delete') {
      settingStore.shortcutKeyMap[editShortcutKey] = ''
    } else {
      // 忽略单独的修饰键
      if (
        shortcutKey === 'Ctrl+' ||
        shortcutKey === 'Alt+' ||
        shortcutKey === 'Shift+' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Shift'
      ) {
        return
      }

      for (const [k, v] of Object.entries(settingStore.shortcutKeyMap)) {
        if (v === shortcutKey && k !== editShortcutKey) {
          settingStore.shortcutKeyMap[editShortcutKey] = DefaultShortcutKeyMap[editShortcutKey]
          return Toast.warning('快捷键重复！')
        }
      }
      settingStore.shortcutKeyMap[editShortcutKey] = shortcutKey
    }
  }
})

function handleInputBlur() {
  // 输入框失焦时结束编辑状态
  editShortcutKey = ''
}

function focusShortcutInput() {
  // 找到当前正在编辑的快捷键输入框
  const inputElements = document.querySelectorAll('.set-key input')
  if (inputElements && inputElements.length > 0) {
    // 聚焦第一个找到的输入框
    const inputElement = inputElements[0] as HTMLInputElement
    inputElement.focus()
  }
}

// 快捷键中文名称映射
function getShortcutKeyName(key: string): string {
  const shortcutKeyNameMap: Record<string, string> = {
    ShowWord: '显示单词',
    Next: '下一个',
    Previous: '上一个',
    Ignore: '跳过单词',
    ToggleSimple: '切换已掌握状态',
    ToggleCollect: '切换收藏状态',
    NextChapter: '下一组',
    NextStep: '下一阶段',
    RepeatChapter: '重复本组',
    DictationChapter: '默写本组',
    PlayWordPronunciation: '播放发音',
    ToggleShowTranslate: '切换显示翻译',
    ToggleDictation: '切换默写模式',
    ToggleTheme: '切换主题',
    ToggleConciseMode: '切换底部工具栏和右侧列表',
    ToggleToolbar: '切换底部工具栏',
    TogglePanel: '切换右侧列表',
    RandomWrite: '随机默写',
    KnowWord: '认识单词',
    UnknownWord: '不认识单词',
    MasteredWord: '已掌握单词',
    ChooseA: '选A',
    ChooseB: '选B',
    ChooseC: '选C',
    ChooseD: '选D',
  }

  return shortcutKeyNameMap[key] || key
}

function resetShortcutKeyMap() {
  editShortcutKey = ''
  settingStore.shortcutKeyMap = cloneDeep(DefaultShortcutKeyMap)
  Toast.success('恢复成功')
}

let importLoading = $ref(false)

// 自动备份文件列表(文档/EnglishLearner备份,由主进程读取)
let autoBackupList = $ref<{ name: string; mtime: number }[]>([])

async function loadAutoBackups() {
  autoBackupList = (await (window as any).desktop?.listAutoBackups?.()) ?? []
}

function formatBackupTime(mtime: number) {
  return new Date(mtime).toLocaleString()
}

/** 恢复某份自动备份:读取内容 → 走与手动导入相同的 importJson 全链路 */
async function restoreAutoBackup(name: string) {
  const content = await (window as any).desktop?.readAutoBackup?.(name)
  if (!content) return Toast.error('读取备份失败')
  await importJson(content)
  Toast.success('恢复成功')
}

const { loading: exportLoading, exportData } = useExport()

async function importJson(str: string) {
  importLoading = true
  let obj: BackupData = {
    version: -1,
    val: {
      setting: {},
      dict: {},
      [PRACTICE_WORD_CACHE.key]: null,
      [PRACTICE_ARTICLE_CACHE.key]: null,
      // @deprecated 大版本5废弃
      [APP_VERSION.key]: null,
    },
  }
  try {
    obj = JSON.parse(str)
    let data = obj.val
    data.dict.val = await checkAndUpgradeSaveDict(data.dict)
    data.setting.val = await checkAndUpgradeSaveSetting(data.setting)
    //老版本兼容逻辑
    if (obj.version === 4) {
      if (!isEmpty(data?.[APP_VERSION.key])) {
        data.setting.val.webAppVersion = data?.[APP_VERSION.key]
      }
    }
    runtimeStore.globalLoading = true
    await dataSyncPersistence.forcePushLocalDataToRemote(data)
    runtimeStore.globalLoading = false
    Toast.success('导入成功！')
    runtimeStore.isNew = APP_VERSION.version > Number(data.setting?.val?.webAppVersion ?? APP_VERSION.version)
    data.setting.val.load = true
    settingStore.setState(data.setting.val)
    data.dict.val.load = true
    store.setState(data.dict.val)
  } catch (err) {
    return Toast.error('导入失败！')
  } finally {
    importLoading = false
  }
}

async function importData(e) {
  importLoading = true
  let file = e.target.files[0]
  if (!file) return (importLoading = false)
  if (file.name.endsWith('.json')) {
    let reader = new FileReader()
    reader.onload = function (v) {
      let str: any = v.target.result
      if (str) {
        importJson(str)
      }
    }
    reader.readAsText(file)
  } else if (file.name.endsWith('.zip')) {
    try {
      const JSZip = await loadJsLib('JSZip', LIB_JS_URL.JSZIP)
      const zip = await JSZip.loadAsync(file)

      const dataFile = zip.file('data.json')
      if (!dataFile) {
        return Toast.error('缺少 data.json，导入失败')
      }

      const mp3Folder = zip.folder('mp3')
      if (mp3Folder) {
        const records: { id: string; file: Blob }[] = []
        for (const filename in zip.files) {
          if (filename.startsWith('mp3/') && filename.endsWith('.mp3')) {
            const entry = zip.file(filename)
            if (!entry) continue
            const blob = await entry.async('blob')
            const id = filename.replace(/^mp3\//, '').replace(/\.mp3$/, '')
            records.push({ id, file: blob })
          }
        }
        await set(LOCAL_FILE_KEY, records)
      }

      const str = await dataFile.async('string')
      await importJson(str)
    } catch (e) {
      Toast.error(e?.message || e || '导入失败！')
    } finally {
      importLoading = false
    }
  } else {
    Toast.error('不支持的文件类型')
  }
  importLoading = false
}

let showHistoryDialog = $ref(false)
let historyBackups = $ref<HistoryBackupMeta[]>([])
let restoreTarget = $ref<HistoryBackupMeta | null>(null)
let restoreLoading = $ref(false)

function openHistoryRestoreGate(item: HistoryBackupMeta) {
  restoreTarget = item
  restoreHistoryData()
}

async function openHistoryDialog() {
  const raw = (await get(BACKUP_INDEX_KEY)) as HistoryBackupIndexItem[] | undefined
  const index = Array.isArray(raw)
    ? raw.filter(item => item && typeof item.hash === 'string' && typeof item.key === 'string')
    : []
  const items: HistoryBackupMeta[] = []
  for (const item of index) {
    const snapshot = (await get(item.key)) as { meta?: { previousHash?: string | null } } | undefined
    items.push({
      ...item,
      previousHash: snapshot?.meta?.previousHash ?? null,
    })
  }
  historyBackups = items.sort((a, b) => b.createdAt - a.createdAt)
  showHistoryDialog = true
}

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

async function restoreHistoryData() {
  if (!restoreTarget) return
  if (restoreLoading) return
  restoreLoading = true
  try {
    const { data: val }: Snapshot = await get(restoreTarget.key)
    let data: BackupData['val'] = {
      setting: JSON.parse(val.setting),
      dict: JSON.parse(val.dict),
      [PRACTICE_WORD_CACHE.key]: JSON.parse(val[PRACTICE_WORD_CACHE.key]),
      [PRACTICE_ARTICLE_CACHE.key]: JSON.parse(val[PRACTICE_ARTICLE_CACHE.key]),
    }
    data.dict.val = await checkAndUpgradeSaveDict(data.dict)
    data.setting.val = await checkAndUpgradeSaveSetting(data.setting)

    runtimeStore.globalLoading = true
    await dataSyncPersistence.forcePushLocalDataToRemote(data)
    runtimeStore.globalLoading = false
    Toast.success('恢复成功！')
    runtimeStore.isNew = APP_VERSION.version > Number(data.setting?.val?.webAppVersion ?? APP_VERSION.version)
    data.setting.val.load = true
    settingStore.setState(data.setting.val)
    data.dict.val.load = true
    store.setState(data.dict.val)
    showHistoryDialog = false
  } catch (error) {
    Toast.error('恢复失败：' + ((error as Error)?.message ?? String(error)))
  } finally {
    restoreLoading = false
  }
}

async function clearAllData() {
  await dataSyncPersistence.clear()
  Toast.success('清除成功')
}

// 清空语音缓存(内存 + IndexedDB 持久化):缓存异常或想释放空间时使用,不动学习数据
async function clearTtsCache() {
  await clearAllTtsCaches()
  Toast.success('语音缓存已清空,下次播放重新合成')
}

// 日志:打开日志目录 / 复制日志内容(帮助-FAQ 底部)
function openLogDir() {
  ;(window as any).desktop?.openLogDir?.()
}

async function copyLog() {
  const text = await (window as any).desktop?.readLog?.()
  if (!text) {
    Toast.info('暂无日志')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    Toast.success('日志已复制,可直接粘贴发给开发者')
  } catch {
    Toast.error('复制失败,请使用「打开日志目录」')
  }
}
</script>

<template>
  <Dialog v-model="show" padding title="设置" :width="'min(92vw, 1080px)'" :height="'min(88vh, 720px)'">
    <div class="setting text-md flex flex-col" style="height: 100%">
      <div class="flex flex-1 overflow-hidden gap-4">
        <div class="left">
          <div class="tabs">
            <div class="tab" :class="tabIndex === 0 && 'active'" @click="tabIndex = 0">
              <IconFluentSettings20Regular />
              <span>{{ '通用设置' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 1 && 'active'" @click="tabIndex = 1">
              <IconFluentBot20Regular />
              <span>{{ '遗忘曲线设置' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 2 && 'active'" @click="tabIndex = 2">
              <IconFluentTextUnderlineDouble20Regular />
              <span>{{ '单词设置' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 3 && 'active'" @click="tabIndex = 3">
              <IconClarityVolumeUpLine />
              <span>{{ '音效设置' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 4 && 'active'" @click="tabIndex = 4">
              <IconFluentDatabasePerson20Regular />
              <span>{{ '数据管理' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 5 && 'active'" @click="tabIndex = 5">
              <IconFluentKeyboardLayoutFloat20Regular />
              <span>{{ '快捷键设置' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 6 && 'active'" @click="tabIndex = 6">
              <IconFluentTextBulletListSquare20Regular />
              <span>{{ '更新日志' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 7 && 'active'" @click="tabIndex = 7">
              <IconFluentQuestionCircle20Regular />
              <span>{{ '帮助' }}</span>
            </div>
            <div class="tab" :class="tabIndex === 8 && 'active'" @click="tabIndex = 8">
              <IconFluentPerson20Regular />
              <span>{{ '关于' }}</span>
            </div>
          </div>
        </div>
        <div class="col-line"></div>
        <div class="flex-1 overflow-y-auto overflow-x-hidden pr-4 content">
          <CommonSetting v-if="tabIndex === 0" />
          <FsrsSetting v-if="tabIndex === 1" />
          <WordSetting v-if="tabIndex === 2" />
          <SoundSetting v-if="tabIndex === 3" />

          <div v-if="tabIndex === 4">
            <!--            退出自动备份-->
            <SettingItem title="退出时自动备份" desc="每次退出应用自动保存一份备份到「文档/EnglishLearner备份」目录，自动保留最近 7 份">
              <Switch v-model="settingStore.autoBackup" />
            </SettingItem>

            <!--            自动备份文件列表(一键恢复)-->
            <SettingItem title="自动备份文件" desc="选择一份备份即可一键恢复全部学习数据">
              <BaseButton size="small" type="info" @click="loadAutoBackups">{{ '刷新' }}</BaseButton>
            </SettingItem>
            <div v-if="autoBackupList.length" class="flex flex-col gap-2 mb-3">
              <div
                v-for="item in autoBackupList"
                :key="item.name"
                class="flex justify-between items-center gap-2 rounded-md border px-3 py-2"
                style="border-color: var(--color-item-border)"
              >
                <span class="text-sm truncate" :title="item.name">{{ item.name }}</span>
                <span class="text-xs text-gray shrink-0">{{ formatBackupTime(item.mtime) }}</span>
                <PopConfirm title="恢复将覆盖当前所有数据，确定恢复这份备份？" @confirm="restoreAutoBackup(item.name)">
                  <BaseButton size="small" type="primary">{{ '恢复' }}</BaseButton>
                </PopConfirm>
              </div>
            </div>
            <div v-else class="text-sm text-gray mb-3">{{ '暂无自动备份文件，点击「刷新」查看' }}</div>
            <div class="line my-3"></div>

            <!--            导出数据-->
            <SettingItem
              title="导出数据"
              :desc="'所有用户数据保存在本地浏览器中。如果您需要在不同的设备、浏览器上使用 ' + APP_NAME + '，您需要手动进行数据导出和导入'"
            >
              <BaseButton size="large"  :loading="exportLoading" @click="exportData()">{{ '导出数据备份(ZIP)' }}</BaseButton>
            </SettingItem>
            <div class="text-gray text-sm">💾 {{ '导出的ZIP文件包含所有学习数据，可在其他设备上导入恢复' }}</div>
            <div class="line my-3"></div>

            <!--            导入数据-->
            <SettingItem title="导入数据">
              <UploadButton
                @change="importData"
                :loading="importLoading"
                accept="application/json,.zip,application/zip"
              >
                {{ '导入数据恢复' }}
              </UploadButton>
            </SettingItem>
            <i18n-t keypath="import_overwrite_warning" tag="span">
              <strong class="color-red">{{ '完全覆盖' }}</strong>
            </i18n-t>

            <div class="line my-3"></div>
            <SettingItem title="其他"> </SettingItem>
            <div class="flex gap-space flex-wrap">
              <BaseButton size="large"  @click="openHistoryDialog">{{ '历史数据' }}</BaseButton>
              <PopConfirm title="将清除已缓存的单词发音与翻译朗读(下次播放时重新合成),不影响学习数据。确定清空?" @confirm="clearTtsCache">
                <BaseButton size="large">{{ '清空语音缓存' }}</BaseButton>
              </PopConfirm>
              <PopConfirm title="该操作将会清除所有数据，确认继续？" @confirm="clearAllData">
                <BaseButton size="large" >{{ '清除所有数据' }}</BaseButton>
              </PopConfirm>
            </div>
          </div>

          <div class="body" v-if="tabIndex === 5">
            <div class="row">
              <label class="main-title">{{ '功能' }}</label>
              <div class="wrapper">{{ '快捷键(点击可修改)' }}</div>
            </div>
            <div class="scroll">
              <div class="row" v-for="item of Object.entries(settingStore.shortcutKeyMap)">
                <label class="item-title">{{ getShortcutKeyName(item[0]) }}</label>
                <div class="wrapper" @click="editShortcutKey = item[0]">
                  <div class="set-key" v-if="editShortcutKey === item[0]">
                    <input
                      ref="shortcutInput"
                      :value="item[1] ? item[1] : '未设置快捷键'"
                      readonly
                      type="text"
                      @blur="handleInputBlur"
                    />
                    <span @click.stop="editShortcutKey = ''"
                      >{{ '按下新快捷键' }}，<span class="text-red!">{{ '完成后点击此处' }}</span></span
                    >
                  </div>
                  <div v-else>
                    <div v-if="item[1]">{{ item[1] }}</div>
                    <span v-else>{{ '未设置快捷键' }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="row">
              <label class="item-title"></label>
              <div class="wrapper">
                <BaseButton size="large"  @click="resetShortcutKeyMap">{{ '恢复默认' }}</BaseButton>
              </div>
            </div>
          </div>

          <!--          日志-->
          <Log v-if="tabIndex === 6" />

          <!--          帮助(常见问题)-->
          <div v-if="tabIndex === 7">
            <div class="font-bold text-2xl mb-6">{{ '常见问题解答' }}</div>
            <div class="list">
              <Collapse q="学习数据保存在哪里？">
                <div class="text">
                  所有数据保存在本机（%APPDATA%\EnglishLearner），卸载 / 覆盖安装都不会丢失。软件完全本地运行，不需要联网登录。
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="怎么备份数据 / 换电脑？">
                <div class="text">
                  {{ '打开「数据管理」→ 点击「导出数据备份」保存一份 zip 文件；换电脑或重装后，在新电脑上打开「数据管理」→「导入数据」选择备份文件即可恢复全部学习进度。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="怎么更新到新版本？">
                <div class="text">
                  {{ '直接运行新版安装包覆盖安装即可，学习数据自动保留，不需要先卸载旧版本。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="单词没有发音？">
                <div class="text">
                  {{ '单词发音和中文翻译朗读都使用在线接口（需联网），断网时暂无发音。可以在「音效设置」中调整发音语速和翻译音色。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="词库怎么添加？">
                <div class="text">
                  {{ '软件内置 17 个词库（四六级、考研、专四专八、雅思、托福、高考、新概念、IT 词汇等 15 个常用词库，外加无道词典、ECDICT 英汉词典），开箱即用、无需联网，查词共覆盖 84.8 万词；也可以在「导入」页导入自定义词库。少部分冷门词库首次打开需要联网下载。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="自动备份在哪里？怎么恢复？">
                <div class="text">
                  {{ '开启「退出时自动备份」后，每次关闭软件会自动保存一份备份到「文档/EnglishLearner备份」目录（保留最近 7 份）。恢复：打开「数据管理」→「自动备份」区域选择备份一键恢复，或手动导入备份文件。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="怎么查单词？">
                <div class="text">
                  {{ '主界面顶部有「查词」栏：输入字母实时匹配（覆盖全部内置词库，离线可用），点击结果查看完整释义、发音，还能一键收藏到生词本。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="打字时键盘没反应？">
                <div class="text">
                  {{ '通常是输入法或按键拦截软件（如微信、输入法等热键）占用导致。切换为英文输入法，或关闭相关软件的热键即可。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="学习进度是怎么安排的？">
                <div class="text">
                  {{ '采用 FSRS 记忆曲线自动安排新词和复习：新词按每日数量学习，学过的单词按记忆规律到期复习，答错的单词自动进入错词本强化练习。' }}
                </div>
              </Collapse>

              <div class="line"></div>

              <Collapse q="遇到问题怎么排查？（日志）">
                <div class="text">
                  {{ '软件会自动记录运行日志（含错误、崩溃、关键操作）。遇到问题（崩溃 / 卡顿 / 功能异常）时，打开日志目录，把 app.log 文件发给开发者即可快速定位。' }}
                </div>
                <div class="flex gap-3 mt-3">
                  <BaseButton type="info" size="small" @click="openLogDir">{{ '打开日志目录' }}</BaseButton>
                  <BaseButton type="info" size="small" @click="copyLog">{{ '复制日志内容' }}</BaseButton>
                </div>
              </Collapse>
            </div>
          </div>

          <!--          关于(含反馈信息)-->
          <div v-if="tabIndex === 8" class="center flex-col">
            <About />
          </div>
        </div>
      </div>
    </div>
  </Dialog>

  <Dialog v-model="showHistoryDialog" title="历史数据">
    <div class="p-4 w-120 max-h-100 overflow-auto">
      <div v-if="!historyBackups.length" class="color-gray">{{ '暂无历史数据' }}</div>
      <div v-else class="flex flex-col gap-3">
        <div>{{ '这里是每次 ' + APP_NAME + ' 更新后/报错后自动保存的用户数据，如果您的数据被损坏，您可在此尝试恢复' }}</div>
        <div v-for="(item, i) in historyBackups" :key="item.key" class="border rounded-md flex justify-between">
          <div>
            <div class="">{{ i + 1 }}{{ '. 版本号：' }}{{ item.hash }}</div>
            <div class="color-gray">{{ '自动备份时间：' }}{{ formatHistoryTime(item.createdAt) }}</div>
          </div>
          <div class="mt-2">
            <BaseButton size="large"  @click="openHistoryRestoreGate(item)" :disabled="restoreLoading">{{ '恢复此版本' }}</BaseButton>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.col-line {
  border-right: 2px solid var(--color-line);
}

.setting {
  width: 100%;

  .left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;

    .tabs {
      padding: 0.6rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      .tab {
        @apply cursor-pointer flex items-center relative;
        border-radius: 0.5rem;
        @apply w-auto p-1 lg:w-40 lg:p-2;
        gap: 0.6rem;
        transition: all 0.5s;

        svg {
          @apply text-lg shrink-0;
        }

        &:hover {
          background: var(--color-fourth);
        }

        &.active {
          background: var(--color-fourth);
        }
      }
    }
  }

  .content {
    .row {
      min-height: 2.6rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: calc(var(--space) * 5);
      flex-wrap: wrap;

      .item-title {
        flex-shrink: 0;
        min-width: 8rem;
      }

      .wrapper {
        height: 2rem;
        flex: 1;
        min-width: 0;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space);

        span {
          text-align: right;
          color: gray;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .set-key {
          display: flex;
          align-items: center;
          flex: 1;
          justify-content: flex-end;
          min-width: 0;

          input {
            flex: 1;
            min-width: 0;
            max-width: 16rem;
            box-sizing: border-box;
            margin-right: 0.6rem;
            height: 1.8rem;
            outline: none;
            font-size: 1rem;
            border: 1px solid gray;
            border-radius: 0.2rem;
            padding: 0 0.3rem;
            background: var(--color-second);
            color: var(--color-font-1);
          }
        }
      }

      .main-title {
        font-size: 1.1rem;
        font-weight: bold;
      }

      .item-title {
        font-size: 1rem;
      }

      .sub-title {
        font-size: 0.9rem;
      }
    }

    .body {
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .scroll {
      flex: 1;
      padding-right: 0.6rem;
      overflow: auto;
    }

    .line {
      border-bottom: 1px solid var(--color-line);
    }
  }
}
</style>