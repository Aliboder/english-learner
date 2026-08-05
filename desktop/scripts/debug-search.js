// 调试:检查搜索列表在运行时的 DOM 与计算样式,确认 scoped 样式是否生效
const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

// 测试脚本用独立临时 userData,不碰开发/安装版数据
const userData = path.join(app.getPath('temp'), 'english-learner-debug-search')
fs.rmSync(userData, { recursive: true, force: true })
app.setPath('userData', userData)

const webRoot = path.join(__dirname, '..', 'frontend', 'dist')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    if (url.host !== 'bundle') return new Response('Not Found', { status: 404 })
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/') pathname = '/index.html'
    const resolved = path.normalize(path.join(webRoot, pathname))
    if (!resolved.startsWith(webRoot)) return new Response('Forbidden', { status: 403 })
    let filePath = resolved
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      const indexFallback = path.join(webRoot, 'index.html')
      filePath = fs.existsSync(indexFallback) ? indexFallback : path.join(webRoot, '200.html')
    }
    return net.fetch(pathToFileURL(filePath).toString(), { bypassCustomProtocolHandlers: true })
  })

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false, // 测试窗口不可见,避免打扰用户(2026-08-06)
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  })
  win.loadURL('app://bundle/words')

  let stage = 0
  win.webContents.on('did-finish-load', async () => {
    stage++
    try {
      if (stage === 1) {
        await new Promise(r => setTimeout(r, 15000))
        const r = await win.webContents.executeJavaScript(`(async () => {
          const input = document.querySelector('.base-input input')
          if (!input) return { error: 'no input found' }
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
          setter.call(input, 'ab')
          input.dispatchEvent(new Event('input', { bubbles: true }))
          await new Promise(r => setTimeout(r, 3000))
          const ul = document.querySelector('.suggestion-list')
          if (!ul) return { error: 'no suggestion-list rendered' }
          const li = ul.querySelector('li')
          if (!li) return { error: 'no li' }
          const wordEl = li.querySelector('.word')
          const transEl = li.querySelector('.trans')
          const cs = getComputedStyle(li)
          // scoped hash 一致性:外部 CSS 文件里必须能找到运行时 DOM 的 data-v hash
          const domHash = (Array.from(li.attributes).find(a => a.name.startsWith('data-v'))?.name ?? '').replace('data-v-', '')
          const cssHashMatch = await (async () => {
            if (!domHash) return 'no-dom-hash'
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            for (const l of links) {
              try {
                const css = await fetch(l.href).then(r => r.text())
                if (css.includes('data-v-' + domHash)) return true
              } catch (e) { /* 跨域忽略 */ }
            }
            return false
          })()
          return {
            liClass: li.className,
            liDataAttrs: Array.from(li.attributes).map(a => a.name).filter(n => n.startsWith('data-v')),
            ulDataAttrs: Array.from(ul.attributes).map(a => a.name).filter(n => n.startsWith('data-v')),
            cursor: cs.cursor,
            backgroundColor: cs.backgroundColor,
            display: cs.display,
            wordWidth: wordEl ? getComputedStyle(wordEl).width : null,
            wordDataV: wordEl ? Array.from(wordEl.attributes).map(a => a.name).filter(n => n.startsWith('data-v')) : null,
            transOverflow: transEl ? getComputedStyle(transEl).overflow : null,
            transWhiteSpace: transEl ? getComputedStyle(transEl).whiteSpace : null,
            cssHashMatch: cssHashMatch,
            domHash: domHash,
          }
        })()`)
        console.log('DEBUG_SEARCH ' + JSON.stringify(r, null, 2))
        app.exit(0)
      }
    } catch (err) {
      console.error('DEBUG_FAILED', err)
      app.exit(1)
    }
  })
  win.webContents.on('render-process-gone', (e, d) => {
    console.error('RENDERER_GONE', d.reason)
    app.exit(1)
  })
})
