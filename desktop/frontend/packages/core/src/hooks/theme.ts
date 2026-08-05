import { useSettingStore } from '../stores/setting.ts'

type Theme = 'light' | 'dark'

// 获取系统主题
export function getSystemTheme(): Theme {
  if (import.meta.server) return 'light'
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'light' // 默认浅色模式
}

// 交换主题名称
export function swapTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : 'light'
}

// 监听系统主题变化
export function listenToSystemThemeChange(call: (theme: Theme) => void) {
  if (import.meta.server) return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (e.matches) {
      // console.log('系统已切换到深色模式');
      call('dark')
    }
  })
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (e.matches) {
      // console.log('系统已切换到浅色模式');
      call('light')
    }
  })
}

export function setTheme(val: string) {
  // auto模式下，则通过查询系统主题来设置主题名称
  if (import.meta.client) {
    document.documentElement.className = val === 'auto' ? getSystemTheme() : val
  }
}

export default function useTheme() {
  const settingStore = useSettingStore()

  // 监听系统主题变更:仅"跟随系统"模式下实时切换,手动选择浅色/深色时不受影响
  listenToSystemThemeChange(() => {
    if (settingStore.theme === 'auto') {
      setTheme('auto')
    }
  })

  function toggleTheme() {
    // auto模式下，默认是使用系统主题，切换时应该使用当前系统主题为基础进行切换
    settingStore.theme = swapTheme(settingStore.theme === 'auto' ? getSystemTheme() : (settingStore.theme as Theme))
    setTheme(settingStore.theme)
  }

  // 获取当前具体的主题名称
  function getTheme(): Theme {
    if (import.meta.client) {
      return settingStore.theme === 'auto' ? getSystemTheme() : (settingStore.theme as Theme)
    }
    // auto模式下，则通过查询系统主题来获取当前具体的主题名称
  }

  return {
    toggleTheme,
    setTheme,
    getTheme,
  }
}
