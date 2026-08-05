import { describe, expect, it } from "vitest";
import { getMeteorShowers } from "./meteor-showers";
import { CITIES } from "./cities";

// Reference values from the IMO 2026 visual meteor shower working list
// (radiant RA converted from degrees to hours). Locks the catalog against drift.
const IMO_REFERENCE: Record<string, { zhr: number; ra: number; dec: number; month: number; day: number }> = {
  象限仪座流星雨: { zhr: 80, ra: 15.33, dec: 49, month: 1, day: 3 },
  天琴座流星雨: { zhr: 18, ra: 18.07, dec: 34, month: 4, day: 22 },
  "宝瓶座 η 流星雨": { zhr: 50, ra: 22.53, dec: -1, month: 5, day: 6 },
  英仙座流星雨: { zhr: 100, ra: 3.2, dec: 58, month: 8, day: 13 },
  猎户座流星雨: { zhr: 20, ra: 6.33, dec: 16, month: 10, day: 21 },
  狮子座流星雨: { zhr: 15, ra: 10.13, dec: 22, month: 11, day: 17 },
  双子座流星雨: { zhr: 150, ra: 7.47, dec: 33, month: 12, day: 14 },
};

describe("meteor shower catalog vs IMO reference", () => {
  it("matches IMO reference ZHR and peak dates for every major shower", () => {
    const beijing = CITIES[0];
    // Reach every shower across a two-year window.
    const events = getMeteorShowers(beijing, new Date("2025-12-25T00:00:00Z"))
      .concat(getMeteorShowers(beijing, new Date("2026-06-01T00:00:00Z")));
    for (const [name, ref] of Object.entries(IMO_REFERENCE)) {
      const event = events.find((item) => item.name === name);
      expect(event, `missing shower ${name}`).toBeTruthy();
      expect(event!.zenithalHourlyRate, `${name} ZHR`).toBe(ref.zhr);
      const peak = new Date(event!.peak);
      const month = Number(new Intl.DateTimeFormat("en", { month: "numeric", timeZone: "Asia/Shanghai" }).format(peak));
      const day = Number(new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "Asia/Shanghai" }).format(peak));
      expect(month, `${name} peak month`).toBe(ref.month);
      expect(day, `${name} peak day`).toBe(ref.day);
    }
  });
});
