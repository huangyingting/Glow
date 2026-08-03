import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const viewports = [
  { name: "phone-short-320", width: 320, height: 568 },
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-short-1024", width: 1024, height: 600 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "wide-1920", width: 1920, height: 1080 },
] as const;

const auditRoot = path.join(process.cwd(), "test-results", "ui-audit");

async function capture(page: Page, viewport: string, state: string) {
  const directory = path.join(auditRoot, viewport);
  await mkdir(directory, { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.mouse.move(1, 1);
  await page.waitForTimeout(50);
  await page.screenshot({ path: path.join(directory, `${state}.png`), fullPage: true });
}

async function expectHealthyLayout(page: Page) {
  const diagnostics = await page.evaluate(() => {
    const root = document.documentElement;
    const duplicateIds = [...document.querySelectorAll<HTMLElement>("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const unnamedControls = [...document.querySelectorAll<HTMLElement>("button, a, input, summary")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const visible = style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
        const name = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || (element as HTMLInputElement).placeholder;
        return visible && !name?.trim();
      })
      .map((element) => element.outerHTML.slice(0, 160));
    const clippedRegions = [".workspace-header", ".workspace-body", ".map-stage", ".inspector"]
      .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > root.clientWidth + 1;
      })
      .map((element) => ({ className: element.className, rect: element.getBoundingClientRect().toJSON() }));

    return {
      horizontalOverflow: root.scrollWidth - root.clientWidth,
      duplicateIds,
      unnamedControls,
      clippedRegions,
    };
  });

  expect(diagnostics).toEqual({
    horizontalOverflow: expect.any(Number),
    duplicateIds: [],
    unnamedControls: [],
    clippedRegions: [],
  });
  expect(diagnostics.horizontalOverflow).toBeLessThanOrEqual(1);
}

for (const viewport of viewports) {
  test(`complete UI action and screenshot audit at ${viewport.name}`, async ({ page, context }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    let failNextForecast = false;
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/forecast**", async (route) => {
      if (!failNextForecast) return route.continue();
      failNextForecast = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "审计模拟：天气源暂时不可用" }) });
    });
    await page.setViewportSize(viewport);
    await context.grantPermissions(["geolocation"], { origin: "http://127.0.0.1:3000" });
    await context.setGeolocation({ latitude: 30.2741, longitude: 120.1551 });
    await page.goto("/");
    await expect(page.locator("[data-map-ready=true]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
    await expectHealthyLayout(page);
    await capture(page, viewport.name, "01-glow-dusk");

    await page.getByLabel("霁光摄影天气工作台").click();
    await expect(page).toHaveURL(/#workspace$/);

    await page.keyboard.press("Control+K");
    const search = page.getByLabel("搜索中国城市");
    await expect(search).toBeFocused();
    await expect(page.getByRole("listbox", { name: "城市搜索结果" })).toBeVisible();
    await search.press("Escape");
    await expect(page.getByRole("listbox", { name: "城市搜索结果" })).toBeHidden();

    await page.getByRole("tab", { name: /朝霞/ }).click();
    await expect(page.getByRole("tab", { name: /朝霞/ })).toHaveAttribute("aria-selected", "true");
    await capture(page, viewport.name, "02-glow-dawn");
    await page.getByRole("tab", { name: /晚霞/ }).click();
    await expect(page.getByRole("tab", { name: /晚霞/ })).toHaveAttribute("aria-selected", "true");

    await search.click();
    await expect(page.getByRole("listbox", { name: "城市搜索结果" })).toBeVisible();
    await capture(page, viewport.name, "03-search-open");
    await search.fill("没有这个城市");
    await expect(page.getByText("未找到城市")).toBeVisible();
    await capture(page, viewport.name, "04-search-empty");
    await page.getByLabel("清空搜索").click();
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page.locator(".coordinate-hud")).toContainText("北京");
    await search.fill("上海");
    await page.getByRole("option", { name: /上海/ }).click();
    await expect(page.locator(".coordinate-hud")).toContainText("上海");
    await capture(page, viewport.name, "05-search-selection");

    const headerLocationResponse = page.waitForResponse((response) => response.url().includes("/api/forecast?lat=30.27410"));
    await page.getByLabel("定位我的位置").click();
    await headerLocationResponse;
    await expect(page.locator(".coordinate-hud")).toContainText("地图落点", { timeout: 30_000 });
    await capture(page, viewport.name, "06-geolocation");

    await search.click();
    const searchLocationResponse = page.waitForResponse((response) => response.url().includes("/api/forecast?lat=30.27410"));
    await page.getByRole("button", { name: "使用当前定位" }).click();
    await searchLocationResponse;
    await expect(page.locator(".coordinate-hud")).toContainText("地图落点", { timeout: 30_000 });

    failNextForecast = true;
    await search.fill("上海");
    await page.getByRole("option", { name: /上海/ }).click();
    const recoverableError = page.locator(".workspace-toast");
    await expect(recoverableError).toContainText("审计模拟：天气源暂时不可用");
    await capture(page, viewport.name, "07-recoverable-error");
    await page.getByLabel("关闭错误提示").click();
    await expect(recoverableError).toBeHidden();

    const dayTabs = page.getByRole("tablist", { name: "七天摄影窗口" }).getByRole("tab");
    await expect(dayTabs).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await dayTabs.nth(index).click();
      await expect(dayTabs.nth(index)).toHaveAttribute("aria-selected", "true");
    }
    await capture(page, viewport.name, "08-day-seven");

    const modes = ["雾景潜势", "日出 / 日落", "月相 / 月升", "星空 / 夜景", "月食", "日食", "云层分析", "降雨分析", "彩虹潜势"];
    for (const [index, mode] of modes.entries()) {
      await page.getByTitle(mode, { exact: true }).click();
      await expect(page.getByRole("heading", { name: mode, exact: true })).toBeVisible();
      await expectHealthyLayout(page);
      await capture(page, viewport.name, `${String(index + 9).padStart(2, "0")}-${mode.replaceAll(" / ", "-")}`);
    }

    const sources = page.getByText("数据与模型", { exact: true });
    await sources.click();
    await expect(page.getByText("Astronomy Engine", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /中国气象局预警/ })).toBeVisible();
    await capture(page, viewport.name, "18-data-sources-open");
    await sources.click();
    await expect(page.getByText("Astronomy Engine", { exact: true })).toBeHidden();

    await page.getByTitle("朝霞 / 晚霞", { exact: true }).click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(50);
    const coordinatesBeforeMapClick = await page.locator(".coordinate-hud").innerText();
    const map = await page.locator(".weather-map").boundingBox();
    expect(map).not.toBeNull();
    await page.mouse.click(map!.x + map!.width * .38, map!.y + map!.height * .42);
    await expect.poll(() => page.locator(".coordinate-hud").innerText(), { timeout: 30_000 }).not.toBe(coordinatesBeforeMapClick);
    await capture(page, viewport.name, "19-map-click");

    const marker = await page.locator(".map-pin-marker").boundingBox();
    expect(marker).not.toBeNull();
    const previousCoordinates = await page.locator(".coordinate-hud").innerText();
    await page.mouse.move(marker!.x + marker!.width / 2, marker!.y + marker!.height / 2);
    await page.mouse.down();
    await page.mouse.move(marker!.x + marker!.width / 2 + 36, marker!.y + marker!.height / 2 + 18, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => page.locator(".coordinate-hud").innerText(), { timeout: 30_000 }).not.toBe(previousCoordinates);
    await capture(page, viewport.name, "20-marker-drag");

    const canvas = await page.locator(".maplibregl-canvas").boundingBox();
    const markerBeforePan = await page.locator(".map-pin-marker").boundingBox();
    expect(canvas).not.toBeNull();
    expect(markerBeforePan).not.toBeNull();
    await page.mouse.move(canvas!.x + canvas!.width * .75, canvas!.y + canvas!.height * .35);
    await page.mouse.down();
    await page.mouse.move(canvas!.x + canvas!.width * .62, canvas!.y + canvas!.height * .35, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await page.locator(".map-pin-marker").boundingBox())?.x).not.toBe(markerBeforePan!.x);
    await capture(page, viewport.name, "21-map-pan");

    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const zoomOut = page.getByRole("button", { name: "Zoom out" });
    await zoomIn.click();
    await page.waitForTimeout(350);
    await capture(page, viewport.name, "22-map-zoom-in");
    await zoomOut.click();
    await page.waitForTimeout(350);

    const attribution = page.locator(".maplibregl-ctrl-attrib-button");
    if (await attribution.isVisible()) {
      await attribution.click();
      await capture(page, viewport.name, "23-attribution-open");
      await attribution.click();
    }

    await expectHealthyLayout(page);
    const expectedSimulatedErrors = consoleErrors.filter((message) => message.includes("503 (Service Unavailable)"));
    expect(expectedSimulatedErrors).toHaveLength(1);
    expect(consoleErrors.filter((message) => !message.includes("503 (Service Unavailable)"))).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

test("initial error state can reconnect without clipping", async ({ page }) => {
  let firstForecast = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/forecast**", async (route) => {
    if (!firstForecast) return route.continue();
    firstForecast = false;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "审计模拟：首次连接失败" }) });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据暂时不可用" })).toBeVisible();
  await capture(page, "phone-390", "21-initial-error");
  await page.getByRole("button", { name: "重新连接" }).click();
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  await expectHealthyLayout(page);
  await capture(page, "phone-390", "22-reconnected");
});

test("denied geolocation remains recoverable and dismissible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, failure?: PositionErrorCallback) => {
          failure?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  await page.getByLabel("定位我的位置").click();
  const locationError = page.locator(".workspace-toast");
  await expect(locationError).toContainText("无法获取位置，请检查浏览器定位权限");
  await capture(page, "phone-390", "23-geolocation-denied");
  await page.getByLabel("关闭错误提示").click();
  await expect(locationError).toBeHidden();
});
