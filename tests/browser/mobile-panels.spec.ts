import { test, expect } from "@playwright/test";

for (const width of [320, 390]) {
  test(`mobile panels collapse and expand without affecting playback at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/episodes/*/checkpoint", (route) =>
      route.fulfill({ json: { positionMs: 0, history: [] } }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "体验示例", exact: true }).click();
    const transcript = page.getByRole("button", {
      name: "文字稿",
      exact: true,
    });
    const chat = page.getByRole("button", { name: "聊两句", exact: true });
    await expect(transcript).toHaveAttribute("aria-expanded", "true");
    await transcript.click();
    await expect(transcript).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("region", { name: "文字稿" })).toBeHidden();
    await chat.click();
    await expect(page.getByRole("textbox", { name: "输入消息" })).toBeVisible();
    await page.getByRole("textbox", { name: "输入消息" }).fill("保留这条草稿");
    await chat.click();
    await expect(page.getByRole("textbox", { name: "输入消息" })).toBeHidden();
    await chat.click();
    await expect(page.getByRole("textbox", { name: "输入消息" })).toHaveValue(
      "保留这条草稿",
    );
    await page.getByRole("button", { name: "播放", exact: true }).click();
    await expect(transcript).toHaveAttribute("aria-expanded", "true");
    await transcript.click();
    await chat.click();
    await expect(chat).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("textbox", { name: "输入消息" }),
    ).toBeInViewport();
    await chat.click();
    await expect
      .poll(() =>
        page.locator("audio").evaluate((a: HTMLAudioElement) => !a.paused),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "暂停", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("region", { name: "文字稿" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "输入消息" })).toBeVisible();
  });
}
