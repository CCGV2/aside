<div align="center">

# 🎧 Aside

**听到好奇的地方，随时插话。**

上传 Podcast · 开口提问 · 连续追问 · 从自然断点继续听

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
![Local prototype](https://img.shields.io/badge/status-local%20prototype-orange)

</div>

Aside 是一个可以用语音打断的播客播放器。它先分析整期音频，建立带时间戳的内容地图；你提出问题时，AI 结合当前听到的内容回答，聊完后回到完整的句子继续播放。

## ✨ 可以做什么

- **直接开口打断**：播放时启用本地人声检测，识别人声后暂停节目；手动暂停也会停止麦克风。
- **围绕节目聊下去**：同一次打断支持多轮对话，Agent 可以检索节目内容和搜索网络。
- **延续节目语气**：以节目人物的第一人称视角解释，回答语言跟随用户提问。自动选择偏男声或偏女声的预设声音，不克隆音色。
- **自然续播**：回答结束后 3 秒没有新输入就继续；说 “continue / go on / 继续” 后约 1.5 秒续播，从语义断点回退开始。
- **歌词式 Transcript**：全文展示、当前段落高亮、自动跟随；聊天自动滚到底部。播放时收起顶部区域，暂停时动画展开。
- **按需连接 Live**：日常监听在浏览器本地完成，提问时才建立云端语音会话；续播后短暂保留，再自动关闭。

## 🚀 本地启动

需要 **Node.js 24+、npm、FFmpeg（含 ffprobe）**，推荐使用 Chrome。

```bash
npm ci
cp .env.example .env
```

在 `.env` 中填写 `OPENAI_API_KEY`，然后运行：

```bash
npm run dev
```

打开 **http://127.0.0.1:5173**，上传音频，等待分析完成，开始播放并允许麦克风访问。API 默认运行在 `127.0.0.1:4310`。

当前代码使用 `whisper-1` 转录、`gpt-audio-1.5` 分析、`gpt-live-1` 语音交互，以及默认 `gpt-5.6-terra` 的后端工具调用。运行需要账号具有相应接口和模型权限；模型名称来自本项目配置，不代表所有账号均可使用。

**不调用模型的播放演示（macOS）：**

```bash
npm run demo
```

此命令使用系统 `say` 和 FFmpeg 生成短音频与预制分析。刷新页面即可测试播放和 Transcript；真实 AI 问答仍需要 API Key。

## ⚙️ 常用配置

完整示例见 [`.env.example`](.env.example)。修改后重启开发服务，刷新网页。

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `ASIDE_BACKEND_MODEL` | `gpt-5.6-terra` | 后端问答模型 |
| `ASIDE_MIC_VAD_THRESHOLD` | `0.8` | 本地人声概率阈值，越高越保守 |
| `ASIDE_MIC_VAD_MIN_RMS` | `0.003` | VAD 模式的静音过滤底线 |
| `ASIDE_MIC_MIN_SPEECH_MS` | `120` | 连续人声达到此时长才打断 |
| `ASIDE_MIC_SILENCE_MS` | `650` | 判断一句话结束的静音时长 |
| `ASIDE_AUTO_RESUME_MS` | `3000` | 回答结束后的追问等待时间；`0` 禁用 |
| `ASIDE_LIVE_GRACE_MS` | `5000` | 续播后保留 Live 会话的时间 |
| `ASIDE_LIVE_IDLE_CLOSE_MS` | `60000` | 空闲 Live 会话关闭时间 |

`ASIDE_MIC_VAD_ENABLED=false` 时使用音量检测，此时 `ASIDE_MIC_THRESHOLD` 才是主要触发阈值。建议戴耳机测试，减少节目外放被识别为用户说话。

## 🧩 代码与文档

```text
engine/       领域类型、播放状态机、续播点、上下文与检索规则
backend/      HTTP API、分析任务、模型接入、SQLite 和音频文件
frontend/     播放器、Transcript、本地麦克风、WebRTC 与交互
scripts/      演示数据、VAD 资源准备、依赖边界检查
tests/        单元/API 测试与浏览器集成测试
.docs/        架构说明、开发指南与设计决策
```

- [架构说明](.docs/architecture.md)：模块边界、分析与问答链路、会话生命周期、存储与限制。
- [开发与验证](.docs/development.md)：运行命令、测试前提、配置和故障定位。
- [ADR 0001 · 初始架构](.docs/adr/0001-interactive-podcast-architecture.md)
- [ADR 0002 · 按需 Live 会话](.docs/adr/0002-on-demand-live-sessions.md)

## 🛠️ 验证

```bash
npm test          # 单元与 API 测试
npm run build     # 类型、模块边界检查及前端构建
```

浏览器测试需先生成演示数据并启动开发服务，详见[开发指南](.docs/development.md)。自动化测试覆盖模拟模型响应、真实本地 VAD 和播放交互；不能替代真实语音会话的听感验证。

## 当前边界

这是单用户本地原型。分析任务目前串行执行，长节目需要等待；已完成的分块会缓存，失败后可以重试。多人播客统一使用一个预设声音，人物口吻与语言跟随依赖模型表现。

`.env`、上传音频、分析缓存、数据库、测试产物和生成的 VAD 资源均不进入 Git。音频分析、提问和云端语音交互会将相应内容发送给模型服务；本地 VAD 监听本身不上传音频。当前服务没有面向公网的用户认证，部署方案尚未完成。

## 📄 License

本项目采用 [Apache License 2.0](LICENSE)。第三方依赖及其模型资源遵循各自的许可证。
