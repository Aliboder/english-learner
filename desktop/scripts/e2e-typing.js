// 打字背单词回归验证(2026-08-03 移除三种学习形式后,确保打字核心流程完好)
// 用法: env -u ELECTRON_RUN_AS_NODE electron scripts/e2e-typing.js (需联网拉词库)
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
const userData = path.join(app.getPath('temp'), 'english-learner-e2e-typing')
fs.rmSync(userData, { recursive: true, force: true })
app.setPath('userData', userData)

let win
const results = []
const log = (s) => {
  console.log('E2E:', s)
  results.push(s)
}
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
    webPreferences: { autoplayPolicy: 'no-user-gesture-required' },
  })
  win.webContents.on('console-message', (event) => {
    const m = event.message || ''
    if (m.includes('Vue错误')) console.log('[renderer]', m.slice(0, 200))
  })

  try {
    // ===== 准备:装载真实词典数据(与 dict 详情页"加入学习"等效) =====
    await win.loadURL('app://bundle/words')
    // 页面就绪轮询(替代固定等待,避免加载慢时偶发误报)
    let ready = false
    for (let i = 0; i < 30; i++) {
      ready = await js(`!!window.useNuxtApp`).catch(() => false)
      if (ready) break
      await wait(500)
    }
    if (!ready) throw new Error('页面未就绪(useNuxtApp 不可用)')
    // CDN 拉取词库允许重试(网络抖动)
    let setup = null
    for (let attempt = 0; attempt < 3 && !setup?.count; attempt++) {
      setup = await js(`(async () => {
        const base = window.useNuxtApp().$pinia._s.get('base')
        const setting = window.useNuxtApp().$pinia._s.get('setting')
        const list = await (await fetch('https://files.typewords.cc/list/word.json')).json()
        const meta = list.flat().find(d => d.words === undefined) ?? list.flat()[0]
        const data = await (await fetch('https://files.typewords.cc/dicts/' + meta.language + '/word/' + meta.url)).json()
        const dict = Object.assign({}, meta, { words: data, length: data.length, perDayStudyNumber: 1, lastLearnIndex: 0, complete: false, custom: false, statistics: [] })
        await base.changeDict(dict)
        setting.perDayStudyNumber = 1
        // 固定用手动切换模式回归(自动切换路径另有设置开关,手动模式覆盖"输完停留→空格切换→落卡"完整链路)
        setting.autoNextWord = false
        setting.first = false
        localStorage.setItem('tour-guide', '1')
        return { name: dict.name, count: data.length, firstWord: data[0].word }
      })()`).catch(() => null)
      if (!setup?.count) await wait(3000)
    }
    log('① 词典装载: ' + JSON.stringify(setup))
    if (!setup || !setup.count) throw new Error('词典数据装载失败(CDN 不可达?)')

    // ===== 进入打字练习 =====
    await js(`window.useNuxtApp().$router.push('/words')`)
    await wait(3000)
    // 打印按钮文本(诊断)
    const btnList = await js(`[...document.querySelectorAll('.base-button')].map(b => b.textContent.trim().slice(0, 24))`)
    log('② 按钮列表: ' + JSON.stringify(btnList))
    // 点"自由练习"(打完词直接结算落卡,不受 System 多阶段流转影响),init() 未完成时按钮 loading 不可点,轮询重试
    let entered = false
    for (let i = 0; i < 10; i++) {
      const clicked = await js(`(() => {
        const btns = [...document.querySelectorAll('.base-button')]
        const btn = btns.find(b => b.textContent.trim() === '自由练习')
        if (btn && !btn.classList.contains('is-loading')) { btn.click(); return true }
        return false
      })()`)
      await wait(2500)
      const cur = await js(`location.href`)
      if (cur.includes('/practice-words/')) { entered = true; log('② 进入练习页: ' + cur); break }
    }
    if (!entered) throw new Error('多次点击未能进入练习页')

    // ===== 打字:读取当前显示的单词,逐个字母模拟键盘输入 =====
    let target = ''
    for (let i = 0; i < 20; i++) {
      target = await js(`(() => {
        const el = document.querySelector('.typing-word .word .letter')
        const t = el ? el.textContent.trim() : ''
        return { t, hasTyping: !!document.querySelector('.typing-word') }
      })()`)
      if (target && target.t) { target = target.t; break }
      await wait(500)
    }
    if (!target) throw new Error('无法读取当前练习单词')
    log('③ 目标单词: ' + target)
    // 通过隐藏 input 派发 input 事件触发打字(TypeWords 的合成键盘机制)
    for (const ch of target) {
      const typed = await js(`(() => {
        const input = document.querySelector('#typing-listener')
        if (!input) return false
        input.value = ${JSON.stringify(ch)}
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })()`)
      if (!typed) throw new Error('找不到 #typing-listener 输入框')
      if (target.indexOf(ch) === 1) {
        const dbg = await js(`(() => {
          const el = document.querySelector('.typing-word .word .letter')
          const inp = document.querySelector('.typing-word .word .input')
          return { letter: el?.textContent?.trim(), input: inp?.textContent?.trim(), hi: document.querySelector('#typing-listener')?.value }
        })()`)
        log('  输入2字符后: ' + JSON.stringify(dbg))
      }
      await wait(150)
    }
    // 手动切换模式:输完后停留显示完整信息,等待超过空格冷却(默认300ms)后按空格键切换到下一个
    await wait(500)
    await js(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', keyCode: 32, bubbles: true, cancelable: true }))
      return true
    })()`)
    // 等待判分/落卡
    await wait(3000)

    // ===== 验证:FSRS 卡落库 + lastLearnIndex 推进 =====
    const check = await js(`(async () => {
      const base = window.useNuxtApp().$pinia._s.get('base')
      const word = ${JSON.stringify(target.toLowerCase())}
      const card = base.fsrsData[word]
      return {
        hasCard: !!card,
        state: card ? card.state : null,
        due: card ? String(card.due) : null,
        lastLearnIndex: base.sdict.lastLearnIndex,
        complete: base.sdict.complete,
      }
    })()`)
    log('④ FSRS 检查: ' + JSON.stringify(check))
    if (!check.hasCard) throw new Error('FSRS 卡未落库!打字判分链路可能损坏')
    if (check.lastLearnIndex < 1) throw new Error('lastLearnIndex 未推进')

    log('✅ 打字模式回归通过')
    console.log('E2E_RESULT ' + JSON.stringify({ pass: true, results }))
    app.exit(0)
  } catch (e) {
    console.error('E2E_FAILED', e && e.message ? e.message : e)
    app.exit(1)
  }
})
