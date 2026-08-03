import { averageMetrics, confidenceFromScores, probabilityLevel, scoreGlow } from "@/lib/glow-model";
import { getAstronomy, getSolarWindow } from "@/lib/astronomy";
import { fogLevel, fogSummary, scoreFog } from "@/lib/photography-models";
import type { City, DayForecast, EventForecast, EventKind, FogForecast, FogMetrics, ForecastResponse, HourlyWeatherPoint, SkyMetrics } from "@/lib/types";

interface OpenMeteoForecast {
  elevation?: number;
  hourly: Record<string, (string | number | null)[]> & { time: string[] };
  daily: { time: string[]; sunrise: string[]; sunset: string[] };
}

interface OpenMeteoAir {
  hourly: Record<string, (string | number | null)[]> & { time: string[] };
}

interface ModelConfig {
  id: string;
  name: string;
  role: string;
}

const MODELS: ModelConfig[] = [
  { id: "ecmwf_ifs025", name: "ECMWF IFS", role: "全球中期预报基准，负责大尺度云系" },
  { id: "cma_grapes_global", name: "CMA GRAPES", role: "中国气象局模式，补充中国区域判断" },
];

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const HOURLY_FIELDS = [
  "temperature_2m",
  "dew_point_2m",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "relative_humidity_2m",
  "visibility",
  "precipitation_probability",
  "precipitation",
  "wind_speed_10m",
  "wind_direction_10m",
  "surface_pressure",
].join(",");

function asNumber(value: string | number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function circularAverage(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  const x = valid.reduce((sum, value) => sum + Math.cos(value * Math.PI / 180), 0);
  const y = valid.reduce((sum, value) => sum + Math.sin(value * Math.PI / 180), 0);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function indicesNear(times: string[], target: string, kind: EventKind) {
  const targetTime = new Date(target).getTime();
  const start = kind === "dawn" ? -75 : -60;
  const end = kind === "dawn" ? 60 : 90;
  const matched = times
    .map((time, index) => ({ index, minutes: (new Date(time).getTime() - targetTime) / 60000 }))
    .filter(({ minutes }) => minutes >= start && minutes <= end)
    .map(({ index }) => index);

  if (matched.length) return matched;
  let closest = 0;
  times.forEach((time, index) => {
    if (Math.abs(new Date(time).getTime() - targetTime) < Math.abs(new Date(times[closest]).getTime() - targetTime)) closest = index;
  });
  return [closest];
}

function valuesAt(data: Record<string, (string | number | null)[]>, key: string, indices: number[]) {
  return indices.map((index) => asNumber(data[key]?.[index]));
}

function airMetricsAt(air: OpenMeteoAir | null, target: string, kind: EventKind) {
  if (!air) return { aerosolOpticalDepth: null, pm25: null };
  const indices = indicesNear(air.hourly.time, target, kind);
  return {
    aerosolOpticalDepth: average(valuesAt(air.hourly, "aerosol_optical_depth", indices)),
    pm25: average(valuesAt(air.hourly, "pm2_5", indices)),
  };
}

function metricsAt(model: OpenMeteoForecast, air: OpenMeteoAir | null, target: string, kind: EventKind): SkyMetrics {
  const indices = indicesNear(model.hourly.time, target, kind);
  const airMetrics = airMetricsAt(air, target, kind);
  return {
    lowCloud: average(valuesAt(model.hourly, "cloud_cover_low", indices)),
    midCloud: average(valuesAt(model.hourly, "cloud_cover_mid", indices)),
    highCloud: average(valuesAt(model.hourly, "cloud_cover_high", indices)),
    humidity: average(valuesAt(model.hourly, "relative_humidity_2m", indices)),
    visibility: average(valuesAt(model.hourly, "visibility", indices)),
    precipitationProbability: average(valuesAt(model.hourly, "precipitation_probability", indices)),
    precipitation: average(valuesAt(model.hourly, "precipitation", indices)),
    ...airMetrics,
  };
}

function fogMetricsAt(model: OpenMeteoForecast, time: string): FogMetrics {
  const index = model.hourly.time.indexOf(time);
  return {
    temperature: asNumber(model.hourly.temperature_2m?.[index]),
    dewPoint: asNumber(model.hourly.dew_point_2m?.[index]),
    humidity: asNumber(model.hourly.relative_humidity_2m?.[index]),
    lowCloud: asNumber(model.hourly.cloud_cover_low?.[index]),
    visibility: asNumber(model.hourly.visibility?.[index]),
    windSpeed: asNumber(model.hourly.wind_speed_10m?.[index]),
    precipitation: asNumber(model.hourly.precipitation?.[index]),
  };
}

function averageFogMetrics(items: FogMetrics[]): FogMetrics {
  const value = (key: keyof FogMetrics) => average(items.map((item) => item[key]));
  return {
    temperature: value("temperature"),
    dewPoint: value("dewPoint"),
    humidity: value("humidity"),
    lowCloud: value("lowCloud"),
    visibility: value("visibility"),
    windSpeed: value("windSpeed"),
    precipitation: value("precipitation"),
  };
}

function buildFogForecast(date: string, leadDays: number, available: { config: ModelConfig; data: OpenMeteoForecast }[]): FogForecast {
  const times = available[0].data.hourly.time.filter((time) => time.startsWith(date));
  const candidates = times.map((time) => {
    const byModel = available.map(({ config, data }) => {
      const metrics = fogMetricsAt(data, time);
      return { config, metrics, score: scoreFog(metrics) };
    });
    const metrics = averageFogMetrics(byModel.map((item) => item.metrics));
    const combined = scoreFog(metrics);
    const probability = Math.round(byModel.reduce((sum, item) => sum + item.score.probability, 0) / byModel.length);
    return { time, byModel, metrics, combined, probability };
  });
  const best = candidates.reduce((current, item) => item.probability > current.probability ? item : current, candidates[0]);
  return {
    time: best.time,
    probability: best.probability,
    confidence: confidenceFromScores(best.byModel.map((item) => item.score), leadDays),
    level: fogLevel(best.probability),
    summary: fogSummary(best.probability, best.metrics),
    metrics: best.metrics,
    contributions: best.combined.contributions,
    modelScores: best.byModel.map(({ config, score }) => ({ model: config.name, probability: score.probability })),
  };
}

function buildHourly(available: { config: ModelConfig; data: OpenMeteoForecast }[], air: OpenMeteoAir | null): HourlyWeatherPoint[] {
  const reference = available[0].data;
  return reference.hourly.time.map((time) => {
    const indices = available.map(({ data }) => data.hourly.time.indexOf(time));
    const modelValues = (key: string) => available.map(({ data }, modelIndex) => asNumber(data.hourly[key]?.[indices[modelIndex]]));
    const airIndex = air?.hourly.time.indexOf(time) ?? -1;
    return {
      time,
      temperature: average(modelValues("temperature_2m")),
      dewPoint: average(modelValues("dew_point_2m")),
      humidity: average(modelValues("relative_humidity_2m")),
      lowCloud: average(modelValues("cloud_cover_low")),
      midCloud: average(modelValues("cloud_cover_mid")),
      highCloud: average(modelValues("cloud_cover_high")),
      visibility: average(modelValues("visibility")),
      precipitationProbability: average(modelValues("precipitation_probability")),
      precipitation: average(modelValues("precipitation")),
      windSpeed: average(modelValues("wind_speed_10m")),
      windDirection: circularAverage(modelValues("wind_direction_10m")),
      pressure: average(modelValues("surface_pressure")),
      aerosolOpticalDepth: airIndex >= 0 ? asNumber(air?.hourly.aerosol_optical_depth?.[airIndex]) : null,
    };
  });
}

function eventSummary(kind: EventKind, probability: number, metrics: SkyMetrics) {
  const label = kind === "dawn" ? "朝霞" : "晚霞";
  if ((metrics.lowCloud ?? 0) > 70) return `低云可能遮住地平线，${label}展开空间有限`;
  if ((metrics.precipitationProbability ?? 0) > 60) return `降水信号偏强，建议临近时再看一次更新`;
  if (probability >= 76) return `高空有可染色云层，地平线也留出了光路`;
  if (probability >= 58) return `云层结构不错，值得在日出日前后留意天空`;
  if (probability >= 38) return `仍有变化窗口，模式更新后可能上调`;
  return `关键条件暂不配合，适合把期待留给下一天`;
}

function buildEvent(
  kind: EventKind,
  time: string,
  leadDays: number,
  available: { config: ModelConfig; data: OpenMeteoForecast }[],
  air: OpenMeteoAir | null,
): EventForecast {
  const byModel = available.map(({ config, data }) => {
    const metrics = metricsAt(data, air, time, kind);
    return { config, metrics, score: scoreGlow(metrics, kind) };
  });
  const metrics = averageMetrics(byModel.map(({ metrics: value }) => value));
  const combined = scoreGlow(metrics, kind);
  const probability = Math.round(byModel.reduce((sum, item) => sum + item.score.probability, 0) / byModel.length);

  return {
    kind,
    time,
    probability,
    confidence: confidenceFromScores(byModel.map(({ score }) => score), leadDays),
    level: probabilityLevel(probability),
    summary: eventSummary(kind, probability, metrics),
    metrics,
    contributions: combined.contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    modelScores: byModel.map(({ config, score }) => ({ model: config.name, probability: score.probability })),
  };
}

function formatDay(date: string) {
  const value = new Date(`${date}T12:00:00+08:00`);
  return {
    weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "Asia/Shanghai" }).format(value),
    shortDate: new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" }).format(value),
  };
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Jiguang-Sky-Forecast/0.1" },
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchModel(city: City, model: ModelConfig) {
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: city.latitude.toString(),
    longitude: city.longitude.toString(),
    hourly: HOURLY_FIELDS,
    daily: "sunrise,sunset",
    timezone: city.timezone,
    forecast_days: "7",
    models: model.id,
  }).toString();
  return fetchJson<OpenMeteoForecast>(url);
}

async function fetchAir(city: City) {
  const url = new URL(AIR_URL);
  url.search = new URLSearchParams({
    latitude: city.latitude.toString(),
    longitude: city.longitude.toString(),
    hourly: "aerosol_optical_depth,pm2_5",
    timezone: city.timezone,
    forecast_days: "7",
  }).toString();
  return fetchJson<OpenMeteoAir>(url);
}

function recommendedDayIndex(days: DayForecast[]) {
  const nowInChina = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const index = days.findIndex((day) => day.sunset >= nowInChina);
  return index < 0 ? 0 : index;
}

export async function getForecast(city: City): Promise<ForecastResponse> {
  const [modelResults, airResult] = await Promise.all([
    Promise.allSettled(MODELS.map(async (config) => ({ config, data: await fetchModel(city, config) }))),
    fetchAir(city).catch(() => null),
  ]);
  const available = modelResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!available.length) throw new Error("当前天气源暂时不可用，请稍后再试");

  const reference = available[0].data;
  const days = reference.daily.time.map((date, index): DayForecast => {
    const sunrise = reference.daily.sunrise[index];
    const sunset = reference.daily.sunset[index];
    const formatted = formatDay(date);
    return {
      date,
      ...formatted,
      sunrise,
      sunset,
      dawn: buildEvent("dawn", sunrise, index, available, airResult),
      dusk: buildEvent("dusk", sunset, index, available, airResult),
      fog: buildFogForecast(date, index, available),
      solar: getSolarWindow(city, sunrise, sunset),
    };
  });

  return {
    location: { ...city, elevation: reference.elevation ?? null },
    generatedAt: new Date().toISOString(),
    recommendedIndex: recommendedDayIndex(days),
    days,
    hourly: buildHourly(available, airResult),
    astronomy: getAstronomy(city),
    sources: [
      ...MODELS.map((model, index) => ({
        id: model.id,
        name: model.name,
        role: model.role,
        status: modelResults[index].status === "fulfilled" ? "available" as const : "unavailable" as const,
      })),
      {
        id: "cams_global",
        name: "CAMS 全球大气成分",
        role: "气溶胶光学厚度与 PM₂.₅，用于评估散射和霾",
        status: airResult ? "available" as const : "unavailable" as const,
      },
    ],
    disclaimer: "结果是基于数值预报的机会指数，并非气象部门发布的确定性预报；山体遮挡、局地云和临近日出日落的快速变化仍可能改变实况。",
  };
}
