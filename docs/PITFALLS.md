# 踩坑记录(EnglishLearner 技术要点 26 条)

> CLAUDE.md 的细节文档之一。改 Electron/前端代码前必读。每条:一句话危害 → 详细内容。

---

**1. 自定义协议 `app://bundle/` 加载静态站(不能用 file://)**
路径是目录 → 必须拼 `/index.html`;index.html 不存在 → 回退 200.html(SPA fallback);必须校验解析路径在 webRoot 内(防目录穿越);webRoot 必须用 `path.join` 生成(正斜杠字面量会让 startsWith 校验失败返回 403)。改 main.js 时别改回去。

**2. `ELECTRON_RUN_AS_NODE` 环境变量坑**
Claude 的 bash 会话里被置为 1,electron.exe 会以纯 Node 模式运行。所有 electron 命令必须 `env -u ELECTRON_RUN_AS_NODE` 前缀。`VAR=` 空值覆盖**不行**(getenv 把空串当已设置)。安装版冒烟也一样要前缀。

**3. 冒烟测试必须在单实例锁之前切换 userData**
`npm run smoke`(即 `electron . --smoke-test`)验证启动页水合 + IndexedDB + 路由。userData 切换必须在 main.js 顶部、单实例锁之前(否则被运行中的应用挡住直接退出)。打包后 exe 无控制台,用 `--smoke-output=<文件>`。

**4. 打包已知坑:杀软锁文件 EPERM**
electron-builder 默认 7za 解压后 rename 会被杀软(腾讯电脑管家)锁文件——已用 `electronDist: "node_modules/electron/dist"` 绕过,**不要移除**。`nsis.deleteAppDataOnUninstall: false`(覆盖安装保留数据)。

**5. 构建缓存坑(vite 预打包)**
pnpm workspace 里改了 `packages/core`、`packages/base` 的源码后,构建可能仍用缓存的旧版本(表现:改了没生效)。清缓存重建用 WORKFLOW.md 的完整命令(含删 `apps/nuxt/dist`),不要单独删部分缓存。"某次生效某次不生效"多半是这个。

**6. preload 沙箱拿不到 `app`**
preload 里不能 `require('electron').app`。版本号通过 main.js 的 `webPreferences.additionalArguments: ['--app-version=' + app.getVersion()]` 传入,preload 从 `process.argv` 读取后经 contextBridge 暴露为 `window.desktop.version`。

**7. base Dialog 组件**
支持 `width`/`height` prop(浮窗尺寸,全屏模式忽略);标题栏撑高后关闭按钮不与内容滚动条重叠(弹窗务必传 title)。**scoped 样式 + `:deep()` 对 Teleport 到 body 的 Dialog 内容无效**,要改弹窗尺寸只能走组件 prop。

**8. SSR 预渲染注意**
页面/组件里用 `window` 前必须 `typeof window !== 'undefined'` 保护,否则 `nuxt generate` 预渲染时 500(如 About.vue 读版本号)。

**9. 上游遗留:设置项组件改宽度用弹性布局**
SettingItem/CommonSetting 等沿用上游样式,改宽度优先用 flex/百分比,不要写死 rem 宽度,方便以后调整弹窗尺寸。

**10. 构建失败被吞坑(血泪)**
`npm run build:web | tail -n` 之类管道会**掩盖失败**(build_exit=1 但后续 electron 启动成功让任务 exit 0),导致加载旧 dist、"问题时好时坏"。每次构建必须:① 输出到文件 ② 显式 `echo "exit=$?"` ③ 检查错误 ④ 再启动窗口。

**11. scoped hash 分叉坑(血泪,已根治)**
frontend/dist 里同一页面 JS 与 CSS 的 `data-v-xxx` hash 不一致 → 该页 scoped 样式整体失效(症状:样式全丢,多页面同时中招)。根因:改 packages 源码后 Nuxt 二次编译命中 `.nuxt` 缓存。已根治:cleanDist.js 每次构建前自动删 `.nuxt` + `dist`。安全网:构建后跑 debug-search.js 确认 `cssHashMatch: true`。**UnoCSS 类名坑**:`pos-fixed`/`pos-absolute` 等 `pos-<位置词>` 类名会被 UnoCSS 自动解析成 position 属性,自定义类名不要用 pos- 加位置词结尾(注释里也别写);已改用 `pos-col`。

**12. vue-macros watch 坑**
`$ref` 变量直接传 `watch(searchWord, cb)` 会被编译成**取值的 watch**,永不触发。必须 `watch(() => searchWord, cb)`(getter 形式)。

**13. base Select 组件**
下拉选项**必须通过 slot 传 `<Option>` 子组件渲染**,`options` prop 只用于回显选中项、不渲染列表(传 options 下拉是空的)。

**14. vxe-table 深色主题**
FsrsRecordsTable.client.vue 引入的 vxe-table 自带浅色样式表,必须用 `:deep(.vxe-table)` 覆盖其 CSS 变量(17 个)到应用主题变量,否则深色模式下表格还是白的。

**15. 按钮组件触发区**
带交互的组件(SettingDialog/VolumeSettingMiniDialog 等)事件若绑在内部图标上,外部加的文字标签不触发——把事件移到组件容器 + 组件内渲染 label prop。

**16. Vue reactive proxy 无法过 Electron IPC(血泪)**
`ipcRenderer.invoke` 传 Vue 的 reactive/proxy 对象会抛 `DataCloneError` → 调用表现为**静默失败**(试听没声等)。IPC 传参前必须展开为普通对象:`{ ...config }`。

**17. dayjs 插件必须组件自注册**
用 `dayjs.utc()`/`isToday()` 等插件 API 的组件必须自己 `dayjs.extend(utc)`,不能依赖其他页面加载的副作用(症状:首次打开弹窗报 `dayjs.utc is not a function` 而"点了没反应")。

**18. GitHub/镜像下载 TLS 坑**
Windows 上 curl 默认 schannel 证书吊销检查会失败(`CRYPT_E_NO_REVOCATION_CHECK`,下载时好时坏)。所有 curl/git 下载加 `--ssl-no-revoke`(git 用 `-c http.sslVerify=false`);大文件用 `curl -L -C - --ssl-no-revoke` 断点续传 + 循环重试。

**19. 用了 dayjs 必须显式 import(血泪,结算卡死根因)**
组件里调用 `dayjs(...)` 却没 `import dayjs from 'dayjs'`,首触时抛 `ReferenceError` → 表现为"结算一直显示结算中"。每个用到 dayjs 的组件顶部必须 `import dayjs from 'dayjs'`(配合 17 的插件自注册;排查"点完没反应"先看日志)。

**20. 大状态序列化卡顿**
ECDICT 等大词库 84 万 words,持久化/导出/备份对**非 custom 词典必须清空 words**(persistLocalState 里 `!b.custom → words: []`,shakeCommonDict 同理),否则 JSON.stringify 卡 1-2 秒乃至"结算中"假卡死。新增大循环必须用 Set/Map 去重计数,别写嵌套循环。

**21. Edge TTS 协议(血泪,别凭记忆改 main.js)**
微软 Edge 朗读是非官方接口,协议细节全在 main.js:①Sec-MS-GEC 签名 = ticks(1601 epoch 秒,向下取整到 5 分钟,×1e7 转 100ns)+ 固定 token 的 sha256 大写 hex,**必须经 URL query 参数传递**(放 header 会 403)②版本 `Sec-MS-GEC-Version: 1-143.0.3650.75` ③headers 要 User-Agent(Chrome/143)+ Origin(chrome-extension://jdicc...)+ Cookie(muid)④时间戳用 JS 风格日期,ssml 消息的 X-Timestamp 尾带 `Z`(Edge 既定 bug 行为,别"修")⑤消息 = speech.config(无 X-RequestId)→ ssml 两条;二进制回复 = `[2B 头长][header 含 Path:audio][\r\n\r\n][音频数据]`,**音频 = subarray(头长+2)** ⑥服务器不发文本 turn.end,用"音频静默 2 秒"判流结束 ⑦15 秒总超时。接口失效时前端静默 + 节流 Toast,勿慌。

**22. 发音倍速换算方向(勿再犯)**
wordSoundSpeed 语义 = 播放倍速(越大越快,0.5 慢 2 快)。Edge rate 换算 `(speed-1)*100%` clamp[-50,100];若按 lengthScale(越大越慢)换算会**方向相反**(用户调低反而加速)。有道单词发音 playbackRate = wordSoundSpeed 直用。翻译朗读用独立语速 transSoundSpeed(见 DEVELOPMENT.md 语音架构)。

**23. 渲染进程 fetch 有道被 CORS 拦截(血泪)**
`fetch('https://dict.youdao.com/dictvoice?...')` 在 app:// 源下会被 CORS 拦截(有道无 CORS 头),预加载单词发音会全部静默失败。**必须走主进程代理**:`fetch-word-audio` IPC(main.js 用 net.fetch 下载返回 data URL),preload 暴露 `desktop.fetchWordAudio`。Audio 元素播放本身不受 CORS 限制(可直连),但 fetch 预下载不行。

**24. 朗读缓存三层设计(改动前先读 preloadTts.ts)**
①滑窗预加载(当前词后 8 个,3 并发)②播放即缓存(playEdgeTts 合成成功写缓存;单词发音未命中时异步走代理下载补缓存)③IndexedDB 持久化(400 条上限,防抖 1s 写入,启动恢复)。**退出练习页 clearTtsCaches 只清内存,磁盘缓存必须保留**。缓存带 voice/speed 校验,设置变更自动失效重合成。入口:settingStore.ttsVoice/wordSoundSpeed/transSoundSpeed/wordSoundVolume。

**25. 翻译缓存 key 兼容(、/。)**
v0.3.8 起多释义用顿号 `、` 连接(朗读更连贯),v0.3.7 前是句号 `。`。getCachedTransAudio 双 key 查询、预加载 has 判断也兼容旧 key,避免升级后历史缓存全部浪费。**新代码 join 分隔符必须与 useWordPracticeAudio/preloadTts/WordDetail/TranslationList 保持一致**(缓存 key 依赖它)。

**26. scoped class 加在子组件根上会失效(血泪,v0.3.9 两次"改了没生效"根因)**
scoped 样式 `.foo[data-v-父hash]` 需要元素带**父组件**的 data-v 属性;而 `<VolumeIcon>` 等**第三方组件内部根节点只带自己的 data-v hash,不继承父组件的** → 选择器匹配不到,样式整体静默失效(表现为"改了半天界面没变",元素回到默认 static 布局)。**规律:要加样式/定位的元素必须是父组件自己渲染的标签**(div/span),第三方组件只能放进这个标签里。诊断方法:Electron 里 executeJavaScript 查 `getComputedStyle(el).position` + 看元素 data-v 属性(临时脚本思路见 WORKFLOW.md 诊断脚本)。

**27. 批量数据规范化必须全量扫描验证,不能只靠抽样(血泪,2026-08-04 词库规范化)**
第一次做 17 个词库的 trans 规范化时,定义了"词性写法/分隔符/内嵌词性"三个维度,并用 good/happy/easy 抽样验证 —— CET-4-frequency(带频率词库)恰好在这三个维度上都"看似规范",但其"每义一条、粒度极细"的问题被漏掉(一个词 9-18 条,单字释义刷屏),用户发现后才补了 `merge_same_pos`(同词性条目按 frequency 降序合并、逗号连接、频率取最高,总条目 -77%)。**教训**:① 批量数据任务要先做全量维度检查(遍历所有记录统计异常),不要只抽几个词看 ② 规范维度要包含"结构粒度"这类隐性维度 ③ 处理完必须全量 sweep 验证(同词同 pos 多条/结构异常/多余字段),不能以抽样结果下结论。规范化脚本:desktop/scripts/normalize-dicts.py;备份:desktop/resources/dict-backup/。

## 28. i18n 全量改造的连环坑(2026-08-05,最后回退为纯中文)

**背景**:一次"界面语言加英文"的需求 → 大量中文硬编码包 $t → 反复修补 → 最终用户决定单语言,反向还原。踩了 6 个坑:

1. **子串替换嵌套**:脚本先替换短子串('再次导入'),后替换含它的长句('可在下方表格修改后再次导入')→ `{{ $t('可在下方表格修改后{{ $t('再次导入') }}') }}`。教训:批处理替换必须**长句先于短句**,或按行匹配整段。
2. **JSX 文件属性语法**:dict.vue 用 `defineRender` + JSX,模板表达式是 `{x}` 不是 `{{x}}`;Vue 风格 `:title="$t('x')"` 在 JSX 里编译失败。教训:改文件前先确认模板语法(Vue 插值 vs JSX)。
3. **HTML 实体/换行进 JS 表达式**:属性值 `&#10;` 会被 HTML 解码成真实换行,JS 字符串里裸换行 = Unterminated string constant;zh.json 值里的 `\n` 还原进 `{{ '...' }}` 同理。教训:字符串进表达式前必须转义 `\n`、实体。
4. **带参插值调用检测盲区**:`$t('key', { n: x })` 的 key 提取正则要求引号后直接 `)`,带参调用全部漏检 → key 缺失,界面显示 `{n}` 字面量。教训:语言 key 校验正则必须兼容参数形式。
5. **正则修补的二次破坏**:修复引号时排除集不完整(`[^{}]*` 漏了 `'`),把三元表达式整体包进字符串,又用第二轮正则恢复,恢复正则又误伤正常拼接(内容含引号)。教训:**引号类修复用逐字符解析器,不用正则;每轮修改后立即构建验证**。
6. **en.json 值本身是中文**:TypeWords 遗留 27 个 key 的英文值是中文(inflections 等),界面英文模式显示中文。教训:多语言改造前先审计语言文件质量。

**最终决策**:用户放弃英文适配,单语言化。还原方式:保留 i18n 机制(zh.json 单语言兜底)+ 脚本把 `$t('中文')` 全部还原为直接中文文本(741 处)+ 删除 en.json/语言切换 UI/locale 恢复逻辑。**教训:小范围个人工具,多语言适配的投入产出比极低,新增功能默认只做中文。**

## 29. 词库压缩漏改列表配置(2026-08-05,"词库下载失败请检查网络"根因)

**背景**:把 15 个考试词库明文 .json 压缩为 .json.z 并删除明文(省 107MB),但只改了数据文件和查词索引(index.json 的 d 字段),**漏改词库列表配置** `public/dicts/list/word.json`(和 recommend_word.json)里的 url——仍指向 `/dicts/en/word/CET4_T.json`(已删除的明文)→ 点击词库学习时 fetch 404 → 前端提示"词库下载失败请检查网络"。

**根因**:文件改名/压缩是"三条链路"的联动改动:① 数据文件本身 ② 查词索引(generate-dict-index.py 自动指向 .z)③ **词库列表配置(list/*.json 的 url 字段)**。第三条是最容易漏的——它不在生成脚本的输出里,是手写配置。

**修复**:① 脚本 fix-dict-list-z.py 把 list 里已本地化的词库 url 改为 .json.z(30 处);② `_getDictDataByUrl` 加载明文 404 时自动重试 .z(兼容旧存档/旧列表里已保存的 .json url——用户本地 bookList 里收藏的词库 url 不会随新版本更新,必须靠这个回退)。

**教训**:① 批量文件改名/压缩必须全链路核对引用(数据文件 → 索引 → 列表配置 → 旧存档兼容);② 做"压缩/删除明文"这类操作后,先跑词库链路冒烟(全部本地 url 可达性检查),再开窗口给用户;③ 新增词库内置的完整流程:fetch-inner-dicts.py(下载+压缩)→ fix-inner-dict-list.py(列表指向本地)→ generate-dict-index.py(重建索引)→ 删 index.json 明文 → 构建+可达性验证。

## 30. 构建产物偶发不完整:scoped CSS 丢失,cssHashMatch false(2026-08-06)

**现象**:改完 TypeWord.vue(例句/信息区块卡片化)构建后,运行时组件带旧 scopeId 而 css 里没有对应规则,`debug-search` 报 `cssHashMatch: false`;同时页面"改了没生效"(卡片样式不显示)。用户反馈"不是卡片啊"。

**根因**:某次 `npm run build:web` 在**项目根目录**(未 cd 到 desktop)静默失败(npm ENOENT),输出被 `grep -E "ERROR|✗"` 过滤吞掉(小写 error 不匹配大写 ERROR),误以为成功;随后一次构建产物不完整(vite 构建中途异常,部分组件的 scoped CSS 未提取进 css 文件,js 与 css 的 scopeId 分叉),frontend/dist 混合了新旧产物。

**修复**:完整重跑 `npm run build:web`(确认输出 `✔ Client built` + `复制完成`)→ 清 `%TEMP%/english-learner-debug-search` 缓存 → 重跑 `debug-search` 确认 `cssHashMatch: true`。

**防再犯**:
1. 构建命令必须显式 `cd /d/.../desktop &&`(CWD 不跨 Bash 调用保持)
2. 构建后检查输出不要用吞错误的正则(至少看 tail 完整段 + `exit=$?` 用管道最后一个命令的退出码判断会失真,应检查 `$PIPESTATUS`)
3. `cssHashMatch: false` 是"改了没生效"的高危信号,必须修复到 true 才能继续/打包
4. 产物验证(grep dist 里新 class/新文案)能发现构建未生效
4. 缓存放大器:构建偶发问题 + Electron 磁盘缓存复用旧产物 = "反复出现"的放大机制。2026-08-06 已根治:main.js 的 app:// 协议响应强制 `Cache-Control: no-store`(每次启动读磁盘最新版);开测试窗口前清 `%APPDATA%/EnglishLearnerDev/Cache` 等目录作双保险(见 WORKFLOW.md)。
5. 根因排查(2026-08-06,连续构建实验 + 系统检查):连续 3 次构建全部正常 → 排除必然性问题;磁盘充足(289G)、Defender 实时保护已关闭、cleanDist 每次全清 .nuxt/dist、无 vite 预构建缓存残留。**最大嫌疑:内存压力**(16GB 内存构建时仅剩 ~4.4GB 空闲,构建期间多进程挤压 vite worker,偶发部分组件 scoped 编译丢失)。已自动化兜底:`desktop/scripts/build-check.sh`(构建 → cssHashMatch 验证 → 失败自动重构建,最多 3 次),构建通过 = 产物可用;建议构建时关闭多余程序/electron 窗口。
