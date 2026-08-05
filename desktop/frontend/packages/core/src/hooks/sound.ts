import { onMounted, watchEffect } from 'vue'
import { useSettingStore } from '../stores/setting'
import { ref } from 'vue'

import { ENV, PronunciationApi, SoundFileOptions } from '../config/env'
import { cacheTransAudio, getCachedTransAudio, getCachedWordAudio, prefetchWordAudio } from './preloadTts'

export function useSound(audioSrcList?: string[], audioFileLength?: number) {
  let audioList = ref<HTMLAudioElement[]>([])
  let audioLength = ref(1)
  let index = ref(0)

  onMounted(() => {
    if (audioSrcList) setAudio(audioSrcList, audioFileLength)
  })

  //这里同一个音频弄好几份是为了快速打字是，可同时发音
  function setAudio(audioSrcList2: string[], audioFileLength2?: number) {
    //@ts-ignore
    if (import.meta.server) return
    if (audioFileLength2) audioLength.value = audioFileLength2
    audioList.value = []
    for (let i = 0; i < audioLength.value; i++) {
      // 桌面版音效内嵌在应用内(/sound/),走本地路径;不要拼 ENV.RESOURCE_URL(远程 CDN 会失败/离线不可用)
      audioSrcList2.map(src => audioList.value.push(new Audio(src)))
    }
    index.value = 0
  }

  function play(volume: number = 100) {
    index.value++
    if (audioList.value.length > 1 && audioList.value.length !== audioLength.value) {
      let htmlAudioElement = audioList.value[index.value % audioList.value.length]
      if (htmlAudioElement) {
        htmlAudioElement.volume = volume / 100
        // 音效文件缺失/加载失败时 play() 会 reject,必须捕获,否则产生 Uncaught 日志(见 NotSupportedError)
        htmlAudioElement.play().catch(() => {})
      }
    } else {
      let htmlAudioElement1 = audioList.value[index.value % audioLength.value]
      if (htmlAudioElement1) {
        htmlAudioElement1.volume = volume / 100
        htmlAudioElement1.play().catch(() => {})
      }
    }
  }

  return { play, setAudio }
}

export function usePlayKeyboardAudio() {
  const settingStore = useSettingStore()
  const { play, setAudio } = useSound()

  watchEffect(() => {
    if (!SoundFileOptions.find(v => v.value === settingStore.keyboardSoundFile)) {
      settingStore.keyboardSoundFile = 'Alpacas'
    }
    let urlList = getAudioFileUrl(settingStore.keyboardSoundFile)
    setAudio(urlList, urlList.length === 1 ? 4 : 1)
  })

  function playAudio() {
    if (settingStore.keyboardSound) {
      play(settingStore.keyboardSoundVolume)
    }
  }

  return playAudio
}

export function usePlayBeep() {
  const settingStore = useSettingStore()
  const { play } = useSound([`/sound/beep.wav`], 1)

  function playAudio() {
    if (settingStore.effectSound) {
      play(settingStore.effectSoundVolume)
    }
  }

  return playAudio
}

export function usePlayCorrect() {
  const settingStore = useSettingStore()
  const { play } = useSound([`/sound/correct.wav`], 1)

  function playAudio() {
    if (settingStore.effectSound) {
      play(settingStore.effectSoundVolume)
    }
  }

  return playAudio
}

const activeWordPlayCountMap = new Map<string, number>()

export function resetActiveWordPlayCount(word: string) {
  if (!word) return
  activeWordPlayCountMap.delete(word.trim().toLowerCase())
}

let isPlaying = false
let activeWordAudio: HTMLAudioElement | null = null
let activeTtsAudio: HTMLAudioElement | null = null

export function cancelWordPracticeAudio() {
  if (activeWordAudio) {
    activeWordAudio.onended = null
    activeWordAudio.onerror = null
    activeWordAudio.pause()
    activeWordAudio.currentTime = 0
  }
  cancelTtsAudio()
  isPlaying = false
}

/** 停止正在播放的 TTS 音频(切换/打断时调用) */
export function cancelTtsAudio() {
  if (activeTtsAudio) {
    activeTtsAudio.onended = null
    activeTtsAudio.onerror = null
    activeTtsAudio.pause()
    activeTtsAudio = null
  }
}

/** 中文朗读(微软 Edge TTS)可调参数:音色/语速 */
export type EdgeTtsConfig = {
  voice?: string
  lengthScale?: number
}

/**
 * 中文朗读:主进程微软 Edge TTS 在线合成(mp3 base64),音质最佳。
 * 网络不可用时返回 false(调用方按需处理)。
 */
export async function playEdgeTts(
  text: string,
  options: { volume?: number; rate?: number; onEnd?: () => void; engine?: EdgeTtsConfig } = {}
): Promise<boolean> {
  if (!text || typeof window === 'undefined') return false
  const speak = (window as any).desktop?.speakText
  if (typeof speak !== 'function') return false
  try {
    // 练习页预加载缓存命中(音色/语速一致)则直接播放,零延迟
    let src = getCachedTransAudio(text, options.engine?.voice, options.engine?.lengthScale)
    if (!src) {
      // 展开为普通对象再传 IPC(Vue reactive proxy 无法被 Electron IPC 序列化,会抛 DataCloneError)
      src = await speak(text, options.engine ? { ...options.engine } : null)
    }
    if (!src) {
      // 合成失败(断网/接口异常):派发事件,由界面层做节流提示
      try {
        window.dispatchEvent(new CustomEvent('edge-tts-fail'))
      } catch {}
      return false
    }
    // 播放即缓存:学过的词回头复习/重听时零延迟,无需重新合成
    cacheTransAudio(text, src, options.engine?.voice, options.engine?.lengthScale)
    cancelTtsAudio()
    // 主进程返回带 mime 前缀的 data URL(Edge TTS = mp3,本地引擎 = wav)
    const audio = new Audio(src.startsWith('data:') ? src : 'data:audio/wav;base64,' + src)
    audio.volume = options.volume ?? 1
    if (options.rate && options.rate !== 1) audio.playbackRate = options.rate
    const finish = () => {
      if (activeTtsAudio === audio) activeTtsAudio = null
      options.onEnd?.()
    }
    audio.onended = finish
    audio.onerror = finish
    activeTtsAudio = audio
    await audio.play()
    return true
  } catch {
    return false
  }
}

export function usePlayWordAudio() {
  const settingStore = useSettingStore()
  let audio = ref<HTMLAudioElement>(null)

  onMounted(() => {
    audio.value = new Audio()
  })

  function playAudio(word: string, handle: boolean = true, onEnd?: () => void) {
    if (!word || isPlaying) return
    isPlaying = true
    let playbackRate = settingStore.wordSoundSpeed
    if (handle) {
      const key = word.trim().toLowerCase()
      const count = activeWordPlayCountMap.get(key) ?? 0
      if (count % 3 !== 0) {
        playbackRate = playbackRate * 0.75
      }
      activeWordPlayCountMap.set(key, count + 1)
    }
    // console.log('playAudio-handle', handle, playbackRate)

    // 练习页预加载缓存命中(blob URL)则直接播放,零延迟;否则在线有道
    const cachedUrl = getCachedWordAudio(word)
    if (!cachedUrl) {
      // 播放即缓存:未命中时后台走主进程代理下载存缓存,下次遇到同一词零延迟(滑窗预加载之外的兜底)
      prefetchWordAudio(word, settingStore.soundType)
    }
    const url = cachedUrl ?? `${PronunciationApi}${word}&type=${settingStore.soundType === 'uk' ? 1 : 2}`
    let onended = () => {
      isPlaying = false
      onEnd?.()
    }
    activeWordAudio = audio.value
    audio.value.onended = onended
    // 加载失败(404/网络错误)也释放 isPlaying,否则后续单词发音全部静默(play() reject 只覆盖部分失败路径)
    audio.value.onerror = onended
    audio.value.src = url
    audio.value.volume = settingStore.wordSoundVolume / 100
    audio.value.playbackRate = playbackRate
    // 静默失败:某些词无发音(有道 404)或源无效时,play() 会 reject,需捕获避免 Uncaught 日志,并释放 isPlaying
    audio.value.play().catch(() => onended())
    // 无本地兜底:离线时单词无发音(翻译朗读走微软 Edge TTS 在线)
  }

  return playAudio
}

export function usePlayAudio(url: string) {
  new Audio(url).play().catch(() => {}) // 音效文件缺失时静默,避免 Uncaught NotSupportedError
}

export function getAudioFileUrl(name: string) {
  // 按键音效均为 mp3(机械轴体声音,来自 qwerty-learner/kbsim);文件名含空格,URL 需编码
  return [`/sound/key-sounds/${encodeURIComponent(name)}.mp3`]
}
