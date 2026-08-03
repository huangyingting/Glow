import type { FogMetrics, ScoreResult } from "@/lib/types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function scoreFog(metrics: FogMetrics): ScoreResult {
  let score = 18;
  let known = 0;
  const contributions: ScoreResult["contributions"] = [];
  const add = (name: string, value: number, detail: string, weight: number) => {
    score += value;
    known += weight;
    contributions.push({
      name,
      value: Math.round(value),
      direction: value > 2 ? "positive" : value < -2 ? "negative" : "neutral",
      detail,
    });
  };

  if (metrics.temperature !== null && metrics.dewPoint !== null) {
    const spread = Math.max(0, metrics.temperature - metrics.dewPoint);
    const value = spread <= 0.8 ? 27 : spread <= 2 ? 23 : spread <= 4 ? 11 : -Math.min((spread - 4) * 4, 20);
    add("露点差", value, `${spread.toFixed(1)}°C`, 28);
  }
  if (metrics.humidity !== null) {
    const value = metrics.humidity >= 96 ? 20 : metrics.humidity >= 90 ? 15 : metrics.humidity >= 82 ? 6 : -Math.min((82 - metrics.humidity) * .7, 16);
    add("近地饱和", value, `${Math.round(metrics.humidity)}% 湿度`, 20);
  }
  if (metrics.windSpeed !== null) {
    const speed = metrics.windSpeed;
    const value = speed >= 4 && speed <= 18 ? 12 : speed < 4 ? 3 : -Math.min((speed - 18) * .9, 18);
    add("平流输送", value, `${speed.toFixed(0)} km/h 风速`, 17);
  }
  if (metrics.lowCloud !== null) {
    const value = metrics.lowCloud >= 70 ? 11 : metrics.lowCloud >= 35 ? 7 : -4;
    add("低层水汽", value, `${Math.round(metrics.lowCloud)}% 低云`, 13);
  }
  if (metrics.visibility !== null) {
    const km = metrics.visibility / 1000;
    const value = km <= 1 ? 14 : km <= 5 ? 10 : km <= 12 ? 4 : -3;
    add("能见度信号", value, `${km.toFixed(km < 10 ? 1 : 0)} km`, 14);
  }
  if (metrics.precipitation !== null) {
    const value = metrics.precipitation <= .1 ? 3 : -Math.min(metrics.precipitation * 8, 12);
    add("非降水性", value, `${metrics.precipitation.toFixed(1)} mm`, 8);
  }

  const completeness = Math.round(known);
  const adjusted = score + (42 - score) * ((100 - completeness) / 100) * .45;
  return {
    probability: Math.round(clamp(adjusted, 4, 96)),
    rawScore: Math.round(score),
    completeness,
    contributions: contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
  };
}

export function fogLevel(probability: number): "很高" | "较高" | "一般" | "较低" {
  if (probability >= 76) return "很高";
  if (probability >= 58) return "较高";
  if (probability >= 38) return "一般";
  return "较低";
}

export function fogSummary(probability: number, metrics: FogMetrics) {
  const spread = metrics.temperature !== null && metrics.dewPoint !== null ? metrics.temperature - metrics.dewPoint : null;
  if ((metrics.windSpeed ?? 0) > 28) return "风速偏强，雾层难以稳定停留";
  if (spread !== null && spread <= 2 && (metrics.humidity ?? 0) >= 90) return "近地空气接近饱和，具备成雾基础";
  if (probability >= 58) return "水汽与输送条件较配合，建议关注低洼和水面附近";
  if (probability >= 38) return "存在雾景窗口，但局地地形将决定最终形态";
  return "空气尚未接近饱和，形成稳定雾层的机会有限";
}
