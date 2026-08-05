// 生成"语速试听"内置音频(声音设置-总倍速展开后每个语速旁的喇叭试听,离线可用)
// 用法: node scripts/gen-speed-preview.js  (需联网一次,产物提交到仓库)
// 产物: frontend/apps/nuxt/public/sound/speed-preview/{word,trans,sentence}.mp3
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const EDGE_TTS_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' +
  EDGE_TTS_TOKEN + '&ConnectionId='
const EDGE_TTS_GEC_VERSION = '1-143.0.3650.75'

function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600
  ticks -= ticks % 300
  ticks = Math.round(ticks * 1e7)
  return crypto.createHash('sha256').update(String(ticks) + EDGE_TTS_TOKEN, 'ascii').digest('hex').toUpperCase()
}

function edgeDateString() {
  const d = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const p = n => String(n).padStart(2, '0')
  return (
    `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`
  )
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function synth(text, voice) {
  return new Promise(resolve => {
    const totalTimer = setTimeout(() => { try { ws.close() } catch {} resolve(null) }, 20000)
    let done = false
    const finish = val => {
      if (done) return
      done = true
      clearTimeout(totalTimer); clearTimeout(idleTimer)
      try { ws.close() } catch {}
      resolve(val)
    }
    let idleTimer = null
    let ws
    try {
      ws = new WebSocket(
        EDGE_TTS_URL + crypto.randomUUID() + '&Sec-MS-GEC=' + generateSecMsGec() + '&Sec-MS-GEC-Version=' + EDGE_TTS_GEC_VERSION,
        { headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
            Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
            Pragma: 'no-cache', 'Cache-Control': 'no-cache',
            Cookie: 'muid=' + crypto.randomBytes(16).toString('hex').toUpperCase() + ';',
        } }
      )
    } catch { finish(null); return }
    const chunks = []
    ws.on('error', () => finish(null))
    ws.on('open', () => {
      try {
        const ts = edgeDateString()
        ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n')
        const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
          `<voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${xmlEscape(String(text).slice(0, 500))}</prosody></voice></speak>`
        ws.send('X-RequestId:' + crypto.randomUUID() + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + 'Z\r\nPath:ssml\r\n\r\n' + ssml)
      } catch { finish(null) }
    })
    ws.on('message', data => {
      try {
        if (typeof data === 'string') return
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        if (buf.length < 4) return
        const headerLen = buf.readUInt16BE(0)
        if (headerLen < 4 || headerLen > buf.length - 2) return
        const header = buf.subarray(0, headerLen).toString('utf8')
        if (!/Path:audio/.test(header)) return
        const audio = buf.subarray(headerLen + 2)
        if (!audio.length) return
        chunks.push(audio)
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => { try { finish(Buffer.concat(chunks)) } catch { finish(null) } }, 2000)
      } catch {}
    })
  })
}

;(async () => {
  const outDir = path.join(__dirname, '..', 'frontend', 'apps', 'nuxt', 'public', 'sound', 'speed-preview')
  fs.mkdirSync(outDir, { recursive: true })
  // 试听内容:单词语速=多音节单词;翻译语速=3-5 词的中文翻译;例句语速=约 15 词例句(便于听出语速差异)
  const tasks = [
    { text: 'opportunity', voice: 'en-US-JennyNeural', file: 'word.mp3' },
    { text: '机会,时机,机遇', voice: 'zh-CN-XiaoxiaoNeural', file: 'trans.mp3' },
    { text: 'The most effective way to learn a new language is to practice every single day.', voice: 'en-US-JennyNeural', file: 'sentence.mp3' },
  ]
  for (const t of tasks) {
    const buf = await synth(t.text, t.voice)
    if (!buf) { console.error('合成失败:', t.file); process.exit(1) }
    fs.writeFileSync(path.join(outDir, t.file), buf)
    console.log('已生成', t.file, buf.length, 'bytes')
  }
  console.log('全部完成')
})().catch(e => { console.error(e); process.exit(1) })
