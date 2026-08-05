import { onUnmounted, watch, type WatchSource } from 'vue'

//因为如果用useStartKeyboardEventListener局部变量控制，当出现多个hooks时就不行了，所以用全局变量来控制
export function useDisableEventListener(watchVal: WatchSource<unknown>) {
  if (typeof window === 'undefined') return
  watch(
    watchVal,
    n => {
      window.disableEventListener = Boolean(n)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    window.disableEventListener = false
  })
}

export default class utils {}
