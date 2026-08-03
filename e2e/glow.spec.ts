import { expect, test } from "@playwright/test";

test("API returns the professional weather and local astronomy payload", async ({ request }) => {
  const response = await request.get("/api/forecast?city=beijing");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.location.name).toBe("北京");
  expect(payload.days).toHaveLength(7);
  expect(payload.hourly).toHaveLength(168);
  expect(payload.days[0].fog.modelScores).toHaveLength(2);
  expect(payload.days[0].solar.sunriseAzimuth).toBeGreaterThan(0);
  expect(payload.days[0].moon.illumination).toBeGreaterThanOrEqual(0);
  expect(payload.days[0].moon.calculatedAt).not.toBe(payload.days[6].moon.calculatedAt);
  expect(payload.days.every((day: { moon: { altitude: number; summary: string } }) => day.moon.altitude > 0 || day.moon.summary.includes("暂无数据"))).toBeTruthy();
  expect(payload.days[0].night.modelScores).toHaveLength(2);
  expect(payload.days[0].solar.astronomicalDarknessMinutes).toBeGreaterThanOrEqual(0);
  expect(payload.hourly[0].windGusts).not.toBeNull();
  expect(payload.astronomy.nextLunarEclipse.visible).toBe(true);
  expect(payload.astronomy.nextSolarEclipse.visible).toBe(true);
  expect(payload.sources.every((source: { status: string }) => source.status === "available")).toBeTruthy();

  expect((await request.get("/api/forecast?lat=1&lon=1")).status()).toBe(400);
  const coordinate = await request.get("/api/forecast?lat=31.23&lon=121.47&name=测试落点");
  expect(coordinate.ok()).toBeTruthy();
  expect(coordinate.headers()["cache-control"]).toContain("private");
});

test("map click moves the observation point and recalculates all photography modes", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("[data-map-ready=true]")).toBeVisible();
  await expect(page.locator(".map-pin-marker")).toBeVisible();
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);

  const map = await page.locator(".weather-map").boundingBox();
  expect(map).not.toBeNull();
  await page.mouse.click(map!.x + map!.width * .32, map!.y + map!.height * .45);
  await expect(page.locator(".coordinate-hud")).toContainText("地图落点", { timeout: 30_000 });
  await expect(page.locator(".weather-map")).not.toHaveClass(/map-moving/, { timeout: 10_000 });
  const beforeDrag = await page.locator(".coordinate-hud").innerText();
  const marker = await page.locator(".map-pin-marker").boundingBox();
  expect(marker).not.toBeNull();
  await page.mouse.move(marker!.x + marker!.width / 2, marker!.y + marker!.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker!.x + marker!.width / 2 + 60, marker!.y + marker!.height / 2 + 25, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => page.locator(".coordinate-hud").innerText(), { timeout: 30_000 }).not.toBe(beforeDrag);

  const modes = [
    ["雾景潜势", "最佳雾景窗口"],
    ["日出 / 日落", "晨间金色时段"],
    ["月相 / 月升", "BEST MOON WINDOW"],
    ["星空 / 夜景", "当晚最佳星空窗口"],
    ["月食", "NEXT LOCALLY VISIBLE EVENT"],
    ["日食", "严禁用肉眼"],
  ];
  for (const [title, evidence] of modes) {
    await page.getByTitle(title, { exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText(evidence, { exact: false }).first()).toBeVisible();
  }
  await expect(page.getByLabel("下一次本地可见食象")).toContainText("尚无可信天气预报");
  await expect(page.getByRole("tablist", { name: "七天摄影窗口" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("city search, glow switch, date timeline and professional charts remain direct", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  await expect(page.getByText("云层垂直剖面")).toBeVisible();
  await expect(page.getByLabel("选定日期逐小时云层、温度、露点和降水图")).toBeVisible();
  await expect(page.getByLabel("拍摄时刻现场简报")).toContainText("持续风 / 阵风");

  await page.getByLabel("搜索中国城市").fill("上海");
  await page.getByRole("option", { name: /上海/ }).click();
  await expect(page.locator(".coordinate-hud")).toContainText("上海");
  await page.getByRole("tab", { name: /朝霞/ }).click();
  await expect(page.getByRole("tab", { name: /朝霞/ })).toHaveAttribute("aria-selected", "true");

  const dayTabs = page.getByRole("tablist", { name: "七天摄影窗口" }).getByRole("tab");
  await dayTabs.nth(3).click();
  await expect(dayTabs.nth(3)).toHaveAttribute("aria-selected", "true");

  await page.getByTitle("月相 / 月升", { exact: true }).click();
  const selectedMoon = await page.locator(".moon-readout").innerText();
  await dayTabs.nth(5).click();
  await expect.poll(() => page.locator(".moon-readout").innerText()).not.toBe(selectedMoon);
  await page.getByTitle("星空 / 夜景", { exact: true }).click();
  await expect(page.getByText("天文暮光结束")).toBeVisible();
});

test("mobile keeps the map-first workflow usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-map-ready=true]")).toBeVisible();
  await expect(page.getByLabel("摄影场景")).toBeVisible();
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  await expect(page.locator(".map-stage")).toHaveCSS("height", "470px");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByTitle("雾景潜势", { exact: true }).click();
  await expect(page.getByText("最佳雾景窗口")).toBeVisible();
  await page.getByTitle("日食", { exact: true }).click();
  await expect(page.getByText("严禁用肉眼", { exact: false })).toBeVisible();
});
