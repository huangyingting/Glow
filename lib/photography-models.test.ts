import { describe, expect, it } from "vitest";
import { scoreFog } from "./photography-models";

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
