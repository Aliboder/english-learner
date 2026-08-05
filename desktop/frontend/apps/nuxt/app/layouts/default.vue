<script setup lang="ts">
import useTheme from '@english-learner/core/hooks/theme.ts'
import { applyWordFont } from '@english-learner/core/hooks/font.ts'
import { useSettingStore } from '@english-learner/core/stores/setting.ts'
import { onMounted, provide, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useInit } from '@english-learner/core/composables/useInit.ts'
import WordCollectPopover from '@english-learner/core/components/word/WordCollectPopover.vue'
import SettingsDialog from '@english-learner/core/components/setting/SettingsDialog.vue'
import { useExport } from '@english-learner/core/hooks/export'
import { ensurePersistedCacheLoaded } from '@english-learner/core/hooks/preloadTts.ts'
import { Toast } from '@english-learner/base'

const router = useRouter()
const { setTheme } = useTheme()
const settingStore = useSettingStore()
const init = useInit()
let settingsDialogRef = $ref()

// 全局打开设置浮窗(单词页按钮、移动端导航共用)
function openSettings() {
  settingsDialogRef?.open?.()
}
provide('openSettings', openSettings)

watch(
  () => settingStore.load,
  n => {
    if (!n) return
    setTheme(settingStore.theme)
    applyWordFont(settingStore.wordFont)
    // 窗口置顶:启动时应用已保存的开关状态
    if (settingStore.alwaysOnTop) window.desktop?.setAlwaysOnTop?.(true)
  }
)

watch(
  () => settingStore.theme,
  n => {
    setTheme(n)
  }
)

watch(
  () => settingStore.wordFont,
  n => {
    applyWordFont(n)
  }
)

watch(
  () => settingStore.alwaysOnTop,
  n => {
    window.desktop?.setAlwaysOnTop?.(!!n)
  }
)

const route = useRoute()

onMounted(() => {
  init()
  // 恢复跨会话朗读缓存(IndexedDB 里最近 400 条翻译音频,隔天复习零延迟)
  ensurePersistedCacheLoaded()

  // 网络/接口失败轻提示:Edge TTS 合成失败时提示一次(30 秒节流,避免连续失败刷屏)
  let lastTtsFailToast = 0
  window.addEventListener('edge-tts-fail', () => {
    const now = Date.now()
    if (now - lastTtsFailToast > 30000) {
      lastTtsFailToast = now
      Toast.warning('网络不可用,翻译朗读失败')
    }
  })

  // 退出自动备份:主进程在窗口关闭前发来请求,这里组装备份数据交给主进程写文件
  // (仅 Electron 桌面版;浏览器环境无 window.desktop 则跳过)
  ;(window as any).desktop?.onAutoBackupRequest?.(async () => {
    try {
      if (settingStore.autoBackup) {
        const { getExportedData } = useExport()
        const data = await getExportedData()
        ;(window as any).desktop?.saveBackup?.(JSON.stringify(data))
      }
    } catch (e) {
      console.error('自动备份失败:', e)
    } finally {
      ;(window as any).desktop?.backupDone?.()
    }
  })
})
</script>

<template>
  <div class="layout anim">
    <!-- 移动端顶部菜单栏 -->
    <div class="mobile-top-nav" :class="{ collapsed: settingStore.mobileNavCollapsed }">
      <div class="nav-items">
        <div class="nav-item" @click="router.push('/words')" :class="{ active: route.path?.includes('/words') }">
          <IconFluentTextUnderlineDouble20Regular />
          <span>{{ '单词' }}</span>
        </div>
        <div class="nav-item" @click="openSettings()">
          <IconFluentSettings20Regular />
          <span>{{ '设置' }}</span>
        </div>
      </div>
      <div class="nav-toggle" @click="settingStore.mobileNavCollapsed = !settingStore.mobileNavCollapsed">
        <IconFluentChevronDown20Filled v-if="!settingStore.mobileNavCollapsed" />
        <IconFluentChevronUp20Filled v-else />
      </div>
    </div>

    <div class="flex-1 z-1 relative main-content overflow-x-hidden">
      <!--      <slot></slot>-->
      <router-view></router-view>
    </div>
    <WordCollectPopover />
    <SettingsDialog ref="settingsDialogRef" />
  </div>
</template>

<style scoped lang="scss">
.layout {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--color-primary);
}

// 移动端顶部菜单栏
.mobile-top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--color-second);
  border-bottom: 1px solid var(--color-item-border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;

  .nav-items {
    display: flex;
    justify-content: space-around;
    padding: 0.5rem 0;

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
      min-width: 44px;
      justify-content: center;
      position: relative;

      svg {
        font-size: 1.2rem;
        margin-bottom: 0.2rem;
        color: var(--color-main-text);
      }

      span {
        font-size: 0.7rem;
        color: var(--color-main-text);
        text-align: center;
      }

      &.active {
        svg,
        span {
          color: var(--color-select-bg);
        }
      }

      &:active {
        transform: scale(0.95);
      }
    }
  }

  .nav-toggle {
    position: absolute;
    bottom: -1.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-second);
    border: 1px solid var(--color-item-border);
    border-top: none;
    border-radius: 0 0 0.5rem 0.5rem;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    transition: all 0.3s;

    svg {
      font-size: 1rem;
      color: var(--color-main-text);
    }

    &:active {
      transform: translateX(-50%) scale(0.95);
    }
  }

  &.collapsed {
    transform: translateY(calc(-100% + 1.5rem));

    .nav-items {
      opacity: 0;
      pointer-events: none;
    }
  }
}

.main-content {
  // 移动端时为主内容区域添加顶部内边距，避免被顶部菜单遮挡
  @media (max-width: 768px) {
    padding-top: 4rem;
  }
}

// 桌面端隐藏移动端顶部菜单栏
@media (min-width: 769px) {
  .mobile-top-nav {
    display: none;
  }
}
</style>
