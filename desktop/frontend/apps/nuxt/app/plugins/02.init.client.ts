//@ts-ignore
import VueVirtualScroller from 'vue-virtual-scroller'

export default defineNuxtPlugin(async nuxtApp => {
  nuxtApp.vueApp.use(VueVirtualScroller)
})
