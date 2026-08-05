// https://nuxt.com/docs/api/configuration/nuxt-config
//@ts-ignore
import { resolve } from 'pathe'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { defineNuxtConfig } from 'nuxt/config'

// 本项目无 git 仓库(源码手动分发),提交信息恒为 unknown;若以后接入 git 再启用 execSync 读取
let latestCommitHash = 'unknown'
let latestCommitTime = 'unknown'

function normalizeBaseURL(baseURL: string = '/') {
  if (!baseURL) return '/'

  let normalizedBaseURL = baseURL.trim()

  if (!normalizedBaseURL.startsWith('/')) {
    normalizedBaseURL = `/${normalizedBaseURL}`
  }
  if (!normalizedBaseURL.endsWith('/')) {
    normalizedBaseURL = `${normalizedBaseURL}/`
  }

  return normalizedBaseURL.replace(/\/{2,}/g, '/')
}

const appBaseURL = normalizeBaseURL(process.env.NUXT_APP_BASE_URL || '/')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    baseURL: appBaseURL,
    // keepalive: true,
    // 页面切换淡入淡出(与 words.vue 的 keepalive 兼容,不影响组件缓存)
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'EnglishLearner — 打字背单词',
      htmlAttrs: {
        lang: 'zh-CN',
      },
      meta: [
        { charset: 'UTF-8' },
        // 阻止 iOS 自动把数字识别为电话号码
        // HandheldFriendly 和 MobileOptimized 是旧手机浏览器的优化提示（现在作用不大）。
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'HandheldFriendly', content: 'True' },
        { name: 'MobileOptimized', content: '320' },
        // referrer 控制请求来源信息
        { name: 'referrer', content: 'origin-when-cross-origin' },
        // color-scheme 告诉浏览器支持亮/暗模式
        { name: 'color-scheme', content: 'light dark' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/icon.png' }],
    },
  },
  // ssr: false,
  routeRules: {
    '/words': { ssr: false },
  },
  vite: {
    optimizeDeps: {
      // 排除 workspace 包预构建:避免 vite 缓存 packages/core、base 的旧源码,
      // 导致"改了源码但构建仍用缓存旧版本 / scoped hash 分叉"(技术要点 5、11)
      exclude: ['@english-learner/core', '@english-learner/base'],
    },
    plugins: [
      Components({
        resolvers: [
          IconsResolver({
            prefix: 'Icon',
          }),
        ],
      }),
      Icons({
        autoInstall: true,
      }),
    ],
  },
  // 模块
  modules: ['@pinia/nuxt', '@unocss/nuxt', 'unplugin-icons/nuxt', '@vue-macros/nuxt', '@nuxtjs/i18n', '@nuxt/image'],
  // i18n 配置(单语言:仅中文)
  i18n: {
    locales: [{ code: 'zh', language: 'zh-CN', file: 'zh.json', name: '中文' }],
    defaultLocale: 'zh',
    detectBrowserLanguage: false,
    // langDir:'app/i18n/',
    strategy: 'no_prefix',
  },
  // CSS
  css: ['~/assets/css/main.scss'],
  // 别名配置
  alias: {
    '@': resolve(__dirname, 'app'),
  },
  // 自动导入配置
  imports: {
    dirs: ['app/composables/**', 'app/utils/**'],
  },
  // 组件自动导入目录
  components: [
    { path: 'components', pathPrefix: false },
    { path: 'app/components', pathPrefix: false },
  ],
  // 运行时配置
  runtimeConfig: {
    public: {
      latestCommitHash: latestCommitHash + (process.env.NODE_ENV === 'production' ? '' : ' (dev)'),
      latestCommitTime: latestCommitTime,
    },
  },
  // 构建配置
  build: {
    transpile: ['vue-virtual-scroller', 'vxe-table'],
  },
  // 实验性功能
  experimental: {
    payloadExtraction: false, // 禁用 payload 提取，减少构建体积
  },
  // TypeScript 配置
  typescript: {
    strict: false,
    typeCheck: false, // 构建时不进行类型检查，加快构建速度
    tsConfig: {
      compilerOptions: {
        types: ['vue-macros/macros-global'],
        allowImportingTsExtensions: true,
      },
    },
  },
  devServer: {
    port: 5567,
  },
})
