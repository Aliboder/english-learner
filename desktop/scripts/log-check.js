// 打包前日志体检(hook 用):读取应用日志,输出 error/warning 摘要注入 Claude 上下文
// 每次用户说"打包"时由 UserPromptSubmit hook 触发,Claude 据此先修复问题再打包
// 日志位置:userData/logs/app.log(开发版与安装版同一路径,APP_NAME 不变)
const fs = require('fs')
const path = require('path')

const logFile = path.join(process.env.APPDATA || '', 'EnglishLearner', 'logs', 'app.log')

try {
  if (!fs.existsSync(logFile)) {
    console.log('【日志体检】日志文件不存在,跳过')
    process.exit(0)
  }
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
  const errors = lines.filter(l => l.includes('[error]'))
  const warnings = lines.filter(l => l.includes('[warning]'))
  console.log('【打包前日志体检】')
  console.log(`共 ${lines.length} 行:error ${errors.length} 条,warning ${warnings.length} 条`)
  if (errors.length) {
    console.log('--- error 记录(最近 15 条)---')
    errors.slice(-15).forEach(l => console.log('  ' + l.slice(0, 400)))
  }
  if (warnings.length) {
    console.log('--- warning 记录(最近 10 条)---')
    warnings.slice(-10).forEach(l => console.log('  ' + l.slice(0, 200)))
  }
} catch (e) {
  console.log('【日志体检】失败: ' + e.message)
}
