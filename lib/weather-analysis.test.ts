import { describe, expect, it } from "vitest";
import type { WeatherAnalysisMetrics } from "./types";
import { buildWeatherAnalysis, precipitationAmount, rainbowSignal, rainSignal, type WeatherHourCandidate } from "./weather-analysis";

function metrics(overrides: Partial<WeatherAnalysisMetrics> = {}): WeatherAnalysisMetrics {
  return {
    totalCloud: 45,
    lowCloud: 25,
    midCloud: 35,
    highCloud: 30,
    precipitationProbability: 40,
    precipitation: .6,
    rain: .2,
    showers: .4,
    directRadiation: 180,
    solarAltitude: 14,
    solarAzimuth: 105,
    weatherCode: 80,
    ...overrides,
  };
}

function hour(time: string, first: Partial<WeatherAnalysisMetrics> = {}, second: Partial<WeatherAnalysisMetrics> = {}): WeatherHourCandidate {
  return {
    time,
    models: [
      { model: "ECMWF IFS", metrics: metrics(first) },
      { model: "CMA GRAPES", metrics: metrics(second) },
    ],
  };
}

describe("extensible weather analysis tools", () => {
  it("selects independent peak windows for cloud, rain, and rainbow", () => {
    const result = buildWeatherAnalysis([
      hour("2026-08-03T08:00", { totalCloud: 92, precipitation: 0, precipitationProbability: 5 }, { totalCloud: 84, precipitation: 0, precipitationProbability: null }),
      hour("2026-08-03T16:00", { precipitation: 3, precipitationProbability: 90, directRadiation: 0 }, { precipitation: 2.2, precipitationProbability: null, directRadiation: 0 }),
      hour("2026-08-03T18:00", { precipitation: .8, directRadiation: 230, solarAltitude: 10 }, { precipitation: .6, precipitationProbability: null, directRadiation: 190, solarAltitude: 10 }),
    ], 0);

    expect(result.cloud.time).toBe("2026-08-03T08:00");
    expect(result.rain.time).toBe("2026-08-03T16:00");
    expect(result.rain.summary).toContain("不是统计概率");
    expect(result.rainbow.time).toBe("2026-08-03T18:00");
    expect(result.rainbow.viewingAzimuth).toBe(285);
    expect(result.rainbow.confidence).toBeLessThanOrEqual(70);
  });

  it("uses forecast amount when a model does not publish precipitation probability", () => {
    expect(rainSignal(metrics({ precipitationProbability: null, precipitation: 1.2 }))).toBeGreaterThan(40);
    expect(rainSignal(metrics({ precipitationProbability: null, precipitation: 0 }))).toBe(0);
    expect(precipitationAmount(metrics({ precipitation: null, rain: null, showers: null }))).toBeNull();
  });

  it("requires concurrent daylight and precipitation for rainbow potential", () => {
    expect(rainbowSignal(metrics({ solarAltitude: -2 }))).toBe(0);
    expect(rainbowSignal(metrics({ solarAltitude: 50 }))).toBe(0);
    expect(rainbowSignal(metrics({ precipitation: 0, rain: 0, showers: 0, precipitationProbability: 90 }))).toBe(0);
    expect(rainbowSignal(metrics({ precipitation: 0, rain: 0, showers: 0, precipitationProbability: 0 }))).toBe(0);
    expect(rainbowSignal(metrics())).toBeGreaterThan(20);

    const splitConditions = buildWeatherAnalysis([
      hour(
        "2026-08-03T18:00",
        { precipitation: 1, directRadiation: 0, solarAltitude: 10 },
        { precipitation: 0, rain: 0, showers: 0, precipitationProbability: 0, directRadiation: 240, solarAltitude: 10 },
      ),
    ], 0);
    expect(splitConditions.rainbow.score).toBe(0);
  });
});
