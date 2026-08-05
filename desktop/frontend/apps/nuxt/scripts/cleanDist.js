// 构建前清理缓存和输出目录,防止 scoped hash 分叉(样式整体失效)
// 根源:改 packages/core/base 源码后,Nuxt 二次编译命中 .nuxt 缓存 → CSS 旧 hash + JS 新 hash
// 实测:只删 .nuxt 即可修复;dist 残留是次要因素,一并清理
const fs = require('fs')
const path = require('path')

// 1) .nuxt:Nuxt 构建缓存(含二次编译产物,分叉根源,必须删)
const nuxtDir = path.resolve(__dirname, '../.nuxt')
fs.rmSync(nuxtDir, { recursive: true, force: true })

// 2) dist:输出目录(旧产物残留)
const distDir = path.resolve(__dirname, '../dist')
fs.rmSync(distDir, { recursive: true, force: true })

console.log('🗑️  已清空构建缓存(.nuxt)和输出目录(dist)')
