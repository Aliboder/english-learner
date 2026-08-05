<script setup lang="ts">
import { BaseButton, BasePage, Textarea, Toast, UploadButton } from '@english-learner/base'
import { ENV, LIB_JS_URL } from '@english-learner/core/config/env.ts'
import { useBaseStore } from '@english-learner/core/stores/base.ts'
import { useRuntimeStore } from '@english-learner/core/stores/runtime.ts'
import { DictType } from '@english-learner/core/types/enum.ts'
import { getDefaultDict, getDefaultWord } from '@english-learner/core/types/func.ts'
import type { Dict, Word } from '@english-learner/core/types/types.ts'
import { cloneDeep, convertToWord, loadJsLib } from '@english-learner/core/utils'
import saveAs from 'file-saver'
import { nanoid } from 'nanoid'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Header from '@english-learner/core/components/Header.vue'
import EditBook from '@english-learner/core/components/article/EditBook.vue'
import Book from '@english-learner/core/components/Book.vue'
import { MessageBox } from '@english-learner/core/utils/MessageBox.tsx'
import { useI18n } from 'vue-i18n'
import type { FailedWordRow } from '~/components/import/WordFailedTable.vue'

type ImportStep = 1 | 2 | 3
type ImportType = 'word' | 'article'

type ImportMode = 'official' | 'custom'

type ImportResultSummary = {
  successCount: number
  officialCount?: number
  customCount?: number
  importMode?: ImportMode
  skippedCount: number
  failedItems: string[]
  pendingFailedWords?: FailedWordRow[]
  type: ImportType
}

const IMPORT_RESULT_STORAGE_PREFIX = 'import-result-'
const CUSTOM_WORD_TEMPLATE_FILE = 'import-custom-word-template.xlsx'
const CUSTOM_WORD_XLSX_COLUMNS = ['单词', '音标①', '音标②', '翻译', '例句', '短语', '近义词', '同根词', '词源'] as const

const route = useRoute()
const router = useRouter()
const base = useBaseStore()
const runtimeStore = useRuntimeStore()

const step = ref<ImportStep>(1)
const selectedDict = ref<Dict | null>(null)
const pendingDict = ref<Dict | null>(null)
const showCreateForm = ref(false)
const textInput = ref('')
const selectedFile = ref<File | null>(null)
const selectedFileName = ref('')
const selectedCustomFile = ref<File | null>(null)
const selectedCustomFileName = ref('')
const uploading = ref(false)
const importingCustom = ref(false)
const downloadingFailed = ref(false)
const importing = ref(false)
const importSummary = ref<ImportResultSummary | null>(null)
const { t } = useI18n()

const importType = computed(() => 'word' as ImportType)
const source = computed(() => base.word)
const targetLabel = '词典'
const contentLabel = '单词'
const currentTarget = computed(() => selectedDict.value ?? pendingDict.value)
const failedCount = computed(() => importSummary.value?.failedItems.length ?? 0)
const pendingFailedCount = computed(() => importSummary.value?.pendingFailedWords?.length ?? 0)
const hasPendingFailedWords = computed(() => pendingFailedCount.value > 0)
const isCustomImportResult = computed(() => importSummary.value?.importMode === 'custom')
const officialCount = computed(() => {
  if (!importSummary.value) return 0
  if (importSummary.value.importMode === 'custom') return importSummary.value.officialCount ?? 0
  return importSummary.value.officialCount ?? importSummary.value.successCount ?? 0
})
const customCount = computed(() => importSummary.value?.customCount ?? 0)
const retryingFailed = ref(false)
const importingBlank = ref(false)

function importResultStorageKey(targetId: string) {
  return `${IMPORT_RESULT_STORAGE_PREFIX}${targetId}`
}

function saveImportSummary(targetId: string, summary: ImportResultSummary) {
  sessionStorage.setItem(importResultStorageKey(targetId), JSON.stringify(summary))
}

function loadImportSummary(targetId: string): ImportResultSummary | null {
  try {
    const raw = sessionStorage.getItem(importResultStorageKey(targetId))
    if (!raw) return null
    const summary = JSON.parse(raw) as Partial<ImportResultSummary>
    const type = summary.type ?? importType.value
    const pendingFailedWords =
      summary.pendingFailedWords?.map(row => ({
        ...row,
        editing: false,
      })) ??
      (type === 'word' && summary.failedItems?.length
        ? summary.failedItems.map(word => ({
            id: nanoid(6),
            word,
            checked: true,
            editing: false,
          }))
        : undefined)
    const successCount = summary.successCount ?? 0
    const importMode = summary.importMode ?? (type === 'word' ? 'official' : undefined)
    return {
      successCount,
      officialCount: summary.officialCount ?? (importMode === 'custom' ? 0 : successCount),
      customCount: summary.customCount ?? 0,
      importMode,
      skippedCount: summary.skippedCount ?? 0,
      failedItems: pendingFailedWords?.map(row => row.word) ?? summary.failedItems ?? [],
      pendingFailedWords,
      type,
    }
  } catch {
    return null
  }
}

const availableDicts = computed(() => source.value.bookList.filter(item => item.id && (item.custom || item.system)))

const manualWords = computed(() =>
  textInput.value
    .split('\n')
    .map(item => {
      return item.trim().replaceAll(',', '').replaceAll('，', '').replaceAll('"', '')
    })
    .filter(Boolean)
)

const hasManualInput = computed(() => manualWords.value.length > 0)
const hasOfficialFile = computed(() => !!selectedFile.value)
const hasCustomFile = computed(() => !!selectedCustomFile.value)
const officialUploadDisabled = computed(() => hasManualInput.value || hasCustomFile.value)
const customUploadDisabled = computed(() => hasManualInput.value || hasOfficialFile.value)
const manualInputDisabled = computed(() => hasOfficialFile.value || hasCustomFile.value)

function findTargetById(id?: string) {
  if (!id) return null
  return source.value.bookList.find(item => String(item.id) === id || String(item.userDictId ?? '') === id) ?? null
}

function normalizeStep(value: unknown): ImportStep {
  if (value === '3' || value === 3) return 3
  if (value === '2' || value === 2) return 2
  return 1
}

function restoreFromRoute() {
  step.value = normalizeStep(route.query.step)
  let target = findTargetById(route.query.targetId as string)
  const queryTargetId = String(route.query.targetId || '')
  if (!target && queryTargetId && String(runtimeStore.editDict.id) === queryTargetId) {
    target = runtimeStore.editDict
  }
  if (target) {
    selectedDict.value = target
    pendingDict.value = null
    runtimeStore.editDict = getDefaultDict(cloneDeep(target))
  }

  const targetId = String(route.query.targetId || runtimeStore.editDict.id || '')

  if (step.value === 3) {
    if (target && !runtimeStore.editDict.id) {
      runtimeStore.editDict = getDefaultDict(cloneDeep(target))
    }
    const summary = targetId ? loadImportSummary(targetId) : null
    if (summary) {
      importSummary.value = summary
    } else {
      step.value = 2
      router.replace({
        query: {
          ...route.query,
          type: 'word',
          step: '2',
          targetId: targetId || undefined,
        },
      })
      return
    }
  }

  if (step.value > 1 && !currentTarget.value && !runtimeStore.editDict.id) {
    step.value = 1
  }
}

onMounted(restoreFromRoute)
watch(() => route.query, restoreFromRoute)
watch(importType, () => {
  selectedDict.value = null
  pendingDict.value = null
  showCreateForm.value = false
  textInput.value = ''
  selectedFile.value = null
  selectedFileName.value = ''
  selectedCustomFile.value = null
  selectedCustomFileName.value = ''
  importSummary.value = null
  if (!route.query.step) step.value = 1
})

function selectTarget(dict: Dict) {
  selectedDict.value = dict
  pendingDict.value = null
}

function handleDraftSubmit(dict?: Dict) {
  if (!dict) return
  pendingDict.value = getDefaultDict({
    ...dict,
    id: dict.id || `pending-word-${nanoid(8)}`,
    custom: true,
    type: DictType.word,
  })
  selectedDict.value = null
  showCreateForm.value = false
}

function goStep2() {
  if (!currentTarget.value) return Toast.warning('请先选择或创建一个' + targetLabel.value)
  step.value = 2
  router.replace({ query: { ...route.query, type: 'word', step: '2' } })
}

function upsertTarget(dict: Dict) {
  const normalized = getDefaultDict(dict)
  const list = source.value.bookList
  const index = list.findIndex(item => String(item.id) === String(normalized.id))
  if (index > -1) {
    list[index] = normalized
  } else {
    list.push(normalized)
  }
  selectedDict.value = normalized
  pendingDict.value = null
  runtimeStore.editDict = cloneDeep(normalized)
  return normalized
}

async function persistTarget() {
  const target = currentTarget.value
  if (!target) throw new Error('missing target')
  if (!pendingDict.value) return target

  let dict = getDefaultDict({
    ...target,
    id: '',
    custom: true,
    type: DictType.word,
  })

  dict.id = `custom-word-${nanoid(8)}`

  return upsertTarget(dict)
}

function completeImport(dict: Dict, summary: ImportResultSummary) {
  const saved = upsertTarget(dict)
  importSummary.value = summary
  saveImportSummary(String(saved.id), summary)
  step.value = 3
  router.replace({
    query: {
      ...route.query,
      type: importType.value,
      step: '3',
      targetId: String(saved.id),
    },
  })
}

function goToDetail() {
  if (!runtimeStore.editDict.id) return Toast.warning('请先完成导入')
  router.push('/dict')
}

function createFailedWordRows(words: string[]): FailedWordRow[] {
  return words.map(word => ({
    id: nanoid(6),
    word,
    checked: true,
    editing: false,
  }))
}

function updateImportSummary(patch: Partial<ImportResultSummary>) {
  if (!importSummary.value) return
  const next = { ...importSummary.value, ...patch }
  if (patch.pendingFailedWords !== undefined) {
    next.failedItems = patch.pendingFailedWords.map(row => row.word)
  }
  importSummary.value = next
  const targetId = String(runtimeStore.editDict.id || route.query.targetId || '')
  if (targetId) saveImportSummary(targetId, next)
}

function onPendingFailedWordsUpdate(rows: FailedWordRow[]) {
  updateImportSummary({ pendingFailedWords: rows })
}

function getCheckedFailedRows(): FailedWordRow[] {
  return importSummary.value?.pendingFailedWords?.filter(row => row.checked) ?? []
}

function downloadFailedTxt() {
  const items = importSummary.value?.failedItems ?? []
  if (!items.length) return
  const content = items.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const name = runtimeStore.editDict.name || currentTarget.value?.name || '导入'
  saveAs(blob, '导入失败' + '-' + name + '.txt')
}

function createEmptyCustomWordRow(word: string) {
  return CUSTOM_WORD_XLSX_COLUMNS.reduce(
    (row, column) => {
      row[column] = column === '单词' ? word : ''
      return row
    },
    {} as Record<(typeof CUSTOM_WORD_XLSX_COLUMNS)[number], string>
  )
}

async function downloadFailedXlsx() {
  const words = importSummary.value?.pendingFailedWords?.map(row => row.word) ?? []
  if (!words.length) return

  downloadingFailed.value = true
  try {
    const XLSX = await loadJsLib('XLSX', LIB_JS_URL.XLSX)
    const sheetData = words.map(word => createEmptyCustomWordRow(word))
    const wb = XLSX.utils.book_new()
    wb.Sheets.Sheet1 = XLSX.utils.json_to_sheet(sheetData)
    wb.SheetNames = ['Sheet1']
    const name = runtimeStore.editDict.name || currentTarget.value?.name || '导入'
    XLSX.writeFile(wb, '未收录单词' + '-' + name + '.xlsx')
  } catch {
    Toast.error('下载失败，请稍后重试')
  } finally {
    downloadingFailed.value = false
  }
}

function goBackToStep2() {
  step.value = 2
  router.replace({
    query: {
      ...route.query,
      type: importType.value,
      step: '2',
      targetId: String(runtimeStore.editDict.id || route.query.targetId || '') || undefined,
    },
  })
}

async function downloadWordTemplate(filename: string) {
  try {
    const res = await fetch(`${ENV.LIBS_URL}${filename}`)
    if (!res.ok) throw new Error('下载失败')
    const blob = await res.blob()
    saveAs(blob, filename)
  } catch {
    Toast.error('模板下载失败，请稍后重试')
  }
}

function readFileAsBinary(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(String(e.target?.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsBinaryString(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(String(e.target?.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file)
  })
}

function dedupeWords(words: string[]) {
  const seen = new Set<string>()
  const unique: string[] = []
  words.forEach(word => {
    const key = word.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    unique.push(word)
  })
  return unique
}

function parseTxtWordContent(content: string) {
  return content
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

function parseJsonWordContent(content: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('JSON 解析失败')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('JSON 格式错误：顶层必须是数组')
  }

  const words: string[] = []
  parsed.forEach(item => {
    if (typeof item === 'string') {
      const word = item.trim()
      if (word) words.push(word)
      return
    }
    if (item && typeof item === 'object' && 'word' in item) {
      const word = String((item as { word: unknown }).word).trim()
      if (word) words.push(word)
    }
  })
  return words
}

function getFileExt(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

async function parseWordFile(file: File): Promise<string[]> {
  const ext = getFileExt(file)

  if (ext === 'txt') {
    const content = await readFileAsText(file)
    return dedupeWords(parseTxtWordContent(content))
  }

  if (ext === 'json') {
    const content = await readFileAsText(file)
    return dedupeWords(parseJsonWordContent(content))
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await loadJsLib('XLSX', LIB_JS_URL.XLSX)
    const data = await readFileAsBinary(file)
    const workbook = XLSX.read(data, { type: 'binary' })
    const sheetName = workbook.SheetNames[0]
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
    const words = rows.map(row => String(row['单词'] ?? row.word ?? '').trim()).filter(Boolean)
    return dedupeWords(words)
  }

  throw new Error('不支持的文件格式「' + ext + '」，请使用 .txt / .json / .xlsx')
}

function getWordRowField(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const val = row[key]
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim()
    }
  }
  return ''
}

function parseCustomWordRow(row: Record<string, unknown>): Word | null {
  const word = getWordRowField(row, '单词', 'word')
  if (!word) return null

  try {
    const parsed = convertToWord({
      id: nanoid(6),
      word,
      phonetic0: row['音标①'] ?? row.phonetic0 ?? '',
      phonetic1: row['音标②'] ?? row.phonetic1 ?? '',
      trans: row['翻译'] ?? row.trans ?? '',
      sentences: row['例句'] ?? row.sentences ?? '',
      phrases: row['短语'] ?? row.phrases ?? '',
      synos: row['近义词'] ?? row.synos ?? '',
      relWords: row['同根词'] ?? row.relWords ?? '',
      etymology: row['词源'] ?? row.etymology ?? '',
    })
    const noteVal = getWordRowField(row, '笔记', 'note')
    if (noteVal) {
      base.noteData[word] = noteVal
    }
    return parsed
  } catch (error: any) {
    console.error('导入单词报错' + word, error?.message)
    return null
  }
}

async function parseCustomXlsxWordFile(file: File): Promise<Word[]> {
  const ext = getFileExt(file)
  if (ext !== 'xlsx' && ext !== 'xls') {
    throw new Error('不支持的文件格式「' + ext + '」，请使用 .xlsx')
  }

  const XLSX = await loadJsLib('XLSX', LIB_JS_URL.XLSX)
  const data = await readFileAsBinary(file)
  const workbook = XLSX.read(data, { type: 'binary' })
  const sheetName = workbook.SheetNames[0]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

  const words: Word[] = []
  const seen = new Set<string>()
  rows.forEach(row => {
    const parsed = parseCustomWordRow(row)
    if (!parsed?.word) return
    const key = parsed.word.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    words.push(parsed)
  })
  return words
}

function mergeCustomWords(target: Dict, customWords: Word[]): { next: Dict; summary: ImportResultSummary } | null {
  const next = cloneDeep(target)
  const existsSet = new Set(next.words.map(w => w.word))
  let customCountAdded = 0
  let skippedCount = 0

  customWords.forEach(word => {
    if (existsSet.has(word.word)) {
      skippedCount++
      return
    }
    next.words.push(word)
    existsSet.add(word.word)
    customCountAdded++
  })

  if (!customCountAdded) {
    Toast.warning('所有单词已存在于词典中，无需重复导入')
    return null
  }

  next.length = next.words.length
  return {
    next,
    summary: {
      successCount: customCountAdded,
      officialCount: 0,
      customCount: customCountAdded,
      importMode: 'custom',
      skippedCount,
      failedItems: [],
      type: 'word',
    },
  }
}
</script>

<template>
  <BasePage>
    <div class="card import-page w-full">
      <Header :title="'导入单词'" />
      <div class="stepper" aria-label="导入步骤">
        <div class="step-item" :class="{ active: step >= 1 }">
          <span>1</span>
          <strong>{{ '选择词典' }}</strong>
        </div>
        <div class="step-rail" :class="{ active: step >= 2 }" />
        <div class="step-item" :class="{ active: step >= 2 }">
          <span>2</span>
          <strong>{{ '导入单词' }}</strong>
        </div>
        <div class="step-rail" :class="{ active: step >= 3 }" />
        <div class="step-item" :class="{ active: step >= 3 }">
          <span>3</span>
          <strong>{{ '导入结果' }}</strong>
        </div>
      </div>

      <main class="main-panel">
        <section v-if="step === 1" class="workflow-section">
          <div class="section-heading">
            <div class="section-title">{{ '选择导入位置' }}</div>
            <BaseButton v-if="!showCreateForm" type="info" @click="showCreateForm = true">
              {{ '新建词典' }}
            </BaseButton>
          </div>

          <ul class="rule-list">
            <li>
              <IconFluentCheckmarkCircle20Regular />
              {{ '仅可导入内置词典、自定义词典' }}
            </li>
            <li>
              <IconFluentCheckmarkCircle20Regular />
              {{ '官方词典不可直接导入，您可创建副本后再导入' }}
            </li>
          </ul>

          <div
            v-if="showCreateForm"
            class="border border-[var(--color-input-border)] rounded-md p-4 bg-[var(--color-card-bg)]"
          >
            <EditBook
              :is-add="true"
              submit-mode="draft"
              fluid
              @submit="handleDraftSubmit"
              @close="showCreateForm = false"
            />
          </div>

          <div class="section-title">{{ '词典列表' }}</div>
          <div v-if="availableDicts.length" class="flex gap-4 flex-wrap">
            <Book
              v-for="dict in availableDicts"
              :key="dict.id"
              :is-add="false"
              :item="dict"
              :quantifier="'单词'"
              :show-progress="false"
              :selected="currentTarget?.id === dict.id"
              @click="selectTarget(dict)"
            />
          </div>
          <div v-else class="empty-state">
            <IconFluentBook20Regular />
            <strong>{{ '还没有可导入的词典' }}</strong>
            <span>{{ '新建一个词典后继续。' }}</span>
          </div>

          <template v-if="pendingDict">
            <div class="section-title">{{ '新建待导入词典' }}</div>
            <div class="flex gap-4 flex-wrap">
              <Book
                :is-add="false"
                :item="pendingDict"
                :quantifier="'词'"
                :show-progress="false"
                :selected="true"
              />
            </div>
          </template>

          <div class="actions-row">
            <BaseButton type="primary" size="large" :disabled="!currentTarget" @click="goStep2">
              {{ '下一步：导入单词' }}
            </BaseButton>
          </div>
        </section>

        <section v-else-if="step === 2" class="workflow-section">
          <div class="section-heading">
            <div class="section-title">{{ '导入到：' }}{{ currentTarget?.name }}</div>
          </div>

          <div class="input-split">
            <!-- 左列：上传文件（固定） -->
            <div class="method-panel primary-method">
              <div class="method-title">
                <IconFluentArrowUpload20Regular />
                <span>{{ '上传文件' }}</span>
              </div>
              <div
                class="official-upload-block"
                :class="{ 'import-block--disabled': officialUploadDisabled }"
              >
                <div class="my-2">{{ '支持导入' }} .txt / .json / .xlsx {{ '格式文件' }}</div>
                <div class="my-2 font-bold text-red">{{ '下载模板文件，按照固定格式填写后上传' }}</div>
                <div class="my-2 font-bold text-red">{{ '暂不支持导入 PDF 文件，您可让 AI 帮您制作导入所需格式的文件' }}</div>
                <div class="flex gap-3 flex-col mb-4">
                  <div>
                    <a href="#" @click.prevent="downloadWordTemplate(`import-word-template.txt`)">{{ '下载' }} txt {{ '模板' }}</a>
                  </div>
                  <div>
                    <a href="#" @click.prevent="downloadWordTemplate(`import-word-template.json`)">{{ '下载' }} json {{ '模板' }}</a>
                  </div>
                  <div>
                    <a href="#" @click.prevent="downloadWordTemplate(`import-word-template.xlsx`)">{{ '下载' }} xlsx {{ '模板' }}</a>
                  </div>
                </div>
                <div class="flex items-center gap-3 flex-wrap">
                  <UploadButton
                    accept=".txt,.json,.xlsx,.xls"
                    :loading="uploading"
                    :disabled="officialUploadDisabled"
                    @change="selectFile"
                  >
                    选择文件
                  </UploadButton>
                  <span class="color-gray text-sm" v-if="selectedFileName">{{ selectedFileName }}</span>
                </div>
              </div>

              <div class="custom-import-panel" :class="{ 'import-block--disabled': customUploadDisabled }">
                <div class="text-lg mt-2">{{ '导入自定义单词' }}</div>
                <div class="my-2 color-gray text-sm">
                  {{ '下载模板，填写翻译、音标、例句等字段后上传' }}
                </div>
                <div class="flex gap-3 flex-col mb-4">
                  <div>
                    <a href="#" @click.prevent="downloadWordTemplate(CUSTOM_WORD_TEMPLATE_FILE)">下载 xlsx 模板</a>
                  </div>
                </div>
                <div class="flex items-center gap-3 flex-wrap">
                  <UploadButton
                    accept=".xlsx,.xls"
                    :loading="importingCustom"
                    :disabled="customUploadDisabled"
                    @change="selectCustomFile"
                  >
                    选择文件
                  </UploadButton>
                  <span class="color-gray text-sm" v-if="selectedCustomFileName">{{ selectedCustomFileName }}</span>
                </div>
              </div>
            </div>

            <span>{{ '或' }}</span>
            <!-- 右列：手动输入 -->
            <div class="method-panel" :class="{ 'method-panel--disabled': manualInputDisabled }">
              <div class="method-title">
                <IconFluentTextAlignLeft16Regular />
                <span>{{ '手动输入' }}</span>
              </div>
              <Textarea
                class="my-2"
                v-model="textInput"
                :disabled="manualInputDisabled"
                :placeholder="'一行一个单词，例如：' + '\napple,\nbanana\ncherry\n' + '行尾带不带逗号都可以'"
                :autosize="{ minRows: 20, maxRows: 20 }"
              />
              <div class="method-footer">
                <span>{{ '已输入' }} {{ manualWords.length }} / 5000 {{ '个单词' }}</span>
              </div>
            </div>
          </div>

          <div class="actions-row step2-actions">
            <BaseButton type="info" size="large" @click="step = 1">{{ '返回上一步' }}</BaseButton>
            <BaseButton
              type="primary"
              size="large"
              :loading="importing || uploading || importingCustom"
              :disabled="!hasManualInput && !hasOfficialFile && !hasCustomFile"
              @click="submitWordImport"
            >
              {{ '提交' }}
            </BaseButton>
          </div>
        </section>

        <section v-else-if="step === 3 && importSummary" class="workflow-section">
          <div class="section-heading">
            <div class="section-title">导入结果</div>
          </div>

          <div class="status-strip mb-4">
            <div class="flex items-center gap-2">
              <IconFluentCheckmarkCircle20Regular />
              <span>{{ '导入完成' }}</span>
            </div>
            <div class="ml-10">
              <template v-if="isCustomImportResult">
                <li>{{ '自定义单词 ' + customCount + ' 个（已导入到' + targetLabel + '中）' }}</li>
              </template>
              <template v-else>
                <li>{{ '官方单词 ' + officialCount + ' 个（已导入到' + targetLabel + '中）' }}</li>
              </template>
              <li v-if="importSummary.skippedCount">
                {{ '跳过 ' + importSummary.skippedCount + ' 个（' + targetLabel + '中已存在）' }}
              </li>
              <li v-if="hasPendingFailedWords">
                <div>{{ pendingFailedCount + ' 个未收录（尚未导入）' }}</div>
                <ul class="mt-1 pl-4">
                  <li>
                    {{ '可在下方表格修改后再次导入' }}
                  </li>
                  <li>
                    {{ '可点击“下载失败列表”按钮 ，填写翻译后，返回上一步通过「导入自定义单词」上传' }}
                  </li>
                </ul>
              </li>
            </div>
          </div>

          <div v-if="hasPendingFailedWords" class="result-panel">
            <WordFailedTable :rows="importSummary.pendingFailedWords!" @update:rows="onPendingFailedWordsUpdate" />
          </div>

          <div class="actions-row step2-actions">
            <BaseButton type="info" size="large" @click="goBackToStep2">返回上一步</BaseButton>
            <div class="flex flex-wrap justify-end">
              <template v-if="hasPendingFailedWords">
                <BaseButton type="info" size="large" :loading="downloadingFailed" @click="downloadFailedXlsx">
                  下载失败列表
                </BaseButton>
                <BaseButton type="info" size="large" :loading="retryingFailed" @click="retryFailedImport">
                  再次导入
                </BaseButton>
                <BaseButton type="info" size="large" @click="abandonFailedImport">{{ '放弃导入' }}</BaseButton>
                <BaseButton type="primary" size="large" :loading="importingBlank" @click="importBlankFailedWords">
                  {{ '直接导入空白单词' }}
                </BaseButton>
              </template>
              <template v-else>
                <BaseButton type="primary" size="large" @click="goToDetail">{{ '查看详情' }}</BaseButton>
              </template>
            </div>
          </div>
        </section>
      </main>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.import-page {
  min-height: calc(100vh - 1.2rem);
}

.eyebrow {
  color: var(--color-select-bg);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.stepper {
  align-items: center;
  display: flex;
  justify-content: space-around;
  flex-shrink: 0;
  gap: 0.45rem;
}

.step-item {
  align-items: center;
  color: var(--color-font-3);
  display: flex;
  gap: 0.45rem;
  min-height: 2.75rem;

  span {
    align-items: center;
    background: var(--color-input-bg);
    border: 1px solid var(--color-input-border);
    border-radius: 999px;
    display: inline-flex;
    font-size: 0.85rem;
    font-weight: 800;
    height: 2rem;
    justify-content: center;
    width: 2rem;
  }

  strong {
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
  }

  &.active {
    color: var(--color-font-1);

    span {
      background: var(--color-select-bg);
      border-color: var(--color-select-bg);
      color: var(--color-font-active-1);
    }
  }
}

.step-rail {
  background: var(--color-input-border);
  height: 1px;
  width: 100%;

  &.active {
    background: var(--color-select-bg);
  }
}

.main-panel {
  border-radius: 0.75rem;
}

.target-summary {
  align-items: flex-start;
  display: flex;
  gap: 0.7rem;

  svg {
    color: var(--color-select-bg);
    flex: 0 0 auto;
    font-size: 1.35rem;
    margin-top: 0.1rem;
  }

  strong,
  span {
    display: block;
  }

  strong {
    color: var(--color-font-1);
    font-weight: 750;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--color-font-3);
    font-size: 0.86rem;
    line-height: 1.5;
    margin-top: 0.2rem;
  }
}

.rule-list {
  color: var(--color-font-2);
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    align-items: flex-start;
    display: flex;
    gap: 0.55rem;
    line-height: 1.5;
  }

  svg {
    color: var(--color-select-bg);
    flex: 0 0 auto;
    margin-top: 0.18rem;
  }
}

.main-panel {
  min-width: 0;
  padding: 1.25rem;
}

.workflow-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-heading {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;

  p {
    color: var(--color-font-3);
    line-height: 1.5;
    margin: 0.25rem 0 0;
  }
}

.section-title {
  color: var(--color-font-1);
  font-size: 1.2rem;
  font-weight: 750;
}

.create-panel,
.status-strip,
.method-panel {
  border: 1px solid var(--color-input-border);
  border-radius: 0.65rem;
}

.custom-import-panel {
  border-top: 1px solid var(--color-input-border);
  margin-top: 1rem;
  padding-top: 1rem;
}

.method-panel--disabled,
.import-block--disabled {
  opacity: 0.55;
  pointer-events: none;
  user-select: none;
}

.create-panel {
  background: var(--color-input-bg);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem;

  label {
    color: var(--color-font-1);
    font-size: 0.9rem;
    font-weight: 700;
  }
}

.create-row {
  align-items: center;
  display: flex;
  gap: 0.7rem;
}

.create-input {
  background: var(--color-card-bg);
  border: 1px solid var(--color-input-border);
  border-radius: 0.5rem;
  color: var(--color-input-color);
  flex: 1;
  min-height: 2.75rem;
  min-width: 12rem;
  outline: none;
  padding: 0 0.85rem;

  &:focus {
    border-color: var(--color-select-bg);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-select-bg) 18%, transparent);
  }
}

.form-error {
  color: var(--color-error);
  font-size: 0.85rem;
}

.helper-text {
  color: var(--color-font-3);
  font-size: 0.85rem;
}

.status-strip {
  align-items: center;
  background: color-mix(in srgb, var(--color-select-bg) 9%, var(--color-card-bg));
  color: var(--color-font-1);
  gap: 0.55rem;
  padding: 0.8rem 0.95rem;
}

.target-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
}

.target-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-input-border);
  border-radius: 0.65rem;
  color: var(--color-font-1);
  cursor: pointer;
  min-height: 7rem;
  min-width: 0;
  padding: 1rem;
  position: relative;
  text-align: left;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;

  strong,
  span {
    display: block;
  }

  strong {
    font-size: 1rem;
    line-height: 1.35;
    margin-top: 0.55rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span:last-of-type {
    color: var(--color-font-3);
    font-size: 0.85rem;
    margin-top: 0.35rem;
  }

  &:hover {
    border-color: var(--color-select-bg);
    transform: translateY(-1px);
  }

  &.selected {
    border-color: var(--color-select-bg);
    box-shadow: inset 0 0 0 1px var(--color-select-bg);
  }
}

.target-type {
  color: var(--color-select-bg);
  font-size: 0.78rem;
  font-weight: 800;
}

.selected-icon {
  color: var(--color-select-bg);
  font-size: 1.25rem;
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
}

.step2-actions {
  justify-content: space-between;
}

.input-split {
  display: grid;
  gap: 1rem;
  align-items: center;
  grid-template-columns: minmax(17rem, 0.75fr) auto minmax(0, 1.25fr);
}

.method-panel {
  height: 100%;
  box-sizing: border-box;
  background: var(--color-input-bg);
  display: flex;
  flex-direction: column;
  min-height: 14rem;
  padding: 1rem;

  p,
  label,
  span {
    color: var(--color-font-3);
    line-height: 1.6;
  }

  label {
    font-size: 0.88rem;
    font-weight: 700;
    margin-top: 0.85rem;
  }
}

.primary-method {
  background: var(--color-card-bg);
}

.method-title {
  align-items: center;
  color: var(--color-font-1);
  display: flex;
  font-weight: 750;
  gap: 0.55rem;

  svg {
    color: var(--color-select-bg);
    font-size: 1.25rem;
  }
}

.method-footer {
  align-items: center;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: auto;
}

.result-stats {
  color: var(--color-font-2);
  display: flex;
  flex-wrap: wrap;
  font-size: 0.9rem;
  gap: 1rem;
}

.result-panel {
  border: 1px solid var(--color-input-border);
  border-radius: 0.65rem;
  max-height: 20rem;
  overflow: auto;
  padding: 0.85rem 1rem;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;

  li {
    border-bottom: 1px solid var(--color-input-border);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding-bottom: 0.65rem;

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }
}

@media (max-width: 1180px) {
  .import-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 900px) {
  .import-layout,
  .input-split {
    grid-template-columns: 1fr;
  }

  .context-panel {
    position: static;
  }
}

@media (max-width: 640px) {
  .import-header,
  .main-panel,
  .context-panel {
    border-radius: 0.5rem;
    padding: 0.85rem;
  }

  .stepper {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }

  .step-rail {
    display: none;
  }

  .section-heading,
  .create-row,
  .method-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .target-grid {
    grid-template-columns: 1fr;
  }
}
</style>
