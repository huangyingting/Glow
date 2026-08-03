import { describe, expect, it } from "vitest";
import { getAstronomy, getMoonGeometry, getSolarAltitude, getSolarWindow } from "./astronomy";
import { CITIES } from "./cities";

describe("location-aware astronomy", () => {
  const beijing = CITIES[0];
  const at = new Date("2026-08-03T00:00:00Z");

  it("calculates the moon and next locally visible eclipses", () => {
    const result = getAstronomy(beijing, at);
    expect(new Date(result.nextSolarEclipse.peak).getTime()).toBeGreaterThan(at.getTime());
    expect(result.nextSolarEclipse.visible).toBe(true);
    expect(result.nextSolarEclipse.azimuth).toBeGreaterThanOrEqual(0);
    expect(result.nextLunarEclipse.visible).toBe(true);
  });

  it("calculates moon geometry for the selected forecast night", () => {
    const first = getMoonGeometry(beijing, new Date("2026-08-03T14:00:00Z"), "2026-08-03");
    const later = getMoonGeometry(beijing, new Date("2026-08-08T14:00:00Z"), "2026-08-08");
    expect(first.calculatedAt).not.toBe(later.calculatedAt);
    expect(first.illumination).not.toBe(later.illumination);
    expect(first.rise?.startsWith("2026-08-03")).toBe(true);
    expect(later.rise?.startsWith("2026-08-08")).toBe(true);
  });

  it("derives blue and golden-hour crossings for the selected day", () => {
    const window = getSolarWindow(beijing, "2026-08-03T05:14", "2026-08-03T19:26");
    expect(window.daylightMinutes).toBe(852);
    expect(window.morningBlueStart).not.toBeNull();
    expect(window.eveningBlueEnd).not.toBeNull();
    expect(window.eveningAstronomicalStart).not.toBeNull();
    expect(window.morningAstronomicalEnd).not.toBeNull();
    expect(window.astronomicalDarknessMinutes).toBeGreaterThan(200);
    expect(window.sunriseAzimuth).toBeGreaterThan(0);
    expect(window.sunsetAzimuth).toBeGreaterThan(180);
    expect(getSolarAltitude(beijing, new Date(window.eveningAstronomicalStart!))).toBeCloseTo(-18, 1);
  });
});
