import type { MicrophoneConfig } from "@aside/engine/core";

/** Local PCM only: no network and no dependency on the Live connection. */
export class MicrophoneBuffer {
  private ring: Float32Array;
  private cursor = 0;
  private count = 0;
  private recording: Float32Array[] | undefined;
  private recorded = 0;
  private aboveMs = 0;
  private quietMs = 0;
  speaking = false;
  constructor(
    readonly sampleRate: number,
    private config: MicrophoneConfig,
    preRollMs: number,
    private maxCaptureMs = 60000,
  ) {
    this.ring = new Float32Array(Math.ceil((sampleRate * preRollMs) / 1000));
  }
  push(
    frame: Float32Array,
    speechProbability?: number,
  ): "start" | "end" | "overflow" | undefined {
    if (this.recording) {
      this.recording.push(frame.slice());
      this.recorded += frame.length;
      if (this.recorded > (this.sampleRate * this.maxCaptureMs) / 1000) {
        this.discard();
        return "overflow";
      }
    }
    for (const x of frame) {
      this.ring[this.cursor] = x;
      this.cursor = (this.cursor + 1) % this.ring.length;
      this.count = Math.min(this.count + 1, this.ring.length);
    }
    const rms = Math.sqrt(frame.reduce((s, x) => s + x * x, 0) / frame.length),
      ms = (frame.length / this.sampleRate) * 1000;
    const confidence = this.speaking
      ? Math.min(0.35, this.config.vadThreshold ?? 0.8)
      : (this.config.vadThreshold ?? 0.8);
    const hasVoice =
      speechProbability === undefined
        ? rms > this.config.threshold
        : rms > (this.config.vadMinRms ?? 0.003) &&
          speechProbability >= confidence;
    if (hasVoice) {
      this.aboveMs += ms;
      this.quietMs = 0;
      if (!this.speaking && this.aboveMs >= this.config.minSpeechMs) {
        this.speaking = true;
        return "start";
      }
    } else {
      this.aboveMs = 0;
      if (this.speaking) {
        this.quietMs += ms;
        if (this.quietMs >= this.config.silenceMs) {
          this.speaking = false;
          return "end";
        }
      }
    }
  }
  begin() {
    if (this.recording) return;
    const pre = new Float32Array(this.count);
    const start =
      (this.cursor - this.count + this.ring.length) % this.ring.length;
    for (let i = 0; i < this.count; i++)
      pre[i] = this.ring[(start + i) % this.ring.length];
    this.recording = [pre];
    this.recorded = pre.length;
  }
  snapshot(): Blob {
    if (!this.recording?.length) throw Error("没有可转录的本地录音");
    const buffer = new ArrayBuffer(44 + this.recorded * 2),
      view = new DataView(buffer);
    const text = (at: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
    };
    text(0, "RIFF");
    view.setUint32(4, 36 + this.recorded * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, this.recorded * 2, true);
    let offset = 44;
    for (const frame of this.recording)
      for (const x of frame) {
        const clipped = Math.max(-1, Math.min(1, x));
        view.setInt16(
          offset,
          Math.round(clipped * (clipped < 0 ? 32768 : 32767)),
          true,
        );
        offset += 2;
      }
    return new Blob([buffer], { type: "audio/wav" });
  }
  discard() {
    this.recording = undefined;
    this.recorded = 0;
  }
  clear() {
    this.discard();
    this.ring.fill(0);
    this.count = 0;
    this.cursor = 0;
    this.speaking = false;
    this.aboveMs = 0;
    this.quietMs = 0;
  }
}
