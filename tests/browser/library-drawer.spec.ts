import { test, expect } from "@playwright/test";

test("player library is a dismissible drawer with keyboard focus contained", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例", exact: true }).click();
  const trigger = page.getByRole("button", { name: "音频库", exact: true });
  const drawer = page.getByRole("dialog", { name: "公共音频库" });
  await expect(drawer).toHaveCount(0);
  await expect(page.locator(".archive-library")).toHaveCount(0);
  await trigger.click();
  const close = drawer.getByRole("button", { name: "关闭音频库" });
  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  await expect(drawer.locator(".audio-library-select").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(700, 300);
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  const bounds = await drawer.boundingBox();
  expect(bounds?.width).toBe(390);
  expect(bounds?.height).toBe(844);
  await drawer.locator(".audio-library-select").first().click();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator(".player-main")).toBeVisible();
});

for (const width of [320, 390, 768]) {
  test(`player top bar and dock fit ${width}px without a sidebar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "体验示例", exact: true }).click();
    await expect(page.locator(".sidebar, .space-sidebar")).toHaveCount(0);
    const header = page.locator(".player-header");
    for (const control of [
      header.getByRole("link", { name: "Aside", exact: true }),
      header.getByRole("button", { name: "音频库", exact: true }),
      header.getByRole("button", { name: "登录 / 注册", exact: true }),
      header.getByRole("button", { name: "界面语言", exact: true }),
    ]) {
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width <= 700) expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width <= 1000) {
      const dock = await page.locator(".player-dock").boundingBox();
      expect(dock!.x).toBe(0);
      expect(dock!.width).toBe(width);
      expect(dock!.y + dock!.height).toBeLessThanOrEqual(844);
    }
    await header.getByRole("button", { name: "音频库", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "关闭音频库" })
      .click();
    await expect(
      header.getByRole("button", { name: "音频库", exact: true }),
    ).toBeFocused();
  });
}

test("desktop library stays visible with compact title rows and adapts to mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例", exact: true }).click();
  const sidebar = page.getByRole("complementary", { name: "公共音频库" });
  await expect(sidebar).toBeVisible();
  await expect(
    page.getByRole("button", { name: "音频库", exact: true }),
  ).toHaveCount(0);
  const row = sidebar.locator(".audio-library-select").first();
  const title = await row.getAttribute("title");
  await expect(
    sidebar.getByRole("link", { name: "Aside", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Aside", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("heading", { name: "音频库", exact: true }),
  ).toBeVisible();
  await expect(row.locator(".audio-library-duration")).toHaveText(/\d+:\d{2}/);
  await expect(row.locator(".audio-library-play")).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(row.locator(".audio-library-duration")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(row.locator(".audio-library-play")).toHaveCSS("opacity", "1");
  await sidebar.getByRole("heading", { name: "音频库", exact: true }).hover();
  await expect(row.locator(".audio-library-duration")).toHaveCSS(
    "opacity",
    "1",
  );

  expect((await row.boundingBox())!.height).toBe(42);
  expect(
    (await page.locator(".player-main").boundingBox())!.x,
  ).toBeGreaterThanOrEqual(256);
  await row.click();
  await expect(
    page
      .locator(".player-main")
      .getByRole("heading", { name: title!, exact: true }),
  ).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate(
          (audio: HTMLAudioElement) => !audio.paused && audio.currentTime > 0,
        ),
    )
    .toBe(true);
  await expect(row).toHaveCSS("border-top-width", "0px");
  await expect(row).toHaveCSS("box-shadow", "none");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar).toHaveCount(0);
  await page.getByRole("button", { name: "音频库", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 844 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(sidebar).toBeVisible();
  await page.getByRole("button", { name: "界面语言", exact: true }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
});

test("desktop library resizes within half the viewport and scrolls overflowing titles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例", exact: true }).click();
  const sidebar = page.getByRole("complementary", { name: "公共音频库" });
  const handle = sidebar.getByRole("separator");
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, 300);
  await page.mouse.down();
  await page.mouse.move(1100, 300);
  await page.mouse.up();
  await expect(sidebar).toHaveCSS("width", "720px");
  expect(
    (await page.locator(".player-main").boundingBox())!.x,
  ).toBeGreaterThanOrEqual(720);
  await handle.press("Home");
  await expect(sidebar).toHaveCSS("width", "220px");
  const titles = sidebar.locator(".library-title > span");
  await expect
    .poll(() =>
      titles.evaluateAll((nodes) =>
        nodes.some((n) => n.getAnimations().length > 0),
      ),
    )
    .toBe(true);
  const movement = await titles.evaluateAll((nodes) => {
    const node = nodes.find((n) => n.getAnimations().length > 0)!;
    const animation = node.getAnimations()[0];
    animation.pause();
    const duration = Number(animation.effect!.getTiming().duration);
    animation.currentTime = duration - 800;
    const end = getComputedStyle(node).transform;
    animation.currentTime = duration - 200;
    const held = getComputedStyle(node).transform;
    animation.currentTime = duration + 100;
    const restarted = getComputedStyle(node).transform;
    return { end, held, restarted };
  });
  expect(movement.end).toBe(movement.held);
  expect(movement.end).not.toBe(movement.restarted);
  await handle.press("End");
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(sidebar).toHaveCSS("width", "550px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      titles.evaluateAll((nodes) =>
        nodes.every((n) => n.getAnimations().length === 0),
      ),
    )
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handle).toHaveCount(0);
  expect((await page.locator(".player-main").boundingBox())!.x).toBe(0);
});
