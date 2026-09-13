import { test, expect } from "@playwright/test";

test("public landing explains the interaction and opens the sample without upload prompts", async ({
  page,
}) => {
  await page.route("**/api/health", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), uploadsEnabled: false },
    });
  });
  await page.goto("/");
  const cta = page.getByRole("button", { name: "免登录试听" });
  await expect(cta).toBeEnabled();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "02 问一句，聊明白" }).click();
  await expect(page.locator(".preview-question")).toHaveText(
    "为什么散步会带来灵感？",
  );
  await page.getByRole("button", { name: "03 从刚才那句继续" }).click();
  await expect(page.locator(".preview-time")).toHaveText("00:10");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await cta.click();
  await expect(page.getByRole("region", { name: "节目逐字稿" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    const box = await page
      .getByRole("textbox", { name: "输入问题" })
      .boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await expect(
      page.getByRole("button", { name: "播放", exact: true }),
    ).toBeInViewport();
  }
});
