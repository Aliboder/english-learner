# EnglishLearner — 打字背单词桌面应用

基于 [TypeWords](https://github.com/zyronon/TypeWords)(GPL-3.0)修改的 **Windows Electron 桌面背单词应用**:纯本地运行、离线优先、词库内嵌,唯一的练习形式是打字背单词(跟打 / 听写 / 自测 / 默写),FSRS 记忆曲线自动安排复习。

## 功能特性

- **打字背单词**:逐字母跟打,支持跟写/拼写/默写/听写/自测/单词测验等模式;输完单词可自动跳转,也可停留查看完整信息后按空格或「下一个」快捷键切换
- **词库内嵌、完全离线**:30+ 词库覆盖中学生与大学生(中考、高考、人教版教材同步、四六级、考研、专升本、雅思、托福、新概念等)+ 无道词典(9.6 万词)+ ECDICT(84.4 万词),查词索引 84.9 万词,全部随安装包内置,断网可学
- **FSRS 记忆曲线**:自动安排复习,支持复习计划(未来 7 天)、提前复习、记忆曲线报告
- **语音朗读**:单词发音(有道)、中文翻译朗读与例句朗读(微软 Edge TTS),练习中滑窗预加载,点击零延迟;例句朗读不自动播放,点击例句后喇叭播放
- **全局字体**:内置 MiSans 10 个字重,设置中一键切换,界面统一生效;单词字符间距可调
- **数据完全本地**:IndexedDB 存储,退出自动备份(文档/EnglishLearner备份,保留 7 份),支持导出/导入备份迁移
- **细节**:窗口置顶、练习页设置浮窗可拖拽、深色主题、快捷键可自定义、运行日志(帮助排查问题)

## 运行环境

- Windows x64(安装包 NSIS;开发环境支持 Windows/macOS/Linux)

## 安装使用

- **下载安装包**:前往 [GitHub Releases](https://github.com/Aliboder/english-learner/releases) 或 [Gitee 发行版](https://gitee.com/Aliboder/english-learner/releases) 下载最新 `EnglishLearner Setup x.x.x.exe`(仅 Windows x64),覆盖安装数据不丢失
- 如提示「未知发布者」,点「更多信息 → 仍要运行」即可
- 安装使用说明随发行版附件提供

## 从源码构建

```bash
# 项目完全自包含(无需克隆上游)
cd desktop
npm install                     # 安装 Electron(已配国内镜像,.npmrc)
cd frontend && pnpm install     # 首次:安装前端依赖
cd ..
npm run build:web               # 构建前端 → frontend/dist
npm run start                   # 启动应用(加载 frontend/dist)
npm run dev                     # 开发模式(隔离数据目录)
npm run dist                    # 打包 NSIS 安装包 → release/
```

> 词库数据已内嵌在 `desktop/frontend/apps/nuxt/public/dicts/`(压缩格式 .json.z);修改词库后需重跑 `desktop/scripts/compress-dicts.py` 与 `desktop/scripts/generate-dict-index.py`。

## 目录结构

```
English_Learner/
├── LICENSE              # GPL-3.0
├── NOTICE               # 上游版权与修改声明
├── THIRD_PARTY_NOTICES.md
├── desktop/             # ★ 唯一开发位置(main.js / preload.js / frontend 前端源码 / scripts 工具脚本)
├── Wudao-dict/          # 无道词典数据克隆(纯数据源,详见其 README)
└── docs/                # 开发文档
```

## 许可

- 本项目基于 TypeWords 修改,**以 GPL-3.0 许可发布**(见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE))。修改、再分发须保留版权声明并继续以 GPL-3.0 授权。
- 第三方组件、词库数据与字体资源的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 免责声明

- 词库数据(无道词典、考试词库)源自网络收集,版权归原所有者,仅供学习研究使用,请勿用于商业用途。
- 软件提供的一切学习数据与统计仅供参考,不构成任何承诺。

## 致谢

- [TypeWords](https://github.com/zyronon/TypeWords) — 本项目的基础(GPL-3.0)
- [ECDICT](https://github.com/skywind3000/ECDICT)(MIT)— 84 万词英汉词典数据库
- 无道词典 — 词库数据来源
- 小米 MiSans — 内置字体
- 微软 Edge TTS — 在线语音合成
