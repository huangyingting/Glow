import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getForecastMock } = vi.hoisted(() => ({ getForecastMock: vi.fn() }));

vi.mock("@/lib/weather", () => ({ getForecast: getForecastMock }));

import { GET } from "./route";

function request(query = "", headers?: HeadersInit) {
  return new NextRequest(`http://localhost/api/forecast${query}`, { headers });
}

describe("forecast API boundary", () => {
  beforeEach(() => {
    getForecastMock.mockReset();
    getForecastMock.mockResolvedValue({ location: { name: "北京" }, days: [] });
  });

  it("rejects unknown cities instead of silently returning Beijing", async () => {
    const response = await GET(request("?city=not-a-city"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "城市参数无效，请从支持的城市列表中选择" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getForecastMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete, malformed, and unsupported coordinates", async () => {
    for (const query of ["?lat=30", "?lat=x&lon=120", "?lat=37.5665&lon=126.978"]) {
      const response = await GET(request(query));
      expect(response.status, query).toBe(400);
    }
    expect(getForecastMock).not.toHaveBeenCalled();
  });

  it("uses public caching for catalog cities and private caching for exact coordinates", async () => {
    const city = await GET(request("?city=beijing"));
    expect(city.status).toBe(200);
    expect(city.headers.get("cache-control")).toContain("public");

    const coordinate = await GET(request("?lat=31.23&lon=121.47&name=测试落点"));
    expect(coordinate.status).toBe(200);
    expect(coordinate.headers.get("cache-control")).toContain("private");
    expect(getForecastMock).toHaveBeenLastCalledWith(expect.objectContaining({ name: "测试落点" }));
  });

  it("does not expose upstream error details", async () => {
    const logging = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getForecastMock.mockRejectedValueOnce(new Error("provider-secret-detail"));
    const response = await GET(request("?city=beijing"));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"天气数据暂时不可用，请稍后再试"}');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(logging).toHaveBeenCalledOnce();
    logging.mockRestore();
  });

  it("bounds exact-coordinate recalculation bursts without affecting catalog cities", async () => {
    let response: Response | null = null;
    for (let index = 0; index <= 90; index += 1) {
      response = await GET(request("?lat=31.23&lon=121.47", { "x-forwarded-for": "203.0.113.77" }));
    }
    expect(response?.status).toBe(429);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(getForecastMock).toHaveBeenCalledTimes(90);

    const catalog = await GET(request("?city=beijing", { "x-forwarded-for": "203.0.113.77" }));
    expect(catalog.status).toBe(200);
  });
});
