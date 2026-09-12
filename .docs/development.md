# 开发与验证

## 环境

使用 Node.js 24+（后端使用内置 SQLite）、npm、FFmpeg 和 ffprobe。初次执行 `npm ci`，复制 `.env.example` 为 `.env` 并配置密钥。不要把真实密钥写进示例或前端环境变量。

`npm run dev` 同时启动 backend 和 frontend。修改 `.env` 后重启命令并刷新网页。仅修改源码通常由 watcher / Vite 自动加载。前端代理默认指向 4310；修改后端 PORT 时也需要同步 `frontend/vite.config.ts`。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地 API 与 Web App |
| `npm run check` | TypeScript 与模块导入边界 |
| `npm test` | 单元与 API 测试 |
| `npm run build` | 检查后生成 `frontend/dist` |
| `npm run demo` | macOS 生成无需模型的演示数据 |
| `npm run test:e2e` | Chrome 浏览器集成测试 |

VAD 的 ONNX、WASM 与 worklet 来自锁定的 npm 依赖，frontend 的 predev / prebuild 自动复制到 `frontend/public/vad/`。这些生成文件不进入 Git。

## 浏览器测试

当前浏览器测试依赖本机 Chrome、正在运行的开发服务，以及默认 `.data/` 中的 `demo-natural-resume` 演示节目：

```bash
npm run demo
npm run dev
```

在另一个终端执行：

```bash
npm run test:e2e
```

演示生成脚本使用 macOS 的 `say -v Tingting`；非 macOS 环境需要另行准备等价演示数据。Playwright 配置没有自动启动 webServer。

`tests/listening-session.test.ts` 用可控时钟与设备替身直接验证组合时序；`question-service.test.ts` 验证工具流程；`contracts.test.ts` 验证 JSON/NDJSON 校验；`provider.test.ts` 验证 SDK 格式映射。

浏览器测试覆盖 Transcript 跟随、聊天滚动、折叠布局、空格快捷键、麦克风生命周期、续播与本地 VAD，以及手动按住/释放、权限延迟、拒绝权限后的播放、倒计时取消与偏好保存。WebRTC loopback 使用本地合成输出验证自动/手动问答的音频结束计时、延迟采样和旧事件拦截。模型接口使用测试替身，VAD 用真实浏览器模型和音频验证。测试通过不代表真实模型的回答速度、人物口吻、语言跟随或各种麦克风环境都已验证。

## 排查入口

- 上传或分析失败：查看后端终端、节目分析状态和数据目录里的分块结果。解析失败会保留原始模型输出；重试会复用已完成阶段。
- 无法语音打断：先检查浏览器麦克风权限和 UI 错误，再检查本地 VAD 资源是否成功加载。VAD 模式调整 `ASIDE_MIC_VAD_THRESHOLD` / `ASIDE_MIC_VAD_MIN_RMS`，不是旧的 `ASIDE_MIC_THRESHOLD`。
- Live 建立失败：查看后端接口错误和账号模型权限。不要将包含令牌或用户内容的完整请求日志直接贴进 Issue。
- 恢复了旧播放位置：checkpoint 是持久化数据，不是播放器初始值；浏览器测试单独替换 checkpoint 保持确定性。

## Git 与数据

`.gitignore` 排除 `.env` 及其变体（保留空值 `.env.example`）、默认 `.data/`、依赖、构建产物、VAD 生成资源、测试报告和系统杂项。

若将 `ASIDE_DATA_DIR` 设在仓库内部的其他位置，需自行把该目录加入 `.gitignore`。提交前用 `git status` 检查，避免加入音频、对话、模型原始响应和数据库。本项目采用 [Apache License 2.0](../LICENSE)，第三方依赖及其模型资源遵循各自的许可证。
