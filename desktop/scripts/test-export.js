// 测试:数据导出功能(设置-数据管理-导出数据备份 ZIP)
// 驱动 UI 点击导出 → 捕获下载 → 校验 zip 文件
const { app, BrowserWindow, protocol, net, session } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

// 测试脚本用独立临时 userData,不碰开发/安装版数据
const userData = path.join(app.getPath('temp'), 'english-learner-test-export')
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

  // 捕获导出下载
  const downloadPath = path.join(app.getPath('downloads'), 'test-export-result.zip')
  session.defaultSession.on('will-download', (event, item) => {
    item.setSavePath(downloadPath)
    item.once('done', (ev, state) => {
      console.log('DOWNLOAD_DONE state=' + state + ' path=' + downloadPath)
      if (state === 'completed') {
        verifyZip()
      } else {
        console.log('EXPORT_TEST_FAILED download state=' + state)
        app.exit(1)
      }
    })
  })

  function verifyZip() {
    // 用 python 解压校验
    const { execSync } = require('child_process')
    try {
      const out = execSync(
        `python -c "import zipfile,json; z=zipfile.ZipFile(r'${downloadPath.replace(/'/g, "''")}'); print('ZIP_FILES', z.namelist()); d=json.loads(z.read('data.json')); print('DATA_VERSION', d.get('version')); print('DATA_KEYS', list(d.get('val',{}).keys()))"`,
        { encoding: 'utf-8' }
      )
      console.log(out.trim())
      console.log('EXPORT_TEST_OK')
      app.exit(0)
    } catch (e) {
      console.log('VERIFY_FAILED', String(e).slice(0, 500))
      app.exit(1)
    }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  win.loadURL('app://bundle/words')

  let stage = 0
  win.webContents.on('did-finish-load', async () => {
    stage++
    try {
      if (stage === 1) {
        await new Promise(r => setTimeout(r, 5000))
        const r = await win.webContents.executeJavaScript(`(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms))
          const btnByText = (txt) => [...document.querySelectorAll('*')].find(b => b.textContent.trim() === txt && b.children.length === 0)
          // 1. 打开设置浮窗
          const settingBtn = btnByText('设置')
          if (!settingBtn) return { error: '设置按钮未找到' }
          settingBtn.click()
          await sleep(1000)
          // 2. 切到数据管理 tab
          const dataTab = [...document.querySelectorAll('.tab')].find(t => t.textContent.includes('数据管理'))
          if (!dataTab) return { error: '数据管理 tab 未找到' }
          dataTab.click()
          await sleep(600)
          // 3. 点击导出按钮
          const exportBtn = btnByText('导出数据备份(ZIP)')
          if (!exportBtn) return { error: '导出按钮未找到' }
          exportBtn.click()
          return { ok: '已点击导出,等待下载' }
        })()`)
        console.log('EXPORT_CLICK ' + JSON.stringify(r))
        if (r.error) app.exit(1)
        // 等待下载完成(最多 20s)
        setTimeout(() => {
          if (fs.existsSync(downloadPath)) {
            // 下载可能已完成但事件已处理
          } else {
            console.log('EXPORT_TEST_TIMEOUT no file')
            app.exit(1)
          }
        }, 20000)
      }
    } catch (err) {
      console.error('EXPORT_TEST_FAILED', err)
      app.exit(1)
    }
  })
})
