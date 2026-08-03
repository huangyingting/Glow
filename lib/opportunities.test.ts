import { describe, expect, it } from "vitest";
import { buildDailyOpportunities } from "./opportunities";
import type { DayForecast, SpaceWeatherResponse } from "./types";
import { CITIES } from "./cities";

const day = {
  date: "2026-08-03",
  sunrise: "2026-08-03T05:20",
  sunset: "2026-08-03T19:20",
  dawn: { time: "2026-08-03T05:20", probability: 72, confidence: 80, summary: "朝霞", metrics: {}, contributions: [], modelScores: [] },
  dusk: { time: "2026-08-03T19:20", probability: 82, confidence: 81, summary: "晚霞", metrics: {}, contributions: [], modelScores: [] },
  fog: { time: "2026-08-03T06:00", probability: 40, confidence: 70, summary: "雾", metrics: {}, contributions: [], modelScores: [] },
  solar: { sunriseAzimuth: 72, sunsetAzimuth: 288, morningBlueStart: "2026-08-02T20:40:00Z", morningGoldenEnd: "2026-08-02T22:00:00Z", eveningGoldenStart: "2026-08-03T10:30:00Z", eveningBlueEnd: "2026-08-03T12:10:00Z", eveningAstronomicalStart: "2026-08-03T12:50:00Z", morningAstronomicalEnd: "2026-08-03T20:10:00Z", astronomicalDarknessMinutes: 440, daylightMinutes: 840 },
  moon: { time: "2026-08-03T22:00", probability: 60, confidence: 70, summary: "月亮", phaseName: "亏凸月", illumination: 70, altitude: 30, azimuth: 110, weather: {}, contributions: [], modelScores: [] },
  night: { time: "2026-08-03T23:00", probability: 75, confidence: 72, summary: "星空", astronomicalDusk: "2026-08-03T12:50:00Z", astronomicalDawn: "2026-08-03T20:10:00Z", darknessMinutes: 440, moon: { illumination: 70 }, weather: {}, contributions: [], modelScores: [] },
  weather: { rainbow: { time: "2026-08-03T18:00", score: 55, confidence: 60, summary: "彩虹", metrics: { solarAltitude: 10 }, modelScores: [], viewingAzimuth: 80 } },
} as unknown as DayForecast;

const spaceWeather: SpaceWeatherResponse = {
  status: "available",
  generatedAt: "2026-08-03T00:00:00Z",
  validUntil: "2026-08-05T00:00:00Z",
  source: { name: "NOAA SWPC", url: "https://example.test" },
  points: [{ time: "2026-08-03T15:00:00Z", kp: 8, status: "predicted", scale: "G4" }],
  message: "test",
};

describe("daily opportunity agenda", () => {
  it("keeps every daily opportunity, including separate dawn and dusk windows", () => {
    const result = buildDailyOpportunities(day, CITIES[0], spaceWeather);
    expect(result.map((item) => item.id)).toEqual(expect.arrayContaining(["dawn-glow", "dusk-glow", "sunrise", "sunset", "fog", "rainbow", "moon", "stars", "aurora"]));
    expect(result).toHaveLength(9);
    expect(result.find((item) => item.id === "sunrise")?.scoreType).toBe("geometry-only");
  });

  it("marks aurora as unavailable instead of turning missing Kp data into zero", () => {
    const result = buildDailyOpportunities(day, CITIES[0], null);
    expect(result.find((item) => item.id === "aurora")).toEqual(expect.objectContaining({ score: null, status: "unavailable" }));
  });
});

