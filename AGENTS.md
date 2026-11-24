# wuyin-composer

五音堂 以**宫商角徵羽**之一为调头，批量创作主旋律清晰的五声调式歌曲。支持 PWA、Android、iOS、手表精简 UI、智能戒指/手杖，以及 CLI 落盘。 快速开始 cd /Users/skat/Projects/active/wuyin-composer npm install npm test npm run build npm start # http://localhost:5188 平台入口 CLI 示例 npm run compose -- --mode gong --count 5 --key D --seed 42 --out ./out

## 用途与 Target 判定

五声调式作曲（PWA/移动；穿戴可选）

- 移动端：需要
- 智能硬件：可选（可搁置）

## 目标平台

| 平台 | 方式 | 产出 |
|------|------|------|
| 🤖 Android | Capacitor → Gradle | APK |
| 🍎 iOS | Capacitor → Xcode | IPA |
| 智能硬件 | 可选（非当前里程碑硬门槛） | 戒指/手杖/手表 |

## 技术栈信号

- 检测到：android, capacitor, ios, node

## 命令

```bash
npm install
npm test
npm run build
npm run start
npm run sync:android
```

## 同步说明

改 Web 源码后执行 `npm run build`（或 `build:web`），再 `npx cap sync android`。打 APK 建议使用 **JDK 17**（`JAVA_HOME` 指向 openjdk@17）。

## 助手约束

- Loop：先定可验证 Done 与停止条件；每切片过验证环；失败回灌；详见 docs/LOOP_ENGINEERING.md
- Harness：遵循根 AGENTS「Harness Engineering」；Guide=本文件，Sensor=测试/CI；同类失误二次须沉淀规则或测试（棘轮）。详见 docs/HARNESS_ENGINEERING.md
- 遵循仓库根 `AGENTS.md`：通用性/扩展性、分阶段里程碑、默认双 Target（**仅当用途适合**）
- 可选 Target 未做时可搁置；不要为不适用形态硬加 APK/穿戴
- 改动保持聚焦；公共逻辑抽到 shared/`tools/`，禁止静默失败

## 验证环 / Done

```bash
npm install
npm test          # 若有
npm run build     # 或 build:web
npx cap sync android   # 若有 android/
# 可选：JAVA_HOME=…/openjdk@17 npm run apk:debug
```

**Done 示例**：测试通过（若有）+ web 产物进 `www/`/`dist/` + `cap sync` 无报错。可选穿戴未做可搁置，不纳入强制 Done。
