import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Store } from "../backend/src/store.js";
import { probe } from "../backend/src/jobs.js";
import type { Passage } from "@aside/engine/core";
const exec = promisify(execFile),
  store = new Store(resolve(".data"));
const id = "demo-natural-resume",
  dir = store.dir(id);
await mkdir(dir, { recursive: true });
const texts = [
  "今天天气真好，我们准备出去走走。",
  "不过，出门之前，我想和你聊聊，为什么散步会让人产生新的想法。",
  "当我们暂时离开屏幕，注意力会从一个固定的问题，转向周围的声音、光线和风。",
  "这不意味着每一次散步都会带来灵感。它只是给思考留下了一点空间。",
  "你可以随时打断我，问问刚才那个概念，也可以说，继续播放。",
  "聊完之后，我们会从一个完整的句子开始，回到刚才的话题。",
];
let offset = 0;
const passages: Passage[] = [];
for (let i = 0; i < texts.length; i++) {
  const path = join(dir, `${i}.aiff`);
  await exec("say", ["-v", "Tingting", "-r", "160", "-o", path, texts[i]]);
  const duration = await probe(path);
  passages.push({
    id: `p-${i}`,
    startMs: offset,
    endMs: offset + duration,
    text: texts[i],
    speaker: "host",
  });
  offset += duration;
}
await exec("ffmpeg", [
  "-y",
  "-v",
  "error",
  ...texts.flatMap((_, i) => ["-i", join(dir, `${i}.aiff`)]),
  "-filter_complex",
  `${texts.map((_, i) => `[${i}:a]`).join("")}concat=n=${texts.length}:v=0:a=1[out]`,
  "-map",
  "[out]",
  "-codec:a",
  "libmp3lame",
  "-f",
  "mp3",
  join(dir, "original"),
]);
store.put({
  id,
  title: "给思考留一点空间",
  createdAt: new Date().toISOString(),
  durationMs: offset,
  status: "ready",
  stage: "演示内容 · 本机合成语音与已知分段",
  progress: 1,
  analysis: {
    version: "demo-v1",
    source: "demo",
    passages,
    anchors: passages.map((p) => ({
      id: `a-${p.id}`,
      startMs: p.startMs,
      endMs: p.endMs,
      text: p.text,
      confidence: 1,
    })),
    speakers: [
      {
        id: "host",
        presentation: "feminine",
        durationMs: offset,
        confidence: 1,
      },
    ],
    voice: "feminine",
    voiceReason: "演示样本指定的合成女声，未进行真实声音分析",
    summary: "散步与思考空间的关系。",
    hostStyle: "平静、简洁、用日常例子解释概念，不夸大结论。",
  },
});
store.close();
console.log(
  "Created local demo with real playable audio (not provider analysis).",
);
