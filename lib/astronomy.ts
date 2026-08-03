import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  NextLocalSolarEclipse,
  NextLunarEclipse,
  Observer,
  SearchAltitude,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  SearchRiseSet,
} from "astronomy-engine";
import type { AstronomySummary, City, EclipseForecast, MoonGeometry, SolarWindow } from "@/lib/types";
import { getMeteorShowers } from "@/lib/meteor-showers";

function localDateStart(date: Date, dateKey?: string) {
  const china = dateKey ?? new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${china}T00:00:00+08:00`);
}

function horizontal(body: Body, date: Date, observer: Observer, applyRefraction = true) {
  const equatorial = Equator(body, date, observer, true, true);
  return Horizon(date, observer, equatorial.ra, equatorial.dec, applyRefraction ? "normal" : undefined);
}

function phaseName(angle: number) {
  if (angle < 22.5 || angle >= 337.5) return "新月";
  if (angle < 67.5) return "娥眉月";
  if (angle < 112.5) return "上弦月";
  if (angle < 157.5) return "盈凸月";
  if (angle < 202.5) return "满月";
  if (angle < 247.5) return "亏凸月";
  if (angle < 292.5) return "下弦月";
  return "残月";
}

function visibleLunarEclipse(start: Date, observer: Observer): EclipseForecast {
  let eclipse = SearchLunarEclipse(start);
  let position = horizontal(Body.Moon, eclipse.peak.date, observer);
  for (let index = 0; index < 12 && position.altitude <= 0; index += 1) {
    eclipse = NextLunarEclipse(eclipse.peak);
    position = horizontal(Body.Moon, eclipse.peak.date, observer);
  }
  const halfDuration = eclipse.sd_penum || eclipse.sd_partial || eclipse.sd_total;
  return {
    kind: eclipse.kind,
    peak: eclipse.peak.date.toISOString(),
    begin: new Date(eclipse.peak.date.getTime() - halfDuration * 60000).toISOString(),
    end: new Date(eclipse.peak.date.getTime() + halfDuration * 60000).toISOString(),
    obscuration: eclipse.obscuration,
    altitude: position.altitude,
    azimuth: position.azimuth,
    visible: position.altitude > 0,
  };
}

function visibleSolarEclipse(start: Date, observer: Observer): EclipseForecast {
  let eclipse = SearchLocalSolarEclipse(start, observer);
  for (let index = 0; index < 12 && eclipse.peak.altitude <= 0; index += 1) {
    eclipse = NextLocalSolarEclipse(eclipse.peak.time, observer);
  }
  const position = horizontal(Body.Sun, eclipse.peak.time.date, observer);
  return {
    kind: eclipse.kind,
    peak: eclipse.peak.time.date.toISOString(),
    begin: eclipse.partial_begin.time.date.toISOString(),
    end: eclipse.partial_end.time.date.toISOString(),
    obscuration: eclipse.obscuration,
    altitude: eclipse.peak.altitude,
    azimuth: position.azimuth,
    visible: eclipse.peak.altitude > 0,
  };
}

export function getMoonGeometry(city: City, at: Date, dateKey?: string): MoonGeometry {
  const observer = new Observer(city.latitude, city.longitude, 0);
  const moonPosition = horizontal(Body.Moon, at, observer);
  const phaseAngle = MoonPhase(at);
  const illumination = Illumination(Body.Moon, at).phase_fraction;
  const start = localDateStart(at, dateKey);
  const moonrise = SearchRiseSet(Body.Moon, observer, 1, start, 1.25);
  const moonset = SearchRiseSet(Body.Moon, observer, -1, start, 1.25);
  return {
    calculatedAt: at.toISOString(),
    phaseAngle,
    phaseName: phaseName(phaseAngle),
    illumination: Math.round(illumination * 100),
    altitude: moonPosition.altitude,
    azimuth: moonPosition.azimuth,
    rise: moonrise?.date.toISOString() ?? null,
    set: moonset?.date.toISOString() ?? null,
  };
}

export function getMoonPosition(city: City, at: Date) {
  const observer = new Observer(city.latitude, city.longitude, 0);
  const position = horizontal(Body.Moon, at, observer);
  return {
    altitude: position.altitude,
    azimuth: position.azimuth,
    illumination: Math.round(Illumination(Body.Moon, at).phase_fraction * 100),
  };
}

export function getAstronomy(city: City, at = new Date()): AstronomySummary {
  const observer = new Observer(city.latitude, city.longitude, 0);
  return {
    nextLunarEclipse: visibleLunarEclipse(at, observer),
    nextSolarEclipse: visibleSolarEclipse(at, observer),
    meteorShowers: getMeteorShowers(city, at),
  };
}

function crossing(body: Body, observer: Observer, direction: 1 | -1, start: Date, altitude: number) {
  return SearchAltitude(body, observer, direction, start, 1, altitude)?.date.toISOString() ?? null;
}

function azimuthAt(date: Date, observer: Observer) {
  return horizontal(Body.Sun, date, observer).azimuth;
}

export function getSolarAltitude(city: City, at: Date) {
  return getSolarPosition(city, at).altitude;
}

export function getSolarPosition(city: City, at: Date) {
  const position = horizontal(Body.Sun, at, new Observer(city.latitude, city.longitude, 0), false);
  return { altitude: position.altitude, azimuth: position.azimuth };
}

export function getSolarWindow(city: City, sunrise: string, sunset: string): SolarWindow {
  const observer = new Observer(city.latitude, city.longitude, 0);
  const date = sunrise.slice(0, 10);
  const start = new Date(`${date}T00:00:00+08:00`);
  const noon = new Date(`${date}T12:00:00+08:00`);
  const sunriseDate = new Date(`${sunrise}:00+08:00`);
  const sunsetDate = new Date(`${sunset}:00+08:00`);
  const eveningAstronomicalStart = crossing(Body.Sun, observer, -1, noon, -18);
  const morningAstronomicalEnd = crossing(Body.Sun, observer, 1, sunsetDate, -18);
  const astronomicalDarknessMinutes = eveningAstronomicalStart && morningAstronomicalEnd
    ? Math.max(0, Math.round((new Date(morningAstronomicalEnd).getTime() - new Date(eveningAstronomicalStart).getTime()) / 60000))
    : 0;
  return {
    morningBlueStart: crossing(Body.Sun, observer, 1, start, -6),
    sunriseAzimuth: azimuthAt(sunriseDate, observer),
    morningGoldenEnd: crossing(Body.Sun, observer, 1, start, 6),
    eveningGoldenStart: crossing(Body.Sun, observer, -1, noon, 6),
    sunsetAzimuth: azimuthAt(sunsetDate, observer),
    eveningBlueEnd: crossing(Body.Sun, observer, -1, noon, -6),
    eveningAstronomicalStart,
    morningAstronomicalEnd,
    astronomicalDarknessMinutes,
    daylightMinutes: Math.round((sunsetDate.getTime() - sunriseDate.getTime()) / 60000),
  };
}
