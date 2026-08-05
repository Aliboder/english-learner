// 预加载脚本:给页面暴露最小化的桌面环境信息 + 自动备份 IPC
const { contextBridge, ipcRenderer } = require('electron')

// 版本号由主进程通过 additionalArguments 传入(沙箱 preload 拿不到 app)
const versionArg = process.argv.find(a => a.startsWith('--app-version='))
const version = versionArg ? versionArg.split('=')[1] : ''

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  version,
  // 自动备份:窗口关闭前主进程发来请求 → 页面回调中组装数据
  onAutoBackupRequest(cb) {
    ipcRenderer.on('request-auto-backup', () => cb())
  },
  // 把备份 JSON 内容交给主进程写入「文档/EnglishLearner备份」
  saveBackup(content) {
    ipcRenderer.send('auto-backup-save', content)
  },
  // 备份处理完成,告知主进程可以真正关闭窗口
  backupDone() {
    ipcRenderer.send('auto-backup-done')
  },
  // 自动备份文件列表/读取(数据管理-一键恢复)
  listAutoBackups() {
    return ipcRenderer.invoke('auto-backup-list')
  },
  readAutoBackup(name) {
    return ipcRenderer.invoke('auto-backup-read', name)
  },
  // 中文朗读:微软 Edge TTS 在线合成,返回 mp3 data URL(失败返回 null)
  // cfg: { voice(音色), lengthScale(语速,越大越快) }
  speakText(text, cfg) {
    return ipcRenderer.invoke('tts-speak', text, cfg ?? null)
  },
  // 预下载单词发音(有道在线,主进程代理绕开 CORS):返回 mp3 data URL(失败返回 null)
  fetchWordAudio(word, type) {
    return ipcRenderer.invoke('fetch-word-audio', word, type)
  },
  // 日志:读取最近日志内容 / 打开日志目录(设置-帮助-日志)
  readLog() {
    return ipcRenderer.invoke('read-log')
  },
  openLogDir() {
    return ipcRenderer.invoke('open-log-dir')
  },
  // 窗口置顶开关(设置-通用-窗口置顶)
  setAlwaysOnTop(flag) {
    return ipcRenderer.invoke('set-always-on-top', flag)
  },
})
