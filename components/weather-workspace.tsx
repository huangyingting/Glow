"use client";

import { Cloud, CloudRain, CloudSun, Compass, Droplets, Eye, Gauge, Navigation, Thermometer, Wind } from "lucide-react";
import type { DayForecast, ForecastResponse, HourlyWeatherPoint, WeatherView } from "@/lib/types";
import { DateTabs, SourceDisclosure, compass, localTime } from "@/components/workspace-common";

export function wmoLabel(code: number | null) {
  if (code === null) return "天气现象待更新";
  if (code === 0) return "晴朗";
  if (code <= 3) return "多云";
  if (code <= 48) return "雾或霾";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "降雨";
  if (code <= 77) return "降雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "雷暴天气";
}

function value(value: number | null, unit: string, digits = 0) {
  return value === null ? "—" : `${value.toFixed(digits)}${unit}`;
}

function WeatherIcon({ point }: { point: HourlyWeatherPoint }) {
  if ((point.precipitation ?? 0) > 0.1 || (point.precipitationProbability ?? 0) >= 45) return <CloudRain />;
  if ((point.totalCloud ?? 0) >= 70) return <Cloud />;
  return <CloudSun />;
}

export function WeatherTimeline({ data, day, dayIndex, hours, selectedTime, onDay, onHour }: {
  data: ForecastResponse;
  day: DayForecast;
  dayIndex: number;
  hours: HourlyWeatherPoint[];
  selectedTime: string;
  onDay: (index: number) => void;
  onHour: (point: HourlyWeatherPoint) => void;
}) {
  return (
    <div className="planner-timeline weather-timeline" aria-label="日期与逐小时天气">
      <DateTabs data={data} selected={dayIndex} onSelect={onDay} label="七天天气日期" />
      <div className="hourly-strip" role="listbox" aria-label={`${day.shortDate}逐小时天气`}>
        {hours.map((point) => (
          <button key={point.time} type="button" role="option" aria-selected={point.time === selectedTime} onClick={() => onHour(point)}>
            <span>{localTime(point.time)}</span>
            <WeatherIcon point={point} />
            <strong>{point.temperature === null ? "—" : `${Math.round(point.temperature)}°`}</strong>
            <small>{point.precipitationProbability === null ? "—" : `${Math.round(point.precipitationProbability)}%`}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function CloudDetail({ point, hours }: { point: HourlyWeatherPoint; hours: HourlyWeatherPoint[] }) {
  const layers = [
    { label: "高云", value: point.highCloud, className: "high" },
    { label: "中云", value: point.midCloud, className: "mid" },
    { label: "低云", value: point.lowCloud, className: "low" },
  ];
  return (
    <section className="weather-detail" aria-label="云层详情">
      <header><span><Cloud /> 云层垂直结构</span><strong>总云量 {value(point.totalCloud, "%")}</strong></header>
      <div className="layer-profile">
        {layers.map((layer) => <span key={layer.label}><small>{layer.label}</small><i className={layer.className}><b style={{ width: `${layer.value ?? 0}%` }} /></i><strong>{value(layer.value, "%")}</strong></span>)}
      </div>
      <div className="hour-bars cloud-bars" aria-label="24小时总云量趋势">
        {hours.map((hour) => <i key={hour.time} style={{ height: `${Math.max(3, (hour.totalCloud ?? 0) * .52)}px` }} title={`${localTime(hour.time)} 云量 ${value(hour.totalCloud, "%")}`}><span>{localTime(hour.time).slice(0, 2)}</span></i>)}
      </div>
      <p>低云更容易遮住地平线，高云有时能提供霞光纹理；总云量本身不代表摄影质量。</p>
    </section>
  );
}

function RainDetail({ point, hours }: { point: HourlyWeatherPoint; hours: HourlyWeatherPoint[] }) {
  const max = Math.max(1, ...hours.map((hour) => hour.precipitation ?? 0));
  return (
    <section className="weather-detail" aria-label="降雨详情">
      <header><span><CloudRain /> 降水时段与量级</span><strong>{wmoLabel(point.weatherCode)}</strong></header>
      <div className="detail-metrics">
        <span><small>降水概率</small><strong>{value(point.precipitationProbability, "%")}</strong></span>
        <span><small>小时降水</small><strong>{value(point.precipitation, " mm", 1)}</strong></span>
        <span><small>连续性雨</small><strong>{value(point.rain, " mm", 1)}</strong></span>
        <span><small>阵雨</small><strong>{value(point.showers, " mm", 1)}</strong></span>
      </div>
      <div className="hour-bars rain-bars" aria-label="24小时降水量趋势">
        {hours.map((hour) => <i key={hour.time} style={{ height: `${Math.max(3, (hour.precipitation ?? 0) / max * 52)}px` }} title={`${localTime(hour.time)} 降水 ${value(hour.precipitation, " mm", 1)}`}><span>{localTime(hour.time).slice(0, 2)}</span></i>)}
      </div>
      <p>概率与实际量级分开显示；CMA 缺少概率字段时保持为空，不把综合信号冒充概率。</p>
    </section>
  );
}

function WindDetail({ point, hours }: { point: HourlyWeatherPoint; hours: HourlyWeatherPoint[] }) {
  const max = Math.max(1, ...hours.map((hour) => hour.windGusts ?? hour.windSpeed ?? 0));
  return (
    <section className="weather-detail" aria-label="风况详情">
      <header><span><Wind /> 风速、阵风与来向</span><strong>{compass(point.windDirection)}</strong></header>
      <div className="wind-current">
        <span className="wind-compass"><Navigation style={{ transform: `rotate(${(point.windDirection ?? 0) + 180}deg)` }} /><small>箭头指向风吹去的方向</small></span>
        <div><small>持续风</small><strong>{value(point.windSpeed, " km/h")}</strong><small>阵风</small><strong>{value(point.windGusts, " km/h")}</strong></div>
      </div>
      <div className="hour-bars wind-bars" aria-label="24小时阵风趋势">
        {hours.map((hour) => <i key={hour.time} style={{ height: `${Math.max(3, (hour.windGusts ?? hour.windSpeed ?? 0) / max * 52)}px` }} title={`${localTime(hour.time)} 阵风 ${value(hour.windGusts, " km/h")}`}><span>{localTime(hour.time).slice(0, 2)}</span></i>)}
      </div>
      <p>来风方向表示风从哪里吹来。阵风超过约 30 km/h 时，长焦、脚架与水面倒影的稳定性会明显下降。</p>
    </section>
  );
}

export function WeatherPanel({ data, point, hours, view, onView }: {
  data: ForecastResponse;
  point: HourlyWeatherPoint;
  hours: HourlyWeatherPoint[];
  view: WeatherView;
  onView: (view: WeatherView) => void;
}) {
  const temperatures = hours.flatMap((item) => item.temperature === null ? [] : [item.temperature]);
  const high = temperatures.length ? Math.max(...temperatures) : null;
  const low = temperatures.length ? Math.min(...temperatures) : null;
  const dewGap = point.temperature !== null && point.dewPoint !== null ? point.temperature - point.dewPoint : null;
  return (
    <aside className="inspector weather-inspector" aria-label="专业天气工作台">
      <header className="inspector-header">
        <div className="scene-title"><span><CloudSun size={18} /></span><div><small>POINT WEATHER</small><h1>天气工作台</h1></div></div>
        <span className="data-fresh"><i /> {localTime(point.time)}</span>
      </header>
      <div className="inspector-scroll" id="workspace-detail" role="tabpanel">
        <section className="weather-hero">
          <span className="weather-hero-icon"><WeatherIcon point={point} /></span>
          <div><small>{data.location.name} · {localTime(point.time)}</small><h2>{wmoLabel(point.weatherCode)}</h2><p>最高 {value(high, "°")} · 最低 {value(low, "°")}</p></div>
          <strong>{point.temperature === null ? "—" : `${Math.round(point.temperature)}°`}</strong>
        </section>
        <div className="weather-overview" aria-label="云雨风概览">
          <button type="button" aria-pressed={view === "cloud"} onClick={() => onView("cloud")}><Cloud /><span><small>总云量</small><strong>{value(point.totalCloud, "%")}</strong></span></button>
          <button type="button" aria-pressed={view === "rain"} onClick={() => onView("rain")}><Droplets /><span><small>降水概率</small><strong>{value(point.precipitationProbability, "%")}</strong></span></button>
          <button type="button" aria-pressed={view === "wind"} onClick={() => onView("wind")}><Wind /><span><small>风 / 阵风</small><strong>{value(point.windSpeed, "")} / {value(point.windGusts, "")}</strong></span></button>
        </div>
        <div className="weather-view-tabs" role="tablist" aria-label="天气详情分类">
          {(["cloud", "rain", "wind"] as WeatherView[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => onView(item)}>{item === "cloud" ? "云层" : item === "rain" ? "降雨" : "风况"}</button>
          ))}
        </div>
        {view === "cloud" && <CloudDetail point={point} hours={hours} />}
        {view === "rain" && <RainDetail point={point} hours={hours} />}
        {view === "wind" && <WindDetail point={point} hours={hours} />}
        <section className="weather-facts workspace-card">
          <header><span><Gauge /> 现场细节</span><small>点位预报</small></header>
          <div>
            <span><Thermometer /><small>体感风险</small><strong>露点差 {value(dewGap, "°", 1)}</strong></span>
            <span><Eye /><small>能见度</small><strong>{point.visibility === null ? "—" : `${Math.round(point.visibility / 1000)} km`}</strong></span>
            <span><Compass /><small>来风方向</small><strong>{compass(point.windDirection)}</strong></span>
            <span><Gauge /><small>地面气压</small><strong>{value(point.pressure, " hPa")}</strong></span>
          </div>
        </section>
        <p className="weather-map-boundary">当前为所选位置的单点 168 小时预报。没有接入授权的雷达/网格瓦片前，地图不会伪造全国云图、雨图或风场。</p>
        <SourceDisclosure data={data} />
      </div>
    </aside>
  );
}

