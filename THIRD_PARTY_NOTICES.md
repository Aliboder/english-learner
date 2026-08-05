# 第三方组件与数据声明

本软件(EnglishLearner)使用了以下第三方代码、数据与字体资源,各自许可如下:

## 代码与框架

| 组件 | 许可 | 说明 |
|---|---|---|
| [TypeWords](https://github.com/zyronon/TypeWords) | GPL-3.0 | 本项目的基础,修改声明见 [NOTICE](NOTICE) |
| [ECDICT](https://github.com/skywind3000/ECDICT) | MIT | 英汉词典数据库 v1.0.28,词库转换脚本见 `desktop/scripts/convert-ecdict.py` |
| Electron / Nuxt / Vue / Pinia 等 | MIT 等 | 见各依赖包自带 LICENSE,不随仓库分发 node_modules |
| JSZip / xlsx 等前端库 | MIT / Apache-2.0 | 已本地化内置,见 `frontend/package.json` 依赖清单 |

## 词库数据

- **无道词典数据**(9.6 万词):数据源自网络收集,**无明确 LICENSE**,仅供学习研究使用,版权归原数据所有者。使用者应自行评估合规风险,不得用于商业用途。
- **15 个考试词库**(CET-4/6、考研、雅思、托福、高考、新概念等):源自 TypeWords 项目及网络收集,版权不明,仅供学习研究,版权归原所有者。
- 词库数据均为内嵌静态文件,不随本项目主张任何数据版权。

## 音效

- **机械键盘按键音效**(13 种轴体声音:Cherry MX、Gateron、圣熊猫、蒂芙尼、Topre 静电容等):源自 [kbsim](https://github.com/tplai/kbsim)(MIT License),经 [qwerty-learner](https://github.com/Realkai42/qwerty-learner)(GPL-3.0) 收录,文件位于 `frontend/apps/nuxt/public/sound/key-sounds/`。MIT 许可允许复制与再分发。

## 字体

- **MiSans**(小米字体,10 个字重,子集化为 woff2):依据小米「MiSans 字体许可协议」免费商用授权使用。许可要点:可免费使用与随软件分发;**禁止单独出售字体文件**;修改字体需遵守原许可条款。完整条款见小米字体官网:https://hyperos.mi.com/font

## 在线服务(运行期可选,非代码依赖)

- **微软 Edge TTS**:中文翻译朗读 / 例句朗读的在线语音合成,需联网,受微软服务条款约束。
- **有道发音**:单词发音的在线音频,需联网。

## 其他

- 本项目不包含任何账号体系、云端同步或遥测上报;所有学习数据保存在用户本机。
