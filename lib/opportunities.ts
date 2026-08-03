import type { City, DailyOpportunity, DayForecast, SpaceWeatherResponse } from "@/lib/types";

const MINUTE = 60_000;

function instant(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}:00+08:00`);
}

function offset(value: string, minutes: number) {
  return new Date(instant(value).getTime() + minutes * MINUTE).toISOString();
}

function normalized(value: string | null, fallback: string) {
  return value ? instant(value).toISOString() : instant(fallback).toISOString();
}

function status(score: number | null): DailyOpportunity["status"] {
  if (score === null) return "unavailable";
  if (score >= 72) return "excellent";
  if (score >= 42) return "watch";
  return "poor";
}

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function kilometres(value: number | null) {
  return value === null ? "—" : `${Math.round(value / 1000)} km`;
}

function auroraOpportunity(day: DayForecast, city: City, spaceWeather: SpaceWeatherResponse | null): DailyOpportunity {
  const start = normalized(day.solar.eveningAstronomicalStart, day.sunset);
  const end = normalized(day.solar.morningAstronomicalEnd, offset(day.sunset, 12 * 60));
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const points = spaceWeather?.status === "available"
    ? spaceWeather.points.filter((point) => {
        const time = new Date(point.time).getTime();
        return time >= startTime && time <= endTime;
      })
    : [];
  const strongest = points.reduce<(typeof points)[number] | null>((current, point) => !current || point.kp > current.kp ? point : current, null);
  const requiredKp = city.latitude >= 52 ? 6 : city.latitude >= 48 ? 7 : city.latitude >= 44 ? 8 : 9;
  const magneticSignal = strongest ? Math.max(0, Math.min(100, (strongest.kp - (requiredKp - 3)) / 3 * 100)) : null;
  const score = magneticSignal === null ? null : Math.round(magneticSignal * day.night.probability / 100);
  const peak = strongest?.time ?? day.night.time;
  const availability = spaceWeather?.status !== "available"
    ? "空间天气源暂时不可用"
    : strongest === null
      ? "超出 NOAA Kp 有效预报范围"
      : strongest.kp < requiredKp
        ? `Kp ${strongest.kp.toFixed(1)}，未达到本纬度约 Kp ${requiredKp} 的经验门槛`
        : `Kp ${strongest.kp.toFixed(1)} 达到本纬度经验门槛，仍需确认极光椭圆与现场天空`;
  return {
    id: "aurora",
    kind: "aurora",
    title: "极光",
    shortTitle: "极光",
    start,
    peak,
    end,
    score,
    scoreType: "opportunity-index",
    confidence: strongest ? Math.min(62, day.night.confidence) : null,
    status: status(score),
    summary: strongest ? `${availability}；本地黑夜与云量共同计入机会指数。` : availability,
    limitation: "Kp 是全球地磁指导；未接入实时极光椭圆与 Bz，不能承诺具体地点可见。",
    direction: score !== null ? { azimuth: 0, label: "建议先查看北方天空" } : null,
    details: [
      { label: "最强 Kp", value: strongest ? strongest.kp.toFixed(1) : "—" },
      { label: "本地经验门槛", value: `约 Kp ${requiredKp}` },
      { label: "星空天气", value: `${day.night.probability}/100` },
      { label: "数据时效", value: spaceWeather?.validUntil ? `至 ${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(spaceWeather.validUntil))}` : "暂无" },
    ],
  };
}

export function buildDailyOpportunities(day: DayForecast, city: City, spaceWeather: SpaceWeatherResponse | null): DailyOpportunity[] {
  const dawnPeak = instant(day.dawn.time).toISOString();
  const duskPeak = instant(day.dusk.time).toISOString();
  const fogPeak = instant(day.fog.time).toISOString();
  const rainbow = day.weather.rainbow;
  const rainbowPeak = instant(rainbow.time).toISOString();
  const moonPeak = instant(day.moon.time).toISOString();
  const starPeak = instant(day.night.time).toISOString();
  const items: DailyOpportunity[] = [
    {
      id: "dawn-glow", kind: "dawn-glow", title: "朝霞", shortTitle: "朝霞",
      start: offset(day.dawn.time, -45), peak: dawnPeak, end: offset(day.dawn.time, 20),
      score: day.dawn.probability, scoreType: "opportunity-index", confidence: day.dawn.confidence, status: status(day.dawn.probability),
      summary: day.dawn.summary, limitation: "机会指数是透明启发式评分，不是统计概率。",
      direction: day.solar.sunriseAzimuth === null ? null : { azimuth: day.solar.sunriseAzimuth, label: "朝霞光路 / 日出方位" },
      details: [
        { label: "低云", value: percent(day.dawn.metrics.lowCloud) },
        { label: "中云", value: percent(day.dawn.metrics.midCloud) },
        { label: "高云", value: percent(day.dawn.metrics.highCloud) },
        { label: "能见度", value: kilometres(day.dawn.metrics.visibility) },
      ],
    },
    {
      id: "sunrise", kind: "sunrise", title: "日出与晨间金色时段", shortTitle: "日出",
      start: normalized(day.solar.morningBlueStart, offset(day.sunrise, -35)), peak: instant(day.sunrise).toISOString(), end: normalized(day.solar.morningGoldenEnd, offset(day.sunrise, 45)),
      score: null, scoreType: "geometry-only", confidence: 100, status: "watch",
      summary: "太阳时刻与方位由定位点天文几何计算；是否出片仍取决于地平线云层与遮挡。", limitation: "未计入山体、建筑和现场地平线遮挡。",
      direction: day.solar.sunriseAzimuth === null ? null : { azimuth: day.solar.sunriseAzimuth, label: "日出方位" },
      details: [
        { label: "日出方位", value: day.solar.sunriseAzimuth === null ? "—" : `${Math.round(day.solar.sunriseAzimuth)}°` },
        { label: "晨间金色结束", value: day.solar.morningGoldenEnd ? "已计算" : "暂无" },
        { label: "白昼长度", value: `${Math.floor(day.solar.daylightMinutes / 60)}小时${day.solar.daylightMinutes % 60}分` },
      ],
    },
    {
      id: "fog", kind: "fog", title: "雾景", shortTitle: "雾景",
      start: offset(day.fog.time, -60), peak: fogPeak, end: offset(day.fog.time, 60),
      score: day.fog.probability, scoreType: "opportunity-index", confidence: day.fog.confidence, status: status(day.fog.probability),
      summary: day.fog.summary, limitation: "单点模式未计入水体距离、精细地形与雾的局地输送。", direction: null,
      details: [
        { label: "湿度", value: percent(day.fog.metrics.humidity) },
        { label: "低云", value: percent(day.fog.metrics.lowCloud) },
        { label: "能见度", value: kilometres(day.fog.metrics.visibility) },
        { label: "风速", value: day.fog.metrics.windSpeed === null ? "—" : `${Math.round(day.fog.metrics.windSpeed)} km/h` },
      ],
    },
    {
      id: "rainbow", kind: "rainbow", title: "彩虹", shortTitle: "彩虹",
      start: offset(rainbow.time, -30), peak: rainbowPeak, end: offset(rainbow.time, 30),
      score: rainbow.score, scoreType: "opportunity-index", confidence: rainbow.confidence, status: status(rainbow.score),
      summary: rainbow.summary, limitation: "单点网格不知道雨幕是否位于反太阳方向，只能表达彩虹潜势。",
      direction: rainbow.viewingAzimuth === null ? null : { azimuth: rainbow.viewingAzimuth, label: "建议观虹方向" },
      details: [
        { label: "降水信号", value: `${rainbow.score}/100` },
        { label: "太阳高度", value: `${rainbow.metrics.solarAltitude.toFixed(1)}°` },
        { label: "直射辐射", value: rainbow.metrics.directRadiation === null ? "—" : `${Math.round(rainbow.metrics.directRadiation)} W/m²` },
        { label: "观测方位", value: rainbow.viewingAzimuth === null ? "—" : `${Math.round(rainbow.viewingAzimuth)}°` },
      ],
    },
    {
      id: "sunset", kind: "sunset", title: "日落与傍晚蓝调", shortTitle: "日落",
      start: normalized(day.solar.eveningGoldenStart, offset(day.sunset, -50)), peak: instant(day.sunset).toISOString(), end: normalized(day.solar.eveningBlueEnd, offset(day.sunset, 40)),
      score: null, scoreType: "geometry-only", confidence: 100, status: "watch",
      summary: "日落、金色时段与蓝调由定位点天文几何确定，可直接用于到场和构图计划。", limitation: "未计入山体、建筑和现场地平线遮挡。",
      direction: day.solar.sunsetAzimuth === null ? null : { azimuth: day.solar.sunsetAzimuth, label: "日落方位" },
      details: [
        { label: "日落方位", value: day.solar.sunsetAzimuth === null ? "—" : `${Math.round(day.solar.sunsetAzimuth)}°` },
        { label: "蓝调结束", value: day.solar.eveningBlueEnd ? "已计算" : "暂无" },
        { label: "白昼长度", value: `${Math.floor(day.solar.daylightMinutes / 60)}小时${day.solar.daylightMinutes % 60}分` },
      ],
    },
    {
      id: "dusk-glow", kind: "dusk-glow", title: "晚霞", shortTitle: "晚霞",
      start: offset(day.dusk.time, -20), peak: duskPeak, end: offset(day.dusk.time, 45),
      score: day.dusk.probability, scoreType: "opportunity-index", confidence: day.dusk.confidence, status: status(day.dusk.probability),
      summary: day.dusk.summary, limitation: "机会指数是透明启发式评分，不是统计概率。",
      direction: day.solar.sunsetAzimuth === null ? null : { azimuth: day.solar.sunsetAzimuth, label: "晚霞光路 / 日落方位" },
      details: [
        { label: "低云", value: percent(day.dusk.metrics.lowCloud) },
        { label: "中云", value: percent(day.dusk.metrics.midCloud) },
        { label: "高云", value: percent(day.dusk.metrics.highCloud) },
        { label: "能见度", value: kilometres(day.dusk.metrics.visibility) },
      ],
    },
    {
      id: "moon", kind: "moon", title: "月亮", shortTitle: "月亮",
      start: offset(day.moon.time, -60), peak: moonPeak, end: offset(day.moon.time, 60),
      score: day.moon.probability, scoreType: "opportunity-index", confidence: day.moon.confidence, status: status(day.moon.probability),
      summary: `${day.moon.phaseName}，照明 ${day.moon.illumination}%。${day.moon.summary}`, limitation: "方位线未计入山体和建筑遮挡。",
      direction: day.moon.altitude > 0 ? { azimuth: day.moon.azimuth, label: "月面方位" } : null,
      details: [
        { label: "月面高度", value: `${day.moon.altitude.toFixed(1)}°` },
        { label: "月面方位", value: `${Math.round(day.moon.azimuth)}°` },
        { label: "照明", value: `${day.moon.illumination}%` },
        { label: "阵风", value: day.moon.weather.windGusts === null ? "—" : `${Math.round(day.moon.weather.windGusts)} km/h` },
      ],
    },
    {
      id: "stars", kind: "stars", title: "星空", shortTitle: "星空",
      start: normalized(day.night.astronomicalDusk, day.sunset), peak: starPeak, end: normalized(day.night.astronomicalDawn, offset(day.sunset, 11 * 60)),
      score: day.night.probability, scoreType: "opportunity-index", confidence: day.night.confidence, status: status(day.night.probability),
      summary: day.night.summary, limitation: "当前未计入光污染、银河核心位置和地形地平线。", direction: null,
      details: [
        { label: "完整黑夜", value: `${Math.round(day.night.darknessMinutes / 60 * 10) / 10} 小时` },
        { label: "月光", value: `${day.night.moon.illumination}%` },
        { label: "低云", value: percent(day.night.weather.lowCloud) },
        { label: "阵风", value: day.night.weather.windGusts === null ? "—" : `${Math.round(day.night.weather.windGusts)} km/h` },
      ],
    },
    auroraOpportunity(day, city, spaceWeather),
  ];
  return items.sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime());
}

