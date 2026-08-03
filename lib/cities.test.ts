import { describe, expect, it } from "vitest";
import { CITIES, findCity, isWithinChina, nearestCity } from "./cities";

describe("supported observation area", () => {
  it("includes every selectable city", () => {
    for (const city of CITIES) expect(isWithinChina(city.latitude, city.longitude), city.name).toBe(true);
  });

  it("rejects obvious points in neighbouring countries that passed the old rectangle", () => {
    expect(isWithinChina(37.5665, 126.978)).toBe(false); // Seoul
    expect(isWithinChina(35.6762, 139.6503)).toBe(false); // Tokyo
    expect(isWithinChina(47.8864, 106.9057)).toBe(false); // Ulaanbaatar
    expect(isWithinChina(21.0278, 105.8342)).toBe(false); // Hanoi
  });

  it("does not silently replace an unknown city with Beijing", () => {
    expect(findCity("not-a-city")).toBeNull();
    expect(findCity(null)?.id).toBe("beijing");
    expect(nearestCity(31.23, 121.47).id).toBe("shanghai");
  });
});
