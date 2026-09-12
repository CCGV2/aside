import { test } from "node:test";
import assert from "node:assert/strict";
import { ResponseLatencyTracker } from "../frontend/src/response-latency.js";

test("latency excludes progress and records the first audible answer once", () => {
  let now = 100;
  const tracker = new ResponseLatencyTracker(() => now);
  tracker.questionEnded("cold");
  now = 1100;
  assert.equal(tracker.output(false), undefined);
  now = 2600;
  assert.deepEqual(tracker.output(true), {
    connection: "cold",
    milliseconds: 2500,
  });
  assert.equal(tracker.output(true), undefined);
  tracker.questionEnded("warm");
  now = 3000;
  assert.deepEqual(tracker.output(true), {
    connection: "warm",
    milliseconds: 400,
  });
});

test("cancelled and superseded turns never contribute stale measurements", () => {
  let now = 0;
  const tracker = new ResponseLatencyTracker(() => now);
  tracker.questionEnded("cold");
  tracker.cancel();
  assert.equal(tracker.output(true), undefined);
  tracker.questionEnded("cold");
  now = 500;
  tracker.questionEnded("warm");
  now = 700;
  assert.deepEqual(tracker.output(true), {
    connection: "warm",
    milliseconds: 200,
  });
});
