import { test } from "node:test";
import assert from "node:assert/strict";
import { MicrophoneBuffer } from "../frontend/src/microphone-buffer.js";
const config = { threshold: 0.025, minSpeechMs: 120, silenceMs: 160 };
test("PCM capture includes pre-trigger samples and never uploads ambient audio itself", async () => {
  const b = new MicrophoneBuffer(1000, config, 750);
  for (let i = 0; i < 10; i++) b.push(new Float32Array(40).fill(0.01));
  for (let i = 0; i < 2; i++)
    assert.equal(b.push(new Float32Array(40).fill(0.1)), undefined);
  assert.equal(b.push(new Float32Array(40).fill(0.1)), "start");
  b.begin();
  b.push(new Float32Array(40).fill(0.2));
  for (let i = 0; i < 3; i++)
    assert.equal(b.push(new Float32Array(40)), undefined);
  assert.equal(b.push(new Float32Array(40)), "end");
  const data = await b.snapshot().arrayBuffer(),
    v = new DataView(data);
  assert.equal(v.getUint32(24, true), 1000);
  assert.equal(v.getUint32(40, true), 720 * 2);
  assert.ok(v.getInt16(44, true) > 0);
  assert.equal(b.speaking, false);
  b.clear();
  assert.throws(() => b.snapshot());
});
test("brief click does not start speech and overflowing cold recording is bounded", () => {
  const b = new MicrophoneBuffer(1000, config, 200, 500);
  b.push(new Float32Array(40).fill(0.2));
  b.push(new Float32Array(40));
  assert.equal(b.speaking, false);
  b.begin();
  let event;
  for (let i = 0; i < 20; i++) {
    event = b.push(new Float32Array(40));
    if (event === "overflow") break;
  }
  assert.equal(event, "overflow");
  assert.throws(() => b.snapshot());
});

test("loud non-speech and isolated speech guesses cannot trigger interruption", () => {
  const b = new MicrophoneBuffer(16000, { ...config, vadThreshold: 0.8 }, 750);
  const loud = new Float32Array(512).fill(0.2);
  for (let i = 0; i < 40; i++) assert.equal(b.push(loud, 0.1), undefined);
  assert.equal(b.push(loud, 0.95), undefined);
  assert.equal(b.push(loud, 0.2), undefined);
  for (let i = 0; i < 3; i++) assert.equal(b.push(loud, 0.95), undefined);
  assert.equal(b.push(loud, 0.95), "start");
  for (let i = 0; i < 4; i++) assert.equal(b.push(loud, 0.05), undefined);
  assert.equal(b.push(loud, 0.05), "end");
});

test("quiet confident speech passes VAD without requiring the old volume threshold", () => {
  const quiet = new Float32Array(512).fill(0.006);
  const voice = new MicrophoneBuffer(16000, config, 750);
  for (let i = 0; i < 3; i++) assert.equal(voice.push(quiet, 0.96), undefined);
  assert.equal(voice.push(quiet, 0.96), "start");
  const noise = new MicrophoneBuffer(16000, config, 750);
  for (let i = 0; i < 20; i++) assert.equal(noise.push(quiet, 0.1), undefined);
  const energyOnly = new MicrophoneBuffer(16000, config, 750);
  for (let i = 0; i < 20; i++) assert.equal(energyOnly.push(quiet), undefined);
});

test("manual capture has no pre-roll but preserves non-silent PCM while held", async () => {
  const buffer = new MicrophoneBuffer(
    16000,
    { threshold: 0.025, minSpeechMs: 120, silenceMs: 650 },
    0,
  );
  buffer.push(new Float32Array(1600).fill(0.9)); // Ambient sound before pressing.
  buffer.begin();
  buffer.push(new Float32Array(1600).fill(0.25));
  const wav = new DataView(await buffer.snapshot().arrayBuffer());
  assert.equal(wav.getUint32(40, true), 3200);
  assert.equal(wav.getInt16(44, true), Math.round(0.25 * 32767));
  assert.equal(
    wav.getInt16(wav.byteLength - 2, true),
    Math.round(0.25 * 32767),
  );
});

test("cloud recording cap discards audio after thirty seconds", () => {
  const buffer = new MicrophoneBuffer(
    16000,
    { ...config, maxCaptureMs: 30000 },
    0,
  );
  buffer.begin();
  assert.notEqual(buffer.push(new Float32Array(16000 * 30)), "overflow");
  assert.equal(buffer.push(new Float32Array(160)), "overflow");
  assert.throws(() => buffer.snapshot());
});
