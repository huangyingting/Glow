import { describe, expect, it } from "vitest";
import { confidenceFromScores, scoreGlow } from "./glow-model";
import type { SkyMetrics } from "./types";

const ideal: SkyMetrics = {
  lowCloud: 8,
  midCloud: 52,
  highCloud: 54,
  humidity: 58,
  visibility: 30000,
  precipitationProbability: 4,
  precipitation: 0,
  aerosolOpticalDepth: 0.22,
  pm25: 18,
};

describe("glow scoring model", () => {
  it("rewards textured upper cloud and a clear horizon", () => {
    expect(scoreGlow(ideal, "dusk").probability).toBeGreaterThan(65);
  });

  it("strongly penalises a blocked, rainy horizon", () => {
    const blocked = scoreGlow({
      ...ideal,
      lowCloud: 94,
      precipitationProbability: 88,
      precipitation: 2.4,
      humidity: 96,
      visibility: 3000,
    }, "dawn");
    expect(blocked.probability).toBeLessThan(25);
  });

  it("uses solar altitude as a bounded twilight timing prior", () => {
    const illuminated = scoreGlow(ideal, "dusk", { solarAltitude: -1 });
    const earthShadow = scoreGlow(ideal, "dusk", { solarAltitude: -7 });
    const broadDaylight = scoreGlow(ideal, "dusk", { solarAltitude: 10 });
    expect(illuminated.probability).toBeGreaterThan(65);
    expect(earthShadow.probability).toBeGreaterThan(35);
    expect(earthShadow.probability).toBeLessThan(illuminated.probability);
    expect(broadDaylight.probability).toBeLessThan(illuminated.probability);
    expect(illuminated.contributions.some((item) => item.name === "暮光时段匹配")).toBe(true);
    expect(earthShadow.contributions.find((item) => item.name === "暮光时段匹配")?.value).toBeLessThan(-20);
  });

  it("does not reward low surface humidity as a direct cause of vivid glow", () => {
    const dry = scoreGlow({ ...ideal, humidity: 30 }, "dawn");
    expect(dry.contributions.find((item) => item.name === "近地湿度")?.value).toBe(0);
  });

  it("does not treat missing observations as perfect conditions", () => {
    const missing = scoreGlow({
      lowCloud: null,
      midCloud: null,
      highCloud: null,
      humidity: null,
      visibility: null,
      precipitationProbability: null,
      precipitation: null,
      aerosolOpticalDepth: null,
      pm25: null,
    }, "dusk");
    expect(missing.completeness).toBe(0);
    expect(missing.probability).toBeLessThan(50);
  });

  it("reduces confidence when models disagree and lead time grows", () => {
    const high = scoreGlow(ideal, "dusk");
    const low = scoreGlow({ ...ideal, lowCloud: 100, precipitationProbability: 100 }, "dusk");
    expect(confidenceFromScores([high, low], 5)).toBeLessThan(confidenceFromScores([high, high], 0));
  });
});
