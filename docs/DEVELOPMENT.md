# 开发细节(EnglishLearner 关键设计)

> CLAUDE.md 的细节文档之一。改前端代码前必读:裁剪记录、关键设计、语音架构、当前状态。

---

## 一、裁剪记录(2026-08-03 起,多轮)

**已删除**:账号/VIP/会员体系、文章背诵整套、云同步(Supabase)、三种学习形式(选义 9/中文选词 10/自检 11,存档自动迁移为打字)、介绍页+引导+侧边栏、作者推广痕迹、死代码(9 死文件/16 死导出)、依赖(supabase-js/rrweb/axios/node-forge/md5 等)。

**⚠️ 上游同步时千万别删(本地核心在用)**:
- `components/article/EditBook.vue`(词库编辑/副本对话框)、`components/article/Space.vue`(打字空格渲染)、`components/Book.vue`(词库卡片)——它们在上游的 article 目录,但本地单词功能重度依赖
- `packages/core/src/components/setting/SettingDialog.vue` 是练习页的小设置弹窗,**与 SettingsDialog.vue(设置浮窗)是两个文件**

**行为变化**:
- 启动直达 /words;帮助/更新日志/关于 已改为本项目信息
- 发音全在线:单词 = 有道 dictvoice;中文翻译 = 微软 Edge TTS;例句朗读已删除(例句文字照常显示)。断网时单词/翻译均无发音(节流 Toast)
- 查词:主界面顶部查词栏,搜索范围 = 已加载词库 + 全部内嵌词库索引(离线);练习页例句点击查词同源
- APP_NAME = 'EnglishLearner';GPL 致谢保留在设置-关于

## 二、语音架构(2026-08-04 起全在线,无本地引擎)

- 单词发音 = 有道 dictvoice(在线);中文翻译朗读 = 微软 Edge TTS(晓晓等 6 音色,主进程 WebSocket 合成,免 key)
- **语速分离(v0.3.8)**:`wordSoundSpeed` = 单词发音播放倍速;`transSoundSpeed` = 翻译朗读 Edge TTS rate。使用边界:单词播放用 wordSoundSpeed;所有 playEdgeTts 翻译朗读(useWordPracticeAudio/WordDetail/TranslationList/TypeWord 发音区按钮/preloadTts 预加载)用 transSoundSpeed。设置 UI:音效 tab 的 SoundMasterControl 总倍速展开两项(SOUND_SPEED_ITEMS),i18n key `trans_speed` 已加全部 14 个语言文件。老存档迁移:checkAndUpgradeSaveSetting 里 transSoundSpeed undefined → 沿用 wordSoundSpeed。
- **音效本地化(v0.3.8)**:`public/sound/beep.wav`(提示音)+ `correct.wav`(正确音)+ `key-sounds/` 8 个按键音(机械0-3/机械键盘1/机械键盘2/老式机械键盘/笔记本键盘,程序生成)。**⚠️ sound.ts 的 setAudio 必须用 `new Audio(src)` 本地路径,不能拼 `ENV.RESOURCE_URL`**(远程 files.typewords.cc 的 key-sounds 被 Cloudflare 545 拦截,v0.3.7 因此产生 31 条 NotSupportedError);getAudioFileUrl 返回 `.wav`。音效加载失败时 play() 必须 `.catch(() => {})`。
- 朗读缓存三层 + 双 key 兼容:见 PITFALLS.md 第 24/25 条
- 自动朗读中文翻译(默认开,设置可关);断网失败节流 Toast(30 秒一次)

## 三、关键设计(改前端前必读)

**练习页 [id].vue — vue-macros 多实例大坑(血泪教训)**:`$ref/$computed` 编译为**模块级变量**,第二个练习会话实例挂载后旧实例引用可能失效(表现为 `reading 'value'` 崩溃)。**修复原则(已保留,别改回去)**:① next() 顶部用 `data.words?.[data.index]` 直读 + 空词直接 complete();② `nextStage` 空列表直接 complete() 而非递归 next();③ `typingRef?.showWord?.()`/`play?.()` 可选链。

**练习页布局(2026-08-04 v0.3.12 重构)**:练习区固定宽度,与单词内容无关:
- `practiceAreaWidth` 设置项(设置-通用,480-960px,默认 640),老存档自动默认值
- PracticeLayout `.wrap` #PracticeArea:`width: min(practiceAreaWidth, calc(100vw - 3rem))`
- [id].vue `.practice-word`:`width: 100%`(勿改回 var(--toolbar-width)——那是上游遗留,会让翻译长短改变整列宽度导致布局跳动)
- TypeWord `.translate`/`.other`/笔记区:`w-full`,文本在固定宽度内换行
- 翻译朗读按钮在发音区(音标旁第二个喇叭);TranslationList 有 `showPlay` prop(练习页传 false,词表/查词/测试页保持文档流按钮)

**设置浮窗 SettingsDialog.vue**:layout 挂载 + `provide('openSettings')`,words.vue 注入调用;组件暴露 `open()` 方法(**defineModel 的 ref 经模板 ref 直接赋值不可靠,必须用方法**);9 个 tab = 通用/遗忘曲线/单词/音效/数据/快捷键/更新日志/帮助/关于;内容容器 `.setting { width: 100% }`。通用 tab 含界面语言(Select + localStorage 持久化,key `english-learner-locale`)、主题(跟随系统/浅色/深色)、练习区宽度滑条。

**查词系统**:主界面顶部查词栏 + 练习页例句点击查词共用 `packages/core/src/hooks/dictIndex.ts`(promise 缓存:并发共享一次加载,不返回空数组)。索引 = `public/dicts/index.json(.z)`(构建期由 generate-dict-index.py 生成,848,726 词)。搜索:已加载词库优先 → 内嵌索引;下拉前缀优先 + 单词列固定 9rem;点击出 WordDetail(支持收藏)。**压缩词库 `.json.z`**:Wudao 96,233 词 + ECDICT 844,414 词,zlib 压缩,加载走 `fetchDictJson()`(原生 DecompressionStream 解压,零依赖)。**vue-macros 坑:watch($ref 变量) 必须用 getter 形式**。

**FSRS 记忆曲线**:ts-fsrs,评级换算 = 错 0 次 Easy / 1-3 Good / 4-6 Hard / 7+ Again(设置可调);**复习词(已有卡且已到期)答错直接 Again 重学**(别改回去);落卡 key 用小写,复习队列用小写匹配(修复 Christ/Polish 等大写词不进队列)。队列:新词 perDay 个 + 复习 perDay×wordReviewRatio 个(不足从已学词填充)。

**打字页工具栏 Footer.vue(两行布局)**:行 1 = 操作按钮(返回/设置/发音/跳过/默写/翻译/词表,图标+文字,事件绑整个容器);行 2 = 状态 + 单条阶段进度条 + 数字(`12/26词 │ 5分钟 │ 错2`)+ 折叠箭头。收起只隐藏行 1,**进度行常驻**。

**主页 words.vue keepalive**:`definePageMeta({ keepalive: true })` 缓存主页;`onActivated` 里刷新练习任务数据。

**自动备份/恢复(main.js + preload + 数据管理 tab)**:
- 退出备份:窗口 close 拦截 → `request-auto-backup` → 渲染进程组数据(纯 JSON,无 mp3)→ `saveBackup` IPC → 主进程写 `文档/EnglishLearner备份`(dev 用 EnglishLearnerDev备份,保留 7 份)→ `backupDone` 放行关闭(5 秒超时强制 destroy)
- 一键恢复:`auto-backup-list` / `auto-backup-read` IPC(防目录穿越),恢复走与手动导入相同的 importJson 全链路
- 自动备份是纯 JSON(手动导出是 ZIP 含 mp3,JSZip 本地化离线可用)

**日志系统(main.js + preload + 帮助 tab)**:见 WORKFLOW.md 第六节。

**复习计划(ReviewPlanDialog.vue)**:主界面按钮 → 未来 7 天每天待复习卡(FSRS due 按天分组,过期归今天)→ 行点击展开单词卡片(3 列 16:9,按掌握状态着色)→ 今天=立即复习/未来=提前复习。**掌握状态**(hooks/wordStatus.ts):mastered(knownWordsSet)/due(有卡且到期)/learning(有卡)/new(无卡);颜色用 CSS 变量(--color-success/error/info/muted)。

**考纲筛选学习**:ECDICT 词条带 tags(zk/gk/cet4/cet6/ky/ielts/toefl/gre),dict.vue"学习"按钮对 ECDICT 先弹范围选择 → 按标签筛选生成子词库(改名"ECDICT·四级"等)。词形变化(inflections)在练习页/查词详情展示(utils/inflections.ts)。

**翻译排版规范化(TranslationList.vue + WordDetail.vue)**:练习页/查词悬浮窗共用 TranslationList,**纯文档流布局**(每条翻译 = block 行,词性 = inline-block 固定 3rem `.pos-col`,翻译 = inline 文本)——物理上不可能重叠。**长翻译折叠**:max-height 4.6em + overflow:hidden,scrollHeight 判断超长显示"展开"按钮。查词详情 WordDetail 完整显示不折叠。查词下拉:单行截断 + title 悬停全文。**⚠️ `.pos-col` 不能改回 `pos-fixed`/`pos-absolute` 等**(UnoCSS 自动解析成 position 属性,见 PITFALLS 第 11 条)。

**界面美化体系(main.scss + base 组件,已收敛)**:全局 CSS 变量 `--radius-card: 12px / --radius-btn / --radius-input`、`--color-primary-btn: var(--color-select-bg)`、`--shadow-card/hover`。**用户反馈"渐变+光晕廉价感"后已收敛**:无渐变/光晕/渐变数字,统一主题纯色;BaseButton primary = 纯色 + 按压 scale(0.97);BaseInput 聚焦只变边框。**状态色(勿硬编码)**:`--color-success/error/warning/info/muted/accent`(浅/深各一套)+ `.tag-success/.tag-info/.tag-warning/.tag-error` 状态标签类(color-mix 透明底)。硬编码颜色(gainsboro/#f5f5f5/#409eff/bg-white)必须换主题变量,否则深色模式不生效。页面过渡 pageTransition(out-in 淡入,与 keepalive 兼容)。

## 四、当前开发状态(2026-08-04 会话中)

**当前版本**: v0.3.11 已打包;**开发中**:v0.3.12(布局固定宽度 + 环境隔离,测试中,等用户确认后打包)

**当前待办**:
1. 用户测试 v0.3.12 布局重构(练习区固定宽度 640px,设置可调)后打包
2. 安装包发同学(QQ/网盘,覆盖安装)
3. 词库取舍(17 个本地词库 + 179 个联网列表;删本地文件需同步重建 index.json)
4. 空间清理(用户曾拒绝:resources/tmp 1GB + 历史安装包 2.3GB)
5. M5: 同学安装使用说明 + v1.0

**用户明确拒绝过(勿主动重提)**:每日目标、WPM 统计、本地提醒、热力图、词频区间练习、错词分析、Anki 导出、一键打包脚本、托盘/快捷键、单词电台、悬浮窗、例句挖空、读音辨析、冲刺模式、成就徽章、词书分享、截图取词、翻译集成

## 五、里程碑

- M1-M3 / v0.2.6-v0.2.9:壳子跑通、裁剪、词库内嵌、查词收藏/错词重练等(v0.2.x 系列,2026-08-03~04)
- v0.3.0:ECDICT 84 万词库 + 无道词典
- v0.3.1:考纲筛选 + 掌握状态 + 记忆曲线报告 + 复习计划 + 界面美化
- v0.3.2:日志系统 + 修复结算卡死 + 词典卡片化
- v0.3.4:Edge TTS 中文朗读 + 预加载 + 移除非本地引擎
- v0.3.5:自动朗读翻译 + 朗读缓存持久化 + 查词索引压缩
- v0.3.6:翻译排版规范化 + hash 分叉根治
- v0.3.7:五批细节优化(6 bug/日志降噪/深色主题/死代码/体验性能)
- v0.3.8:音效本地化 + 语速分离 + 缓存双 key 兼容
- v0.3.9/0.3.10:翻译按钮位置(两次踩坑,见 PITFALLS 26)
- v0.3.11:翻译按钮移到发音区(showPlay 方案)
- **进行中 v0.3.12**:练习区固定宽度(可设置)+ 开发/安装环境隔离
- M5(未完成):同学安装使用说明 + v1.0
