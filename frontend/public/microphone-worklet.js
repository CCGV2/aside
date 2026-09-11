// Collect ~40 ms packets. A zero-gain output keeps the graph running without monitoring the mic.
class AsideCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.packet = new Float32Array(Math.round(sampleRate * 0.04));
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input)
      for (const value of input) {
        this.packet[this.offset++] = value;
        if (this.offset === this.packet.length) {
          this.port.postMessage(this.packet, [this.packet.buffer]);
          this.packet = new Float32Array(Math.round(sampleRate * 0.04));
          this.offset = 0;
        }
      }
    return true;
  }
}
registerProcessor("aside-capture", AsideCapture);
