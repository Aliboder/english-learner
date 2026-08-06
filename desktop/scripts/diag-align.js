// 诊断脚本:默写模式下,主格(中格)在「遮挡 ↔ 显示单词」切换时是否居中/偏移(2026-08-06)
// 用法: env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/diag-align.js
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
const userData = path.join(app.getPath('temp'), 'english-learner-diag-align')
fs.rmSync(userData, { recursive: true, force: true })
app.setPath('userData', userData)

let win
const log = (s) => console.log('DIAG:', s)
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
    show: true, // 可见窗口(移到屏幕外):隐藏窗口下 rAF 动画可能不执行,导致过渡卡在 from 阶段
    x: -2000,
    y: -2000,
    webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  })

  try {
    // ===== 准备:装载本地内置词库(免联网) =====
    await win.loadURL('app://bundle/words')
    let ready = false
    for (let i = 0; i < 30; i++) {
      ready = await js(`!!window.useNuxtApp`).catch(() => false)
      if (ready) break
      await wait(500)
    }
    if (!ready) throw new Error('页面未就绪')

    const setup = await js(`(async () => {
      // 等待 base store 注册完成(02.init 插件挂载 pinia 后才有)
      let base = null
      for (let i = 0; i < 20 && !base; i++) {
        base = window.useNuxtApp().$pinia?._s?.get('base')
        if (!base) await new Promise(r => setTimeout(r, 300))
      }
      if (!base) return null
      const setting = window.useNuxtApp().$pinia._s.get('setting')
      // 读本地词库列表,选第一个内置词库
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
      setting.perDayStudyNumber = 50 // 多词模式,next/prev 才能真正切词(1 词会直接走结算)
      setting.autoNextWord = false
      setting.first = false
      localStorage.setItem('tour-guide', '1')
      return { name: dict.name, count: words.length, firstWord: words[0].word }
    })()`)
    log('① 词典装载: ' + JSON.stringify(setup))
    if (!setup || !setup.count) throw new Error('词典装载失败')

    // ===== 进入自由练习 =====
    await js(`window.useNuxtApp().$router.push('/words')`)
    await wait(3000)
    let entered = false
    for (let i = 0; i < 10; i++) {
      await js(`(() => {
        const btns = [...document.querySelectorAll('.base-button')]
        const btn = btns.find(b => b.textContent.trim() === '自由练习')
        if (btn && !btn.classList.contains('is-loading')) { btn.click(); return true }
        return false
      })()`)
      await wait(2500)
      const cur = await js(`location.href`)
      if (cur.includes('/practice-words/')) { entered = true; log('② 进入练习页'); break }
    }
    if (!entered) throw new Error('未能进入练习页')
    // 顶栏状态显示验证:阶段名 + 位置数字
    const toolbar = await js(`(() => {
      const status = document.querySelector('.top-toolbar .status-row')
      const nums = document.querySelector('.top-toolbar .nums')
      return { status: status ? status.textContent.trim() : null, nums: nums ? nums.textContent.trim() : null }
    })()`)
    log('②b 顶栏显示: ' + JSON.stringify(toolbar))
    // System 模式组内显示验证(临时切模式,验证后恢复)
    const sysCheck = await js(`(async () => {
      const setting = window.useNuxtApp().$pinia._s.get('setting')
      const before = setting.wordPracticeMode
      setting.wordPracticeMode = 0 // System
      await new Promise(r => setTimeout(r, 200))
      const status = document.querySelector('.top-toolbar .status-row')
      const nums = document.querySelector('.top-toolbar .nums')
      const r = { status: status ? status.textContent.trim() : null, nums: nums ? nums.textContent.trim() : null }
      setting.wordPracticeMode = before
      return r
    })()`)
    log('②c System 模式显示: ' + JSON.stringify(sysCheck))

    // 等待单词渲染 + 字体加载(宽度测量依赖字体)
    await wait(1500)
    await js(`document.fonts.ready`).catch(() => {})

    // ===== 开启默写模式 =====
    await js(`(() => {
      const setting = window.useNuxtApp().$pinia._s.get('setting')
      setting.dictation = true
      return true
    })()`)
    await wait(800)

    // ===== 测量函数:单格(当前词)相对打字区容器的居中 + 过渡类 =====
    // 注入到页面:measure() 返回 word-cell 几何 + transform + 过渡类名
    await js(`window.__diag = {
      measure() {
        const cell = document.querySelector('.word-cell')
        const wrap = document.querySelector('#PracticeArea') // 练习区容器(居中基准)
        const word = document.querySelector('#word')
        if (!cell) return null
        const cr = cell.getBoundingClientRect()
        const wr = wrap ? wrap.getBoundingClientRect() : null
        const wordR = word ? word.getBoundingClientRect() : null
        return {
          cellCenter: Math.round((cr.left + cr.right) / 2),
          cellLeft: Math.round(cr.left),
          cellWidth: Math.round(cr.width),
          cellHeight: Math.round(cr.height),
          wrapCenter: wr ? Math.round((wr.left + wr.right) / 2) : null,
          offsetX: wr ? Math.round(cr.left - wr.left) : null, // cell 相对练习区左缘
          wordCenter: wordR ? Math.round((wordR.left + wordR.right) / 2) : null,
          wordWidth: wordR ? Math.round(wordR.width) : null,
          transform: getComputedStyle(cell).transform,
          classes: cell.className,
          wordHtml: word ? word.innerHTML.slice(0, 120) : null,
        }
      },
      showWord() {
        const w = document.querySelector('#word')
        if (w) w.dispatchEvent(new MouseEvent('mouseenter'))
      },
      hideWord() {
        const w = document.querySelector('#word')
        if (w) w.dispatchEvent(new MouseEvent('mouseleave'))
      },
      type(ch) {
        const input = document.querySelector('#typing-listener')
        if (!input) return false
        input.value = ch
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      },
      currentWord() {
        const cell = document.querySelector('.word-cell')
        return cell ? (cell.textContent || '').trim().slice(0, 40) : ''
      },
      lastKeyEvents() {
        return (window.__diag_keyEvents || []).slice(-6)
      },
    }; true`)  // 返回 true:对象含函数无法跨进程克隆
    // keydown 捕获器(capture 阶段先于页面监听器):调试快捷键是否到达/被处理
    await js(`window.__diag_keyEvents = []
      window.addEventListener('keydown', (e) => {
        window.__diag_keyEvents.push({ key: e.key, ctrlKey: e.ctrlKey, preventedAfter: e.defaultPrevented })
        if (window.__diag_keyEvents.length > 30) window.__diag_keyEvents.shift()
      })
      true`)
    const measure = () => js(`window.__diag.measure()`)
    const showWord = () => js(`window.__diag.showWord()`)
    const hideWord = () => js(`window.__diag.hideWord()`)
    const type = (ch) => js(`window.__diag.type(${JSON.stringify(ch)})`)
    // 真实键盘事件(比 dispatchEvent 更接近用户操作,能触发 Electron 层快捷键处理)
    const sendKey = (keyCode, modifiers = []) => {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
    }

    // ===== 场景 1:遮挡初始状态 =====
    let m = await measure()
    log('③ 遮挡(初始): ' + JSON.stringify(m))
    // dict-line 样式检查:color 必须 transparent(遮挡生效),background-position 必须 0% 100%(横线在底部)
    const dl = await js(`(() => {
      const el = document.querySelector('.dict-line')
      if (!el) return null
      const cs = getComputedStyle(el)
      return { color: cs.color, bgPos: cs.backgroundPosition, bgSize: cs.backgroundSize }
    })()`)
    log('③b dict-line 样式: ' + JSON.stringify(dl))

    // ===== 场景 2:显示单词(mouseenter)→ 遮挡(mouseleave) =====
    await showWord()
    await wait(600)
    m = await measure()
    log('④ 显示(悬停): ' + JSON.stringify(m))

    await hideWord()
    await wait(300)
    m = await measure()
    log('⑤ 重新遮挡: ' + JSON.stringify(m))

    // ===== 场景 3:快速切换 5 次(悬停显示↔隐藏) =====
    for (let i = 0; i < 5; i++) {
      await showWord()
      await wait(120)
      await hideWord()
      await wait(120)
    }
    await wait(800)
    m = await measure()
    log('⑥ 快速切换5次后(遮挡): ' + JSON.stringify(m))

    // ===== 场景 4:输入 3 个字母(遮挡中打字)→ 显示 =====
    const target = setup.firstWord
    for (let i = 0; i < Math.min(3, target.length); i++) {
      await type(target[i])
      await wait(150)
    }
    await wait(300)
    m = await measure()
    log('⑦ 输入3字符(遮挡): ' + JSON.stringify(m))
    await showWord()
    await wait(600)
    m = await measure()
    log('⑧ 输入3字符(显示): ' + JSON.stringify(m))
    await hideWord()
    await wait(300)

    // ===== 场景 5:切下一个(→ 向左滑) =====
    // 输入剩余部分(场景 4 已输 "can")→ 输完 → Space 切词(与 e2e 同路径,已验证可用)
    const info = await js(`window.__CURRENT_WORD_INFO__`)
    const cur = await js(`window.__diag.currentWord()`)
    const rest = (cur || '').slice(info && info.input ? info.input.length : 0)
    log('⑧b 输入剩余: ' + JSON.stringify({ cur, have: info && info.input, rest }))
    for (const ch of rest) {
      await type(ch)
      await wait(100)
    }
    await wait(600) // 输完停留
    const before = await js(`window.__diag.currentWord()`)
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', keyCode: 32, bubbles: true, cancelable: true }))`) // 空格 → 下一个
    // 动画全程采样:每 100ms 记录一次(leave + enter 两个元素),观察过渡是否真正执行
    const samples = []
    for (let i = 0; i < 8; i++) {
      await wait(100)
      samples.push(await js(`(() => {
        return [...document.querySelectorAll('.word-cell')].map(el => {
          const r = el.getBoundingClientRect()
          return {
            t: getComputedStyle(el).transform,
            c: el.className.replace('word-cell ', ''),
            w: (el.textContent || '').trim().slice(0, 12),
            left: Math.round(r.left),
            top: Math.round(r.top),
          }
        })
      })()`))
    }
    log('⑨ 切下一个·动画全程: ' + JSON.stringify(samples))

    // ===== 场景 6:切上一个(→ 向右滑)+ 连续切词残留 =====
    // 尝试 Ctrl+左 快捷键(与真实用户一致);并记录 keydown 捕获器调试
    await js(`window.__diag_keyEvents = []`)
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, ctrlKey: true, bubbles: true, cancelable: true }))`) // Ctrl+左 → 上一个
    await wait(100)
    const keys = await js(`window.__diag.lastKeyEvents()`)
    log('⑪b Ctrl+左 keydown 捕获: ' + JSON.stringify(keys))
    m = await measure()
    log('⑫ 切上一个·动画中: ' + JSON.stringify(m))
    await wait(700)
    m = await measure()
    log('⑬ 切上一个·动画后: ' + JSON.stringify(m))
    const afterPrev = await js(`window.__diag.currentWord()`)
    log('⑭ 词变化: ' + JSON.stringify({ afterPrev }))
    // 连续切词 5 次(验证无残留)
    for (let i = 0; i < 5; i++) {
      await js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', keyCode: 32, bubbles: true, cancelable: true }))`)
      await wait(600)
    }
    m = await measure()
    log('⑮ 连续切词5次后: ' + JSON.stringify(m))

    // ===== 默写(Dictation)类型:单行 + 输完自动出答案验证 =====
    const dCheck = await js(`(async () => {
      const setting = window.useNuxtApp().$pinia._s.get('setting')
      const beforeType = setting.wordPracticeType
      const beforeDict = setting.dictation
      setting.wordPracticeType = 4 // Dictation(默写)
      setting.dictation = true // 默写遮挡
      await new Promise(r => setTimeout(r, 400))
      const wordEl = document.querySelector('#word')
      const hasGrid = !!document.querySelector('.dictation') // 旧拼写格子应不存在
      const listener = document.querySelector('#typing-listener')
      if (!wordEl || !listener) return null
      // 输入完整单词(从 DOM 读词形;遮挡时 letter 全文 = 完整词)
      const target = (wordEl.querySelector('.dict-line')?.textContent || '').trim()
      for (const ch of target) {
        listener.value = ch
        listener.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise(r => setTimeout(r, 120))
      }
      await new Promise(r => setTimeout(r, 400))
      const htmlAfter = wordEl.innerHTML.slice(0, 160)
      // 完成判定:input span 显示完整词(答案已展示)+ inputLock 锁定(不能再输入)
      const inputEl = wordEl.querySelector('.input')
      const r = {
        hasOldGrid: hasGrid,
        target,
        inputShown: inputEl ? inputEl.textContent : null,
        inputLock: window.__CURRENT_WORD_INFO__?.inputLock,
        htmlAfter,
      }
      // 再输入一个字母:应被锁定(input 不变)
      listener.value = 'x'
      listener.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise(r => setTimeout(r, 250))
      r.afterExtraInput = wordEl.querySelector('.input')?.textContent
      setting.wordPracticeType = beforeType
      setting.dictation = beforeDict
      return r
    })()`)
    log('⑯ 默写输完自动出答案: ' + JSON.stringify(dCheck))

    // 汇总偏移:主格中心 - 容器中心
    log('DONE')
    app.exit(0)
  } catch (e) {
    console.error('DIAG_FAILED', e && e.message ? e.message : e)
    app.exit(1)
  }
})
