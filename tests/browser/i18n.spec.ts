import { test, expect } from "@playwright/test";

test.use({ locale: "en-US" });

test("English browser default, persistent switch, and uninterrupted playback", async ({
  page,
}) => {
  await page.route("**/api/episodes/demo-natural-resume/checkpoint", (route) =>
    route.fulfill({
      json: {
        positionMs: 0,
        history: [{ role: "user", text: "保留这段对话" }],
      },
    }),
  );
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: /Your podcast.*Now a conversation/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /给思考留一点空间/ }).click();
  await expect(page.getByRole("region", { name: "Transcript" })).toContainText(
    "今天天气真好",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0.2);
  const audio = await page.locator("audio").elementHandle();
  const position = await audio!.evaluate(
    (audio: HTMLAudioElement) => audio.currentTime,
  );
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("zh");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("region", { name: "节目逐字稿" })).toBeVisible();
  await expect(page.getByRole("log")).toContainText("保留这段对话");
  expect(
    await audio!.evaluate(
      (audio: HTMLAudioElement, previous: number) =>
        audio.isConnected && !audio.paused && audio.currentTime >= previous,
      position,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "界面语言" })).toHaveValue(
    "zh",
  );
  await expect(page).toHaveTitle("Aside · 随时聊两句");
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("combobox", { name: "Interface language" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Chinese browser works when preference storage is unavailable", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "zh-TW" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "aside.locale") throw new Error("blocked");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "aside.locale") throw new Error("blocked");
      return setItem.call(this, key, value);
    };
  });
  await page.goto("http://127.0.0.1:5173/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: /Your podcast.*Now a conversation/ }),
  ).toBeVisible();
  await context.close();
});
