import { ref, unref, type ComputedRef, type Ref } from 'vue'
import type { Word } from '../types'
import { playEdgeTts, usePlayWordAudio } from '../hooks/sound'
import { useSettingStore } from '../stores/setting'
import { buildTransSpeechText } from '../utils/transSpeech'

export enum WordPlayTrigger {
  NewWord = 'newWord',
  RepeatWord = 'repeatWord',
  ResetSameWord = 'resetSameWord',
  RevealUnknown = 'revealUnknown',
  DictationReveal = 'dictationReveal',
  IdentifyWrongKey = 'identifyWrongKey',
  Typo = 'typo',
  DelRetry = 'delRetry',
  Manual = 'manual',
  Shortcut = 'shortcut',
}

/** 非整词发音的触发(打字纠错/退格重试),不触发中文翻译自动播放 */
const NO_TRANSLATE_TRIGGERS = new Set([WordPlayTrigger.Typo, WordPlayTrigger.DelRetry])

export interface WordPracticeAudioOptions {
  word: Ref<Word>
  volumeIconRef: Ref<{ animateOnly?: (reset?: boolean) => void } | undefined> | ComputedRef<{ animateOnly?: (reset?: boolean) => void } | undefined>
  canSeeSentences?: () => boolean
}

export function useWordPracticeAudio({ word, volumeIconRef }: WordPracticeAudioOptions) {
  const settingStore = useSettingStore()
  const playWordAudio = usePlayWordAudio()

  /** 正在朗读的例句下标(播放中高亮,播放结束复位) */
  const highlightedSentenceIndex = ref(-1)

  /**
   * 朗读例句(微软 Edge TTS):与翻译共用音色 ttsVoice,语速独立 sentenceSoundSpeed。
   * playEdgeTts 内部自动命中预加载缓存(滑窗后台合成),未命中则在线合成并播放即缓存。
   */
  function playSentence(index: number, options?: { highlight?: boolean }) {
    const text = word.value.sentences?.[index]?.c
    if (!text) return
    const highlight = options?.highlight ?? false
    if (highlight) highlightedSentenceIndex.value = index
    playEdgeTts(text, {
      volume: settingStore.wordSoundVolume / 100,
      engine: {
        lengthScale: settingStore.sentenceSoundSpeed,
        voice: settingStore.ttsVoice,
      },
      onEnd: () => {
        if (highlight) highlightedSentenceIndex.value = -1
      },
    })
  }

  /** 单词发音结束后自动朗读中文翻译(设置-音效「自动朗读中文翻译」开启时) */
  function playTranslationAfterWord() {
    if (!settingStore.autoPlayTrans) return
    // 顿号连接多释义(句号会让 Edge TTS 停顿过长);与预加载/查词/词表共用同一拼接(缓存 key 一致)
    const zh = buildTransSpeechText(word.value.trans, settingStore.showDetailedTrans, settingStore.limitTransSpeech)
    if (!zh) return
    playEdgeTts(zh, {
      volume: settingStore.wordSoundVolume / 100,
      engine: {
        // 翻译朗读用独立语速(transSoundSpeed),与单词发音(wordSoundSpeed)互不影响
        lengthScale: settingStore.transSoundSpeed,
        voice: settingStore.ttsVoice,
      },
    })
  }

  function playWord(
    trigger: WordPlayTrigger,
    options?: { resetIcon?: boolean; volumeRef?: { animateOnly?: (reset?: boolean) => void } }
  ) {
    const handle =
      trigger === WordPlayTrigger.RepeatWord ||
      trigger === WordPlayTrigger.Manual ||
      trigger === WordPlayTrigger.Shortcut

    // 单词发音播完后紧接着播中文翻译(打字纠错等非整词发音除外)
    const onEnd = NO_TRANSLATE_TRIGGERS.has(trigger) ? undefined : playTranslationAfterWord
    playWordAudio(word.value.word, handle, onEnd)

    const iconRef = options?.volumeRef ?? unref(volumeIconRef)
    iconRef?.animateOnly?.(options?.resetIcon ?? false)
  }

  return {
    highlightedSentenceIndex,
    playWord,
    playSentence,
    WordPlayTrigger,
  }
}
