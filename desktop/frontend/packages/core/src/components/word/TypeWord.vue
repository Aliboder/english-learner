<script setup lang="ts">
import type { Question, Word } from '../../types'
import { getDefaultWord, IdentifyMethod, ShortcutKey, WordPracticeType } from '../../types'
import { useBaseStore, useSettingStore } from '../../stores'
import {
  cancelWordPracticeAudio,
  playEdgeTts,
  resetActiveWordPlayCount,
  usePlayBeep,
  usePlayCorrect,
  usePlayKeyboardAudio,
} from '../../hooks/sound'
import { WordPlayTrigger, useWordPracticeAudio } from '../../composables/useWordPracticeAudio'
import { emitter, EventKey, useEventsByWatch } from '../../utils/eventBus'
import { computed, onMounted, onUnmounted, toRef, watch } from 'vue'
import SentenceHightLightWord from './SentenceHightLightWord.vue'
import ClickableEnglishText from './ClickableEnglishText.vue'
import ClickableWord from './ClickableWord.vue'
import WordLookupPopover from './WordLookupPopover.vue'
import { _nextTick, last, normalizeWord, useNav } from '../../utils'
import { BaseButton, BaseIcon, Textarea, Toast, Tooltip, VolumeIcon } from '@english-learner/base'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '../../hooks/dict.ts'
import { openWordCollectPicker } from '../../hooks/useWordCollectPicker.ts'
import { ref } from 'vue'
import TranslationList from './TranslationList.vue'
import { useOnKeyboardEventListener } from '../../hooks/event.ts'
import { parseInflections } from '../../utils/inflections.ts'
import { buildTransSpeechText } from '../../utils/transSpeech'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question
  /** 上一个/下一个单词:仅用于切词动画方向判断(切下一词向左滑/切上一词向右滑),不再渲染 */
  prevWord?: Word
  nextWord?: Word
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: []
  know: []
  mastered: []
  skip: []
  toggleSimple: []
}>()

let input = $ref('')
let wrong = $ref('')
let showFullWord = $ref(false)
let showWordResult = ref(false)
//错误次数
let wrongTimes = ref(0)
//输入锁定，因为跳转到下一个单词有延时，如果重复在延时期间内重复输入，导致会跳转N次
let inputLock = false
let waitClear = false
let wordRepeatCount = 0
// 记录单词完成的时间戳，用于防止同时按下最后一个字母和空格键时跳过单词
let wordCompletedTime = 0
let jumpTimer: ReturnType<typeof setTimeout> | null = null
let cursor = $ref({
  top: 0,
  left: 0,
})
const settingStore = useSettingStore()
const store = useBaseStore()

const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

const volumeIconRef: any = $ref()

const canSeeSentences = computed(
  () =>
    ![WordPracticeType.Listen, WordPracticeType.Dictation, WordPracticeType.Identify].includes(
      settingStore.wordPracticeType
    ) ||
    showFullWord ||
    showWordResult.value
)

const { highlightedSentenceIndex, playWord, playSentence } = useWordPracticeAudio({
  word: toRef(props, 'word'),
  volumeIconRef: computed(() => volumeIconRef),
})
const typingWordRef = $ref<HTMLDivElement>()
// const volumeTranslateIconRef: any = $ref()

let showAllCandidates = $ref(false)
let editingNote = $ref(false)
let noteInputValue = $ref('')

let displayWord = $computed(() => {
  return props.word.word.slice(input.length + wrong.length)
})
let displaySentence = $computed(() => {
  return props.word.sentences[currentPracticeSentenceIndex].c.slice(input.length + wrong.length)
})

let isSelfAssessment = $computed(() => {
  return (
    settingStore.wordPracticeType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.SelfAssessment
  )
})

let isWordTest = $computed(() => {
  return (
    settingStore.wordPracticeType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.WordTest
  )
})

// 在全局对象中存储当前单词信息，以便其他模块可以访问
function updateCurrentWordInfo() {
  window.__CURRENT_WORD_INFO__ = {
    word: props.word.word,
    input: input,
    inputLock: inputLock,
    containsSpace: props.word.word.includes(' '),
  }
}

watch(
  () => props.word,
  () => resetState(WordPlayTrigger.NewWord)
)

function resetState(trigger: WordPlayTrigger) {
  clearJumpTimer()
  cancelWordPracticeAudio()
  wrong = input = ''
  wordRepeatCount = 0
  showWordResult.value = inputLock = completeSelect = showAllCandidates = false
  editingNote = false
  noteInputValue = ''
  currentPracticeSentenceIndex = -1
  wordCompletedTime = 0
  wrongTimes.value = 0
  resetActiveWordPlayCount(props.word.word)
  if (settingStore.wordSound && settingStore.wordPracticeType !== WordPracticeType.Dictation) {
    playWord(trigger, { resetIcon: trigger === WordPlayTrigger.NewWord })
  }
  updateCurrentWordInfo()
  checkCursorPosition()
}

// 监听输入变化，更新当前单词信息
watch(
  () => input,
  () => {
    updateCurrentWordInfo()
  }
)

function onKeyUp(e: KeyboardEvent) {
  hideWord()
}

function onKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Backspace':
      del()
      break
  }
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

onMounted(() => {
  // 初始化当前单词信息
  updateCurrentWordInfo()

  emitter.on(EventKey.resetWord, onResetWord)
  emitter.on(EventKey.onTyping, onTyping)
})

function onResetWord() {
  resetState(WordPlayTrigger.ResetSameWord)
}

onUnmounted(() => {
  clearJumpTimer()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
})

function clearJumpTimer() {
  if (!jumpTimer) {
    return
  }
  clearTimeout(jumpTimer)
  jumpTimer = null
}

function repeat() {
  setTimeout(() => {
    wrong = input = ''
    wordRepeatCount++
    inputLock = false

    if (settingStore.wordSound) playWord(WordPlayTrigger.RepeatWord)
  }, settingStore.waitTimeForChangeWord)
}

let pressNumber = 0

const right = $computed(() => {
  let a = input
  let b
  if (isTypingSentence()) {
    b = props.word.sentences[currentPracticeSentenceIndex].c
  } else {
    b = props.word.word
  }

  if (settingStore.wordPracticeType === WordPracticeType.Dictation) {
    a = normalizeWord(a)
    b = normalizeWord(b)
  }
  if (settingStore.ignoreCase) {
    return a.toLowerCase() === b.toLowerCase()
  } else {
    return a === b
  }
})

let showNotice = false

function know(e) {
  if (isSelfAssessment) {
    if (!showWordResult.value) {
      inputLock = showWordResult.value = true
      input = props.word.word
      emit('know')
      if (!showNotice) {
        Toast.info('若误选"我认识"，可按删除键重新选择！', { duration: 5000 })
        showNotice = true
      }
      return
    }
  }
  onTyping(e)
}

function mastered(e) {
  if (isSelfAssessment) {
    emit('mastered')
    return
  }
  onTyping(e)
}

function unknown(e) {
  if (isSelfAssessment) {
    if (!showWordResult.value) {
      showWordResult.value = true
      typo()
      if (settingStore.wordSound) playWord(WordPlayTrigger.RevealUnknown)
      return
    }
  }
  onTyping(e)
}

let selectIndex = $ref(-1)
let completeSelect = false
function select(e, index: number) {
  if (completeSelect) return
  if (isWordTest) {
    completeSelect = true
    selectIndex = index
    if (index == props?.question?.correctIndex) {
      input = props.word.word
      playCorrect()
      emit('know')
    } else {
      wrong = props.word.word
      playBeep()
      play()
      emit('wrong')
    }

    if (!showNotice) {
      Toast.info('请按空格键继续', { duration: 5000 })
      showNotice = true
    }
    return
  }
  onTyping(e)
}

let currentPracticeSentenceIndex = $ref(-1)

async function onTyping(e: KeyboardEvent) {
  if (waitClear) {
    return
  }

  if (isWordTest) {
    if (e.code === 'Space') {
      if (completeSelect) {
        completeTypeWord(false)
      } else {
        select(e, -1)
      }
    }
    return
  }

  const target = props.word.word
  const targetVolumeIcon = volumeIconRef
  // 输入完成会锁死不能再输入
  if (inputLock) {
    //判断是否是空格键以便切换到下一个
    if (e.code === 'Space') {
      //正确时就切换到下一个
      if (right) {
        clearJumpTimer()
        // 如果单词刚完成（冷却时间内），忽略空格键，避免同时按下最后一个字母和空格键时跳过
        // 自动模式使用切换等待时间，手动模式使用独立的空格冷却时间设置
        const spaceCooldown = settingStore.autoNextWord
          ? settingStore.waitTimeForChangeWord
          : settingStore.spaceCooldownTime
        if (wordCompletedTime && Date.now() - wordCompletedTime < spaceCooldown) {
          return
        }
        completeTypeWord(false)
        showWordResult.value = inputLock = false
      } else {
        if (showWordResult.value) {
          // 错误时，提示用户按删除键，仅默写需要提示
          pressNumber++
          if (pressNumber >= 3) {
            Toast.info('请按删除键重新输入', { duration: 2000 })
            pressNumber = 0
          }
        }
      }
    } else {
      //当正确时,切换提示已常驻显示在操作按钮上方(next-word-tip),不再弹 Toast 重复提示
      if (!right) {
        //当错误时，按任意键重新输入
        showWordResult.value = inputLock = false
        input = wrong = ''
        onTyping(e)
      }
    }
    return
  }
  inputLock = true
  let letter = e.key
  // console.log('letter',letter)
  // 2026-08-06 默写(Dictation)已与其他形式统一:删除"默写途中不判断、按空格才出答案"的特殊逻辑,
  // 改为逐字母判断、输完自动出答案(完成处理见下方 input === target 分支)
  if (settingStore.wordPracticeType === WordPracticeType.Identify && !showWordResult.value) {
    //当自测模式下，按其他键则自动默认为不认识
    showWordResult.value = true
    typo()
    if (settingStore.wordSound) {
      playWord(WordPlayTrigger.IdentifyWrongKey, { volumeRef: targetVolumeIcon })
    }
    inputLock = false
    onTyping(e)
  } else {
    let right = false
    if (settingStore.ignoreCase) {
      right = letter.toLowerCase() === target[input.length].toLowerCase()
    } else {
      right = letter === target[input.length]
    }
    //针对中文的特殊判断
    if (
      e.shiftKey &&
      (('！' === target[input.length] && e.code === 'Digit1') ||
        ('￥' === target[input.length] && e.code === 'Digit4') ||
        ('…' === target[input.length] && e.code === 'Digit6') ||
        ('（' === target[input.length] && e.code === 'Digit9') ||
        ('—' === target[input.length] && e.code === 'Minus') ||
        ('？' === target[input.length] && e.code === 'Slash') ||
        ('》' === target[input.length] && e.code === 'Period') ||
        ('《' === target[input.length] && e.code === 'Comma') ||
        ('“' === target[input.length] && e.code === 'Quote') ||
        ('”' === target[input.length] && e.code === 'Quote') ||
        ('：' === target[input.length] && e.code === 'Semicolon') ||
        ('）' === target[input.length] && e.code === 'Digit0'))
    ) {
      right = true
      letter = target[input.length]
    }
    if (
      !e.shiftKey &&
      (('、' === target[input.length] && e.code === 'Slash') ||
        ('。' === target[input.length] && e.code === 'Period') ||
        ('，' === target[input.length] && e.code === 'Comma') ||
        ('‘' === target[input.length] && e.code === 'Quote') ||
        ('’' === target[input.length] && e.code === 'Quote') ||
        ('；' === target[input.length] && e.code === 'Semicolon') ||
        ('【' === target[input.length] && e.code === 'BracketLeft') ||
        ('】' === target[input.length] && e.code === 'BracketRight'))
    ) {
      right = true
      letter = target[input.length]
    }
    // console.log('e', e, e.code, e.shiftKey, word[input.length])

    if (right) {
      input += letter
      wrong = ''
      playKeyboardAudio()
    } else {
      typo()
      wrong = letter
      playBeep()
      if (settingStore.wordSound) {
        playWord(WordPlayTrigger.Typo, { volumeRef: targetVolumeIcon })
      }
      waitClear = true
      setTimeout(() => {
        if (settingStore.inputWrongClear && !isTypingSentence()) input = ''
        wrong = ''
        waitClear = false
      }, 500)
    }
    // 更新当前单词信息
    updateCurrentWordInfo()
    //不需要把inputLock设为false，输入完成不能再输入了，只能删除，删除会打开锁
    if (input.toLowerCase() === target.toLowerCase()) {
      wordCompletedTime = Date.now() // 记录单词完成的时间戳
      playCorrect()
      if (
        [WordPracticeType.Listen, WordPracticeType.Identify].includes(settingStore.wordPracticeType) &&
        !showWordResult.value
      ) {
        showWordResult.value = true
      }
      if ([WordPracticeType.FollowWrite, WordPracticeType.Spell, WordPracticeType.Dictation].includes(settingStore.wordPracticeType)) {
        if (settingStore.autoNextWord) {
          // 自动切换:短暂延时后跳转到下一个单词
          completeTypeWord(true)
        } else {
          // 手动切换:停留在当前单词展示完整信息(音标/翻译/例句等),按空格键切换到下一个
          showWordResult.value = true
        }
      }
    } else {
      //这里不要移动inputLock，否则输入完成时无法进入空格键的判断
      inputLock = false
    }
  }
}

function shouldRepeat() {
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite) {
    if (settingStore.repeatCount == 100) {
      return settingStore.repeatCustomCount > wordRepeatCount + 1
    } else {
      return settingStore.repeatCount > wordRepeatCount + 1
    }
  } else {
    return false
  }
}

function isTypingSentence() {
  return currentPracticeSentenceIndex !== -1
}

function completeTypeWord(delay: boolean) {
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite && settingStore.practiceSentence) {
    currentPracticeSentenceIndex++
    if (currentPracticeSentenceIndex < props.word.sentences.length) {
      // 还有下一个句子
      inputLock = false
      wrong = input = ''
      return
    }
  }
  if (shouldRepeat()) {
    repeat()
  } else {
    if (delay) {
      clearJumpTimer()
      jumpTimer = setTimeout(() => emit('complete'), settingStore.waitTimeForChangeWord)
    } else {
      emit('complete')
    }
  }
}

function del() {
  playKeyboardAudio()
  inputLock = false
  if (showWordResult.value) {
    input = ''
    showWordResult.value = false
    //如果是自测阶段，按删除键代码弄错了，需要标记为错词，同时从excludeWords里排除
    if (settingStore.wordPracticeType === WordPracticeType.Identify) {
      typo()
      if (settingStore.wordSound) playWord(WordPlayTrigger.DelRetry)
    }
  } else {
    if (wrong) {
      wrong = ''
    } else {
      input = input.slice(0, -1)
    }
  }
  // 更新当前单词信息
  updateCurrentWordInfo()
}

function showWord() {
  if (settingStore.allowWordTip) {
    //如果不是跟写模式，查看单词一律标记为错词
    if (settingStore.wordPracticeType !== WordPracticeType.FollowWrite || settingStore.dictation) {
      typo()
    }
    if (
      settingStore.wordPracticeType === WordPracticeType.Identify &&
      settingStore.identifyMethod === IdentifyMethod.WordTest
    ) {
      showAllCandidates = true
      return
    }
    showFullWord = true
  }
}

function hideWord() {
  showAllCandidates = false
  showFullWord = false
}

function editNote() {
  editingNote = !editingNote
  if (editingNote) {
    noteInputValue = store.noteData[props.word.word] ?? ''
  } else {
    noteInputValue = ''
  }
}

function saveNote() {
  if (noteInputValue.trim()) {
    store.noteData[props.word.word] = noteInputValue
  } else {
    delete store.noteData[props.word.word]
  }
  editingNote = false
}

function cancelNote() {
  editingNote = false
  noteInputValue = ''
}

function deleteNote() {
  delete store.noteData[props.word.word]
  editingNote = false
  noteInputValue = ''
}

function typo() {
  emit('wrong')
  wrongTimes.value++
}

function checkIsWrong() {
  if (settingStore.wordPracticeType === WordPracticeType.Dictation || settingStore.dictation) {
    if (!showWordResult.value && !right) {
      //输入完成，或者已显示的情况下，不记入错误
      typo()
    }
  }
}

function onVolumeIconClick() {
  checkIsWrong()
  playWord(WordPlayTrigger.Manual)
}

/** 朗读中文翻译(发音区第二个喇叭;与自动接读共用 transSoundSpeed/缓存/拼接) */
function playTranslation() {
  const zh = buildTransSpeechText(props.word.trans, settingStore.showDetailedTrans, settingStore.limitTransSpeech)
  if (!zh) return
  playEdgeTts(zh, {
    volume: settingStore.wordSoundVolume / 100,
    engine: {
      lengthScale: settingStore.transSoundSpeed,
      voice: settingStore.ttsVoice,
    },
  })
}

function play() {
  checkIsWrong()
  playWord(WordPlayTrigger.Shortcut)
}

function mouseleave() {
  setTimeout(() => {
    showFullWord = false
  }, 50)
}

watch([() => input, () => showFullWord, () => settingStore.dictation], checkCursorPosition)

//检测光标位置
function checkCursorPosition() {
  _nextTick(() => {
    let cursorOffset
    if (isTypingSentence()) {
      cursorOffset = { top: 0, left: 0 }
    } else {
      cursorOffset = { top: 0, left: -3 }
    }
    // 选中目标元素
    const cursorEl = document.querySelector(`.cursor`)
    const inputList = document.querySelectorAll(`.l`)
    if (!typingWordRef || !cursorEl) return
    const typingWordRect = typingWordRef.getBoundingClientRect()

    if (inputList.length) {
      let inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top + inputRect.height - cursorEl.clientHeight - typingWordRect.top + cursorOffset.top,
        left: inputRect.right - typingWordRect.left + cursorOffset.left,
      }
    } else {
      const letter = document.querySelector(`.letter`)
      let elRect = letter ? letter.getBoundingClientRect() : null
      if (!elRect) return
      cursor = {
        top: elRect.top + elRect.height - cursorEl.clientHeight - typingWordRect.top + cursorOffset.top,
        left: elRect.left - typingWordRect.left + cursorOffset.left,
      }
    }
  })
}

useEventsByWatch(
  [
    [ShortcutKey.KnowWord, know],
    [ShortcutKey.UnknownWord, unknown],
    [ShortcutKey.MasteredWord, mastered],
  ],
  () => isSelfAssessment
)

useEventsByWatch(
  [
    [ShortcutKey.ChooseA, e => select(e, 0)],
    [ShortcutKey.ChooseB, e => select(e, 1)],
    [ShortcutKey.ChooseC, e => select(e, 2)],
    [ShortcutKey.ChooseD, e => select(e, 3)],
  ],
  () => isWordTest
)

const { isWordSimple, toggleWordSimple } = useWordOptions()

const collectAnchorRef = ref<HTMLElement | null>(null)

function openCollectPicker(e: MouseEvent) {
  e.stopPropagation()
  openWordCollectPicker(props.word, e.currentTarget as HTMLElement, {
    excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined,
  })
}

const isSimple = $computed(() => isWordSimple(props.word))

// 「下一个」快捷键(设置-快捷键可修改);输完单词后,按空格或该快捷键均可切换
const nextShortcutKey = $computed(() => settingStore.shortcutKeyMap[ShortcutKey.Next] ?? '')

// ---- 单格布局:当前词居中,左右词隐藏 ----
// 切词动画方向:新词 = 下一个(旧词是 prevWord)→ 向左滑;新词 = 上一个(旧词是 nextWord)→ 向右滑;
// 面板跳转/随机等任意跳转(prevWord/nextWord 都不是旧词)默认向前(向左滑)
// watch 默认 flush:'pre',切词时先更新 animDir 再渲染,Transition 读到的名字已是新方向
let animDir = $ref<'fwd' | 'back'>('fwd')
const transitionName = $computed(() => (animDir === 'fwd' ? 'slide-next' : 'slide-prev'))
watch(
  () => props.word,
  (_newWord, oldWord) => {
    const ow = oldWord?.word?.toLowerCase()
    animDir = props.prevWord?.word?.toLowerCase() === ow ? 'fwd' : props.nextWord?.word?.toLowerCase() === ow ? 'back' : 'fwd'
  }
)

defineExpose({
  del,
  showWord,
  hideWord,
  play,
  showWordResult,
  wrongTimes,
  getCollectAnchor: () => collectAnchorRef.value,
})
</script>

<template>
  <div class="typing-word" ref="typingWordRef" v-if="word.word.length">
    <div class="flex flex-col items-center">
      <!-- 单词操作按钮区:顶部间距常驻且可自定义(设置-练习区顶部间距);切换提示悬浮在按钮上方,不占文档流(输完出现/消失零位移) -->
      <div class="relative" :style="{ marginTop: settingStore.practiceTopGap + 'px' }">
        <div
          v-if="showWordResult && !settingStore.autoNextWord"
          class="next-word-tip absolute left-1/2 -translate-x-1/2 -top-7 whitespace-nowrap"
        >
          {{ '按' }} <span class="key">空格</span> {{ '切换到下一个单词' }}
        </div>
        <div class="flex gap-4 mb-2">
        <BaseIcon
          @click="emit('toggleSimple')"
          :title="
            (!isSimple ? '标记为已掌握' : '取消标记已掌握') +
            `(${settingStore.shortcutKeyMap[ShortcutKey.ToggleSimple]})`
          "
        >
          <IconFluentCheckmarkCircle16Regular v-if="!isSimple" />
          <IconFluentCheckmarkCircle16Filled v-else />
        </BaseIcon>
        <BaseIcon @click="editNote" :title="editingNote ? '完成编辑笔记' : '编辑笔记'">
          <IconFluentClipboardTextEdit20Regular />
        </BaseIcon>
        <span ref="collectAnchorRef" class="inline-flex">
          <BaseIcon
            class="word-collect-anchor"
            @click="openCollectPicker"
            :title="`${'收藏到词典'}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleCollect]})`"
          >
            <IconFluentStarAdd16Regular />
          </BaseIcon>
        </span>
        <BaseIcon @click="emit('skip')" :title="`${'跳过单词'}(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
          <IconFluentArrowBounce20Regular class="transform-rotate-180" />
        </BaseIcon>
        </div>
      </div>

      <div class="flex gap-1">
        <div
          class="phonetic"
          :class="
            (settingStore.dictation ||
              [WordPracticeType.Spell, WordPracticeType.Listen, WordPracticeType.Dictation].includes(
                settingStore.wordPracticeType
              )) &&
            !showFullWord &&
            !showWordResult &&
            'word-shadow'
          "
          v-if="settingStore.soundType === 'uk' && word.phonetic0"
        >
          / {{ word.phonetic0 }} /
        </div>
        <div
          class="phonetic"
          :class="
            (settingStore.dictation ||
              [WordPracticeType.Spell, WordPracticeType.Listen, WordPracticeType.Dictation].includes(
                settingStore.wordPracticeType
              )) &&
            !showFullWord &&
            !showWordResult &&
            'word-shadow'
          "
          v-if="settingStore.soundType === 'us' && word.phonetic1"
        >
          / {{ word.phonetic1 }} /
        </div>
        <VolumeIcon
          :title="`${'发音'}(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
          ref="volumeIconRef"
          :simple="true"
          @click="onVolumeIconClick"
        />
        <!-- 翻译朗读:与单词发音喇叭并列,不占翻译区行 -->
        <VolumeIcon title="朗读翻译(中文)" :simple="true" @click="playTranslation" />
      </div>

      <!-- 单格滑动切词:key=词,切词时按方向滑动过渡(下一个向左/上一个向右);打字/遮挡切换不触发动画 -->
      <!-- word-stage:relative 定位基准 + 横向裁切;enter 元素留文档流撑高,leave 元素 absolute 对齐 stage 顶部(与 enter 同一高度) -->
      <div class="word-stage">
      <Transition :name="transitionName">
        <div :key="word.word.toLowerCase()" class="word-cell">
      <Tooltip
        :title="settingStore.dictation ? `${'快捷键'} ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]} ${'显示单词'}` : ''"
      >
        <div
          id="word"
          class="word my-1"
          :class="wrong && !isTypingSentence() ? 'is-wrong' : ''"
          :style="{
            fontSize: settingStore.fontSize.wordForeignFontSize + 'px',
            letterSpacing: settingStore.wordLetterSpacing + 'px',
          }"
          @mouseenter="showWord"
          @mouseleave="mouseleave"
        >
          <!-- 2026-08-06 统一单行结构:默写新词(Dictation)不再单独开拼写格子,
               与跟写/听写/拼写一致,直接在词位输入(单词由 dictation 开关控制遮挡) -->
          <div v-if="currentPracticeSentenceIndex === -1">
            <span class="input" v-if="input">{{ input }}</span>
            <span class="wrong" v-if="wrong">{{ wrong }}</span>
            <!-- 默写占位:连续横线(非逐字母下划线),宽度随词长,输入推进时保持 -->
            <span class="letter dict-line" v-if="settingStore.dictation && !showFullWord">
              {{ displayWord }}
            </span>
            <span class="letter" v-else>{{ displayWord }}</span>
          </div>
          <div v-else>
            <span class="input">{{ word.word }}</span>
          </div>
        </div>
      </Tooltip>
        </div>
      </Transition>
      </div>

      <!-- 自测判断按钮:看单词 → 判断 → 翻译确认;胶囊样式带语义色(深/浅主题自适应) -->
      <!-- 位置:单词与翻译正中间(mt-2 抵消单词区底部留白,mb-3 与翻译顶部间距均衡) -->
      <div class="mt-2 mb-3 flex gap-2" v-if="isSelfAssessment && !showWordResult">
        <button type="button" class="judge-btn judge-know" @click="know">
          <IconFluentCheckmarkCircle16Filled />
          <span>{{ '我认识' }}</span>
          <span class="judge-key">{{ settingStore.shortcutKeyMap[ShortcutKey.KnowWord] }}</span>
        </button>
        <button type="button" class="judge-btn judge-unknown" @click="unknown">
          <IconFluentDismissCircle16Regular />
          <span>{{ '不认识' }}</span>
          <span class="judge-key">{{ settingStore.shortcutKeyMap[ShortcutKey.UnknownWord] }}</span>
        </button>
        <button type="button" class="judge-btn judge-mastered" @click="mastered">
          <IconFluentStar16Filled />
          <span>{{ '已掌握' }}</span>
          <span class="judge-key">{{ settingStore.shortcutKeyMap[ShortcutKey.MasteredWord] }}</span>
        </button>
      </div>

      <!-- 翻译:紧跟单词(打字区)下方,限宽居中 —— 与 demo 布局一致 -->
      <div
        class="translate flex flex-col gap-2 my-3 w-full"
        v-opacity="settingStore.translate || showWordResult || showFullWord"
        :style="{
          fontSize: settingStore.fontSize.wordTranslateFontSize + 'px',
        }"
      >
        <TranslationList
          :word="word"
          :showFull="!settingStore.dictation || showWordResult || showFullWord"
          :show-play="false"
        />
      </div>

      <div v-if="isWordTest && !showWordResult" class="flex gap-8 flex-col my-8 w-full">
        <div
          v-for="(value, index) in question?.candidates ?? []"
          class="flex gap-2 min-h-20"
          :class="{
            'text-[var(--color-success)]': completeSelect && index === props?.question?.correctIndex,
            'text-[var(--color-error)]': completeSelect && index !== props?.question?.correctIndex && index === selectIndex,
          }"
        >
          <BaseButton
            :keyboard="`${'快捷键'}(${settingStore.shortcutKeyMap[[ShortcutKey.ChooseA, ShortcutKey.ChooseB, ShortcutKey.ChooseC, ShortcutKey.ChooseD][index]]})`"
            @click="e => select(e, index)"
          >
            {{ ['A', 'B', 'C', 'D'][index] }}
          </BaseButton>
          <span class="ml-2">
            <div class="min-h-10 text-2xl" :class="{ 'word-shadow': !showAllCandidates && !completeSelect }">
              {{ value.word.word }}
            </div>
            <TranslationList :word="value.word" :showFull="showAllCandidates || completeSelect" />
          </span>
        </div>
      </div>

    </div>

    <template v-if="editingNote || store.noteData[word.word]?.trim()">
      <div class="line-white my-3"></div>
      <div class="flex flex-col gap-2 w-full">
        <div class="flex">
          <div class="label">{{ '笔记' }}</div>
          <Textarea
            autofocus
            v-if="editingNote"
            v-model="noteInputValue"
            placeholder="记录这个单词的个人笔记"
            :autosize="{ minRows: 4, maxRows: 8 }"
            class="note-textarea"
          />
          <div v-else class="note-content">{{ store.noteData[word.word] }}</div>
        </div>
        <div v-if="editingNote" class="flex justify-end mt-2">
          <BaseButton size="large" type="info" v-if="store.noteData[word.word]" @click="deleteNote">{{ '删除' }}</BaseButton>
          <BaseButton size="large" @click="cancelNote">{{ '取消' }}</BaseButton>
          <BaseButton size="large" type="primary" @click="saveNote">{{ '保存' }}</BaseButton>
        </div>
      </div>
    </template>

    <div
      class="other anim w-full"
      v-opacity="
        ![WordPracticeType.Listen, WordPracticeType.Dictation, WordPracticeType.Identify].includes(
          settingStore.wordPracticeType
        ) ||
        showFullWord ||
        showWordResult
      "
    >
      <template v-if="word?.sentences?.length">
        <!-- 例句卡片:3 条一栏,英文一行 + 中文下一行(与 demo-9 样式一致) -->
        <div class="sentence-card">
          <div
            class="sentence"
            :class="{
              'is-wrong': wrong && currentPracticeSentenceIndex === index,
              'is-playing': highlightedSentenceIndex === index,
            }"
            v-for="(item, index) in word.sentences"
            :key="index"
          >
            <div class="flex gap-space text-xl">
              <div v-if="index !== currentPracticeSentenceIndex">
                <ClickableEnglishText
                  :text="item.c"
                  :word="word.word"
                  :dictation="!(!settingStore.dictation || showFullWord || showWordResult)"
                />
              </div>
              <div v-else>
                <span class="input" v-if="input">{{ input }}</span>
                <span class="wrong" v-if="wrong">{{ wrong }}</span>
                <span class="letter">{{ displaySentence }}</span>
              </div>
              <!-- 例句朗读:点击喇叭播放(后台已预加载缓存,零等待;不自动播放) -->
              <VolumeIcon :title="'朗读例句'" :simple="true" @click="playSentence(index, { highlight: true })" />
            </div>
            <div class="text-base anim" v-opacity="settingStore.translate || showFullWord || showWordResult">
              {{ item.cn }}
            </div>
          </div>
        </div>
      </template>

      <template v-if="word?.phrases?.length">
        <div class="info-card">
          <div class="flex">
            <div class="label">{{ '短语' }}</div>
            <div class="flex flex-col">
              <div class="flex items-center gap-4" v-for="(item, index) in word.phrases" :key="index">
                <div class="flex gap-space items-center">
                  <ClickableEnglishText
                    class="en"
                    :text="item.c"
                    :word="word.word"
                    :dictation="!(!settingStore.dictation || showFullWord || showWordResult)"
                  />
                </div>
                <div class="cn anim" v-opacity="settingStore.translate || showFullWord || showWordResult">
                  {{ item.cn }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="settingStore.translate || !settingStore.dictation">
        <template v-if="word?.synos?.length">
          <div class="info-card">
            <div class="flex">
              <div class="label">{{ '近义词' }}</div>
              <div class="flex flex-col gap-3">
                <div class="flex" v-for="item in word.synos">
                  <div class="pos line-height-1.4rem!">{{ item.pos }}</div>
                  <div>
                    <div class="cn anim" v-opacity="settingStore.translate || showFullWord || showWordResult">
                      {{ item.cn }}
                    </div>
                    <div class="anim" v-opacity="!settingStore.dictation || showFullWord || showWordResult">
                      <template v-for="(i, j) in item.ws" :key="j">
                        <ClickableWord :word="i" />
                        <span v-if="j !== item.ws.length - 1"> / </span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <div
        class="anim"
        v-opacity="
          ((settingStore.translate && !settingStore.dictation) || showFullWord || showWordResult) &&
          settingStore.showEtymologyAndRelWords
        "
      >
        <template v-if="word?.etymology?.length">
          <div class="info-card">
            <div class="flex">
              <div class="label">{{ '词源' }}</div>
              <div class="text-base">
                <div class="mb-2" v-for="item in word.etymology">
                  <div class="">{{ item.t }}</div>
                  <div class="">{{ item.d }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 词形变化(ECDICT exchange 解析) -->
        <template v-if="parseInflections(word.inflections).length">
          <div class="info-card">
            <div class="flex">
              <div class="label">{{ '词形变化' }}</div>
              <div class="flex flex-wrap gap-x-4 gap-y-1">
                <div v-for="inf in parseInflections(word.inflections)" :key="inf.label">
                  <span class="pos">{{ inf.label }}</span>
                  <span class="en">{{ inf.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-if="word?.relWords?.root">
          <div class="info-card">
            <div class="flex">
              <div class="label">{{ '同根词' }}</div>
              <div class="flex flex-col gap-3">
                <div v-if="word.relWords.root" class=" ">
                  {{ '词根' }}：<ClickableWord class="en" :word="word.relWords.root" />
                </div>
                <div class="flex" v-for="item in word.relWords.rels">
                  <div class="pos">{{ item.pos }}</div>
                  <div>
                    <div class="flex items-center gap-4" v-for="itemj in item.words">
                      <ClickableWord class="en" :word="itemj.c" />
                      <div class="cn">{{ itemj.cn }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <WordLookupPopover />
  </div>
</template>

<style scoped lang="scss">

.typing-word {
  width: 100%;
  flex: 1;
  //overflow: auto;
  word-break: break-word;
  position: relative;
  color: var(--color-font-2);
  // 练习字体(设置-练习字体):单词/翻译/例句统一继承所选 MiSans;音标 .phonetic 有独立字体不受影响
  font-family: var(--en-article-family);

  .phonetic,
  .translate {
    font-size: 1.2rem;
  }

  // 翻译区:限宽居中(长翻译换行不撑满全宽,与打字区视觉对齐)
  .translate {
    max-width: 720px;
    margin: 0 auto;
  }

  // 自测判断按钮(认识/不认识/已掌握):胶囊 + 语义色,深浅主题自适应
  .judge-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    border: 1px solid;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1.4;
    font-family: var(--font-family);
    transition: filter 0.15s, transform 0.1s;
    user-select: none;

    svg {
      flex-shrink: 0;
    }

    &:hover {
      filter: brightness(1.15);
    }

    &:active {
      transform: scale(0.96);
    }

    .judge-key {
      font-size: 0.75rem;
      opacity: 0.6;
      margin-left: 0.15rem;
    }

    &.judge-know {
      background: color-mix(in srgb, var(--color-success) 14%, transparent);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
      color: var(--color-success);
    }

    &.judge-unknown {
      background: color-mix(in srgb, var(--color-error) 14%, transparent);
      border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
      color: var(--color-error);
    }

    &.judge-mastered {
      background: color-mix(in srgb, var(--color-info) 14%, transparent);
      border-color: color-mix(in srgb, var(--color-info) 40%, transparent);
      color: var(--color-info);
    }
  }

  .phonetic {
    color: var(--color-font-1);
    font-family: var(--word-font-family);
  }

  .word {
    font-size: 3rem;
    line-height: 1;
    font-family: var(--en-article-family);
    // 字符间距由设置内联控制(letterSpacing: wordLetterSpacing px,换字体后可微调)
  }

  .is-wrong {
    animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  // ---- 单格布局(2026-08-06 重构:左右词隐藏,当前词居中;切词用方向性滑动动画) ----
  // word-stage:leave 元素(absolute)的定位基准 + 横向裁切;高度由 enter 元素(流内)撑起,min-height 保底
  // 2026-08-06 修复:leave 元素 absolute 脱离 flex 流后静态位置落在容器顶部,与 enter 高度不一致 →
  // 显式 top/left/right 对齐 stage 顶部(enter 是 stage 唯一流内元素,从顶部开始,两者同一高度)
  .word-stage {
    position: relative;
    overflow: hidden;
    min-height: 5rem;
    width: 100%;
  }

  .word-cell {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  // 切下一个:向左滑(新词从右侧滑入,旧词向左滑出,同屏交错)
  .slide-next-enter-active,
  .slide-next-leave-active {
    transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .slide-next-leave-active {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  .slide-next-enter-from {
    transform: translateX(100%);
  }

  .slide-next-leave-to {
    transform: translateX(-100%);
  }

  // 切上一个:向右滑(镜像方向)
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .slide-prev-leave-active {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  .slide-prev-enter-from {
    transform: translateX(-100%);
  }

  .slide-prev-leave-to {
    transform: translateX(100%);
  }

  // 默写占位:透明词形 + 底部连续横线(宽度 = 词形宽度,精确且不改变布局宽度)
  // 2026-08-06 修复①:border-bottom/padding-bottom/line-height 1.15 使盒高(69px)大于正常显示(56px),
  // 遮挡↔显示切换 → 主格高度突变 → grid 行高重算 → TransitionGroup 误判 FLIP move → transform 残留(偏下 7px 不居中)
  // 横线改用 background 底部渐变(不占盒尺寸),line-height 与正常显示一致 → 两种状态盒高恒定,切换零跳动
  // 2026-08-06 修复②:.letter 定义在 .dict-line 之后,同特异性下 color 被 .letter 覆盖 → 透明失效(模糊没打上),
  // 用 !important 锁定透明;background-position 用两值语法(0 100%),"bottom 0.15em" 是无效声明会回退左上角(横线画在单词上方)
  .dict-line {
    display: inline-block;
    color: transparent !important;
    line-height: 1;
    background-image: linear-gradient(var(--color-typing-wait), var(--color-typing-wait));
    background-repeat: no-repeat;
    background-size: 100% 2px;
    background-position: 0 100%;
    user-select: none;
  }



  // 手动切换提示(关闭自动切换时,输完单词显示;顶部间距由模板类控制,自身不再带 margin)
  .next-word-tip {
    font-size: 0.85rem;
    color: var(--color-sub-text);

    .key {
      margin: 0 0.2rem;
      padding: 0.05rem 0.4rem;
      border: 1px solid var(--color-line);
      border-radius: 0.25rem;
      background: var(--color-third);
      font-size: 0.8rem;
      color: var(--color-main-text);
    }
  }

  // 打字区三色(深浅主题各一套,变量定义在 main.scss):未输入弱化、已输入绿色、错误红色
  .letter {
    color: var(--color-typing-wait);
  }

  .input,
  .right {
    color: var(--color-typing-input);
  }

  .wrong {
    // 原 rgba(red, 0.6) 为无效 CSS(浏览器忽略,错字不显红);改用状态色变量,深浅主题自动适配
    color: var(--color-error);
  }

  .tabs {
    @apply: text-lg font-medium;
    display: flex;
    gap: 2rem;

    .tab {
      cursor: pointer;

      &.active {
        border-bottom: 2px solid var(--color-font-2);
      }
    }
  }

  .label {
    width: 6rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
  }

  .cn {
    @apply text-base;
  }

  .note-content {
    @apply text-base whitespace-pre-wrap;
  }

  .en {
    @apply text-lg;
  }

  .pos {
    @apply min-w-10;
  }

  // 信息卡片(例句/短语/近义词/词源/词形变化/同根词):白底圆角,深浅主题适配
  .sentence-card,
  .info-card {
    margin: 0.8rem 0 0.5rem;
    background: var(--color-card-bg);
    border: 1px solid var(--color-line);
    border-radius: 0.6rem;
    display: flex;
    flex-direction: column;

    .sentence {
      margin-left: 0;
      margin-right: 0;
    }
  }

  .sentence-card {
    padding: 0.5rem 0.6rem;
  }

  .info-card {
    padding: 0.8rem 1rem;
    gap: 0.6rem;
  }

  .sentence {
    @apply rounded-lg px-3 py-2 -mx-3;
    background: transparent;
    transition: all .3s;

    // 例句朗读中:整句高亮(点击喇叭后,播放结束复位)
    &.is-playing {
      color: var(--color-link);
      background: rgba(124, 58, 237, 0.08);
    }
  }
  .sentence-highlight {
    background: rgba(124, 58, 237, 0.1);
    box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.25);
  }
}

// 移动端适配
@media (max-width: 768px) {
  .typing-word {
    .label {
      @apply w-unset mr-2;
    }
    :deep(.pos) {
      @apply w-unset mr-2 min-w-unset;
    }
  }
}
</style>