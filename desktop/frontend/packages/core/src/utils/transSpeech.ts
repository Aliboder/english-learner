import { simplifyTransCn } from './index'

// 精简翻译朗读:每个词性最多朗读的释义条数
const MAX_TRANS_PER_POS = 3

/** 词性缩写 → 中文(朗读时拼在词性组前,如「形容词:边远的、偏僻的、遥远的」;未收录的缩写原样朗读) */
const POS_LABEL: Record<string, string> = {
  n: '名词',
  v: '动词',
  vt: '及物动词',
  vi: '不及物动词',
  adj: '形容词',
  a: '形容词',
  adv: '副词',
  ad: '副词',
  prep: '介词',
  conj: '连词',
  pron: '代词',
  num: '数词',
  art: '冠词',
  int: '感叹词',
  interj: '感叹词',
  aux: '助动词',
  modal: '情态动词',
  phr: '短语',
  abbr: '缩写',
}

/** 词性中文名:先按原样查,再容错末尾点号(词库常见「adj.」) */
function posLabel(pos: string) {
  return POS_LABEL[pos] ?? POS_LABEL[pos.replace(/\.$/, '')] ?? pos
}

/**
 * 构造中文翻译朗读文本(所有朗读翻译与预加载共用,保证缓存 key 一致)。
 * 词条结构:一条 trans 的 cn 可能含多个释义片段(逗号/分号/顿号分隔,如「边远的,偏僻的,遥远的」),
 * 所以截断粒度是「释义片段」而不是「trans 条目数」。
 * @param showDetailed 是否显示详细翻译(关 = 去掉括号补充内容)
 * @param limitByPos 精简模式(开 = 每个词性累计最多读前 MAX_TRANS_PER_POS 个片段,读完转下一词性)
 * 输出格式:每个词性组拼「词性名:片段1、片段2、…」,组间分号分隔(无词性组不带标签);
 * 无论是否精简都带词性(用户要求),文本与旧版不同,旧语音缓存自然失效。
 */
export function buildTransSpeechText(
  trans: { pos?: string; cn: string }[] | undefined,
  showDetailed: boolean,
  limitByPos: boolean
): string {
  if (!trans?.length) return ''
  const items = trans
    .map(t => ({ pos: t.pos ?? '', cn: showDetailed ? t.cn : simplifyTransCn(t.cn) }))
    .filter(t => !!t.cn)
  // 按词性分组(组顺序 = 词性首次出现顺序,无词性条目归入空组),组内按 cn 拆分释义片段
  const groups: { pos: string; parts: string[] }[] = []
  const groupIndex = new Map<string, number>()
  for (const { pos, cn } of items) {
    if (!groupIndex.has(pos)) {
      groupIndex.set(pos, groups.length)
      groups.push({ pos, parts: [] })
    }
    const group = groups[groupIndex.get(pos)!]
    // 分隔符覆盖中英文逗号/分号/顿号(词库 cn 常用中文标点,如「边远的，偏僻的；遥远的」)
    for (const part of cn.split(/[,;、，；]/).map(s => s.trim()).filter(Boolean)) {
      if (limitByPos && group.parts.length >= MAX_TRANS_PER_POS) break
      group.parts.push(part)
    }
  }
  // 每组拼「词性名:释义1、释义2、释义3」,组间分号分隔(无词性组不带标签)
  return groups
    .map(g => (g.pos ? `${posLabel(g.pos)}:${g.parts.join('、')}` : g.parts.join('、')))
    .join(';')
}
