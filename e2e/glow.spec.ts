import { expect, test } from "@playwright/test";

test("forecast API returns two sky events and rejects out-of-scope coordinates", async ({ request }) => {
  const response = await request.get("/api/forecast?city=beijing");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.location.name).toBe("北京");
  expect(payload.days).toHaveLength(7);
  expect(payload.days[0].dawn.probability).toBeGreaterThanOrEqual(0);
  expect(payload.days[0].dusk.modelScores).toHaveLength(2);
  expect(payload.sources).toHaveLength(3);
  expect(payload.sources.every((source: { status: string }) => source.status === "available")).toBeTruthy();

  const outside = await request.get("/api/forecast?lat=1&lon=1");
  expect(outside.status()).toBe(400);

  const coordinate = await request.get("/api/forecast?lat=31.23&lon=121.47&name=定位点");
  expect(coordinate.ok()).toBeTruthy();
  expect(coordinate.headers()["cache-control"]).toContain("private");
});

test("desktop user can change city, date and map location without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "北京的霞光窗口" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "朝霞" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "晚霞" })).toBeVisible();
  await expect(page.getByLabel("未来七天朝霞和晚霞概率折线图")).toBeVisible();

  await page.getByRole("button", { name: "当前观测地 北京" }).click();
  await page.getByLabel("搜索中国城市").fill("上海");
  await page.getByRole("option", { name: /上海/ }).click();
  await expect(page.getByRole("heading", { name: "上海的霞光窗口" })).toBeVisible();

  const tabs = page.getByRole("tab");
  await tabs.nth(3).click();
  await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "查看成都" }).click();
  await expect(page.getByRole("heading", { name: "成都的霞光窗口" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile layout stays within the viewport and preserves primary controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "北京的霞光窗口" })).toBeVisible();
  await expect(page.getByRole("link", { name: /查看七天机会/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开导航" })).toBeVisible();
  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(page.getByRole("link", { name: "数据方法" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const cards = page.locator(".event-card");
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(358);
  }
});
