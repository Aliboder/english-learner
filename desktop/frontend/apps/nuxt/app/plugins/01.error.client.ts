export default defineNuxtPlugin(nuxtApp => {
  // 1. JS 同步错误
  window.onerror = function (msg, url, line, col, err) {
    reportError({ type: 'js', jsErr: err })
  }

  // 2. Promise 错误
  // window.addEventListener('unhandledrejection', e => {
  //   e.preventDefault() // 阻止继续传播
  //   reportError({ type: 'promise', promiseErr: e.reason })
  // })

  // 3. 资源加载错误
  window.addEventListener(
    'error',
    e => {
      if (e.target !== window) {
        reportError({ type: 'resource', resourceErr: e?.target?.src })
      }
    },
    true
  )

  // 4. vue错误
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    reportError({ type: 'vue', vueErr: err, vueInfo: info })
  }
})

function reportError(data) {
  // 桌面端无 umami 统计(上报 no-op),错误信息经 console 转发进主进程日志(设置-帮助-日志可查看,便于排障)
  // 注意:多参 console.error 的对象参数在主进程日志里被 String() 成 [object Object],丢细节——必须先拼成字符串
  const err = data.jsErr || data.vueErr || data.resourceErr
  let detail: string
  if (err instanceof Error) detail = `${err.message}${err.stack ? '\n' + err.stack : ''}`
  else if (typeof err === 'string') detail = err
  else detail = err ? JSON.stringify(err) : JSON.stringify(data)
  const info = data.vueInfo ? ` vueInfo=${JSON.stringify(data.vueInfo)}` : ''
  console.error(`[${data.type}] ${detail}${info}`)
}
