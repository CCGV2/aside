/** A single cancellable follow-up window; eligibility is rechecked at expiry. */
export class FollowupTimer {
  private timer?: ReturnType<typeof setTimeout>;
  cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  arm(delayMs: number, eligible: () => boolean, resume: () => void) {
    this.cancel();
    if (delayMs <= 0 || !eligible()) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (eligible()) resume();
    }, delayMs);
  }
}
