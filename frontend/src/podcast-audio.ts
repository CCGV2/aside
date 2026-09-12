export interface PodcastAudio {
  positionMs: number;
  play(): Promise<void>;
  pause(): void;
  setRate(rate: number): void;
}
/** The DOM reference stays here; UI code only binds it. */
export class BrowserPodcastAudio implements PodcastAudio {
  private element: HTMLAudioElement | null = null;
  attach = (element: HTMLAudioElement | null) => {
    this.element = element;
  };
  get positionMs() {
    return (this.element?.currentTime ?? 0) * 1000;
  }
  set positionMs(value: number) {
    if (this.element) this.element.currentTime = value / 1000;
  }
  play() {
    return this.element?.play() ?? Promise.reject(Error("节目音频未就绪"));
  }
  pause() {
    this.element?.pause();
  }
  setRate(rate: number) {
    if (this.element) this.element.playbackRate = rate;
  }
}
