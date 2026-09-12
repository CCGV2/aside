import { test, expect, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.route("**/api/episodes/demo-natural-resume/checkpoint", (route) =>
    route.fulfill({ json: { positionMs: 3, history: [] } }),
  );
  await page.route("**/api/health", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: {
        ...(await response.json()),
        liveConfigured: true,
        microphone: {
          vadEnabled: false,
          threshold: 0.025,
          minSpeechMs: 120,
          silenceMs: 160,
        },
        voiceLifecycle: {
          preRollMs: 750,
          graceMs: 100,
          idleCloseMs: 60000,
          autoResumeMs: 3000,
        },
      },
    });
  });
  // No test can fall through to a paid voice or transcription request.
  await page.route("**/api/episodes/*/live", (route) =>
    route.fulfill({ status: 503, json: { error: "测试连接不可用" } }),
  );
  await page.route("**/api/episodes/*/transcribe-question", (route) =>
    route.fulfill({ json: { text: "测试问题" } }),
  );
  await page.route("**/api/episodes/*/question", (route) =>
    route.fulfill({
      json: {
        revision: route.request().postDataJSON().revision,
        action: "answer",
        answer: "散步给思考留出空间。",
        sources: [],
        tools: [],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /给思考留一点空间/ }).click();
}

async function ask(page: Page, text = "为什么？") {
  await page.getByRole("textbox", { name: "输入问题" }).fill(text);
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.locator(".message.assistant").last()).toContainText("散步");
}

const paused = (page: Page) =>
  page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.paused);

test("listen-only needs no microphone; visible countdown can be held through follow-ups", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { micRequests: 0 });
    navigator.mediaDevices.getUserMedia = async () => {
      (window as any).micRequests++;
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await openDemo(page);
  await page.getByLabel("插话方式").selectOption("off");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect.poll(() => paused(page)).toBe(false);
  expect(await page.evaluate(() => (window as any).micRequests)).toBe(0);
  await ask(page);
  await expect(page.locator(".followup-window")).toContainText(/秒后继续播放/);
  await page.getByRole("button", { name: "先别继续" }).click();
  await expect(page.locator(".followup-window")).toContainText("准备好了");
  await ask(page, "再解释一点");
  await page.waitForTimeout(3400);
  expect(await paused(page)).toBe(true);
  await page.getByRole("button", { name: "继续听 ↗" }).click();
  await expect.poll(() => paused(page)).toBe(false);
  await ask(page);
  await expect(page.locator(".followup-window")).toContainText(/秒后继续播放/);
  await expect.poll(() => paused(page), { timeout: 5000 }).toBe(false);
  await page.getByLabel("回答后继续").selectOption("0");
  await ask(page);
  await page.waitForTimeout(3400);
  expect(await paused(page)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /给思考留一点空间/ }).click();
  await expect(page.getByLabel("插话方式")).toHaveValue("off");
  await expect(page.getByLabel("回答后继续")).toHaveValue("0");
});

test("microphone rejection leaves original playback usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("未允许麦克风", "NotAllowedError");
    };
  });
  await openDemo(page);
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("可以继续听节目");
  await expect.poll(() => paused(page)).toBe(false);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect.poll(() => paused(page)).toBe(true);
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect.poll(() => paused(page)).toBe(false);
});

test("manual hold ignores ambient sound, submits on release, and recovers from cloud failure", async ({
  page,
}) => {
  let transcriptions = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.addInitScript(() => {
    Object.assign(window, { micRequests: 0 });
    navigator.mediaDevices.getUserMedia = async () => {
      (window as any).micRequests++;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const destination = ctx.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      await ctx.resume();
      return destination.stream;
    };
  });
  await openDemo(page);
  await page.route("**/api/episodes/*/live", async (route) => {
    await released;
    await route.fulfill({ status: 503, json: { error: "测试连接不可用" } });
  });
  await page.route("**/api/episodes/*/transcribe-question", async (route) => {
    transcriptions++;
    const body = route.request().postDataBuffer()!;
    const wav = body.subarray(body.indexOf(Buffer.from("RIFF")));
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    const pcm = wav.subarray(44, 44 + wav.readUInt32LE(40));
    expect(pcm.length).toBeGreaterThan(1600);
    expect(pcm.some((value) => value !== 0)).toBe(true);
    release();
    await route.fulfill({ json: { text: "手动问题" } });
  });
  await page.getByLabel("插话方式").selectOption("manual");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  expect(await page.evaluate(() => (window as any).micRequests)).toBe(0);
  const button = page.getByRole("button", { name: "按住说话", exact: true });
  await button.focus();
  await page.keyboard.down("Space");
  await expect(button).toContainText("正在录音");
  await page.waitForTimeout(500);
  expect(transcriptions).toBe(0);
  expect(await paused(page)).toBe(true);
  await page.keyboard.up("Space");
  await expect.poll(() => transcriptions).toBe(1);
  await expect(page.getByRole("alert")).toContainText("可以继续听节目");
  await page.getByRole("button", { name: "继续听 ↗" }).click();
  await expect.poll(() => paused(page)).toBe(false);
  await expect(page.getByRole("status")).toContainText("麦克风未监听");
});

test("release before permission resolves cannot record or connect later", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/(live|transcribe-question)$/.test(request.url()))
      calls.push(request.url());
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        Object.assign(window, {
          grantMic: () => {
            const ctx = new AudioContext();
            const stream = ctx.createMediaStreamDestination().stream;
            Object.assign(window, { lateStream: stream });
            resolve(stream);
          },
        });
      });
  });
  await openDemo(page);
  await page.getByLabel("插话方式").selectOption("manual");
  const button = page.getByRole("button", { name: "按住说话", exact: true });
  await button.focus();
  await page.keyboard.down("Space");
  await expect(button).toContainText("开启麦克风");
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).grantMic))
    .toBe("function");
  await page.keyboard.up("Space");
  await page.evaluate(() => (window as any).grantMic());
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).lateStream.getTracks()[0].readyState),
    )
    .toBe("ended");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(calls).toEqual([]);
});

test("long answers leave eight seconds and long conversations show heard context", async ({
  page,
}) => {
  await openDemo(page);
  await page.clock.install();
  await page.getByLabel("插话方式").selectOption("off");
  await page.locator("audio").evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = 26;
  });
  await page.route("**/api/episodes/*/question", (route) =>
    route.fulfill({
      json: {
        revision: route.request().postDataJSON().revision,
        action: "answer",
        answer: "散步让思考变得轻松。".repeat(24),
        sources: [],
        tools: [],
      },
    }),
  );
  await ask(page);
  await expect(page.locator(".followup-window")).toContainText(
    "8 秒后继续播放",
  );
  await page.getByRole("button", { name: "先别继续" }).click();
  await page.clock.fastForward(61000);
  await expect(page.locator(".return-context")).toContainText("刚才听到");
  expect(await paused(page)).toBe(true);
});
