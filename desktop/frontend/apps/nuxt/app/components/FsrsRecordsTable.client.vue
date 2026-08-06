<script setup lang="ts">
import { getCurrentInstance, type App } from 'vue'
import VxeUITable from 'vxe-table'
import 'vxe-table/lib/style.css'
import dayjs from 'dayjs'
import { State } from 'ts-fsrs'

export interface FsrsRow {
  word: string
  last_review?: string | Date | null
  due?: string | Date | null
  state: number
  stability?: number
  difficulty?: number
  elapsed_days?: number
  scheduled_days?: number
  learning_steps?: number
  reps?: number
  lapses?: number
  [key: string]: unknown
}

defineProps<{
  rows: FsrsRow[]
}>()

// 标记挂在 app 上：模块级变量在 HMR/重载时会丢，但 app 不变，避免重复 use() 导致重复注册
const FSRS_VXE_INSTALLED = '__fsrsVxeTableInstalled' as const

const instance = getCurrentInstance()
if (instance) {
  const app = instance.appContext.app as App & { [FSRS_VXE_INSTALLED]?: boolean }
  if (!app[FSRS_VXE_INSTALLED]) {
    app.use(VxeUITable)
    app[FSRS_VXE_INSTALLED] = true
  }
}

function formatDate(v: string | Date | null | undefined) {
  return v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
}

function getStateName(state: number | undefined): string {
  const stateMap: Record<number, string> = {
    0: '新词',
    1: '学习中',
    2: '复习中',
    3: '重新学',
  }
  return stateMap[state ?? -1] ?? '未知'
}

// 下次复习日期颜色:已到期=红,今天内到期=橙,其余默认
function dueClass(v: string | Date | null | undefined): string {
  if (!v) return ''
  const due = dayjs(v).valueOf()
  const now = Date.now()
  if (due <= now) return 'due-overdue'
  if (due <= dayjs().endOf('day').valueOf()) return 'due-today'
  return ''
}

// 难度颜色:高难度(>=0.5)=红,低难度(<=0.25)=绿
function diffClass(v: number | undefined): string {
  if (v == null) return ''
  if (v >= 0.5) return 'diff-hard'
  if (v <= 0.25) return 'diff-easy'
  return ''
}
</script>

<template>
  <div class="flex-1 overflow-hidden h-full">
    <vxe-table
      round
      border
      show-overflow
      show-header-overflow
      show-footer-overflow
      height="auto"
      :data="rows"
      :row-config="{ keyField: 'word', isHover: true }"
      :virtual-y-config="{ enabled: true, gt: 100 }"
      :sort-config="{
        defaultSort: {
          field: 'due',
          order: 'asc',
        },
      }"
    >
      <vxe-column type="seq" width="60" title="序号" fixed="left" />
      <vxe-column field="word" title="单词" min-width="120" fixed="left" sortable>
        <template #default="{ row }">
          <span class="word-cell">{{ row.word }}</span>
        </template>
      </vxe-column>
      <vxe-column field="last_review" title="最近复习日期" min-width="160" sortable>
        <template #default="{ row }">
          {{ formatDate(row.last_review as string | Date | null | undefined) }}
        </template>
      </vxe-column>
      <vxe-column field="due" title="下次复习日期" min-width="160" sortable>
        <template #default="{ row }">
          <span :class="dueClass(row.due as string | Date | null | undefined)">
            {{ formatDate(row.due as string | Date | null | undefined) }}
          </span>
        </template>
      </vxe-column>
      <vxe-column field="state" title="状态" min-width="100" sortable>
        <template #default="{ row }">
          <span class="state-tag" :class="'state-' + row.state">{{ getStateName(row.state) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="stability" title="记忆稳定性" min-width="100" sortable>
        <template #default="{ row }">
          {{ row.stability != null ? Number(row.stability).toFixed(2) : '-' }}
        </template>
      </vxe-column>
      <vxe-column field="difficulty" title="难度" min-width="80" sortable>
        <template #default="{ row }">
          <span :class="diffClass(row.difficulty)">
            {{ row.difficulty != null ? Number(row.difficulty).toFixed(2) : '-' }}
          </span>
        </template>
      </vxe-column>
      <!--      <vxe-column field="elapsed_days" title="经过天数" min-width="90" sortable/>-->
      <vxe-column field="scheduled_days" title="计划间隔" min-width="90" sortable />
      <!--      <vxe-column field="learning_steps" title="学习步骤" min-width="90" />-->
      <vxe-column field="reps" title="复习次数" min-width="90" sortable />
      <vxe-column field="lapses" title="遗忘次数" min-width="90" sortable />
    </vxe-table>
  </div>
</template>

<style scoped lang="scss">
// 单词列:加粗强调
.word-cell {
  font-weight: 600;
  color: var(--color-main-text);
}

// 状态列:彩色胶囊标签(新词=灰/学习中=蓝/复习中=绿/重新学=红)
.state-tag {
  display: inline-block;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.5;
}

.state-0 {
  background: color-mix(in srgb, var(--color-muted) 15%, transparent);
  color: var(--color-muted);
}

.state-1 {
  background: color-mix(in srgb, var(--color-info) 15%, transparent);
  color: var(--color-info);
}

.state-2 {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.state-3 {
  background: color-mix(in srgb, var(--color-error) 15%, transparent);
  color: var(--color-error);
}

// 下次复习日期:已到期=红加粗,今天内到期=橙
.due-overdue {
  color: var(--color-error);
  font-weight: 600;
}

.due-today {
  color: var(--color-warning);
}

// 难度:高=红,低=绿
.diff-hard {
  color: var(--color-error);
}

.diff-easy {
  color: var(--color-success);
}

// vxe-table 自带浅色主题(style.css),用 CSS 变量覆盖成应用主题色,跟随深色模式
:deep(.vxe-table) {
  --vxe-ui-layout-background-color: var(--color-card-bg);
  --vxe-ui-font-color: var(--color-main-text);
  --vxe-ui-font-primary-color: var(--color-main-text);
  --vxe-ui-font-tinge-color: var(--color-sub-text);
  --vxe-ui-table-header-background-color: var(--bg-card-secend);
  --vxe-ui-table-header-font-color: var(--color-main-text);
  --vxe-ui-table-border-color: var(--color-item-border);
  --vxe-ui-table-row-hover-background-color: var(--color-third);
  --vxe-ui-table-row-current-background-color: var(--color-fifth);
  --vxe-ui-table-row-striped-background-color: var(--color-third);
  --vxe-ui-table-footer-background-color: var(--bg-card-secend);
  --vxe-ui-table-column-hover-background-color: var(--color-third);
  --vxe-ui-base-hover-background-color: var(--color-third);
  --vxe-ui-input-background-color: var(--color-third);
  --vxe-ui-input-border-color: var(--color-item-border);
  --vxe-ui-input-placeholder-color: var(--color-sub-text);
}
</style>
