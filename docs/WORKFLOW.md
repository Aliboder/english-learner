# 工作流程与常用命令(EnglishLearner)

> CLAUDE.md 的细节文档之一。本文档:常用命令、构建验证、打包发布、环境隔离、CodeGraph 使用、测试脚本。**所有命令在 desktop/ 内执行**(CodeGraph 命令在项目根执行)。

## 一、常用命令速查

```bash
cd frontend && pnpm install        # 首次:安装前端依赖(复用 pnpm 全局缓存)
npm run build:web                  # 构建前端 → frontend/dist/(唯一允许的构建方式)
npm run start                      # 启动应用(加载 frontend/dist/)
npm run smoke                      # 冒烟测试(启动页水合 + IndexedDB + 路由)
npm run dist                       # 打包 NSIS 安装包 → release/(等用户说"打包"才跑)
# 打字核心回归(改动练习/判分/存储后跑):
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/e2e-typing.js
# 导出/导入功能回归(注意先跑 test-export 再跑 test-import):
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/test-export.js
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/test-import.js
# scoped hash / 搜索列表样式运行时验证(构建后必跑,确认 cssHashMatch: true):
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe scripts/debug-search.js
# 词库数据更新后重新生成查词索引(输出 index.json + 压缩版 index.json.z):
python scripts/generate-dict-index.py
# 无道词典数据更新后重新转换:
python scripts/convert-wudao.py
# ECDICT 数据更新后重新转换(读 resources/tmp/stardict.db → ecdict.json.z):
python scripts/convert-ecdict.py
# 构建产物异常时清缓存重建(必须用这条完整命令,含删 apps/nuxt/dist):
rm -rf frontend/apps/nuxt/.nuxt frontend/apps/nuxt/node_modules/.vite frontend/node_modules/.vite frontend/node_modules/.cache frontend/apps/nuxt/dist && npm run build:web
```

### 开测试窗口(用户测试)

```bash
taskkill //IM EnglishLearner.exe //F 2>/dev/null; taskkill //IM electron.exe //F 2>/dev/null
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe .   # 后台运行
```

注意:dev 窗口与安装版数据完全隔离(见下文"环境隔离"),首次打开是空数据,需要先装载词库。

## 二、构建与验证(铁律)

1. **构建必须显式检查结果**(血泪教训,别用管道吞错):
   ```bash
   npm run build:web > /tmp/build.log 2>&1; echo "exit=$?"; grep -iE "error|failed" /tmp/build.log | head
   ```
   构建失败时**绝不开窗口**(可能加载旧产物)。
2. **构建后必跑 debug-search.js** 验证 `cssHashMatch: true` + `cursor: pointer` + `wordWidth: 144px`。
3. cleanDist.js 每次构建自动删 `.nuxt` + `dist`(scoped hash 分叉已根治);仍异常时用上文的完整清缓存命令。
4. 验证自动化分级:默认 `build:web` + debug-search;改动练习/判分/存储 → 跑 e2e-typing;改 main.js/打包配置 → 安装版冒烟;改导出/导入链路 → test-export + test-import。

## 三、打包与发布流程

0. **用户说"打包"时,UserPromptSubmit hook 自动执行 `desktop/scripts/log-check.js` 日志体检**(.claude/settings.json 配置),结果注入上下文 → **先甄别并修复日志中的问题,再进入打包**。注意甄别:日志可能含旧会话记录(已修复的问题别重复处理);**日志时间是 UTC**(13:33Z = 本地 21:33);aria-hidden/initData 等历史残留看最新启动之后的新记录即可。
1. 用户说"打包" → 升 `desktop/package.json` 版本号 → `npm run dist`
2. 后台静默覆盖安装(`./release/EnglishLearner Setup X.X.X.exe /S`,后台跑避免超时;安装 1-2 分钟,轮询 `powershell -Command "(Get-Item 'D:/EnglishLearner/EnglishLearner.exe').VersionInfo.ProductVersion"` 确认版本)
3. 安装版冒烟(`D:/EnglishLearner/EnglishLearner.exe --smoke-test --smoke-output=<文件>`)——仅当改了 main.js/打包配置时
4. 清理残留进程,把安装包发给同学(QQ/网盘),覆盖安装,**IndexedDB 数据保留**
5. **打包后验证产物**:检查 `release/win-unpacked/resources/web/_nuxt/` 里的 CSS/JS 是否含本次改动(避免"改了没生效"发出去)

## 四、开发/安装环境隔离(2026-08-04 起)

| 项目 | dev 窗口(未打包) | 安装版 |
|---|---|---|
| 学习数据/设置(IndexedDB) | `%APPDATA%/EnglishLearnerDev` | `%APPDATA%/EnglishLearner` |
| 日志 | `EnglishLearnerDev/logs/app.log` | `EnglishLearner/logs/app.log` |
| 自动备份 | `文档/EnglishLearnerDev备份` | `文档/EnglishLearner备份` |
| 单实例锁 | 互不影响,**可同时运行** | 同上 |

- main.js 里 `!app.isPackaged && !isSmokeTest` 时切换 userData(在单实例锁**之前**)
- 测试脚本(e2e/debug-search/test-export/test-import)各自用 temp 下独立 userData,不碰任何真实数据
- 排错先确认是哪个环境产生的日志

## 五、CodeGraph 代码知识图谱(必用 MCP)

- 项目根有 `.codegraph/` SQLite 索引(包名 `@colbymchenry/codegraph`,查更新用 `npm view @colbymchenry/codegraph version`——npm 上的 `codegraph` 是无关同名包,别查错)
- **查询/改代码前先调 `codegraph_explore`**:一次返回符号源码(带行号)+ 调用路径 + 影响范围,替代 Grep+Read 循环;**必须传 `projectPath`**(项目根,此 MCP 无默认项目)
- 返回源码视为已 Read,不要重复打开;索引未覆盖的(新文件未 sync)再用 Read/Grep
- 更新:`codegraph sync`(增量,改完代码跑)/ `codegraph index`(全量,大型重构后)/ `codegraph status`(查看状态)
- CLI 兜底(MCP 不可用):`codegraph query` / `explore` / `node` / `callers` / `callees` / `impact`
- ⚠️ 在项目根执行(不在 desktop/)

## 六、日志系统

- 主进程 `writeLog(level, source, message)` 写 userData/logs/app.log(5MB 轮转保留 3 份);渲染进程 console 经 IPC 转发,`NOISY_LOG_PATTERNS` 过滤已知噪声
- 帮助 tab → 可复制/打开日志目录(IPC `read-log` / `open-log-dir`)
- 排错流程:出问题先看日志文件(对应环境的),能秒级定位渲染进程报错(ReferenceError/DataCloneError 等)
