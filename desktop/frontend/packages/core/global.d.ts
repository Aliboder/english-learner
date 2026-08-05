/// <reference types="vite/client" />

declare module 'node-forge'

declare global {
  interface Console {
    parse(v: any): void

    json(v: any, space: number): string
  }

  interface Window {
    umami: {
      track(name: string, data?: any): void
    }
    disableEventListener: boolean
    LA: any
    dataLayer: any
    JSZip: any
    __CURRENT_WORD_INFO__?: {
      word: string
      input: string
      inputLock: boolean
      containsSpace: boolean
    }
  }

  interface ImportMeta {
    client: boolean
    server: boolean
    env: ImportMetaEnv
  }

  interface ImportMetaEnv {
    readonly VITE_PASSWORD_RSA_PUBLIC_KEY?: string
  }
}
export {}
