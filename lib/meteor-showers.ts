import { Body, Horizon, Illumination, Observer } from "astronomy-engine";
import type { City, MeteorShowerForecast } from "@/lib/types";

interface ShowerDefinition {
  id: string;
  name: string;
  peakMonth: number;
  peakDay: number;
  activeStart: [number, number];
  activeEnd: [number, number];
  zenithalHourlyRate: number;
  radiant: string;
  radiantRa: number;
  radiantDec: number;
  viewingAdvice: string;
}

// Major annual showers only. Peak times can move by several hours from year to
// year, so the public contract deliberately describes a planning night range.
const MAJOR_SHOWERS: ShowerDefinition[] = [
  { id: "quadrantids", name: "象限仪座流星雨", peakMonth: 1, peakDay: 3, activeStart: [12, 28], activeEnd: [1, 12], zenithalHourlyRate: 80, radiant: "牧夫座北部", radiantRa: 15.33, radiantDec: 49, viewingAdvice: "后半夜辐射点升高，面向东北至天顶的大范围天空观察。" },
  { id: "lyrids", name: "天琴座流星雨", peakMonth: 4, peakDay: 22, activeStart: [4, 14], activeEnd: [4, 30], zenithalHourlyRate: 18, radiant: "天琴座", radiantRa: 18.07, radiantDec: 34, viewingAdvice: "午夜后辐射点逐渐升高，避开月亮并使用广角构图。" },
  { id: "eta-aquariids", name: "宝瓶座 η 流星雨", peakMonth: 5, peakDay: 6, activeStart: [4, 19], activeEnd: [5, 28], zenithalHourlyRate: 50, radiant: "宝瓶座", radiantRa: 22.53, radiantDec: -1, viewingAdvice: "中国多数地区以黎明前低空窗口为主，南方观测条件更好。" },
  { id: "perseids", name: "英仙座流星雨", peakMonth: 8, peakDay: 13, activeStart: [7, 17], activeEnd: [8, 24], zenithalHourlyRate: 100, radiant: "英仙座", radiantRa: 3.2, radiantDec: 58, viewingAdvice: "午夜后至晨光前辐射点较高，选择开阔北向天空。" },
  { id: "orionids", name: "猎户座流星雨", peakMonth: 10, peakDay: 21, activeStart: [10, 2], activeEnd: [11, 7], zenithalHourlyRate: 20, radiant: "猎户座", radiantRa: 6.33, radiantDec: 16, viewingAdvice: "后半夜猎户座升高，镜头避开明月可提升暗流星对比度。" },
  { id: "leonids", name: "狮子座流星雨", peakMonth: 11, peakDay: 17, activeStart: [11, 6], activeEnd: [11, 30], zenithalHourlyRate: 15, radiant: "狮子座", radiantRa: 10.13, radiantDec: 22, viewingAdvice: "黎明前辐射点最高，普通年份不应按历史暴雨强度做期待。" },
  { id: "geminids", name: "双子座流星雨", peakMonth: 12, peakDay: 14, activeStart: [12, 4], activeEnd: [12, 20], zenithalHourlyRate: 150, radiant: "双子座", radiantRa: 7.47, radiantDec: 33, viewingAdvice: "入夜后即可拍摄，午夜前后辐射点更高且持续时间长。" },
];
const chinaYearFormatter = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Shanghai" });

function chinaNight(year: number, month: number, day: number, hour = 23) {
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+08:00`);
}

function boundaryYear(peakYear: number, boundaryMonth: number, peakMonth: number, isStart: boolean) {
  if (isStart && boundaryMonth > peakMonth) return peakYear - 1;
  if (!isStart && boundaryMonth < peakMonth) return peakYear + 1;
  return peakYear;
}

export function getMeteorShowers(city: City, at = new Date()): MeteorShowerForecast[] {
  const chinaYear = Number(chinaYearFormatter.format(at));
  const observer = new Observer(city.latitude, city.longitude, 0);
  return [chinaYear, chinaYear + 1]
    .flatMap((year) => MAJOR_SHOWERS.map((definition) => {
      const peak = chinaNight(year, definition.peakMonth, definition.peakDay);
      const startYear = boundaryYear(year, definition.activeStart[0], definition.peakMonth, true);
      const endYear = boundaryYear(year, definition.activeEnd[0], definition.peakMonth, false);
      const activeStart = chinaNight(startYear, definition.activeStart[0], definition.activeStart[1], 0);
      const activeEnd = chinaNight(endYear, definition.activeEnd[0], definition.activeEnd[1], 23);
      const radiant = Horizon(peak, observer, definition.radiantRa, definition.radiantDec, "normal");
      return {
        id: `${definition.id}-${year}`,
        name: definition.name,
        peak: peak.toISOString(),
        activeStart: activeStart.toISOString(),
        activeEnd: activeEnd.toISOString(),
        peakPrecision: "night-range" as const,
        zenithalHourlyRate: definition.zenithalHourlyRate,
        radiant: definition.radiant,
        radiantAltitude: radiant.altitude,
        radiantAzimuth: radiant.azimuth,
        viewingAdvice: definition.viewingAdvice,
        moonIllumination: Math.round(Illumination(Body.Moon, peak).phase_fraction * 100),
        source: "IMO 主要流星雨年表；峰值按北京时间夜间范围表达",
      };
    }))
    .filter((event) => new Date(event.activeEnd).getTime() >= at.getTime())
    .sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime())
    .slice(0, 8);
}
