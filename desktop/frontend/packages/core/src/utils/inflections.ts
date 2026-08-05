// 词形变化解析:ECDICT exchange 字段(如 "d:cancelled/p:cancelled/i:cancelling/3:cancels/s:cancels")
// 常见前缀: p=过去式 d=过去分词 i=现在分词 3=第三人称单数 s=复数 r=比较级 t=最高级

const EXCHANGE_LABELS: Record<string, string> = {
  p: '过去式',
  d: '过去分词',
  i: '现在分词',
  3: '第三人称单数',
  s: '复数',
  r: '比较级',
  t: '最高级',
  0: '原型',
}

export type Inflection = { label: string; value: string }

export function parseInflections(raw?: string | null): Inflection[] {
  if (!raw) return []
  return raw
    .split('/')
    .map(part => {
      const idx = part.indexOf(':')
      if (idx <= 0) return null
      const key = part.slice(0, idx)
      const value = part.slice(idx + 1).trim()
      if (!value) return null
      return { label: EXCHANGE_LABELS[key] ?? key, value }
    })
    .filter((x): x is Inflection => x !== null)
}
