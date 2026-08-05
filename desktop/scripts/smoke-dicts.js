// 词库压缩后冒烟:验证本地 .z 词库可加载、查词索引正常、旧明文 404、列表 url 指向存在文件
// 注意:解压后的超大词库文本(如 ECDICT 200MB)绝不传回 Node(executeJavaScript 序列化会失败),只返回统计值
// 用法: env -u ELECTRON_RUN_AS_NODE electron scripts/smoke-dicts.js
const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

const webRoot = path.join(__dirname, '..', 'frontend', 'dist')
app.setPath('userData', path.join(app.getPath('temp'), 'english-learner-smoke-dicts'))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const js = (code) => win.webContents.executeJavaScript(code)
let win

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

  win = new BrowserWindow({ width: 800, height: 600, show: false })
  await win.loadURL('app://bundle/words')
  await wait(4000)

  // 分步执行,每步返回小对象,避免大字符串序列化
  const step1 = await js(`(async () => {
    const out = {}
    const r1 = await fetch('/dicts/en/word/CET4_T.json.z')
    out.zStatus = r1.status
    const r2 = await fetch('/dicts/en/word/CET4_T.json')
    out.oldStatus = r2.status
    const r3 = await fetch('/dicts/index.json.z')
    out.indexStatus = r3.status
    const r4 = await fetch('/dicts/en/word/ecdict.json.z')
    out.ecdictStatus = r4.status
    return out
  })()`)
  const step2 = await js(`(async () => {
    const gunzip = async (url) => {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      const ds = new DecompressionStream('deflate')
      return new Response(new Blob([buf]).stream().pipeThrough(ds)).text()
    }
    // CET4 .z 解压并检查内容(不返回文本)
    const t1 = await gunzip('/dicts/en/word/CET4_T.json.z')
    const arr1 = JSON.parse(t1)
    const idx = JSON.parse(await gunzip('/dicts/index.json.z'))
    return {
      cet4Count: arr1.length,
      cet4HasCancel: arr1.some(w => w.word === 'cancel'),
      indexCount: idx.length,
      cancelTarget: idx.find(x => x.w === 'cancel')?.d,
      abeyanceTarget: idx.find(x => x.w === 'abeyance')?.d,
      wudaoTarget: idx.find(x => x.w === 'abeyance')?.d,
    }
  })()`)
  const step3 = await js(`(async () => {
    // 列表本地 url 全部可达
    const list = await (await fetch('/dicts/list/word.json')).json()
    const missing = []
    for (const item of list) {
      const u = item.url || ''
      if (!u.startsWith('/')) continue
      const r = await fetch(u)
      if (!r.ok) missing.push(u)
    }
    return { missingLocal: missing }
  })()`)

  console.log('SMOKE: ' + JSON.stringify({ ...step1, ...step2, ...step3 }))
  app.exit(0)
}).catch((e) => {
  console.error('SMOKE_FAILED', e && e.message ? e.message : e)
  app.exit(1)
})
