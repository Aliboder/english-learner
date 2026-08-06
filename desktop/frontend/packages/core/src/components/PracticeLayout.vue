<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStore } from '../stores/setting'

const settingStore = useSettingStore()
defineProps<{
  panelLeft: string
}>()

// 练习区固定宽度:取设置值(px),窗口窄时自动收窄(留左右边距),保证不同单词间布局稳定
const wrapStyle = computed(() => ({
  width: `min(${settingStore.practiceAreaWidth}px, calc(100vw - 3rem))`,
}))
</script>

<template>
  <div class="flex justify-center relative">
    <div class="wrap" id="PracticeArea" :style="wrapStyle">
      <slot name="practice"></slot>
    </div>
    <div
      class="panel-wrap"
      :style="{ left: panelLeft }"
      :class="{ 'has-panel': settingStore.showPanel }"
      @click.self="settingStore.showPanel = false"
    >
      <slot name="panel"></slot>
    </div>
    <div class="footer-wrap">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wrap {
  transition: all var(--anim-time);
}

// 工具栏浮窗由 Footer 组件内部 fixed 定位(可拖拽),这里只需普通容器
.footer-wrap {
  position: relative;
  z-index: 999;
}

.panel-wrap {
  position: fixed;
  top: 0.8rem;
  z-index: 1;
  height: calc(100vh - 1.8rem);
}

@media (max-width: 1439px) {
  .panel-wrap {
    position: fixed;
    top: 0;
    left: 0 !important;
    right: 0 !important;
    bottom: 0;
    height: 100vh;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    box-sizing: border-box;

    // 当面板未显示时，禁用指针事件
    pointer-events: none;

    // 只有当面板显示时才添加背景蒙版并启用指针事件
    &.has-panel {
      background: rgba(0, 0, 0, 0.5);
      pointer-events: auto;
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .wrap {
    height: calc(100vh - 6rem);
    width: 100vw;
    padding: 0 1rem;
    box-sizing: border-box;
  }

  .footer-hide {
    .wrap {
      height: calc(100vh - 2rem) !important;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .wrap {
    height: calc(100vh - 5rem);
    padding: 0 0.5rem;
  }

  .footer-hide {
    .wrap {
      height: calc(100vh - 1.5rem) !important;
    }
  }

  .panel-wrap {
    padding: 0.5rem;
    left: 0 !important;
    right: 0 !important;
  }
}
</style>
