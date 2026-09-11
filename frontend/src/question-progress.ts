/** Delay brief answers' filler; limit long tool chains to two spoken updates. */
export class QuestionProgress {
  private timer?: ReturnType<typeof setTimeout>;
  private phase = "working";
  private count = 0;
  private lastAt = 0;
  private closed = false;
  constructor(private emit: (phase: string) => void) {}
  update(phase: string) {
    if (this.closed || this.count >= 2) return;
    this.phase = phase;
    if (this.timer) return;
    const delay =
      this.count === 0 ? 1500 : Math.max(0, 8000 - (Date.now() - this.lastAt));
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.closed) return;
      this.count++;
      this.lastAt = Date.now();
      this.emit(this.phase);
    }, delay);
  }
  close() {
    this.closed = true;
    clearTimeout(this.timer);
  }
}
