//这里合并导入，打包会报错
import { ShortcutKey, WordPracticeMode, WordPracticeStage } from '../types/enum.ts'

export const GITHUB = 'https://github.com/zyronon/TypeWords'
export const APP_NAME = 'EnglishLearner'
export const IS_DEV = import.meta.env.MODE === 'development'

const common = {}
const map = {
  DEV: {
    // 桌面版:资源全部走应用内路径,本地加载免联网
    RESOURCE_URL: '/',
    LIBS_URL: '/',
  },
}

export const ENV = Object.assign(map['DEV'], common)

export const AppEnv = {
  IS_OFFICIAL: false, // 桌面版恒为 false:词库资源全部走应用内路径,无线上资源站分支
}

// 桌面版:词库列表 + 常用词库数据已内嵌到应用内(public/dicts/),直接加载本地文件,免联网
export const DICT_LIST = {
  WORD: {
    ALL: `/dicts/list/word.json`,
    RECOMMENDED: `/dicts/list/recommend_word.json`,
  },
}

// 按键音效:13 个机械键盘轴体声音(来自 qwerty-learner/kbsim,MIT);value=文件名(拼 URL 用),label=显示名
export const SoundFileOptions = [
  { value: 'Alpacas', label: '羊驼轴 (Alpacas)' },
  { value: 'Buckling Spring', label: '屈膝弹簧 (Buckling Spring)' },
  { value: 'Cherry MX Blacks', label: 'Cherry MX 黑轴 (Blacks)' },
  { value: 'Cherry MX Blues', label: 'Cherry MX 青轴 (Blues)' },
  { value: 'Cherry MX Browns', label: 'Cherry MX 茶轴 (Browns)' },
  { value: 'Gateron Black Inks', label: 'Gateron 黑透轴 (Black Inks)' },
  { value: 'Gateron Red Inks', label: 'Gateron 红透轴 (Red Inks)' },
  { value: 'Holy Pandas', label: '圣熊猫轴 (Holy Pandas)' },
  { value: 'Kailh Box Navies', label: '凯华 Box 海军轴 (Box Navies)' },
  { value: 'NovelKeys Creams', label: '奶油轴 (NovelKeys Creams)' },
  { value: 'SKCM Blue Alps', label: 'ALPS 青轴 (SKCM Blue Alps)' },
  { value: 'Topre', label: 'Topre 静电容 (Topre)' },
  { value: 'Turquoise Tealios', label: '蒂芙尼轴 (Turquoise Tealios)' },
]
export const APP_VERSION = {
  key: 'english-learner-app-version',
  version: 6,
}
export const SAVE_DICT_KEY = {
  key: 'typing-word-dict',
  version: 4,
}
export const SAVE_SETTING_KEY = {
  key: 'typing-word-setting',
  version: 22,
}

//5版本，不再单独保存 app version字段
export const EXPORT_DATA_KEY = {
  key: 'typing-word-export',
  version: 5,
}
export const LOCAL_FILE_KEY = 'typing-word-files'
export const WEBSITE_VERSION_HASH = 'type-words-website-version-hash'
export const BACKUP_INDEX_KEY = 'type-words-backup-index'
export const BACKUP_KEY = 'type-words-backup-'

// 桌面版:第三方库已下载到应用内(public/libs),离线可用,不依赖远程 CDN
export const LIB_JS_URL = {
  JSZIP: '/libs/jszip.min.js',
  XLSX: '/libs/xlsx.full.min.js',
}
export const PronunciationApi = 'https://dict.youdao.com/dictvoice?audio='
export const DefaultShortcutKeyMap = {
  [ShortcutKey.ShowWord]: 'Escape',
  [ShortcutKey.Previous]: 'Ctrl+⬅',
  [ShortcutKey.Next]: 'Ctrl+➡',
  [ShortcutKey.Ignore]: 'Tab',
  [ShortcutKey.ToggleSimple]: '`',
  [ShortcutKey.ToggleCollect]: 'Enter',
  [ShortcutKey.NextChapter]: 'Alt+➡',
  [ShortcutKey.NextStep]: 'Shift+➡',
  [ShortcutKey.RepeatChapter]: 'Ctrl+Enter',
  [ShortcutKey.DictationChapter]: 'Alt+Enter',
  [ShortcutKey.PlayWordPronunciation]: 'Ctrl+P',
  [ShortcutKey.ToggleShowTranslate]: 'Ctrl+Z',
  [ShortcutKey.ToggleDictation]: 'Ctrl+I',
  [ShortcutKey.ToggleTheme]: 'Ctrl+Q',
  [ShortcutKey.ToggleConciseMode]: 'Ctrl+M',
  [ShortcutKey.ToggleToolbar]: 'Ctrl+B',
  [ShortcutKey.TogglePanel]: 'Ctrl+L',
  [ShortcutKey.RandomWrite]: 'Ctrl+R',
  [ShortcutKey.KnowWord]: '1',
  [ShortcutKey.UnknownWord]: '2',
  [ShortcutKey.MasteredWord]: '3',
  [ShortcutKey.ChooseA]: '1',
  [ShortcutKey.ChooseB]: '2',
  [ShortcutKey.ChooseC]: '3',
  [ShortcutKey.ChooseD]: '4',
}
export const WordPracticeModeStageMap: Record<WordPracticeMode, WordPracticeStage[]> = {
  [WordPracticeMode.Free]: [WordPracticeStage.FollowWriteNewWord, WordPracticeStage.Complete],
  [WordPracticeMode.IdentifyOnly]: [
    WordPracticeStage.IdentifyNewWord,
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.DictationOnly]: [
    WordPracticeStage.DictationNewWord,
    WordPracticeStage.DictationReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.ListenOnly]: [
    WordPracticeStage.ListenNewWord,
    WordPracticeStage.ListenReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.System]: [
    WordPracticeStage.FollowWriteNewWord,
    WordPracticeStage.ListenNewWord,
    WordPracticeStage.DictationNewWord,
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.ListenReview,
    WordPracticeStage.DictationReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.Shuffle]: [WordPracticeStage.Shuffle, WordPracticeStage.Complete],
  [WordPracticeMode.Review]: [
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.ListenReview,
    WordPracticeStage.DictationReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.ShuffleWordsTest]: null,
  [WordPracticeMode.ReviewWordsTest]: null,
}
export const WordPracticeStageNameMap: Record<WordPracticeStage, string> = {
  [WordPracticeStage.FollowWriteNewWord]: '跟写新词',
  [WordPracticeStage.IdentifyNewWord]: '自测新词',
  [WordPracticeStage.ListenNewWord]: '听写新词',
  [WordPracticeStage.DictationNewWord]: '默写新词',
  [WordPracticeStage.FollowWriteReview]: '跟写旧词',
  [WordPracticeStage.IdentifyReview]: '自测旧词',
  [WordPracticeStage.ListenReview]: '听写旧词',
  [WordPracticeStage.DictationReview]: '默写旧词',
  [WordPracticeStage.Complete]: '完成学习',
  [WordPracticeStage.Shuffle]: '随机复习',
}
export const WordPracticeModeNameMap: Record<WordPracticeMode, string> = {
  [WordPracticeMode.System]: '学习',
  [WordPracticeMode.Free]: '自由练习',
  [WordPracticeMode.IdentifyOnly]: '自测',
  [WordPracticeMode.DictationOnly]: '默写',
  [WordPracticeMode.ListenOnly]: '听写',
  [WordPracticeMode.Shuffle]: '随机复习',
  [WordPracticeMode.Review]: '复习',
  [WordPracticeMode.ShuffleWordsTest]: '随机单词测试',
  [WordPracticeMode.ReviewWordsTest]: '单词测试',
}
export const WordPracticeModeUrlMap: Record<WordPracticeMode, string> = {
  [WordPracticeMode.System]: '/practice-words',
  [WordPracticeMode.Free]: '/practice-words',
  [WordPracticeMode.IdentifyOnly]: '/practice-words',
  [WordPracticeMode.DictationOnly]: '/practice-words',
  [WordPracticeMode.ListenOnly]: '/practice-words',
  [WordPracticeMode.Shuffle]: '/practice-words',
  [WordPracticeMode.Review]: '/practice-words',
  [WordPracticeMode.ShuffleWordsTest]: '/words-test',
  [WordPracticeMode.ReviewWordsTest]: '/words-test',
}
export class DictId {
  static wordCollect = 'wordCollect'
  static wordWrong = 'wordWrong'
  static wordKnown = 'wordKnown'
  static articleCollect = 'articleCollect'
}
