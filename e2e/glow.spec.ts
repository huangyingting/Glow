import { expect, test } from "@playwright/test";

test("API returns the professional weather and local astronomy payload", async ({ request }) => {
  const response = await request.get("/api/forecast?city=beijing");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.location.name).toBe("北京");
  expect(payload.days).toHaveLength(7);
  expect(payload.hourly).toHaveLength(168);
  expect(payload.days[0].fog.modelScores.length).toBeGreaterThanOrEqual(1);
  expect(payload.days[0].solar.sunriseAzimuth).toBeGreaterThan(0);
  expect(payload.days[0].moon.illumination).toBeGreaterThanOrEqual(0);
  expect(payload.days[0].moon.calculatedAt).not.toBe(payload.days[6].moon.calculatedAt);
  expect(payload.days.every((day: { moon: { altitude: number; summary: string } }) => day.moon.altitude > 0 || day.moon.summary.includes("暂无数据"))).toBeTruthy();
  expect(payload.days[0].night.modelScores).toHaveLength(2);
  expect(payload.days[0].solar.astronomicalDarknessMinutes).toBeGreaterThanOrEqual(0);
  expect(payload.days[0].weather.cloud.score).toBeGreaterThanOrEqual(0);
  expect(payload.days[0].weather.rain.score).toBeGreaterThanOrEqual(0);
  expect(payload.days[0].weather.rainbow.score).toBeGreaterThanOrEqual(0);
  expect(payload.hourly[0].windGusts).not.toBeNull();
  expect(payload.hourly[0]).toEqual(expect.objectContaining({ totalCloud: expect.any(Number), solarAltitude: expect.any(Number), solarAzimuth: expect.any(Number) }));
  expect(payload.astronomy.nextLunarEclipse.visible).toBe(true);
  expect(payload.astronomy.nextSolarEclipse.visible).toBe(true);
  expect(payload.sources.map((source: { id: string }) => source.id)).toEqual(["ecmwf_ifs025", "cma_grapes_global", "cams_global"]);
  expect(payload.sources.slice(0, 2).some((source: { status: string }) => source.status === "available")).toBeTruthy();
  expect(payload.provenance).toEqual(expect.objectContaining({ delivery: "Open-Meteo", license: "CC BY 4.0", warningAuthority: false }));

  expect((await request.get("/api/forecast?lat=1&lon=1")).status()).toBe(400);
  expect((await request.get("/api/forecast?lat=37.5665&lon=126.978")).status()).toBe(400);
  expect((await request.get("/api/forecast?city=not-a-city")).status()).toBe(400);
  const coordinate = await request.get("/api/forecast?lat=31.23&lon=121.47&name=测试落点");
  expect(coordinate.ok()).toBeTruthy();
  expect(coordinate.headers()["cache-control"]).toContain("private");
});

test("cloud, rain, and rainbow tools reuse one location and date context without navigation", async ({ page }) => {
  let forecastRequests = 0;
  page.on("request", (request) => { if (request.url().includes("/api/forecast")) forecastRequests += 1; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  const baselineRequests = forecastRequests;
  const dateTabs = page.getByRole("tablist", { name: "七天摄影窗口" }).getByRole("tab");
  await dateTabs.nth(3).click();

  await page.getByTitle("云层分析", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "云层分析" })).toBeVisible();
  await expect(page.getByText("当日峰值总云量", { exact: true })).toBeVisible();
  await expect(dateTabs.nth(3)).toHaveAttribute("aria-selected", "true");

  await page.getByTitle("降雨分析", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "降雨分析" })).toBeVisible();
  await expect(page.getByText("降水信号不是降雨概率", { exact: true })).toBeVisible();

  await page.getByTitle("彩虹潜势", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "彩虹潜势" })).toBeVisible();
  await expect(page.getByText("这是物理条件潜势，不是“此处必见彩虹”", { exact: true })).toBeVisible();
  expect(forecastRequests).toBe(baselineRequests);
  await expect(page).toHaveURL(/\/$/);
});

test("refresh, degraded source health, and rejected map picks stay truthful", async ({ page }) => {
  await page.route("**/api/forecast?city=beijing", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources[0].status = "unavailable";
    await route.fulfill({ response, json: body });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  await expect(page.getByRole("status", { name: "2/3 个天气数据源在线" })).toBeVisible();

  const refreshed = page.waitForResponse((response) => response.url().includes("/api/forecast?city=beijing") && response.request().resourceType() === "fetch");
  await page.getByRole("button", { name: "刷新当前预测" }).click();
  await refreshed;
  await expect(page.getByRole("button", { name: "刷新当前预测" })).toBeEnabled();

  const markerBefore = await page.locator(".map-pin-marker").boundingBox();
  const map = await page.locator(".weather-map").boundingBox();
  expect(markerBefore).not.toBeNull();
  expect(map).not.toBeNull();
  const rejected = page.waitForResponse((response) => response.url().includes("/api/forecast?lat=") && response.status() === 400);
  await page.mouse.click(map!.x + map!.width * .96, map!.y + map!.height * .5);
  await rejected;
  await expect(page.locator(".workspace-toast")).toContainText("中国天气区域");
  await expect(page.locator(".coordinate-hud")).toContainText("北京");
  await expect.poll(async () => (await page.locator(".map-pin-marker").boundingBox())?.x).toBeCloseTo(markerBefore!.x, 0);
});

test("map click moves the observation point and recalculates all workspace tools", async ({ page }) => {
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
    ["云层分析", "当日峰值总云量"],
    ["降雨分析", "降水信号不是降雨概率"],
    ["彩虹潜势", "这是物理条件潜势"],
  ];
  for (const [title, evidence] of modes) {
    await page.getByTitle(title, { exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText(evidence, { exact: false }).first()).toBeVisible();
  }
  await page.getByTitle("日食", { exact: true }).click();
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
  await expect(page.getByLabel("摄影与天气工具")).toBeVisible();
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  await expect(page.locator(".map-stage")).toHaveCSS("height", "500px");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByTitle("雾景潜势", { exact: true }).click();
  await expect(page.getByText("最佳雾景窗口")).toBeVisible();
  await page.getByTitle("日食", { exact: true }).click();
  await expect(page.getByText("严禁用肉眼", { exact: false })).toBeVisible();
});
