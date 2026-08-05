// 生成应用图标(512x512 PNG,electron-builder 会自动转成 ICO)
// 用法: electron scripts/gen-icon.js
// 设计:靛蓝渐变圆角方块 + 白色"词"字(呼应 TypeWords #818CF8 主题色)
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const SIZE = 512
const OUT = path.join(__dirname, '..', 'build', 'icon.png')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 600, height: 600 })
  try {
    await win.loadURL('data:text/html,<html><body></body></html>')
    const dataUrl = await win.webContents.executeJavaScript(`
      (async () => {
        const size = ${SIZE}
        const cv = new OffscreenCanvas(size, size)
        const ctx = cv.getContext('2d')

        // 圆角矩形裁剪(Windows 图标样式)
        const r = size * 0.22
        ctx.beginPath()
        ctx.moveTo(r, 0)
        ctx.arcTo(size, 0, size, size, r)
        ctx.arcTo(size, size, 0, size, r)
        ctx.arcTo(0, size, 0, 0, r)
        ctx.arcTo(0, 0, size, 0, r)
        ctx.closePath()
        ctx.clip()

        // 靛蓝渐变背景
        const g = ctx.createLinearGradient(0, 0, size, size)
        g.addColorStop(0, '#6366F1')
        g.addColorStop(1, '#A5B4FC')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)

        // 中央白色"词"字
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = 'bold ' + Math.round(size * 0.55) + 'px "Microsoft YaHei", "PingFang SC", sans-serif'
        ctx.fillText('词', size / 2, size / 2 + size * 0.02)

        // 底部三条"键盘键位"装饰线
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        const bw = size * 0.30
        const bh = size * 0.045
        const bx = (size - bw) / 2
        const by = size * 0.72
        const gap = size * 0.055
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, bh / 2)
        ctx.roundRect(bx + gap, by + gap, bw - gap * 2, bh, bh / 2)
        ctx.fill()

        const blob = await cv.convertToBlob({ type: 'image/png' })
        const buf = new Uint8Array(await blob.arrayBuffer())
        let bin = ''
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
        return 'data:image/png;base64,' + btoa(bin)
      })()
    `)

    const b64 = dataUrl.split(',')[1]
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, Buffer.from(b64, 'base64'))
    console.log('✅ 图标已生成:', OUT, Buffer.byteLength(b64, 'base64'), 'bytes')
  } catch (err) {
    console.error('❌ 图标生成失败:', err)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})
