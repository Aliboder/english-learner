// 截图脚本:单词测试页排版检查(2026-08-06)
// 用法: env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/diag-shot-test.js
const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])

const webRoot = path.join(__dirname, '..', 'frontend', 'dist')
const userData = path.join(app.getPath('temp'), 'english-learner-diag-shot')
fs.rmSync(userData, { recursive: true, force: true })
app.setPath('userData', userData)

let win
const log = (s) => console.log('SHOT:', s)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const js = (code) => win.webContents.executeJavaScript(code)

app.whenReady().then(async () => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/') pathname = '/index.html'
    const resolved = path.normalize(path.join(webRoot, pathname))
    if (!resolved.startsWith(webRoot)) return new Response('Forbidden', { status: 403 })
    let filePath = resolved
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(webRoot, 'index.html')
    return net.fetch(pathToFileURL(filePath).toString(), { bypassCustomProtocolHandlers: true })
  })

  win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: true,
    x: -2000,
    y: -2000,
    webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  })

  try {
    await win.loadURL('app://bundle/words')
    let ready = false
    for (let i = 0; i < 30; i++) {
      ready = await js(`!!window.useNuxtApp`).catch(() => false)
      if (ready) break
      await wait(500)
    }
    if (!ready) throw new Error('页面未就绪')

    const setup = await js(`(async () => {
      let base = null
      for (let i = 0; i < 20 && !base; i++) {
        base = window.useNuxtApp().$pinia?._s?.get('base')
        if (!base) await new Promise(r => setTimeout(r, 300))
      }
      if (!base) return null
      const setting = window.useNuxtApp().$pinia._s.get('setting')
      const list = await (await fetch('app://bundle/dicts/list/word.json')).json()
      const meta = list.find(d => d.url && d.url.endsWith('.json.z'))
      const res = await fetch('app://bundle' + meta.url)
      const buf = await res.arrayBuffer()
      const ds = new DecompressionStream('deflate')
      const stream = new Blob([buf]).stream().pipeThrough(ds)
      const text = await new Response(stream).text()
      const words = JSON.parse(text)
      const dict = Object.assign({}, meta, { words, length: words.length, perDayStudyNumber: 50, lastLearnIndex: 0, complete: false, custom: false, statistics: [] })
      await base.changeDict(dict)
      setting.perDayStudyNumber = 50
      setting.autoNextWord = false
      setting.first = false
      localStorage.setItem('tour-guide', '1')
      return { name: dict.name, count: words.length, id: dict.id }
    })()`)
    log('① 词典装载: ' + JSON.stringify(setup))
    if (!setup) throw new Error('词典装载失败')

    // ===== 进入单词测试页 =====
    await js(`window.useNuxtApp().$router.push('/words-test/${setup.id}')`)
    await wait(4000)
    // 等待题目渲染
    let hasQ = false
    for (let i = 0; i < 20; i++) {
      hasQ = await js(`!!document.querySelector('.option-card')`)
      if (hasQ) break
      await wait(500)
    }
    if (!hasQ) throw new Error('题目未渲染')

    // 布局测量:各卡片位置/高度(排版是否对齐)
    const layout = await js(`(() => {
      const cards = [...document.querySelectorAll('.option-card')].map(el => {
        const r = el.getBoundingClientRect()
        return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), html: el.innerHTML.slice(0, 80) }
      })
      const q = document.querySelector('.question-card')
      const qr = q ? q.getBoundingClientRect() : null
      return {
        cards,
        question: qr ? { top: Math.round(qr.top), h: Math.round(qr.height) } : null,
        pageTitle: document.querySelector('.page-title')?.textContent,
      }
    })()`)
    log('② 布局: ' + JSON.stringify(layout))

    // ===== 截图(答题前) =====
    await wait(500)
    const img1 = await win.webContents.capturePage()
    fs.writeFileSync(path.join(__dirname, '.tmp-shot-test-1.png'), img1.toPNG())

    // ===== 点击一个选项(答题后状态)再截图 =====
    await js(`document.querySelector('.option-card').click()`)
    await wait(600)
    const img2 = await win.webContents.capturePage()
    fs.writeFileSync(path.join(__dirname, '.tmp-shot-test-2.png'), img2.toPNG())

    log('DONE 截图已保存 .tmp-shot-test-1.png / -2.png')
    app.exit(0)
  } catch (e) {
    console.error('SHOT_FAILED', e && e.message ? e.message : e)
    app.exit(1)
  }
})
