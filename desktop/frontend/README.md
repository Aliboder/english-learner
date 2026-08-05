# EnglishLearner 前端(Nuxt 4 + Vue 3)

EnglishLearner 桌面应用的前端源码,基于开源项目 [TypeWords](https://github.com/zyronon/TypeWords) 二次开发(GPL-3.0)。

## 目录结构

- `apps/nuxt/` — Nuxt 应用(页面、样式、静态资源、词库数据)
- `packages/core/` — 核心逻辑(练习、词库、FSRS、设置、语音)
- `packages/base/` — 基础 UI 组件
- `packages/utils/` — 工具函数

## 构建

在 `desktop/` 目录下执行:

```bash
npm run build:web   # 构建静态站 → frontend/dist
```

构建产物由 Electron 主进程通过自定义 `app://` 协议加载,详见 [desktop/README.md](../README.md)。
