# 五音堂

以**宫商角徵羽**之一为调头，批量创作主旋律清晰的五声调式歌曲。支持 PWA、Android、iOS、手表精简 UI、智能戒指/手杖，以及 CLI 落盘。

## 快速开始

```bash
cd /Users/skat/Projects/active/wuyin-composer
npm install
npm test
npm run build
npm start          # http://localhost:5188
```

## 平台入口

| 平台 | 命令 / 方式 |
|------|-------------|
| **Web / PWA** | `npm start`，浏览器可「添加到主屏幕」 |
| **Android** | `npm run sync:android` → `npm run apk`（debug APK）或 `npm run open:android` |
| **iOS** | `npm run sync:ios` → `npm run open:ios`（需 macOS + Xcode） |
| **手表** | 同一 `www/`；视口 ≤280×300 自动精简创作/播放 UI |
| **戒指/手杖** | App 内点「启用穿戴」；左右倾切调式，摇一摇/轻点播放 |
| **CLI** | `npm run compose -- --mode yu --count 10 --midi --out ./out` |
| **桌面** | 浏览器打开 `www/`；Electron/Tauri 可后续包同一 `www` |

### CLI 示例

```bash
npm run compose -- --mode gong --count 5 --key D --seed 42 --out ./out
npm run compose -- --mode shang --count 8 --midi --structure ballad
```

参数：`--mode` `gong|shang|jue|zhi|yu` · `--count` · `--key` · `--tempo` · `--structure` · `--seed` · `--midi` · `--out`

### Android APK

需 **JDK 17**（系统若为 Java 24，Gradle 8.2 无法编译）。本机可用 Homebrew `openjdk@17`：

```bash
npm run apk
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
# 或手动：
# JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
```

HTML/JS 变更后务必 `npm run build`（或 `sync:*`），否则 APK 内仍是旧资源。

### iOS

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
npm run sync:ios
npm run open:ios
```

CocoaPods 需要 UTF-8 locale。

## 产品能力

- 选择宫 / 商 / 角 / 徵 / 羽为**主旋律调式**
- 批量 N 首（曲名、种子、速度、曲式 short/standard/ballad）
- 播放 / 暂停 / 上下首，旋律可视化
- 乐理知识页（五音、调头、情绪、移调）
- 导出单曲 MIDI/JSON、整批 JSON

## 测试

```bash
npm test                 # 全量 + 覆盖率门槛 ≥90%
npm run test:unit        # 单元测试
npm run test:ab          # A/B 对照（调式/结构/种子）
npm run test:completeness
npm run test:robustness
npm run test:security
npm run test:all         # 分类跑完再跑覆盖率全量
```

| 套件 | 文件 | 关注点 |
|------|------|--------|
| 单元 | `test/unit.test.js` 等 | 乐理、作曲、导出、消毒 API |
| A/B | `test/ab.test.js` | 调式/曲式/速度对照与可复现性 |
| 完备性 | `test/completeness.test.js` | 五音×结构×宫音、CLI、导出面 |
| 鲁棒 | `test/robustness.test.js` | NaN/越界/残缺 MIDI/重复 stop |
| 安全 | `test/security.test.js` | 路径穿越、XSS、原型污染、MIDI 字节 |

## 关键文件

```
src/theory.js          五声音阶与乐理词条
src/composer.js        批量作曲
src/synth.js           Web Audio 演奏
src/midi-export.js     MIDI / JSON
src/sanitize.js        HTML/文件名/MIDI 消毒
src/cli.js             CLI 核心（可单测）
src/wearable-input.js  戒指 / 手杖
src/app.js             UI 逻辑
index.html             触控优先界面 + 手表 CSS
bin/wuyin-cli.js       命令行批量生成
www/                   构建产物（PWA + Capacitor webDir）
```

## 手势

| 输入 | 动作 |
|------|------|
| 戒指左右倾 | 切换五音 |
| 戒指上下倾 | 上一首 / 下一首 |
| 戒指摇动 | 无曲则创作，有曲则播放/暂停 |
| 手杖轻点 | 同上 |
| 手杖挥动 | 切调式 / 下一首 |

## 设计

漆木底、青铜点缀、朱漆强调；避免紫白渐变与奶油衬线套餐。品牌名「五音堂」为首页主视觉。
