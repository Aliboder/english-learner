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

const siteOrigin = (process.env.ORIGIN || 'https://typewords.cc').replace(/\/$/, '')

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

function withBaseURL(path: string, baseURL: string) {
  if (!path.startsWith('/')) return path
  if (baseURL === '/') return path
  if (path === '/') return baseURL
  return `${baseURL.slice(0, -1)}${path}`
}

function toSiteURL(path: string, baseURL: string) {
  return new URL(withBaseURL(path, baseURL), siteOrigin).toString()
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
      title: 'Type Words — 免费英语单词练习 | Free English Typing Practice', // default fallback title
      htmlAttrs: {
        lang: 'zh-CN',
      },
      meta: [
        { charset: 'UTF-8' },
        //百度站长HTML标签验证
        { name: 'baidu-site-verification', content: 'codeva-NoSMtV313P' },
        //搜索引擎描述
        {
          name: 'description',
          content:
            'Type Words 官方网站 - 在线英语练习平台，支持单词、文章跟打练习，提升英语学习效率，电脑上背单词。Practice English, one strike, one step forward',
        },
        //关键词（可选，搜索引擎基本不用，但能补充信息）
        {
          name: 'keywords',
          content:
            'Type Words, Typing Word, Type Words 官网, 电脑上背单词 , 英语打字练习, 单词跟打, 文章跟打, 键盘练习, 英语学习, 文章学习, 打字练习软件, 单词记忆工具, 英语学习软件, 背单词神器, 英语肌肉记忆, 键盘工作者, 免费英语学习, 音标发音, 默写练习, 在线学英语, CET-4, CET-6, TOEFL, IELTS, GRE, GMAT, SAT, 考研英语, 专四专八, 程序员英语, JavaScript API, Node.js API, Java API, Linux命令, 编程词汇, 技术英语, VSCode插件, 开源项目, GitHub趋势榜, V2EX热搜, Gitee GVP, 少数派推荐, 英语打字训练, WPM统计, 准确率分析, 商务英语, BEC, 雅思听力, 日语学习, 多语言学习, 英语口语练习, 单词拼写训练',
        },
        { name: 'author', content: 'zyronon' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },

        //Open Graph（用于社交媒体分享，微信/QQ/知乎/Facebook 等）
        { property: 'og:title', content: 'Type Words 官网 - 英语打字练习平台' },
        {
          property: 'og:description',
          content:
            'Type Words 官方网站 - 在线英语练习平台，支持单词、文章跟打练习，提升英语学习效率，电脑上背单词。Practice English, one strike, one step forward',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://typewords.cc/' },
        { property: 'og:image', content: 'https://typewords.cc/imgs/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },

        // Twitter Card（用于 Twitter 分享）
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Type Words 官网 - 英语打字练习平台' },
        {
          name: 'twitter:description',
          content:
            'Type Words 官方网站 - 在线英语练习平台，支持单词、文章跟打练习，提升英语学习效率，电脑上背单词。Practice English, one strike, one step forward',
        },
        { name: 'twitter:image', content: 'https://typewords.cc/imgs/og-image.png' },

        //设置浏览器地址栏颜色（在 Android Chrome 特别明显
        { name: 'theme-color', content: '#818CF8' },
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
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: 'https://typewords.cc/' },
        //苹果设备（iOS Safari）在用户添加到主屏时显示的图标
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.json' },
      ],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'TypeWords',
            alternateName: ['Type Words', '词文记'],
            url: 'https://typewords.cc/',
            sameAs: ['https://github.com/zyronon/typing-word'],
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://typewords.cc/words?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'TypeWords',
            alternateName: '词文记',
            applicationCategory: 'EducationApplication',
            operatingSystem: 'Web, VSCode Extension',
            description: 'Free English typing practice and vocabulary builder. Practice words and articles, powered by FSRS spaced repetition.',
            url: 'https://typewords.cc/',
            screenshot: 'https://typewords.cc/imgs/og-image.png',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '500',
            },
          }),
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: '数据存储在哪里？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '所有数据优先保存在本地浏览器（IndexedDB / localStorage），完全离线可用。如需跨设备同步，可在设置中配置自己的 Supabase 实例，实现双向云端同步。',
                },
              },
              {
                '@type': 'Question',
                name: '支持哪些平台？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '支持所有现代浏览器（Web 端），同时提供 VSCode 扩展版，可在编写代码的同时练习单词，无需切换窗口。',
                },
              },
              {
                '@type': 'Question',
                name: '和其他单词软件有什么不同？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '核心差异在于「打字输入」与「FSRS 间隔复习算法」的结合。不是简单点击选择，而是真正键入单词，配合 7 种练习模式递进阶段，有效加深肌肉记忆与拼写能力。',
                },
              },
              {
                '@type': 'Question',
                name: '如何添加自定义词库或文章？',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '在「单词」模块可新建自定义词典并手动添加单词；在「文章」模块可添加自定义书籍和文章（支持本地音频）。完全自由，不依赖任何平台。',
                },
              },
            ],
          }),
        },
      ],
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
      exclude: ['@typewords/core', '@typewords/base'],
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
  nitro: {
    prerender: {
      ignore: appBaseURL === '/' ? [] : [withBaseURL('/manifest.json', appBaseURL)],
    },
    devProxy: {
      '/baidu': {
        target: 'https://api.fanyi.baidu.com/api/trans/vip/translate',
        changeOrigin: true,
      },
    },
  },
})
