import { afterEach, describe, expect, it, vi } from "vitest";
import { CITIES } from "./cities";
import { getForecast } from "./weather";

const start = new Date("2026-08-03T00:00:00Z");
const hourlyTime = Array.from({ length: 168 }, (_, index) => new Date(start.getTime() + index * 3_600_000).toISOString().slice(0, 16));
const dailyTime = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
const values = (value: number) => hourlyTime.map(() => value);

function forecastFixture(offset = 0) {
  return {
    elevation: 47,
    hourly: {
      time: hourlyTime,
      temperature_2m: values(20 + offset),
      dew_point_2m: values(12),
      cloud_cover_low: values(10 + offset),
      cloud_cover_mid: values(40),
      cloud_cover_high: values(55),
      relative_humidity_2m: values(60),
      visibility: values(30_000),
      precipitation_probability: values(5),
      precipitation: values(0),
      wind_speed_10m: values(9),
      wind_gusts_10m: values(16),
      wind_direction_10m: values(315),
      surface_pressure: values(1002),
    },
    daily: {
      time: dailyTime,
      sunrise: dailyTime.map((date) => `${date}T05:20`),
      sunset: dailyTime.map((date) => `${date}T19:20`),
    },
  };
}

const airFixture = {
  hourly: {
    time: hourlyTime,
    aerosol_optical_depth: values(.2),
    pm2_5: values(18),
  },
};

describe("forecast subsystem degradation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds the complete seven-day contract from deterministic provider data", async () => {
    const response = await getForecast(CITIES[0], {
      now: new Date("2026-08-03T00:00:00Z"),
      fetcher: async (url: URL) => url.hostname.startsWith("air-quality") ? airFixture : forecastFixture(url.searchParams.get("models") === "cma_grapes_global" ? 4 : 0),
    });
    expect(response.generatedAt).toBe("2026-08-03T00:00:00.000Z");
    expect(response.days).toHaveLength(7);
    expect(response.hourly).toHaveLength(168);
    expect(response.days[0].dawn.modelScores).toHaveLength(2);
    expect(response.sources.every((source) => source.status === "available")).toBe(true);
  });

  it("continues with one weather model when its peer and CAMS are unavailable", async () => {
    const response = await getForecast(CITIES[0], {
      now: new Date("2026-08-03T00:00:00Z"),
      fetcher: async (url: URL) => {
        if (url.hostname.startsWith("air-quality") || url.searchParams.get("models") === "ecmwf_ifs025") throw new Error("simulated outage");
        return forecastFixture(3);
      },
    });
    expect(response.days[0].dawn.modelScores).toHaveLength(1);
    expect(response.sources.map((source) => source.status)).toEqual(["unavailable", "available", "unavailable"]);
    expect(response.days).toHaveLength(7);
  });

  it("rejects malformed success payloads instead of crashing later in the model", async () => {
    await expect(getForecast(CITIES[0], {
      now: new Date("2026-08-03T00:00:00Z"),
      fetcher: async () => ({ hourly: { time: [] }, daily: {} }),
    })).rejects.toThrow("当前天气源暂时不可用");
  });

  it("retries each transient provider failure once within the bounded adapter", async () => {
    const attempts = new Map<string, number>();
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = input.toString();
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      if (count === 1) return new Response("temporary", { status: 503 });
      const payload = url.includes("air-quality-api") ? airFixture : forecastFixture();
      return Response.json(payload);
    }));

    const response = await getForecast(CITIES[0], { now: new Date("2026-08-03T00:00:00Z") });
    expect(response.days).toHaveLength(7);
    expect([...attempts.values()]).toEqual([2, 2, 2]);
  });
});
