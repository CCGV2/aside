import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeAnalysis,
  searchPodcast,
  getPassage,
  buildContext,
} from "@aside/engine/server";
const ps = [
  {
    id: "1",
    startMs: 0,
    endMs: 3000,
    text: "散步会给思考留下空间。",
    speaker: "a",
  },
  {
    id: "2",
    startMs: 3000,
    endMs: 6000,
    text: "后面的答案是收购。",
    speaker: "a",
  },
];
const a = makeAnalysis(ps, {
  summary: "future facts",
  hostStyle: "plain",
  speakers: [],
  groups: [
    { firstId: "1", lastId: "2" },
    { firstId: "missing", lastId: "2" },
  ],
});
test("lookup excludes future and partially heard passages", () => {
  assert.equal(searchPodcast(a, "收购", 4000).length, 0);
  assert.equal(searchPodcast(a, "散步", 4000).length, 1);
  assert.deepEqual(
    getPassage(a, 3000, 4000).map((p) => p.id),
    ["1"],
  );
});
test("context does not leak global future summary and labels current partial text", () => {
  const c = buildContext(a, 4000, []);
  assert.equal(c.currentPassage?.partiallyHeard, true);
  assert.equal(JSON.stringify(c).includes("future facts"), false);
  assert.equal(c.recentTranscript.length, 1);
});
test("analysis rejects fabricated boundaries and covers real segments", () => {
  assert.equal(a.anchors.length, 1);
  assert.equal(a.anchors[0].startMs, 0);
  assert.equal(a.anchors[0].endMs, 6000);
});

test("new Live session keeps recent roles and bounds multilingual history", async () => {
  const { liveStartupHistory } = await import("@aside/engine/server");
  const history = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 ? ("assistant" as const) : ("user" as const),
    text: `${i} 中文😀`.repeat(300),
  }));
  const selected = liveStartupHistory(history, 1000);
  assert.ok(
    new TextEncoder().encode(selected.map((t) => t.text).join("")).length <=
      1000,
  );
  assert.equal(selected.at(-1)?.role, "assistant");
  assert.ok(selected.at(-1)?.text.startsWith("19"));
  assert.ok(!selected.some((t) => t.text.startsWith("0 ")));
});
