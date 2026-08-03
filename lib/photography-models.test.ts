import { describe, expect, it } from "vitest";
import { scoreFog, scoreMoon, scoreNightscape } from "./photography-models";
import type { NightWeatherMetrics } from "./types";

const clearNight: NightWeatherMetrics = {
  temperature: 9,
  dewPoint: 5,
  humidity: 58,
  lowCloud: 4,
  midCloud: 6,
  highCloud: 8,
  visibility: 30000,
  precipitationProbability: 2,
  precipitation: 0,
  windSpeed: 7,
  windGusts: 12,
  windDirection: 315,
};

describe("fog photography scoring", () => {
  it("rewards a small dew-point spread with humid, gentle flow", () => {
    const result = scoreFog({ temperature: 11, dewPoint: 10.2, humidity: 97, lowCloud: 82, visibility: 2500, windSpeed: 9, precipitation: 0 });
    expect(result.probability).toBeGreaterThan(70);
  });

  it("penalises dry and windy conditions", () => {
    const result = scoreFog({ temperature: 25, dewPoint: 9, humidity: 36, lowCloud: 4, visibility: 30000, windSpeed: 42, precipitation: 0 });
    expect(result.probability).toBeLessThan(25);
  });

  it("reduces certainty when core variables are missing", () => {
    const result = scoreFog({ temperature: null, dewPoint: null, humidity: null, lowCloud: null, visibility: null, windSpeed: null, precipitation: null });
    expect(result.completeness).toBe(0);
    expect(result.probability).toBeLessThan(45);
  });
});

describe("night photography scoring", () => {
  it("rewards a clear, dry, dark and moonless night", () => {
    expect(scoreNightscape(clearNight, { sunAltitude: -24, moonAltitude: -12, moonIllumination: 8 }).probability).toBeGreaterThan(70);
  });

  it("penalises twilight, bright moonlight, cloud and tripod-level gusts", () => {
    const poor = scoreNightscape({ ...clearNight, lowCloud: 85, midCloud: 90, highCloud: 95, humidity: 96, windGusts: 55 }, {
      sunAltitude: -9,
      moonAltitude: 48,
      moonIllumination: 98,
    });
    expect(poor.probability).toBeLessThan(20);
  });

  it("scores moon photography from selected-hour visibility and field weather", () => {
    const visible = scoreMoon(clearNight, { altitude: 18, illumination: 72 });
    const hidden = scoreMoon({ ...clearNight, lowCloud: 94, precipitationProbability: 80 }, { altitude: -12, illumination: 72 });
    expect(visible.probability).toBeGreaterThan(65);
    expect(hidden.probability).toBeLessThan(20);
  });
});
