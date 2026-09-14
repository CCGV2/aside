import { test, expect } from "@playwright/test";
test.use({ locale: "en-US" });
test("English samples show attribution, timed transcripts, and playable audio", async ({
  page,
}) => {
  // Nine real audio samples plus each cabinet opening/return transition.
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample", exact: true }).click();
  await expect(page.locator(".source-credit")).toContainText(
    "Electronic Frontier Foundation",
  );
  await expect(
    page.locator(".source-credit").getByRole("link", { name: /Reuse terms/ }),
  ).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  await expect(
    page.getByRole("link", { name: "Download excerpt" }),
  ).toHaveAttribute("download", "eff-oligarchy.mp3");
  await expect(
    page.getByRole("link", { name: "Download transcript" }),
  ).toHaveAttribute("href", "/api/episodes/eff-oligarchy");
  for (const title of [
    "Smashing the Tech Oligarchy",
    "Fighting Enshittification",
    "The Mind-Bending Math Inside Black Holes",
    "Eat Like a Martian",
    "Blender: Open Source Creativity",
    "Large Language Models: What Are They Good For?",
    "Color Outside the Lines",
    "Pin Your Hopes on Something",
    "Curiosity, Questions, and Prying",
  ]) {
    // The CTA already opened the first sample. Reloading that same title would
    // let the assertion match the old heading before the reload completes.
    if (title !== "Smashing the Tech Oligarchy") {
      await page.getByRole("complementary", { name: "Public library" }).getByRole("button", { name: new RegExp(title) }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await expect(
      page.locator(".player-main").getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(await page.locator(".transcript-line").count()).toBeGreaterThan(15);
    if (title === "Smashing the Tech Oligarchy") await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
      )
      .toBeGreaterThan(0.2);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  }
});
