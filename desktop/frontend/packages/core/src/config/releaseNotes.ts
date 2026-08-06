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
    date: '2026-08-06',
    title: '细节打磨与稳定性加固',
    summary: '按键音量倍数滑条、复习按钮重设计、学习记录表格美化、保存链路加固',
    features: [
      { type: 'improve', title: '按键音量改为倍数滑条', desc: '按键音放大倍数 10~100 倍可调(默认 10 倍),滑条带试听;按键音文件更换为官方原版' },
      { type: 'improve', title: '复习按钮重设计', desc: '「我认识/不认识/已掌握」移到单词与中文翻译中间,胶囊按钮样式,支持快捷键 1/2/3' },
      { type: 'improve', title: '学习记录表格美化', desc: '卡片状态彩色胶囊、到期单词红色高亮、难度/稳定性着色,数字更易读' },
      { type: 'fix', title: '保存链路加固', desc: '保存/结算失败不再卡死界面并明确提示;损坏的备份导入前拦截,不会误清数据;错误日志可完整查看' },
      { type: 'improve', title: '其他细节', desc: '练习页单词字符间距默认调整为 2px,观感更紧凑' },
    ],
  },
  {
    version: 6,
    date: '2026-08-06',
    title: '切词重构与单词测试美化',
    summary: '切词滑动动画、顶栏进度可视化、默写单行统一、单词测试卡片化',
    features: [
      { type: 'new', title: '切词系统重构', desc: '左右词隐藏,当前词居中;切下一个词向左滑动、切上一个词向右滑动(同屏交错动画)' },
      { type: 'improve', title: '顶栏进度可视化', desc: '顶栏显示当前阶段(跟写新词/复习·默写等)与组内位置(跟写 4/7 · 第2组);进度条连续前进不回退,完成一天任务时走满;阶段切换有提示' },
      { type: 'improve', title: '默写统一为单行', desc: '默写新词不再单独开拼写格子,与跟写/听写一致在词位输入;输完自动显示答案' },
      { type: 'new', title: '单词测试美化', desc: '选项卡片化(字母徽章/答题红绿反馈/对勾叉),题目显示音标,顶部进度条;卡片宽度跟随练习区宽度,翻译字号可在设置中调节;测试页新增设置按钮' },
      { type: 'fix', title: '主页今日任务', desc: '今日新词数显示「剩余量」(每日目标-今日已学),学完显示 0,不再永远显示下一批 20 个' },
    ],
  },
  {
    version: 25,
    date: '2026-08-06',
    title: '设置整理与按键音升级',
    summary: '设置界面全面重构、机械键盘轴体按键音、查词排序优化',
    features: [
      { type: 'improve', title: '设置界面全面整理', desc: '9 大分类(通用/练习/声音/记忆曲线/数据管理/快捷键/更新日志/帮助/关于),内容归位,主设置窗口可拖拽' },
      { type: 'improve', title: '声音设置重构', desc: '总音量/总倍速分项独立调节(单词发音/按键音量/效果音量,单词/翻译/例句语速),每项带试听喇叭,调节即听' },
      { type: 'new', title: '机械键盘轴体按键音', desc: '13 种真实机械键盘音效(Cherry MX 黑/青/茶轴、圣熊猫、蒂芙尼、Topre 静电容等),默认羊驼轴' },
      { type: 'improve', title: '默认配置优化', desc: '新用户默认显示词源与相关词,关闭详细翻译/上下词/自动切换,练习体验更聚焦' },
      { type: 'fix', title: '查词排序优化', desc: '输入单词时最匹配的结果置顶(精确匹配 > 前缀 > 包含,组内按词长排序)' },
    ],
  },
  {
    version: 4,
    date: '2026-08-06',
    title: '项目清理与体积优化',
    summary: '移除上游残留内容,包名统一,导入模板本地化,安装包更小',
    features: [
      { type: 'improve', title: '上游残留清理', desc: '移除 TypeWords 在线站残留(SEO/官网内容/无用页面),删除死代码与 100MB 冗余备份,仓库更干净' },
      { type: 'improve', title: '包名统一', desc: '内部包名统一为 @english-learner,导入页简化(仅单词导入),模板文件本地生成,完全离线可用' },
    ],
  },
  {
    version: 3,
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
