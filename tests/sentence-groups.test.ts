import { test } from "node:test";
import assert from "node:assert/strict";
import type { Passage } from "@aside/engine/core";
import { sentenceGroups } from "../scripts/sentence-groups";

function passages(texts: string[], ms = 4000): Passage[] {
  return texts.map((text, index) => ({
    id: `p-${index}`,
    startMs: index * ms,
    endMs: (index + 1) * ms,
    text,
    speaker: "unknown",
  }));
}
const spans = (texts: string[], ms = 4000) =>
  sentenceGroups(passages(texts, ms)).map((group) => [
    group.firstId,
    group.lastId,
  ]);

test("a Latin sentence ending closes the group", () => {
  assert.deepEqual(
    spans([
      "The first part ends.",
      "The second part runs on",
      "and ends here.",
    ]),
    [
      ["p-0", "p-0"],
      ["p-1", "p-2"],
    ],
  );
});

test("full-width Chinese endings also close the group", () => {
  assert.deepEqual(
    spans(["第一句到这里结束。", "第二句还在继续", "也结束了！"]),
    [
      ["p-0", "p-0"],
      ["p-1", "p-2"],
    ],
  );
  assert.deepEqual(spans(["这是问题吗？", "答案在这里。"]), [
    ["p-0", "p-0"],
    ["p-1", "p-1"],
  ]);
});

test("a closing quote after the mark still closes the group", () => {
  assert.deepEqual(spans(["他说", "「就是这样。」", "下一段继续"]), [
    ["p-0", "p-1"],
    ["p-2", "p-2"],
  ]);
  assert.deepEqual(spans(["He said", '"That is all."', "The next part"]), [
    ["p-0", "p-1"],
    ["p-2", "p-2"],
  ]);
});

test("a group never runs past the duration cap even with no sentence ending", () => {
  assert.deepEqual(spans(["一", "二", "三", "四", "五", "六", "七", "八"]), [
    ["p-0", "p-5"],
    ["p-6", "p-7"],
  ]);
});

test("the last segment always closes its group and empty input yields nothing", () => {
  assert.deepEqual(spans(["no ending here", "still nothing"]), [
    ["p-0", "p-1"],
  ]);
  assert.deepEqual(sentenceGroups([]), []);
});
