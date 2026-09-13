# asidefm.com 生产部署

目标：`https://asidefm.com`。生产配置为 `wrangler.production.jsonc`，本地配置为 `wrangler.jsonc`，避免本地调试覆盖生产域名。

## 资源

- Cloudflare account: `221784d24eb2a95d148bc96b6f06d6be`（个人账号）
- Worker: `asidefm`
- D1: `asidefm` / `5e090133-a259-40a8-a20b-5262a5f7bc48`
- R2: `asidefm-audio`，r2.dev 公开访问关闭；一天后清理未完成 multipart
- Workflow: `asidefm-analysis`
- Durable Objects: `MediaContainer`、`LiveSupervisor`
- Turnstile: `Aside FM trial`，managed 模式，仅 `asidefm.com`

已应用数据库迁移 0001–0005。演示节目 `demo-natural-resume` 已导入元数据和逐字稿，音频 148,288 bytes；这是项目生成的合成演示，不包含私人节目、播放历史和问答记录。

## 发布

```bash
npm run deploy:cloudflare
# 新增数据库迁移时，先执行：
npm run db:cloudflare:production
```

首次部署需要 `SESSION_SECRET`、`OPENAI_API_KEY`、`TURNSTILE_SECRET_KEY` 三个 Worker Secrets；使用 Wrangler secret put/bulk 的私密输入。不要把 secret 值写进仓库。普通再次部署保留现有 Secrets，不重新生成会话密钥。

示例导出：`npm run export:demo`，输出在忽略版本管理的 `.wrangler/release-demo`；脚本仅允许项目自带、已处理的 demo，不导出其他节目或用户历史。

## 当前状态

2026-09-12：D1/R2/Turnstile、演示数据、Worker、Workflow、Container 和自定义域名均已部署。

- Worker version: `638fba73-eac5-4ab8-8b1e-e2870ef5d31e`
- Container app: `a03cceeb-6ffb-4d0f-af94-ce14bd76c7a3`
- Image digest: `sha256:a20de65ab5dcceb4e4a60caa81524447fbb0d95a7868174e000203d58d12cc9e`
- `https://asidefm.com/`：HTTPS HTTP 200。
- `/api/health`：HTTP 200，`liveConfigured=true`，`uploadsEnabled=true`。
- 用户明确授权后，通过 Wrangler 成功写入 `SESSION_SECRET`、`OPENAI_API_KEY`、`TURNSTILE_SECRET_KEY`。

线上验证完成（2026-09-13 04:44 UTC）：

- 公开列表只有项目自带的 `demo-natural-resume`，完整分析含 6 段逐字稿。
- 148,288 bytes 的音频与本地演示 SHA-256 一致，Range 请求返回 206 和正确字节。
- Turnstile 已配置；未验证提问返回 403 / `trial_verification_required`。
- 跨域 checkpoint 写入返回 403。
- 没有调用付费模型；真实语音对话、供应商侧关闭和计费仍需线上实测，不能仅凭 health 推断模型可用。

验证摘要保存在 `.wrangler/production-verification.json`。临时 Secrets JSON 和 Turnstile 创建回包已清理，密钥保存在 Worker Secrets，项目原有 `.env` 不变。

## 界面语言

前端支持中文和英文。首次访问按 `navigator.languages` 的顺序选择支持的语言，均不支持时使用英文；顶部切换器的手动选择保存在 `aside.locale`，优先于浏览器设置。同步更新页面标题和 HTML `lang`，切换不重建播放器、不清空对话。节目名称、逐字稿和问答内容保留原语言。

试用弹窗与 Turnstile 跟随界面语言（[Cloudflare 支持的语言代码](https://developers.cloudflare.com/turnstile/reference/supported-languages/)）。本次发布使用 `wrangler deploy --config wrangler.production.jsonc --containers-rollout=none`，保留现有 Container。

验证：69 项单元测试通过；15 项浏览器用例全部验证通过（新增语言用例修正测试定位和参数传递后单独重跑）。线上语言验证摘要保存于 `.wrangler/i18n-production-verification.json`。

## 产品首页与排版优化

首页改为独立 Hero，包含中英文价值介绍、免登录示例入口、可点选的收听/提问/继续交互示意和示例列表。未开放上传的环境隐藏上传控件，本地允许上传时保留导入入口。字体采用明确的系统字体栈；英文 Hero 使用 Georgia，中文标题使用系统无衬线字体，分别设置行高与字间距。

验证：生产构建通过；15 项既有浏览器回归和 1 项新增首页用例通过。检查了中英文桌面、390px 手机首屏；正式域名试听入口正常进入 6 段示例逐字稿。

## 桌面试听视窗

宽度大于 1000px 时，试听页使用 100dvh 弹性布局；播放器始终紧凑，隐藏大封面和页脚，逐字稿与聊天记录独立滚动，输入框保留可见。手机端保留纵向布局。验证了 1440×900、1280×720、1024×600 页面高度及输入框可见性，7 项相关浏览器用例通过（更新暂停后保持紧凑的预期后复测）。

## 进入试听的麦克风权限

移除插话方式和回答后继续设置栏，使用自动插话与服务端默认续播设置，不再读取旧的模式/等待偏好。首页进入试听的点击立即发起 getUserMedia 权限请求，成功后释放所有 track，播放时再由 ListeningSession 启动监听；拒绝时维持只听模式并提示仍可播放或打字。进入本身不发起 Live/转录/模型请求。

验证：构建、69 项单元测试通过；14 项现行浏览器用例通过（权限时机相关用例更新后复测）。正式 HTML 指向本次构建的 JS，资源返回 200。原生权限弹窗由浏览器处理，自动测试模拟授权和拒绝。

## 英文试用内容

新增 `voa-color-outside-lines`、`voa-pin-your-hopes`、`voa-curiosity-and-prying`，采用 VOA Learning English 原创讲解的约两分钟节选。版权来源、裁剪区间和音频哈希见 [public-samples.md](public-samples.md)。音频已上传 R2，元数据/逐字稿/续播点已导入 D1；公开库共 4 条内容。

4 项相关浏览器测试和生产构建通过。线上逐一验证 ready 状态、署名元数据、逐字稿、音频哈希相同及 Range 206；证据在 `.wrangler/public-samples/production-verification.json`。英文界面试听按钮优先打开英文内容。本次用项目配置的 Whisper 和音频分析模型准备公开样本；未进行线上付费问答。


## 扩充英文试听库

2026-09-12：新增 EFF 两集、NASA 两集、FOSS and Crafts 的 Blender 以及 Hacker Public Radio 的 Large Language Models，共六段 1:56–3:43 的英文节选。公开库现有 10 条（9 英文 + 1 中文演示）。每条的原始区间与授权证据见 [public-samples.md](public-samples.md)。

六条节选的音频已上传 R2，元数据、逐字稿与续播点已导入 D1。英文 Hero CTA 默认选择 Kara Swisher 的 Smashing the Tech Oligarchy。CC 内容显示许可名称，并提供音频节选与带转写 JSON 的下载入口；CC BY-SA 素材及其改编转写继续按同许可发布。

线上只读验证确认六条 ready、逐字稿/续播点数量正确、完整音频 SHA-256 与本地一致、Range 返回 206。证据：`.wrangler/public-samples/expanded-production-verification.json`。前端构建已通过；本地浏览器测试覆盖九条英文音频与授权链接。未执行线上付费 AI 问答。

正式域名浏览器回归也已通过：九条英文内容逐一播放并显示逐字稿，CC 下载链接正确，桌面试听页无需整体滚动。首次运行因测试重复打开同一节目、旧标题提前满足断言导致加载竞态；修正测试后正式域名用例通过（17 秒）。麦克风拒绝由测试模拟，没有采集真实麦克风音频。

## 下架中文演示

按用户要求，生产 D1 中 `demo-natural-resume` 的 `public` 改为 0。公开试听库仅保留 9 条英文节目。前端已有默认节目回退逻辑，中文界面会选择第一条可用英文试听，无需重新发布前端。项目自带演示仍保留用于本地开发。

## 账号与 profile 开发状态

本地已实现邮件验证码、Google OAuth、profile 编辑和私有头像；D1 新增 `0004_accounts.sql`。本地 69 个项目测试和 20 个 Worker/D1/R2 集成测试通过，前端构建及生产 Wrangler dry-run 通过。2026-09-12 已在 Cloudflare Email Sending 接入 `auth.asidefm.com`，控制台显示 Enabled、DNS Configured；生产 D1 已应用 `0004`，Worker 已部署包含限定发件地址 `EMAIL` binding 的版本 `c36b8c0c-47be-415c-a11a-40025b19387f`，其后 Google Secret 配置产生了更新版本。线上 `/api/health` 正常，`/api/auth/session` 返回邮件与 Google 渠道均启用，未登录 profile 返回 401。一次真实发信请求返回成功且 D1 存有挑战，Cloudflare 发信日志显示 Delivered；尚未检查收件箱或用验证码完成线上邮件登录。2026-09-13 已在 PAX Chrome profile 中完成真实 Google 登录和正式域名回调；同一浏览器的 session 返回已登录用户及 Google 头像。部署顺序及精确配置见[用户账号](accounts.md)；这一阶段 `ALLOW_UPLOADS=false` 保持不变。

2026-09-13 已部署登录账号每 UTC 日最多 5 个有效上传（上传中或已完成）的限制；取消未完成上传释放名额，分析重试使用独立额度，全站每日上限仍为 10。生产 Worker 版本 `2462e15a-acf2-4940-86a2-667e9e0e7724` 已接收 100% 流量；部署保留了原有前端资源与 Container。线上 `/api/health` 正常，邮件与 Google 登录渠道正常响应，同源未登录上传请求返回 401。这次配额预发布的绑定显示 `DAILY_UPLOAD_LIMIT=5`，当时 `ALLOW_UPLOADS=false`，因此未做真实上传或生产配额耗尽测试；随后发布的个人 Space 见下节。

## 个人 Space 发布

新版增加 D1 `0005_personal_space.sql` 的删除墓碑列与私人列表索引。发布时先应用迁移，再在 `ALLOW_UPLOADS=false` 下部署 Worker、静态资源与媒体 Container，确认 Container 更新完成，最后将生产配置的 `ALLOW_UPLOADS` 改为 `true` 并只更新 Worker。这个顺序避免新上传落到仍限制 3 小时/500 MiB 的旧 Container。

2026-09-13 实际发布顺序：生产 D1 应用 `0005`；在 `ALLOW_UPLOADS=false` 下部署 Worker、Space 静态资源和媒体镜像；Cloudflare Container 配置随后切换到新 digest，滚动更新结束；将 `ALLOW_UPLOADS=true` 发布为 Worker 版本 `3c90d665-0fc9-474e-83a6-018d229e2d58`。最后修正私人列表加载更多后的自动刷新，发布当前 Worker 版本 `2a05b519-8fc6-481a-abc9-b60fe4dde138`，保留 Container 镜像。

本地验证：69 项项目测试、25 项 Worker/D1/R2/Workflow 集成测试、此前 19 项 Chrome 浏览器回归通过；分页修正后 4 项 Space 浏览器回归和类型/边界检查通过。Linux/amd64 媒体镜像构建成功并在容器内接受 5:00:00 合成 WAV、拒绝 5:00:01。线上验证：`/space` 实际加载新版界面，`/api/health` 返回 `uploadsEnabled=true`，`/api/auth/session` 显示邮件和 Google 登录启用，未登录访问私人列表及上传均返回 401。尚未用真实账号在生产完成一次上传、自动分析，也未对接近五小时的真实压缩节目测量费用/耗时。见[个人 Space](personal-space.md)。

## My Space 双栏播放器

2026-09-13：将私人音频列表移到左侧导航。有可听音频时默认在右侧打开最近一条的暂停播放器、逐字稿和该音频的 checkpoint 对话记录；点击左侧另一条在 `/space` 内切换，不混入公开示例。左侧「上传音频」切到 Profile 和上传视图，空库也直接显示上传视图。手机端列表横向滚动。

本地完整 Chrome 回归 20/20、项目测试 69/69 通过；Space 回归额外检查私人/公开列表隔离、默认选择、跨音频切换逐字稿与对话、返回上传视图和手机宽度。桌面与手机截图人工检查通过。已发布 Worker 版本 `9649da4b-96ab-4a2d-bc90-fafc839320b4`，Cloudflare 部署状态为 100%。首次请求时静态资源短暂返回旧版，随后正式域名 `/space` 返回 `index-e73hOC5u.js` 和 `index-CaqYyiMI.css`，两项资源均以正确 MIME 和内容返回；实际浏览器已加载新版访客页面。未使用用户登录态在生产查看私人节目或播放私人音频。

## 播放器前端模块

2026-09-13：把原来位于 `frontend/src/main.tsx` 的播放器界面、空格键与手动录音释放、聊天滚动和视图切换动效移入 `frontend/src/PlayerView.tsx`。`main.tsx` 只组合账号、公开页与 My Space 路由；`usePlayerController` 和 `ListeningSession` 继续拥有播放及问答运行时。公开试听和私人 Space 仍共享同一套播放器。构建/类型检查、69 项项目测试和 20 项 Chrome 回归通过。生产 Worker 版本 `638fba73-eac5-4ab8-8b1e-e2870ef5d31e` 已接收 100% 流量；正式域名首页及 `/space` 均返回新 JS `index-H8MCYj8f.js`，其 MIME 为 JavaScript，`uploadsEnabled=true`。

## 底部播放器与逐句跳播

2026-09-13：公开试听与 My Space 的播放器改为底部常驻控制栏，保留顶部节目标题、左侧列表、逐字稿和对话区。逐字稿每句左侧在悬停、选中或键盘聚焦时显示播放按钮；点按跳到该句时间戳并立即播放，原有跟随和手动滚动可继续使用。手机端轻点句子后按钮出现。

本地构建、69 项项目测试及 21 项 Chrome 浏览器回归全部通过；新增用例核对逐句时间戳跳转、开始播放和桌面/手机底栏位置。生产 Worker `31bf6064-eab8-4707-99dd-08c796328df8` 已接收 100% 流量，绑定仍包含 `EMAIL`，`ALLOW_UPLOADS=true`。正式域名首页和 `/space` 均返回 `index-BYgAvilu.js`、`index-6mhoYjqW.css`；访客公开示例在生产桌面滚动后悬停按钮可见并能播放，手机触控选句、跳播和底栏贴底亦已验证。未借用私人账号验证生产私人音频。

## My Space 侧栏直传

2026-09-13：取消中间的 Profile/上传大卡片及 `/space?view=upload` 视图。左侧「上传音频」直接打开系统文件选择器，文件通过浏览器大小/时长预检后即按文件名上传，随后自动分析；每日用量、检查/上传进度、取消与错误都留在侧栏。中间有音频时持续显示原播放器、逐字稿和对话，空库只保留简短提示。Profile 仍可从右上角账号控件编辑。

构建、69 项项目测试、21 项 Chrome 浏览器回归通过。Space 回归覆盖空库直传、已有播放器时上传不切换音频、手机布局与分页刷新；桌面空库/播放器及手机截图已人工查看。生产 Worker `35c4da82-93b6-44e2-8b7a-a75b10de0e54` 已接收 100% 流量，`/space` 返回 `index-DJfUAwT5.js` 和 `index-3612Td6H.css`，两项资源 HTTP 200 且 MIME 正确，`/api/health` 显示 `uploadsEnabled=true`。没有对生产账号执行真实上传或付费分析。

## 收听入口的试用验证

2026-09-13：访客进入节目时，浏览器先请求麦克风权限；权限流程结束后显示 Turnstile，取消仍可收听，第一次付费操作会再次要求验证。访客证明绑定匿名身份与 IP，有效期从 30 分钟延长到 6 小时，覆盖最长 5 小时音频。已登录账号在服务端免 Turnstile，仍保留账号、IP、全站每日额度及请求速率限制；上传仍要求登录且每天最多 5 篇。

构建、69 项项目测试、26 项 Worker 集成测试和 23 项 Chrome 回归通过；浏览器回归覆盖权限与验证顺序、登录收听和上传免弹窗。生产 Worker `8c84cdca-7b0a-4fd1-a8a5-bf30470d34e2` 已接收 100% 流量，保留 `EMAIL` binding 和 `ALLOW_UPLOADS=true`。正式域名 `/`、`/space` 均加载新资源 `index-DxsyK5sI.js`；JS/CSS 返回 HTTP 200 且 MIME 正确，`/api/health` 显示 `trial=true`、`uploadsEnabled=true`，未登录 `/api/trial` 返回 `verified=false`。未在生产账号执行付费提问或真实上传。
