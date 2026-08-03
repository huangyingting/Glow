import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${state}: ${results.violations.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`all photography scenes meet automated accessibility checks on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "跳到摄影工作区" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#workspace")).toBeFocused();
    await expectAccessible(page, `${viewport.name} glow`);

    for (const scene of ["雾景潜势", "日出 / 日落", "月相 / 月升", "星空 / 夜景", "月食", "日食"]) {
      await page.getByTitle(scene, { exact: true }).click();
      await expect(page.getByRole("heading", { name: scene, exact: true })).toBeVisible();
      await expectAccessible(page, `${viewport.name} ${scene}`);
    }

    await page.getByLabel("搜索中国城市").click();
    await expect(page.getByRole("listbox", { name: "城市搜索结果" })).toBeVisible();
    await expectAccessible(page, `${viewport.name} city search`);
  });
}

test("initial failure state meets automated accessibility checks", async ({ page }) => {
  await page.route("**/api/forecast**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "审计模拟：天气源暂时不可用" }),
  }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据暂时不可用" })).toBeVisible();
  await expectAccessible(page, "initial API failure");
});

test("not-found route is actionable and accessible", async ({ page }) => {
  const response = await page.goto("/missing-photography-route");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回摄影工作区" })).toHaveAttribute("href", "/");
  await expectAccessible(page, "not found");
});
