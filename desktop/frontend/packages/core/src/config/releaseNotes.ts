import { APP_VERSION } from './env'

export type ReleaseFeatureType = 'new' | 'improve' | 'fix'

export interface ReleaseFeature {
  type: ReleaseFeatureType
  title: string
  desc?: string
}

export interface ReleaseVersion {
  version: number
  date: string
  title: string
  summary: string
  features: ReleaseFeature[]
}

export const RELEASE_NOTES: ReleaseVersion[] = [
  {
    version: APP_VERSION.version,
    date: '2026-08-05',
    title: '发布前打磨完成',
    summary: '例句朗读、自动切换、全局字体、性能与体积优化,纯中文界面',
    features: [
      { type: 'new', title: '例句朗读', desc: '微软 Edge TTS 朗读单词例句,点击喇叭播放不自动发声,预加载缓存点击零延迟' },
      { type: 'new', title: '自动切换开关', desc: '输完单词可自动跳转;也可关闭后停留显示完整信息,按空格或「下一个」快捷键切换' },
      { type: 'new', title: '全局字体', desc: '内置 MiSans 10 个字重,设置中一键切换,整个界面统一生效' },
      { type: 'new', title: '词库扩展', desc: '新增中考/高考真题/人教版教材同步/巧记速记/考研926/专升本/牛津3000 等 16 个词库,内置达 33 个,全部离线可用' },
      { type: 'improve', title: '练习页细节', desc: '单词字符间距可调、设置浮窗可拖拽、窗口置顶、输完单词切换提示' },
      { type: 'improve', title: '性能与体积', desc: '打字切词提速、练习缓存恢复提速、词库压缩(安装后占用 179→72MB)' },
      { type: 'fix', title: '纯中文界面', desc: '移除多语言仅保留中文,修复翻译与进度显示问题' },
    ],
  },
  {
    version: 16,
    date: '2026-06-22',
    title: '练习体验与导入升级',
    summary: '重复播放单词、点击查词、导入流程全面优化',
    features: [
      { type: 'new', title: '点击查词', desc: '练习时点击单词即可查看释义' },
      { type: 'improve', title: '重复播放单词', desc: '支持重复播放当前单词，并可降低语速' },
      { type: 'improve', title: '导入流程优化', desc: '单词与文章导入界面更清晰，操作更直观' },
      { type: 'new', title: '文章标题发音', desc: '文章标题和问题支持语音播放' },
      { type: 'new', title: '自定义复习范围', desc: '随机复习/测试时可自定义单词范围' },
    ],
  },
  {
    version: 2,
    date: '2025-08-10',
    title: '2.0 全新改版',
    summary: '全新 UI、短语例句、近义词与文章编辑能力',
    features: [
      { type: 'new', title: '全新 UI', desc: '界面与交互全面重新设计' },
      { type: 'new', title: '短语与例句', desc: '单词学习支持短语和例句展示' },
      { type: 'new', title: '近义词', desc: '单词详情新增近义词信息' },
      { type: 'improve', title: '文章编辑', desc: '完善文章编辑、导入、导出等功能' },
      { type: 'new', title: '自动播放下一篇', desc: '文章练习支持自动播放下一篇' },
    ],
  },
  {
    version: 1,
    date: '2025-07-19',
    title: '首次发布',
    summary: 'TypeWords 1.0 正式上线',
    features: [{ type: 'new', title: '核心打字练习', desc: '支持单词与文章的键盘打字练习' }],
  },
]

export function getCurrentRelease(): ReleaseVersion | undefined {
  return RELEASE_NOTES.find(r => r.version === APP_VERSION.version)
}
