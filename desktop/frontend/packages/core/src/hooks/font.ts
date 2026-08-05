import { useSettingStore } from '../stores/setting'

/**
 * 全局字体应用:设置 CSS 变量 --app-word-font,同时驱动 --font-family(全局 UI)与 --en-article-family(练习页英文)。
 * 空值 = 移除变量,回退系统默认。
 * 切换后由 default.vue 的 watch 自动应用,无需在设置页手动调用。
 */
export function applyWordFont(font: string) {
  const root = document.documentElement
  if (font) {
    root.style.setProperty('--app-word-font', `'${font}'`)
  } else {
    root.style.removeProperty('--app-word-font')
  }
}

/** 设置界面切换全局字体:写入 store(自动持久化),watch 会自动应用 */
export function useWordFont() {
  const settingStore = useSettingStore()
  function setWordFont(font: string) {
    settingStore.wordFont = font
    applyWordFont(font)
  }
  return { setWordFont }
}
