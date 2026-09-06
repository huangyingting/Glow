import type { WeatherAnalysisForecast, WeatherAnalysisMetrics, WeatherAnalysisSet } from "@/lib/types";

export interface WeatherModelHour {
  model: string;
  metrics: WeatherAnalysisMetrics;
}

export interface WeatherHourCandidate {
  time: string;
  models: WeatherModelHour[];
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function average(values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

function averageMetrics(models: WeatherModelHour[]): WeatherAnalysisMetrics {
  const value = (key: keyof Omit<WeatherAnalysisMetrics, "solarAltitude" | "solarAzimuth" | "weatherCode">) => average(models.map((model) => model.metrics[key]));
  return {
    totalCloud: value("totalCloud"),
    lowCloud: value("lowCloud"),
    midCloud: value("midCloud"),
    highCloud: value("highCloud"),
    precipitationProbability: value("precipitationProbability"),
    precipitation: value("precipitation"),
    rain: value("rain"),
    showers: value("showers"),
    directRadiation: value("directRadiation"),
    solarAltitude: models[0]?.metrics.solarAltitude ?? -90,
    solarAzimuth: models[0]?.metrics.solarAzimuth ?? 0,
    weatherCode: models.find((model) => model.metrics.weatherCode !== null)?.metrics.weatherCode ?? null,
  };
}

function cloudScore(metrics: WeatherAnalysisMetrics) {
  const cloud = metrics.totalCloud ?? average([metrics.lowCloud, metrics.midCloud, metrics.highCloud]);
  return cloud === null ? null : Math.round(clamp(cloud));
}

export function precipitationAmount(metrics: WeatherAnalysisMetrics) {
  if (metrics.precipitation !== null) return metrics.precipitation;
  if (metrics.rain === null && metrics.showers === null) return null;
  return (metrics.rain ?? 0) + (metrics.showers ?? 0);
}

export function rainSignal(metrics: WeatherAnalysisMetrics) {
  const amount = precipitationAmount(metrics);
  if (amount === null && metrics.precipitationProbability === null) return null;
  const amountSignal = amount === null || amount <= 0 ? 0 : clamp(20 + Math.log1p(amount * 4) * 28);
  if (metrics.precipitationProbability === null) return Math.round(amountSignal);
  if (amountSignal === 0) return Math.round(clamp(metrics.precipitationProbability * .65));
  return Math.round(clamp(metrics.precipitationProbability * .52 + amountSignal * .48));
}

export function rainbowSignal(metrics: WeatherAnalysisMetrics) {
  if (metrics.solarAltitude <= 0 || metrics.solarAltitude >= 42.5) return 0;
  const amount = precipitationAmount(metrics);
  if (amount === null) return null;
  if (amount <= 0) return 0;
  if (metrics.directRadiation === null) return null;
  const rain = rainSignal(metrics);
  if (rain === null) return null;
  const sunlight = clamp((metrics.directRadiation ?? 0) / 2.5);
  if (rain < 5 || sunlight < 4) return 0;
  const altitude = clamp(100 - Math.abs(metrics.solarAltitude - 14) * 2.8);
  const opening = clamp(105 - (metrics.totalCloud ?? 55));
  const coexistence = Math.sqrt(rain * sunlight);
  return Math.round(clamp(coexistence * (.62 + altitude * .0038) * (.82 + opening * .0018)));
}

function confidence(scores: number[], leadDays: number, cap = 92) {
  const spread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 28;
  const singleModelPenalty = scores.length > 1 ? 0 : 12;
  return Math.round(clamp(90 - spread * .48 - leadDays * 5 - singleModelPenalty, 24, cap));
}

function strongest(
  candidates: WeatherHourCandidate[],
  scorer: (metrics: WeatherAnalysisMetrics) => number | null,
) {
  const scored = candidates.map((candidate) => {
    const metrics = averageMetrics(candidate.models);
    const modelScores = candidate.models.map((model) => ({ model: model.model, score: scorer(model.metrics) }));
    const availableScores = modelScores.flatMap((model) => model.score === null ? [] : [model.score]);
    const meanScore = average(availableScores);
    return {
      time: candidate.time,
      metrics,
      score: meanScore === null ? null : Math.round(meanScore),
      modelScores,
    };
  });
  return scored.reduce((best, candidate) => (candidate.score ?? -1) > (best.score ?? -1) ? candidate : best, scored[0]);
}

function cloudForecast(candidates: WeatherHourCandidate[], leadDays: number): WeatherAnalysisForecast {
  const best = strongest(candidates, cloudScore);
  const score = best.score;
  const layers = [
    ["低云", best.metrics.lowCloud],
    ["中云", best.metrics.midCloud],
    ["高云", best.metrics.highCloud],
  ].filter((layer): layer is [string, number] => layer[1] !== null);
  const dominant = layers.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "分层云";
  const level = score === null ? "云量数据不可用" : score >= 85 ? "密集云层" : score >= 60 ? "多云" : score >= 30 ? "局部云层" : "少云";
  const numericScores = best.modelScores.flatMap((model) => model.score === null ? [] : [model.score]);
  return {
    ...best,
    confidence: score === null ? 0 : confidence(numericScores, leadDays),
    level,
    summary: score === null
      ? "当前小时缺少可用云量字段，不把缺失值解释为晴空。"
      : `${level}，${dominant}信号最明显；逐小时剖面可用于比较云底遮挡与高云纹理。`,
    viewingAzimuth: null,
  };
}

function rainForecast(candidates: WeatherHourCandidate[], leadDays: number): WeatherAnalysisForecast {
  const best = strongest(candidates, rainSignal);
  const score = best.score;
  const amount = precipitationAmount(best.metrics);
  const showerDominant = (best.metrics.showers ?? 0) > (best.metrics.rain ?? 0);
  const level = score === null ? "降水数据不可用" : score >= 76 ? "强降水信号" : score >= 52 ? "明显降水信号" : score >= 25 ? "局地降水可能" : "降水信号弱";
  const numericScores = best.modelScores.flatMap((model) => model.score === null ? [] : [model.score]);
  return {
    ...best,
    confidence: score === null ? 0 : confidence(numericScores, leadDays),
    level,
    summary: score === null
      ? "当前小时同时缺少降水概率和降水量，不把缺失值解释为无雨。"
      : `${level}；以${showerDominant ? "阵雨" : "连续性降雨"}为主，小时总降水约 ${amount?.toFixed(1) ?? "—"} mm/h。数值是综合信号，不是统计概率。`,
    viewingAzimuth: null,
  };
}

function rainbowForecast(candidates: WeatherHourCandidate[], leadDays: number): WeatherAnalysisForecast {
  const best = strongest(candidates, rainbowSignal);
  const score = best.score;
  const viewingAzimuth = score !== null && score > 0 ? (best.metrics.solarAzimuth + 180) % 360 : null;
  const level = score === null ? "彩虹数据不足" : score >= 70 ? "较强彩虹潜势" : score >= 45 ? "存在彩虹窗口" : score >= 20 ? "微弱彩虹窗口" : "暂无明确窗口";
  const numericScores = best.modelScores.flatMap((model) => model.score === null ? [] : [model.score]);
  return {
    ...best,
    confidence: score === null ? 0 : confidence(numericScores, leadDays, 70),
    level,
    summary: score === null
      ? "当前小时缺少降水量或直射辐射，无法可靠判断阳光与雨幕是否共存。"
      : score > 0
      ? `${level}：阳光与降水信号在同一网格小时共存，面向太阳反方向观察。`
      : `${level}：当前没有同时满足低角度阳光和降水信号的小时。`,
    viewingAzimuth,
  };
}

export function buildWeatherAnalysis(candidates: WeatherHourCandidate[], leadDays: number): WeatherAnalysisSet {
  if (!candidates.length || !candidates[0].models.length) throw new Error("Weather analysis requires hourly model data");
  return {
    cloud: cloudForecast(candidates, leadDays),
    rain: rainForecast(candidates, leadDays),
    rainbow: rainbowForecast(candidates, leadDays),
  };
}
