// 测试:数据导入功能——把导出的 zip 重新导入,验证全链路
// 1. 主进程读导出 zip → base64 → 传给页面
// 2. 页面重建 File → 喂给上传 input → 触发 importData
// 3. 验证:Toast "导入成功" + IndexedDB 设置已写入
const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

// 测试脚本用独立临时 userData,不碰开发/安装版数据
const userData = path.join(app.getPath('temp'), 'english-learner-test-import')
fs.rmSync(userData, { recursive: true, force: true })
app.setPath('userData', userData)

const webRoot = path.join(__dirname, '..', 'frontend', 'dist')
const zipPath = path.join(app.getPath('downloads'), 'test-export-result.zip')

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

  if (!fs.existsSync(zipPath)) {
    console.log('IMPORT_TEST_FAILED 找不到导出文件: ' + zipPath)
    app.exit(1)
    return
  }
  const zipBase64 = fs.readFileSync(zipPath).toString('base64')

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
          // 打开设置
          const settingBtn = btnByText('设置')
          if (!settingBtn) return { error: '设置按钮未找到' }
          settingBtn.click()
          await sleep(1000)
          // 数据管理 tab
          const dataTab = [...document.querySelectorAll('.tab')].find(t => t.textContent.includes('数据管理'))
          if (!dataTab) return { error: '数据管理 tab 未找到' }
          dataTab.click()
          await sleep(600)
          // 找到上传 input
          const fileInput = document.querySelector('input[type="file"]')
          if (!fileInput) return { error: '上传 input 未找到' }
          // 重建 zip 文件(从主进程传来的 base64)
          const b64 = ${JSON.stringify(zipBase64)}
          const binary = atob(b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const file = new File([bytes], 'backup.zip', { type: 'application/zip' })
          const dt = new DataTransfer()
          dt.items.add(file)
          fileInput.files = dt.files
          fileInput.dispatchEvent(new Event('change', { bubbles: true }))
          // 等待导入完成(升级校验 + 写入)
          await sleep(1500)
          // 验证 1:页面出现"导入成功"提示(Toast 约 3 秒后消失,要早查)
          const bodyText = document.body.textContent
          const toastText = bodyText.includes('导入成功') ? 'success' : bodyText.includes('导入失败') ? 'failed' : 'none'
          await sleep(2500)
          // 验证 2:IndexedDB 设置键已写入
          const idbOk = await new Promise((resolve) => {
            const req = indexedDB.open('keyval-store')
            req.onsuccess = () => {
              const db = req.result
              const tx = db.transaction('keyval', 'readonly')
              const getReq = tx.objectStore('keyval').get('typing-word-setting')
              getReq.onsuccess = () => resolve(!!getReq.result)
              getReq.onerror = () => resolve(false)
            }
            req.onerror = () => resolve(false)
          })
          return {
            toastText,
            idbSettingWritten: idbOk,
          }
        })()`)
        console.log('IMPORT_RESULT ' + JSON.stringify(r))
        const ok = r.toastText === 'success' && r.idbSettingWritten
        console.log(ok ? 'IMPORT_TEST_OK' : 'IMPORT_TEST_FAILED')
        app.exit(ok ? 0 : 1)
      }
    } catch (err) {
      console.error('IMPORT_TEST_FAILED', err)
      app.exit(1)
    }
  })
})
