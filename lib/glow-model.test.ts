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
