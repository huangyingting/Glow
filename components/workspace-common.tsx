"use client";

import { ChevronDown, Cloud, Database, Droplets, Eye, Gauge, Navigation, Thermometer, Wind } from "lucide-react";
import type { ForecastResponse, HourlyWeatherPoint } from "@/lib/types";

export function forecastInstant(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}:00+08:00`).getTime();
}

export function localTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(forecastInstant(value)));
}

export function localDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Shanghai" }).format(new Date(forecastInstant(value)));
}

export function longDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(forecastInstant(value)));
}

export function compass(value: number | null) {
  if (value === null) return "—";
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return `${directions[Math.round(value / 45) % 8]} ${Math.round(value)}°`;
}

export function closestHour(hourly: HourlyWeatherPoint[], target: string) {
  const targetTime = forecastInstant(target);
  const point = hourly.reduce<HourlyWeatherPoint | null>((current, item) => {
    if (!current) return item;
    return Math.abs(forecastInstant(item.time) - targetTime) < Math.abs(forecastInstant(current.time) - targetTime) ? item : current;
  }, null);
  return point && Math.abs(forecastInstant(point.time) - targetTime) <= 90 * 60 * 1000 ? point : null;
}

export function DateTabs({ data, selected, onSelect, label = "选择预报日期" }: { data: ForecastResponse; selected: number; onSelect: (index: number) => void; label?: string }) {
  const move = (index: number, key: string) => {
    const next = key === "ArrowRight" ? (index + 1) % data.days.length
      : key === "ArrowLeft" ? (index - 1 + data.days.length) % data.days.length
        : key === "Home" ? 0
          : key === "End" ? data.days.length - 1
            : index;
    if (next !== index) {
      onSelect(next);
      window.requestAnimationFrame(() => document.getElementById(`forecast-day-${next}`)?.focus());
    }
  };
  return (
    <div className="date-tabs" role="tablist" aria-label={label}>
      {data.days.map((day, index) => (
        <button
          id={`forecast-day-${index}`}
          key={day.date}
          type="button"
          role="tab"
          tabIndex={selected === index ? 0 : -1}
          aria-selected={selected === index}
          aria-controls="workspace-detail"
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              move(index, event.key);
            }
          }}
          onClick={() => onSelect(index)}
        >
          <span>{index === 0 ? "今天" : day.weekday}</span>
          <strong>{day.shortDate}</strong>
        </button>
      ))}
    </div>
  );
}

export function FieldBriefing({ point, label, elevation }: { point: HourlyWeatherPoint | null; label: string; elevation: number | null }) {
  if (!point) return <p className="field-unavailable">{label}超出七天天气时效，暂不附加现场条件。</p>;
  const dewGap = point.temperature !== null && point.dewPoint !== null ? point.temperature - point.dewPoint : null;
  return (
    <section className="field-briefing workspace-card" aria-label={`${label}现场条件`}>
      <header><span><Gauge size={15} /> {label}现场条件</span><small>{localTime(point.time)}</small></header>
      <div>
        <span><Thermometer /><small>气温 / 露点差</small><strong>{point.temperature?.toFixed(0) ?? "—"}° / {dewGap?.toFixed(1) ?? "—"}°</strong></span>
        <span><Wind /><small>持续 / 阵风</small><strong>{point.windSpeed?.toFixed(0) ?? "—"} / {point.windGusts?.toFixed(0) ?? "—"} km/h</strong></span>
        <span><Navigation /><small>来风方向</small><strong>{compass(point.windDirection)}</strong></span>
        <span><Eye /><small>能见度</small><strong>{point.visibility === null ? "—" : `${Math.round(point.visibility / 1000)} km`}</strong></span>
        <span><Cloud /><small>总云量</small><strong>{point.totalCloud === null ? "—" : `${Math.round(point.totalCloud)}%`}</strong></span>
        <span><Droplets /><small>降水</small><strong>{point.precipitation === null ? "—" : `${point.precipitation.toFixed(1)} mm`}</strong></span>
      </div>
      <p>海拔 {elevation === null ? "—" : `${Math.round(elevation)} m`} · 露点差接近 0°C 时注意镜片结露，阵风会影响长焦与脚架稳定。</p>
    </section>
  );
}

export function SourceDisclosure({ data, includeSpaceWeather = false }: { data: ForecastResponse; includeSpaceWeather?: boolean }) {
  return (
    <details className="source-disclosure">
      <summary><span><Database size={14} /> 数据、模型与边界</span><ChevronDown size={14} /></summary>
      <div>
        {data.sources.map((source) => <p key={source.id}><i className={source.status} /><span><strong>{source.name}</strong><small>{source.role}</small></span></p>)}
        {includeSpaceWeather && <p><i className="available" /><span><strong><a href="https://www.swpc.noaa.gov/" target="_blank" rel="noreferrer">NOAA SWPC ↗</a></strong><small>Kp 空间天气指导；独立接口失败时不会影响普通天气</small></span></p>}
        <p><i className="available" /><span><strong><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo ↗</a></strong><small>{data.provenance.access === "customer" ? "商业客户接口" : "非商业开放接口"} · {data.provenance.license} · ECMWF / CMA / CAMS 交付层</small></span></p>
        <p><i className="available" /><span><strong>Astronomy Engine</strong><small>日月位置、暮光与本地食象几何</small></span></p>
        <p><i /><span><strong><a href="https://weather.cma.cn/web/alarm/map.html" target="_blank" rel="noreferrer">中国气象局预警 ↗</a></strong><small>权威灾害预警；当前工作台不替代官方预警</small></span></p>
      </div>
    </details>
  );
}

