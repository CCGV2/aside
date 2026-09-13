# 数据库存储

业务代码不再把节目目录、JSON 文件或音频文件路径作为存储接口。`app.ts`、`jobs.ts` 和模型适配器不导入 `fs`/`path`，边界检查禁止重新引入这些依赖。

| 数据                         | 本地 SQLite                             | Cloudflare                                      |
| ---------------------------- | --------------------------------------- | ----------------------------------------------- |
| 节目及完整分析               | `episodes.json`，含 `analysis.passages` | D1 `episodes` 元数据及 `artifacts` 完整分析记录 |
| 逐字稿、分段分析、停顿       | `artifacts(episode_id,name,json)`       | D1 `artifacts(key,part,value)`                  |
| 模型原始证据                 | `artifacts`，保留原始文本               | D1 `artifacts`，保留原始文本                    |
| 问答任务记录                 | `artifacts`，`question-<UUID>`          | 原有流式问答不新增历史归档                      |
| 播放位置、对话历史、语音用量 | `checkpoints` / `voice_usage`           | D1 同名表，按 owner 隔离                        |
| 原音频                       | `objects` + `object_parts`              | 私有 R2                                         |
| 账号、登录方式与个人资料     | 单用户模式，无账号表                    | D1 `users` / `auth_identities` / `auth_sessions`；头像在私有 R2 |
| 编码音频                     | 临时生成，可重建                        | R2 分块，可重用                                 |

本地数据库路径仍是 `.data/aside.sqlite`；SQLite 本身使用数据库文件和 WAL，这是数据库引擎的持久化机制。新业务读写不依赖 `.data/<episode-id>/`。正式云端部署使用托管 D1/R2。

## 读写一致性

本地对象以版本号分块写入，全部接收成功后才提交可见指针；上传失败保留原对象。流式 Range 读取覆盖跨块范围；同进程替换对象时保留正在读取的旧版本，直到读取结束。编码器通过 `local-media.ts` 把原音频写入随机临时目录，用完清理；模型接收字节及证据回调。分析任务的恢复依据数据库中的 transcript / analysis 记录。

D1 结构化记录以最多 64,000 个 UTF-16 单元切片，并避免切开 surrogate pair。一次 batch 原子删除旧记录并写入新分片，最多 250 片；中途失败保留旧值。读取按 part 顺序重组 JSON。拆分是为了符合 [D1 单行大小限制](https://developers.cloudflare.com/d1/platform/limits/)，音频仍放在 R2，避免大媒体占用 D1 容量。

## 从本地旧目录迁移

停止旧后端，执行：

```bash
npm run migrate:storage
# 自定义目录：
ASIDE_DATA_DIR=/absolute/path/to/data npm run migrate:storage
```

脚本先通过 SQLite backup API 创建 `aside-before-storage-<UUID>.sqlite` 快照，再逐个导入元数据中已有节目对应目录的 `original`、`transcript-v1-*`、`analysis-v1-*`、`silences-v1`、`question-*`、`*.enrichment-*`。音频前后 SHA-256 必须一致；JSON 读回核对。已有数据库记录跳过，部分失败后可重跑。旧音频分块可重建，不导入；旧文件不会删除。

不要在仍有旧版本进程写目录时迁移。启动新服务后，只备份数据库即可覆盖新持久数据；运行期间使用 SQLite backup API，不要只复制可能仍有 WAL 写入的主文件。旧目录保留用于核对，不作为运行时回退来源。

Cloudflare 应用 `0001`–`0004` migrations。生产已有公开试听数据，账号迁移不改变这些节目；本次不会上传本地素材。若把改造前的 R2 JSON 数据接入新版本，需要先显式导入 D1 `artifacts`，不能只升级 schema。

## 验证

- SQLite 对象上传中断、跨块 Range、读取期间替换对象。
- 旧目录导入两次不会重复；删除测试旧目录并重开数据库后，音频 API 和 transcript 仍可读。
- 分析失败后关闭、重开 SQLite，再次运行复用已完成转录。
- 超过 D1 单行上限的中文/emoji JSON 分片读回，以及故障触发的 batch 回滚。
- 原有 Cloudflare 隔离、工作流和试用防滥用测试。
