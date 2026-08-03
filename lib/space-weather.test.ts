import { describe, expect, it } from "vitest";
import { getSpaceWeather, parseKpForecast } from "./space-weather";

const fixture = [
  ["time_tag", "Kp", "observed", "noaa_scale"],
  ["2026-08-03 00:00:00", "3.33", "observed", null],
  ["2026-08-03 03:00:00", "6.00", "predicted", "G2"],
];

describe("space weather adapter", () => {
  it("parses NOAA's tabular Kp contract without inventing missing rows", () => {
    expect(parseKpForecast(fixture)).toEqual([
      expect.objectContaining({ kp: 3.33, status: "observed" }),
      expect.objectContaining({ kp: 6, status: "predicted", scale: "G2" }),
    ]);
    expect(parseKpForecast({ invalid: true })).toEqual([]);
    expect(parseKpForecast([{ time_tag: "2026-08-03T06:00:00", kp: 4.33, observed: "predicted", noaa_scale: null }])).toEqual([
      expect.objectContaining({ kp: 4.33, status: "predicted" }),
    ]);
  });

  it("keeps source validity separate from local aurora visibility", async () => {
    const result = await getSpaceWeather({
      now: new Date("2026-08-03T00:00:00Z"),
      fetcher: async () => fixture,
    });
    expect(result.status).toBe("available");
    expect(result.validUntil).toBe("2026-08-03T03:00:00.000Z");
    expect(result.points).toHaveLength(2);
  });
});
