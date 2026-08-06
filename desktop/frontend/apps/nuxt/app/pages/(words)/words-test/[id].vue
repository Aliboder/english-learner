<script setup lang="ts">
import { onMounted } from 'vue'
import { BaseButton, BasePage, Toast, VolumeIcon } from '@english-learner/base'
import { useRoute, useRouter } from 'vue-router'
import { useBaseStore } from '@english-learner/core/stores/base.ts'
import type { Dict, Question, TaskWords, Word } from '@english-learner/core/types/types.ts'
import { _getDictDataByUrl, shuffle, useNav } from '@english-learner/core/utils'
import { useRuntimeStore } from '@english-learner/core/stores/runtime.ts'
import { usePlayBeep, usePlayCorrect, usePlayWordAudio } from '@english-learner/core/hooks/sound.ts'
import { useEvents } from '@english-learner/core/utils/eventBus'
import { useStartKeyboardEventListener } from '@english-learner/core/hooks/event.ts'
import { ShortcutKey } from '@english-learner/core/types/enum'
import { useSettingStore } from '@english-learner/core/stores/setting.ts'
import { buildQuestion } from '@english-learner/core/utils/word-test'
import TranslationList from '@english-learner/core/components/word/TranslationList.vue'
import SettingDialog from '@english-learner/core/components/setting/SettingDialog.vue'

const route = useRoute()
const router = useRouter()
const base = useBaseStore()
const runtimeStore = useRuntimeStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playWordAudio = usePlayWordAudio()

let loading = $ref(false)
let dict = $ref<Dict>()
let questions = $ref<Question[]>([])
let index = $ref(0)
let pageNo = $ref(0)
let pageSize = $ref(100)
let allWords = []
let testWords = []
let total = $computed(() => {
  return (pageNo + 1) * pageSize
})
let no = $computed(() => {
  return pageNo * pageSize + index + 1
})

async function init() {
  let dictId: any = route.params.id
  let d = base.word.bookList.find(v => v.id === dictId)
  if (!d) d = base.sdict
  if (!d?.id) return router.push('/words')
  dict = d
  if (!d.words.length && runtimeStore.editDict?.id === d.id) {
    loading = true
    let r = await _getDictDataByUrl(runtimeStore.editDict)
    d = r
    loading = false
  }
  if (!dict.words.length) {
    return Toast.warning('没有单词可测试！')
  }
  if (runtimeStore.routeData?.taskWords) {
    let currentStudy: TaskWords = runtimeStore.routeData.taskWords
    if (currentStudy.review.length) {
      testWords = runtimeStore.routeData.taskWords.review
    }
  }
  if (!testWords.length) {
    testWords = shuffle(dict.words)
  }
  allWords = shuffle(dict.words)
  questions = testWords.slice(pageNo * pageSize, (pageNo + 1) * pageSize).map(w => buildQuestion(w, allWords))
  index = 0

  Toast.info('可以按快捷键进行选择,例如按快捷键[' + aShortcutKey + ']选择A', { duration: 3000 })
}

let submitted = $ref(false)
let selectedIndex = $ref(-1)
function select(i: number) {
  let q = questions[index]
  if (!q || submitted) return
  selectedIndex = i
  submitted = true
  if (i === q.correctIndex) {
    playCorrect()
  } else {
    playBeep()
    let temp = q.candidates[q.correctIndex].word.word.toLowerCase()
    if (!base.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
      base.wrong.words.push(q.candidates[q.correctIndex].word)
      base.wrong.length = base.wrong.words.length
    }
  }
}

const { nav } = useNav()

function next() {
  submitted = false
  selectedIndex = -1
  if (no >= testWords.length) {
    nav('/words')
  }
  if (no < total) index++
  else {
    pageNo++
    index = 0
    questions = testWords.slice(pageNo * pageSize, (pageNo + 1) * pageSize).map(w => buildQuestion(w, allWords))
  }
}

function end() {
  router.back()
}

useStartKeyboardEventListener()

useEvents([
  [ShortcutKey.ChooseA, () => select(0)],
  [ShortcutKey.ChooseB, () => select(1)],
  [ShortcutKey.ChooseC, () => select(2)],
  [ShortcutKey.ChooseD, () => select(3)],
  [ShortcutKey.Next, () => next()],
])

const settingStore = useSettingStore()

let aShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseA]
let bShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseB]
let cShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseC]
let dShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseD]

let nextShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.Next]

// ===== 美化:音标 / 进度 / 选项答题状态 =====
// 音标:与练习页一致(soundType 'uk' 显示 phonetic0,否则 phonetic1)
const phonetic = $computed(() => {
  const w = questions[index]?.candidates?.[questions[index]?.correctIndex]?.word
  if (!w) return ''
  return settingStore.soundType === 'uk' ? (w.phonetic0 || '') : (w.phonetic1 || '')
})

const progressPct = $computed(() => {
  const totalN = Math.min(total, testWords.length)
  return totalN > 0 ? Math.min(100, Math.round((no / totalN) * 100)) : 0
})

const optionKeys = [aShortcutKey, bShortcutKey, cShortcutKey, dShortcutKey]

// 答题后选项状态:正确绿 / 误选红 / 其余淡出
function optionClass(i: number) {
  if (!submitted) return ''
  const q = questions[index]
  if (!q) return ''
  if (i === q.correctIndex) return 'is-correct'
  if (i === selectedIndex) return 'is-wrong'
  return 'is-dim'
}

// 页面宽度跟随设置「练习区宽度」(与练习页一致:窄窗口自动收窄)
const pageStyle = $computed(() => ({
  width: `min(${settingStore.practiceAreaWidth}px, calc(100vw - 3rem))`,
}))

onMounted(init)
</script>

<template>
  <BasePage>
    <div class="test-page" :style="pageStyle">
      <!-- 顶部:标题 + 设置按钮 + 计数 + 进度条 -->
      <div class="test-header">
        <div class="flex items-center justify-between">
          <div class="page-title">{{ '测试' }}：{{ dict?.name }}</div>
          <div class="flex items-center gap-3">
            <SettingDialog type="word" label="设置" />
            <div class="q-count">{{ no }} / {{ Math.min(total, testWords.length) }}</div>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
      </div>

      <div v-if="questions.length" class="flex flex-col gap-6">
        <!-- 题目卡片:单词居中 + 发音 + 音标 -->
        <div class="question-card">
          <div class="question-word">
            <span>{{ questions[index].candidates[questions[index].correctIndex].word.word }}</span>
            <VolumeIcon
              :simple="true"
              title="发音"
              :cb="() => playWordAudio(questions[index].candidates[questions[index].correctIndex].word.word)"
            />
          </div>
          <div class="phonetic" v-if="phonetic">/ {{ phonetic }} /</div>
        </div>

        <!-- 选项 2×2 卡片:字母徽章 + 快捷键 + 翻译 + 单词;答后正确绿/误选红/其余淡出 -->
        <div class="options-grid">
          <div
            v-for="(opt, i) in questions[index].candidates"
            :key="i"
            class="option-card"
            :class="optionClass(i)"
            @click="select(i)"
          >
            <div class="option-top">
              <span class="badge">{{ ['A', 'B', 'C', 'D'][i] }}</span>
              <span class="shortcut">{{ optionKeys[i] }}</span>
              <!-- 答案单词:答题后显示在徽章旁,不额外扩展卡片高度 -->
              <span class="opt-word" v-if="submitted">{{ opt.word.word }}</span>
              <span class="mark" v-if="submitted && i === questions[index].correctIndex">✓</span>
              <span class="mark wrong" v-else-if="submitted && i === selectedIndex && i !== questions[index].correctIndex">✗</span>
            </div>
            <!-- show-play=false:测试卡片不显示翻译朗读喇叭(喇叭位置不统一且非必需),排版更干净 -->
            <!-- 字号由设置「测试选项卡字号」控制 -->
            <div class="trans" :style="{ fontSize: settingStore.testTransFontSize + 'px' }">
              <TranslationList :word="opt.word" :show-full="false" :show-play="false"></TranslationList>
            </div>
          </div>
        </div>

        <div class="actions">
          <BaseButton type="primary" size="large" @click="next">{{ '继续测试' }}[{{ nextShortcutKey }}]</BaseButton>
          <BaseButton type="info" size="large" @click="end">{{ '结束' }}</BaseButton>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
// 测试页:宽度由设置「练习区宽度」控制(内联 style),居中,标题/题目/选项三级卡片
.test-page {
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

// 顶部:标题 + 计数 + 进度条
.test-header {
  background: var(--color-third);
  border-radius: 12px;
  padding: 0.9rem 1.25rem;

  .q-count {
    font-size: 0.9rem;
    color: var(--color-sub-text);
  }

  .progress-track {
    height: 4px;
    margin-top: 0.6rem;
    background: var(--color-progress-bar);
    border-radius: 999px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--color-link);
      transition: width 0.3s ease;
    }
  }
}

// 题目卡片:单词居中 + 音标 + 发音
.question-card {
  background: var(--color-third);
  border-radius: 12px;
  padding: 1.75rem 1.25rem;
  text-align: center;

  .question-word {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    font-size: 3rem;
    line-height: 1;
    font-family: var(--en-article-family);
    color: var(--color-font-1);
  }

  .phonetic {
    margin-top: 0.6rem;
    font-size: 1rem;
    color: var(--color-sub-text);
    font-family: var(--word-font-family);
  }
}

// 选项卡片:四行一列竖排(2026-08-06 由 2×2 改),单行宽度充足,长翻译一行放下不换行
.options-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.option-card {
  display: flex;
  flex-direction: column;
  min-height: 40px; // 最窄保底高度,内容多时自适应扩展
  background: var(--color-third);
  border: 2px solid var(--color-line);
  border-radius: 12px;
  padding: 0.55rem 1.1rem; // 上下留白收紧,翻译不贴边
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;

  &:hover {
    border-color: var(--color-link);
    transform: translateY(-2px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  }

  // 答后状态:正确绿、误选红、其余淡出
  &.is-correct {
    border-color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
  }

  &.is-wrong {
    border-color: var(--color-error);
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
  }

  &.is-dim {
    opacity: 0.4;
  }

  .option-top {
    display: flex;
    align-items: center;
    gap: 0.75rem; // 徽章与快捷键间距拉开,避免"A1"误读

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 50%;
      background: var(--color-second);
      border: 1px solid var(--color-line);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-main-text);
      flex-shrink: 0;
    }

    .shortcut {
      font-size: 0.75rem;
      color: var(--color-sub-text);
    }

    .mark {
      margin-left: auto;
      font-size: 1.2rem;
      color: var(--color-success);
      font-weight: 700;

      &.wrong {
        color: var(--color-error);
      }
    }
  }

  // 翻译区:占据卡片中部,行高适中,长翻译不贴边
  .trans {
    flex: 1;
    margin-top: 0.35rem;
    line-height: 1.5;
  }

  // 答案单词(答后显示在徽章旁):inline 小字,不占额外行
  .opt-word {
    font-size: 0.95rem;
    font-weight: 600;
    font-family: var(--en-article-family);
    color: var(--color-font-1);
  }
}

.actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
}
</style>