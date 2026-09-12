# ADR 0003：收听操作、问答生命周期与共享契约

- 日期：2026-09-12
- 状态：已实现
- 延续：ADR 0002 的本地监听与按需云连接；当前三种模式和续播等待以 architecture.md 为准。

## 背景

加入按住说话、只听节目、可取消倒计时和回答延迟后，usePlayerController.ts 达到 990 行。页面仍持有语音连接与可写状态引用，并按固定顺序执行定位和提问。取消、过期回调与计时规则分散，组合问题主要依赖浏览器测试定位。

前后端各自描述回答结构，NDJSON 读取直接断言泛型。后端 Provider 同时负责 OpenAI 协议、工具循环、已听内容限制与引用收集，HTTP 测试需要继承供应商类。

## 决策

1. 页面只表达完整操作：定位、提交问题、播放、停止、按住/松开及设置变化。DOM 音频引用留在 BrowserPodcastAudio；页面只绑定 ref 与浏览器事件。
2. ListeningSession 是非 React 的收听 Module，协调音频、按需语音、播放 reducer 和完整操作。React Hook 订阅不可变快照，并负责节目列表、加载、轮询、checkpoint 与偏好持久化。
3. Conversation 持有整轮问答的有效性、请求取消、字幕聚合、工具委派等待、回答分类、来源、延迟与追问窗口。收听会话切换或停止时统一撤销问答；旧响应不能更新新一轮。模型输出完成不等于音频播放结束。
4. RuntimeClock、PodcastAudio、PlayerBackend 和 VoicePort 提供测试替换位置。时间和设备由浏览器 Adapter 提供，运行时测试不需要 React、DOM、WebRTC 或真实模型。
5. engine/contracts 定义请求、回答、来源、进度、错误与 checkpoint 的 Zod schema 和派生类型。后端验证输出；前端验证 JSON/NDJSON 并校验预期 revision。旧 checkpoint 中缺少 turn id 仍然有效。
6. QuestionService 执行问答政策与工具循环。QuestionModel 返回供应商无关的回答、工具调用、来源与响应 ID；OpenAIProvider 转换 SDK 输入/输出，并保留转录、音频分析和 Live 协商适配。进程入口组装依赖，HTTP 层只依赖 BackendServices。

## 保留的行为

- 固定自然续播锚点、默认已听内容限制、三种插话方式及回答语言规则。
- 本地麦克风与云端克隆轨道分离、先关闭再建立、首句转录和连接就绪双条件。
- 3 秒/8 秒/手动继续，长回答延长等待，暂缓持续跨追问有效。
- 原音频在语音失败后可继续播放；已经请求的续播不被随后断线取消。
- 继续保留真实本地 VAD 与 WebRTC 回环浏览器测试；运行时测试补充时序覆盖。

## 取舍

运行时增加了显式依赖与快照订阅，但取消规则有集中归属，新增 UI 入口无需复制操作序列。engine/contracts 引入浏览器可用的 Zod；它不引入供应商 SDK 或服务端实现。

本次不引入全局事件总线、状态管理框架、通用多供应商平台或独立分析 worker。真实模型回答质量、延迟与听感仍需另行验证。
