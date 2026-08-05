declare global {
  interface Console {
    parse(v: any): void

    json(v: any, space: number): string
  }

  interface Window {
    umami: {
      track(name: string, data?: any): void
    },
    LA: any,
    dataLayer: any,
    JSZip: any,
    __CURRENT_WORD_INFO__?: {
      word: string,
      input: string,
      inputLock: boolean,
      containsSpace: boolean
    }
  }
}
export {}
