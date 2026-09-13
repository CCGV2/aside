import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnrichment } from "../backend/src/enrichment.js";

const valid = {
  summary: "技术分析",
  hostStyle: "自然",
  speakers: [
    { id: "s", presentation: "unknown", durationMs: 100, confidence: 0.5 },
  ],
  groups: [{ firstId: "p", lastId: "p" }],
};
test("enrichment repairs missing commas and retains original evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aside-json-"));
  let evidence = "";
  const artifact = async (value: string) => {
    evidence = value;
  };
  try {
    const raw = JSON.stringify(valid).replace(',"hostStyle"', '\n"hostStyle"');
    assert.deepEqual(await parseEnrichment(raw, "stop", artifact), valid);
    const saved = JSON.parse(evidence);
    assert.equal(saved.raw, raw);
    assert.equal(saved.repaired, true);
    assert.equal(saved.status, "validated");
    assert.deepEqual(
      await parseEnrichment(
        "  ```json\n" + JSON.stringify(valid) + "\n```  ",
        "stop",
        artifact,
      ),
      valid,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("enrichment rejects incomplete, refused and schema-invalid output while saving evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aside-json-"));
  let evidence = "";
  const artifact = async (value: string) => {
    evidence = value;
  };
  try {
    for (const [raw, reason] of [
      [JSON.stringify(valid), "length"],
      [JSON.stringify(valid), "content_filter"],
      [JSON.stringify(valid).slice(0, -1), "stop"],
      ['{"summary":"only"}', "stop"],
      [
        JSON.stringify({
          ...valid,
          speakers: [{ ...valid.speakers[0], confidence: 2 }],
        }),
        "stop",
      ],
      ["", "stop"],
    ]) {
      await assert.rejects(
        parseEnrichment(raw, reason, artifact),
        /原始回复已保存/,
      );
      const saved = JSON.parse(evidence);
      assert.equal(saved.status, "invalid");
      assert.equal(saved.raw, raw);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
