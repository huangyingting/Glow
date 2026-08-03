import { expect, test } from "@playwright/test";

test("production responses use nonce CSP and reject untrusted inline scripts", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  const headers = response!.headers();
  const policy = headers["content-security-policy"];
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");

  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const serverHtml = await response!.text();
  const serverScriptNonces = [...serverHtml.matchAll(/<script\b([^>]*)>/g)].map((match) => match[1].match(/\bnonce="([^"]+)"/)?.[1]);
  expect(serverScriptNonces.length).toBeGreaterThan(0);
  expect(new Set(serverScriptNonces)).toEqual(new Set([nonce]));

  await expect(page.getByRole("heading", { name: "朝霞 / 晚霞" })).toBeVisible();
  const scriptNonces = await page.locator("script[nonce]").evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(new Set(scriptNonces)).toEqual(new Set([nonce]));

  const secondResponse = await page.request.get("/");
  const secondNonce = secondResponse.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
  expect(secondNonce).toBeTruthy();
  expect(secondNonce).not.toBe(nonce);

  const violation = await page.evaluate(() => new Promise<string>((resolve) => {
    document.addEventListener("securitypolicyviolation", (event) => resolve(event.violatedDirective), { once: true });
    const button = document.createElement("button");
    button.setAttribute("onclick", "window.__untrustedInlineExecuted = true");
    document.body.append(button);
    button.click();
    window.setTimeout(() => resolve("missing"), 1000);
  }));
  expect(violation).toContain("script-src");
  expect(await page.evaluate(() => (window as Window & { __untrustedInlineExecuted?: boolean }).__untrustedInlineExecuted ?? false)).toBe(false);
});

test("API validation failures are non-cacheable and sanitized", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect(await health.json()).toEqual(expect.objectContaining({ status: "ok", service: "jiguang-sky-forecast" }));

  const unknown = await request.get("/api/forecast?city=not-a-city");
  expect(unknown.status()).toBe(400);
  expect(unknown.headers()["cache-control"]).toBe("no-store");
  expect(await unknown.json()).toEqual({ error: "城市参数无效，请从支持的城市列表中选择" });

  const outside = await request.get("/api/forecast?lat=37.5665&lon=126.978");
  expect(outside.status()).toBe(400);
  expect(outside.headers()["cache-control"]).toBe("no-store");
  expect(await outside.text()).not.toContain("stack");
});
