import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSpaceWeatherMock, unavailableMock } = vi.hoisted(() => ({
  getSpaceWeatherMock: vi.fn(),
  unavailableMock: vi.fn(() => ({ status: "unavailable", points: [] })),
}));

vi.mock("@/lib/space-weather", () => ({
  getSpaceWeather: getSpaceWeatherMock,
  unavailableSpaceWeather: unavailableMock,
}));

import { GET } from "./route";

describe("space weather API boundary", () => {
  beforeEach(() => {
    getSpaceWeatherMock.mockReset();
    unavailableMock.mockClear();
  });

  it("caches a valid NOAA response independently from ordinary weather", async () => {
    getSpaceWeatherMock.mockResolvedValue({ status: "available", points: [{ kp: 4 }] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=900");
    await expect(response.json()).resolves.toEqual({ status: "available", points: [{ kp: 4 }] });
  });

  it("returns an explicit unavailable contract instead of failing the page", async () => {
    const logging = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getSpaceWeatherMock.mockRejectedValue(new Error("simulated outage"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=120");
    await expect(response.json()).resolves.toEqual({ status: "unavailable", points: [] });
    expect(unavailableMock).toHaveBeenCalledOnce();
    logging.mockRestore();
  });
});

