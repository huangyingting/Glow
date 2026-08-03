export type EventKind = "dawn" | "dusk";

export interface City {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  timezone: string;
  region: "华北" | "东北" | "华东" | "华中" | "华南" | "西南" | "西北";
}

export interface SkyMetrics {
  lowCloud: number | null;
  midCloud: number | null;
  highCloud: number | null;
  humidity: number | null;
  visibility: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  aerosolOpticalDepth: number | null;
  pm25: number | null;
}

export type PhotographyMode = "glow" | "fog" | "sun" | "moon" | "stars" | "lunar-eclipse" | "solar-eclipse";

export interface HourlyWeatherPoint {
  time: string;
  temperature: number | null;
  dewPoint: number | null;
  humidity: number | null;
  lowCloud: number | null;
  midCloud: number | null;
  highCloud: number | null;
  visibility: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  windDirection: number | null;
  pressure: number | null;
  aerosolOpticalDepth: number | null;
}

export interface FogMetrics {
  temperature: number | null;
  dewPoint: number | null;
  humidity: number | null;
  lowCloud: number | null;
  visibility: number | null;
  windSpeed: number | null;
  precipitation: number | null;
}

export interface FogForecast {
  time: string;
  probability: number;
  confidence: number;
  level: "很高" | "较高" | "一般" | "较低";
  summary: string;
  metrics: FogMetrics;
  contributions: ScoreResult["contributions"];
  modelScores: { model: string; probability: number }[];
}

export interface SolarWindow {
  morningBlueStart: string | null;
  sunriseAzimuth: number | null;
  morningGoldenEnd: string | null;
  eveningGoldenStart: string | null;
  sunsetAzimuth: number | null;
  eveningBlueEnd: string | null;
  eveningAstronomicalStart: string | null;
  morningAstronomicalEnd: string | null;
  astronomicalDarknessMinutes: number;
  daylightMinutes: number;
}

export interface EclipseForecast {
  kind: "penumbral" | "partial" | "annular" | "total";
  peak: string;
  begin: string;
  end: string;
  obscuration: number;
  altitude: number;
  azimuth: number;
  visible: boolean;
}

export interface MoonGeometry {
  calculatedAt: string;
  phaseAngle: number;
  phaseName: string;
  illumination: number;
  altitude: number;
  azimuth: number;
  rise: string | null;
  set: string | null;
}

export interface AstronomySummary {
  nextLunarEclipse: EclipseForecast;
  nextSolarEclipse: EclipseForecast;
}

export interface NightWeatherMetrics {
  temperature: number | null;
  dewPoint: number | null;
  humidity: number | null;
  lowCloud: number | null;
  midCloud: number | null;
  highCloud: number | null;
  visibility: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  windDirection: number | null;
}

export interface MoonForecast extends MoonGeometry {
  time: string;
  probability: number;
  confidence: number;
  level: "极佳" | "值得期待" | "可以等等" | "机会较低";
  summary: string;
  weather: NightWeatherMetrics;
  contributions: ScoreResult["contributions"];
  modelScores: { model: string; probability: number }[];
}

export interface NightForecast {
  time: string;
  astronomicalDusk: string | null;
  astronomicalDawn: string | null;
  darknessMinutes: number;
  sunAltitude: number;
  probability: number;
  confidence: number;
  level: "极佳" | "值得期待" | "可以等等" | "机会较低";
  summary: string;
  moon: MoonGeometry;
  weather: NightWeatherMetrics;
  contributions: ScoreResult["contributions"];
  modelScores: { model: string; probability: number }[];
}

export interface ScoreResult {
  probability: number;
  rawScore: number;
  completeness: number;
  contributions: {
    name: string;
    value: number;
    direction: "positive" | "negative" | "neutral";
    detail: string;
  }[];
}

export interface EventForecast {
  kind: EventKind;
  time: string;
  probability: number;
  confidence: number;
  level: "极佳" | "值得期待" | "可以等等" | "机会较低";
  summary: string;
  metrics: SkyMetrics;
  contributions: ScoreResult["contributions"];
  modelScores: { model: string; probability: number }[];
}

export interface DayForecast {
  date: string;
  weekday: string;
  shortDate: string;
  sunrise: string;
  sunset: string;
  dawn: EventForecast;
  dusk: EventForecast;
  fog: FogForecast;
  solar: SolarWindow;
  moon: MoonForecast;
  night: NightForecast;
}

export interface ForecastResponse {
  location: City & { elevation: number | null };
  generatedAt: string;
  recommendedIndex: number;
  days: DayForecast[];
  hourly: HourlyWeatherPoint[];
  astronomy: AstronomySummary;
  sources: {
    id: string;
    name: string;
    role: string;
    status: "available" | "unavailable";
  }[];
  disclaimer: string;
}
