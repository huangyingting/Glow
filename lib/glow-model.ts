import type { EventKind, ScoreResult, SkyMetrics } from "@/lib/types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function bell(value: number, ideal: number, width: number) {
  return Math.exp(-0.5 * ((value - ideal) / width) ** 2);
}

export interface GlowContext {
  solarAltitude: number;
}

function illuminationFactor(solarAltitude: number) {
  if (solarAltitude <= -6 || solarAltitude >= 9) return 0.55;
  if (solarAltitude < -4) return 0.55 + (solarAltitude + 6) * 0.125;
  if (solarAltitude < -1) return 0.8 + (solarAltitude + 4) * (0.2 / 3);
  if (solarAltitude <= 2.5) return 1;
  return 1 - (solarAltitude - 2.5) * (0.45 / 6.5);
}

function present(values: (number | null)[]) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

export function averageMetrics(items: SkyMetrics[]): SkyMetrics {
  const average = (key: keyof SkyMetrics) => {
    const values = present(items.map((item) => item[key]));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  return {
    lowCloud: average("lowCloud"),
    midCloud: average("midCloud"),
    highCloud: average("highCloud"),
    humidity: average("humidity"),
    visibility: average("visibility"),
    precipitationProbability: average("precipitationProbability"),
    precipitation: average("precipitation"),
    aerosolOpticalDepth: average("aerosolOpticalDepth"),
    pm25: average("pm25"),
  };
}

export function scoreGlow(metrics: SkyMetrics, kind: EventKind, context?: GlowContext): ScoreResult {
  let rawScore = 34;
  let knownWeight = 0;
  const totalWeight = 100;
  const contributions: ScoreResult["contributions"] = [];
  const add = (name: string, value: number, detail: string) => {
    rawScore += value;
    contributions.push({
      name,
      value: Math.round(value),
      direction: value > 2 ? "positive" : value < -2 ? "negative" : "neutral",
      detail,
    });
  };

  if (metrics.midCloud !== null || metrics.highCloud !== null) {
    const mid = metrics.midCloud ?? metrics.highCloud ?? 0;
    const high = metrics.highCloud ?? metrics.midCloud ?? 0;
    const texture = bell(mid, 52, 28) * 13 + bell(high, 52, 32) * 15;
    add("染色云层", texture - 7, `${Math.round(mid)}% 中云 · ${Math.round(high)}% 高云`);
    knownWeight += 30;
  }

  if (metrics.lowCloud !== null) {
    const penalty = metrics.lowCloud <= 18 ? 8 : metrics.lowCloud <= 42 ? 4 - (metrics.lowCloud - 18) * 0.35 : -4 - (metrics.lowCloud - 42) * 0.52;
    add("近地低云遮挡", clamp(penalty, -28, 8), `${Math.round(metrics.lowCloud)}% 低云；单点数据不能证明远处光路畅通`);
    knownWeight += 24;
  }

  if (metrics.precipitationProbability !== null || metrics.precipitation !== null) {
    const probability = metrics.precipitationProbability ?? clamp((metrics.precipitation ?? 0) * 34);
    const amount = metrics.precipitation ?? 0;
    const penalty = -(probability * 0.22 + Math.min(amount * 7, 12));
    add("降水干扰", clamp(penalty, -26, 0), `${Math.round(probability)}% 降水可能`);
    knownWeight += 18;
  }

  if (metrics.visibility !== null) {
    const kilometres = metrics.visibility / 1000;
    const value = clamp((kilometres - 7) * 0.72, -9, 8);
    add("空气通透", value, `${kilometres.toFixed(0)} km 能见度`);
    knownWeight += 10;
  }

  if (metrics.humidity !== null) {
    const value = metrics.humidity <= 82 ? 0 : -(metrics.humidity - 82) * 0.55;
    add("近地湿度", clamp(value, -10, 0), `${Math.round(metrics.humidity)}% 相对湿度；仅用于识别雾霾与低层遮挡风险`);
    knownWeight += 8;
  }

  if (metrics.aerosolOpticalDepth !== null || metrics.pm25 !== null) {
    const aod = metrics.aerosolOpticalDepth;
    const pm25 = metrics.pm25;
    let value = 0;
    if (aod !== null) value += aod < 0.08 ? -1 : aod <= 0.35 ? 2 : aod <= 0.7 ? 0 : -Math.min((aod - 0.7) * 18, 12);
    if (pm25 !== null && pm25 > 75) value -= Math.min((pm25 - 75) * 0.11, 9);
    add("气溶胶背景", clamp(value, -15, 2), `${aod === null ? "—" : aod.toFixed(2)} AOD · PM₂.₅ ${pm25 === null ? "—" : Math.round(pm25)}；粗分辨率背景修正`);
    knownWeight += 10;
  }

  const completeness = Math.round((knownWeight / totalWeight) * 100);
  const uncertaintyPull = (100 - completeness) * 0.13;
  const weatherScore = clamp(rawScore + (50 - rawScore) * (uncertaintyPull / 100), 4, 96);
  const illumination = context ? illuminationFactor(context.solarAltitude) : 1;
  const probability = Math.round(clamp(4 + (weatherScore - 4) * illumination, 4, 96));
  if (context) {
    const value = probability - Math.round(weatherScore);
    contributions.push({
      name: "暮光时段匹配",
      value,
      direction: value < -2 ? "negative" : "neutral",
      detail: `${kind === "dawn" ? "日出前后" : "日落前后"}太阳高度 ${context.solarAltitude.toFixed(1)}°；这是经验时段先验，不代表目标云一定仍被直射`,
    });
  }

  return { probability, rawScore: Math.round(rawScore), completeness, contributions };
}

export function probabilityLevel(probability: number): "极佳" | "值得期待" | "可以等等" | "机会较低" {
  if (probability >= 76) return "极佳";
  if (probability >= 58) return "值得期待";
  if (probability >= 38) return "可以等等";
  return "机会较低";
}

export function confidenceFromScores(scores: ScoreResult[], leadDays: number) {
  if (!scores.length) return 20;
  const average = scores.reduce((sum, score) => sum + score.probability, 0) / scores.length;
  const disagreement = scores.reduce((sum, score) => sum + Math.abs(score.probability - average), 0) / scores.length;
  const completeness = scores.reduce((sum, score) => sum + score.completeness, 0) / scores.length;
  const multiModel = scores.length > 1 ? 12 : -8;
  return Math.round(clamp(58 + multiModel + completeness * 0.22 - disagreement * 1.25 - leadDays * 4, 24, 94));
}
