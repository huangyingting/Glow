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
}

export interface ForecastResponse {
  location: City & { elevation: number | null };
  generatedAt: string;
  recommendedIndex: number;
  days: DayForecast[];
  sources: {
    id: string;
    name: string;
    role: string;
    status: "available" | "unavailable";
  }[];
  disclaimer: string;
}
