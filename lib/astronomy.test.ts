import { describe, expect, it } from "vitest";
import { getAstronomy, getSolarWindow } from "./astronomy";
import { CITIES } from "./cities";

describe("location-aware astronomy", () => {
  const beijing = CITIES[0];
  const at = new Date("2026-08-03T00:00:00Z");

  it("calculates the moon and next locally visible eclipses", () => {
    const result = getAstronomy(beijing, at);
    expect(result.moon.illumination).toBeGreaterThanOrEqual(0);
    expect(result.moon.illumination).toBeLessThanOrEqual(100);
    expect(new Date(result.nextSolarEclipse.peak).getTime()).toBeGreaterThan(at.getTime());
    expect(result.nextSolarEclipse.visible).toBe(true);
    expect(result.nextLunarEclipse.visible).toBe(true);
  });

  it("derives blue and golden-hour crossings for the selected day", () => {
    const window = getSolarWindow(beijing, "2026-08-03T05:14", "2026-08-03T19:26");
    expect(window.daylightMinutes).toBe(852);
    expect(window.morningBlueStart).not.toBeNull();
    expect(window.eveningBlueEnd).not.toBeNull();
    expect(window.sunriseAzimuth).toBeGreaterThan(0);
    expect(window.sunsetAzimuth).toBeGreaterThan(180);
  });
});
