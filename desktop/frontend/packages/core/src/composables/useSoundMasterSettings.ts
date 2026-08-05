import { computed, ref, watch } from 'vue'
import { useSettingStore } from '../stores/setting'
import type { SettingState } from '../stores/setting'

type VolumeKey = 'wordSoundVolume' | 'keyboardSoundVolume' | 'effectSoundVolume'

type SpeedKey = 'wordSoundSpeed' | 'transSoundSpeed' | 'sentenceSoundSpeed'

export const SOUND_VOLUME_ITEMS: { key: VolumeKey; labelKey: string }[] = [
  { key: 'wordSoundVolume', labelKey: 'word_pronunciation' },
  { key: 'keyboardSoundVolume', labelKey: 'keyboard_volume' },
  { key: 'effectSoundVolume', labelKey: 'effect_volume' },
]

export const SOUND_SPEED_ITEMS: { key: SpeedKey; labelKey: string }[] = [
  { key: 'wordSoundSpeed', labelKey: 'word_speed' },
  { key: 'transSoundSpeed', labelKey: 'trans_speed' },
]

function createMasterControl<K extends keyof SettingState>(keys: K[]) {
  const settingStore = useSettingStore()

  const isUnified = computed(() => {
    const values = keys.map(key => settingStore[key] as number)
    return values.every(v => v === values[0])
  })

  // 子项不一致时默认展开详细设置（含下次进入页面）
  const expanded = ref(!isUnified.value)

  watch(isUnified, unified => {
    if (!unified) expanded.value = true
  })

  const showDetail = computed(() => expanded.value || !isUnified.value)

  const master = computed({
    get: () => settingStore[keys[0]] as number,
    set: (value: number) => {
      const patch = {} as Partial<SettingState>
      keys.forEach(key => {
        patch[key] = value as SettingState[typeof key]
      })
      settingStore.$patch(patch)
    },
  })

  function toggleExpanded() {
    expanded.value = !expanded.value
  }

  return {
    expanded,
    isUnified,
    showDetail,
    master,
    toggleExpanded,
    keys,
  }
}

/** 声音设置:总音量 = 单词发音 + 按键音量 + 效果音量统一;总倍速 = 单词发音 + 翻译朗读 + 例句朗读统一 */
export function useSpeechSoundSettings() {
  return useSoundMasterSettings(
    ['wordSoundVolume', 'keyboardSoundVolume', 'effectSoundVolume'],
    ['wordSoundSpeed', 'transSoundSpeed', 'sentenceSoundSpeed']
  )
}

/** 音效:音量=按键音+效果音统一,无倍速 */
export function useEffectSoundSettings() {
  return useSoundMasterSettings(['keyboardSoundVolume', 'effectSoundVolume'], [])
}

export function useSoundMasterSettings(volumeKeys: VolumeKey[], speedKeys: SpeedKey[]) {
  const volume = createMasterControl(volumeKeys)
  const speed = speedKeys.length ? createMasterControl(speedKeys) : null

  return {
    volumeExpanded: volume.expanded,
    volumeIsUnified: volume.isUnified,
    volumeShowDetail: volume.showDetail,
    volumeMaster: volume.master,
    volumeToggleExpanded: volume.toggleExpanded,
    speedExpanded: speed?.expanded ?? null,
    speedIsUnified: speed?.isUnified ?? null,
    speedShowDetail: speed?.showDetail ?? null,
    speedMaster: speed?.master ?? null,
    speedToggleExpanded: speed?.toggleExpanded ?? null,
  }
}
