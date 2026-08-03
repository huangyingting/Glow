"use client";

import { AlertTriangle, CalendarDays, Eclipse, MoonStar, Orbit, Sparkles, Telescope } from "lucide-react";
import type { EclipseForecast, ForecastResponse, MeteorShowerForecast } from "@/lib/types";
import { FieldBriefing, SourceDisclosure, closestHour, compass, forecastInstant, localDate, longDateTime } from "@/components/workspace-common";

export interface RareEvent {
  id: string;
  kind: "lunar-eclipse" | "solar-eclipse" | "meteor-shower";
  title: string;
  peak: string;
  start: string;
  end: string;
  metric: string;
  metricLabel: string;
  summary: string;
  sourceNote: string;
  azimuth: number | null;
  altitude: number | null;
  moonIllumination: number | null;
  eclipse?: EclipseForecast;
  shower?: MeteorShowerForecast;
}

const ECLIPSE_KIND: Record<EclipseForecast["kind"], string> = {
  penumbral: "半影食",
  partial: "偏食",
  annular: "环食",
  total: "全食",
};

export function buildRareEvents(data: ForecastResponse): RareEvent[] {
  const lunar = data.astronomy.nextLunarEclipse;
  const solar = data.astronomy.nextSolarEclipse;
  return [
    {
      id: `lunar-${lunar.peak}`,
      kind: "lunar-eclipse" as const,
      title: `${ECLIPSE_KIND[lunar.kind]} · 月食`,
      peak: lunar.peak,
      start: lunar.begin,
      end: lunar.end,
      metric: lunar.kind === "penumbral" ? "半影" : `${Math.round(lunar.obscuration * 100)}%`,
      metricLabel: lunar.kind === "penumbral" ? "无本影遮掩" : "最大遮掩",
      summary: `${data.location.name}定位点在食甚时月面${lunar.visible ? "位于地平线上" : "不在地平线上"}。`,
      sourceNote: "Astronomy Engine 本地可见食象几何",
      azimuth: lunar.azimuth,
      altitude: lunar.altitude,
      moonIllumination: null,
      eclipse: lunar,
    },
    {
      id: `solar-${solar.peak}`,
      kind: "solar-eclipse" as const,
      title: `${ECLIPSE_KIND[solar.kind]} · 日食`,
      peak: solar.peak,
      start: solar.begin,
      end: solar.end,
      metric: `${Math.round(solar.obscuration * 100)}%`,
      metricLabel: "本地最大遮掩",
      summary: `${data.location.name}定位点在食甚时太阳${solar.visible ? "位于地平线上" : "不在地平线上"}。`,
      sourceNote: "Astronomy Engine 本地日食接触时刻与遮掩",
      azimuth: solar.azimuth,
      altitude: solar.altitude,
      moonIllumination: null,
      eclipse: solar,
    },
    ...data.astronomy.meteorShowers.map((shower): RareEvent => ({
      id: shower.id,
      kind: "meteor-shower",
      title: shower.name,
      peak: shower.peak,
      start: shower.activeStart,
      end: shower.activeEnd,
      metric: `ZHR ${shower.zenithalHourlyRate}`,
      metricLabel: "理想天顶流量",
      summary: shower.viewingAdvice,
      sourceNote: shower.source,
      azimuth: shower.radiantAzimuth,
      altitude: shower.radiantAltitude,
      moonIllumination: shower.moonIllumination,
      shower,
    })),
  ].sort((a, b) => forecastInstant(a.peak) - forecastInstant(b.peak));
}

function daysAway(data: ForecastResponse, event: RareEvent) {
  return Math.max(0, Math.ceil((forecastInstant(event.peak) - forecastInstant(data.generatedAt)) / 86_400_000));
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(forecastInstant(value)));
}

export function EventsTimeline({ data, events, selectedId, onSelect }: { data: ForecastResponse; events: RareEvent[]; selectedId: string; onSelect: (event: RareEvent) => void }) {
  return (
    <div className="planner-timeline events-timeline" aria-label="未来天象事件时间线">
      <div className="events-timeline-label"><span>NEXT EVENTS</span><strong>未来天象</strong></div>
      <div className="event-strip" role="listbox" aria-label="按日期排序的天象事件">
        {events.map((event) => (
          <button key={event.id} type="button" role="option" aria-selected={selectedId === event.id} onClick={() => onSelect(event)}>
            {event.kind === "meteor-shower" ? <Sparkles /> : event.kind === "lunar-eclipse" ? <MoonStar /> : <Eclipse />}
            <span><small>{localDate(event.peak)}</small><strong>{event.title}</strong><em>{daysAway(data, event)} 天后</em></span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function EventsPanel({ data, events, selectedId, onSelect }: { data: ForecastResponse; events: RareEvent[]; selectedId: string; onSelect: (event: RareEvent) => void }) {
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const inWeatherRange = data.days.some((day) => day.date === dateKey(selected.peak));
  const fieldPoint = inWeatherRange ? closestHour(data.hourly, selected.peak) : null;
  const SelectedIcon = selected.kind === "meteor-shower" ? Sparkles : selected.kind === "lunar-eclipse" ? MoonStar : Eclipse;
  return (
    <aside className="inspector events-inspector" aria-label="罕见天象事件面板">
      <header className="inspector-header">
        <div className="scene-title"><span><Telescope size={18} /></span><div><small>CELESTIAL CALENDAR</small><h1>天象事件</h1></div></div>
        <span className="data-fresh"><i /> {events.length} 个事件</span>
      </header>
      <div className="inspector-scroll" id="workspace-detail" role="tabpanel">
        <section className="event-overview">
          <CalendarDays />
          <div><span>按峰值日期排序</span><strong>远期看几何，临近再看天气</strong></div>
          <p>流星雨峰值按夜间范围表达，不伪装成分钟级确定时刻。</p>
        </section>
        <div className="rare-event-list">
          {events.map((event) => (
            <button type="button" key={event.id} aria-pressed={selected.id === event.id} onClick={() => onSelect(event)}>
              <span>{event.kind === "meteor-shower" ? <Sparkles /> : event.kind === "lunar-eclipse" ? <Orbit /> : <Eclipse />}</span>
              <span><strong>{event.title}</strong><small>{localDate(event.peak)} · {daysAway(data, event)} 天后</small></span>
              <em>{event.metric}</em>
            </button>
          ))}
        </div>
        <section className={`event-detail workspace-card ${selected.kind}`}>
          <header>
            <span><SelectedIcon /></span>
            <div><small>NEXT SELECTED EVENT</small><h2>{selected.title}</h2></div>
            <strong>{selected.metric}<small>{selected.metricLabel}</small></strong>
          </header>
          <p>{selected.summary}</p>
          <div className="event-timing">
            <span><small>开始 / 活跃期起</small><strong>{longDateTime(selected.start)}</strong></span>
            <i />
            <span><small>{selected.kind === "meteor-shower" ? "预计峰值夜" : "食甚"}</small><strong>{longDateTime(selected.peak)}</strong></span>
            <i />
            <span><small>结束 / 活跃期止</small><strong>{longDateTime(selected.end)}</strong></span>
          </div>
          <div className="event-facts">
            <span><small>距离事件</small><strong>{daysAway(data, selected)} 天</strong></span>
            <span><small>本地方位</small><strong>{selected.azimuth === null ? "—" : compass(selected.azimuth)}</strong></span>
            <span><small>{selected.kind === "meteor-shower" ? "峰值夜辐射点高度" : "食甚高度"}</small><strong>{selected.altitude === null ? "—" : `${selected.altitude.toFixed(1)}°`}</strong></span>
            <span><small>天气状态</small><strong>{inWeatherRange ? "已进入七天预报" : "尚无可信天气"}</strong></span>
            {selected.shower && <><span><small>辐射点</small><strong>{selected.shower.radiant}</strong></span><span><small>月面照明</small><strong>{selected.moonIllumination}%</strong></span></>}
          </div>
          <p className="event-source-note">{selected.sourceNote}</p>
          {selected.kind === "solar-eclipse" && <p className="event-safety"><AlertTriangle /> 严禁用肉眼或普通减光镜直视太阳；拍摄日食必须使用合格的太阳滤镜。</p>}
        </section>
        {inWeatherRange ? <FieldBriefing point={fieldPoint} label="事件峰值" elevation={data.location.elevation} /> : <p className="event-weather-wait">事件距今 {daysAway(data, selected)} 天。天气只在进入七天预报窗口后显示，当前不生成远期云量或成功率。</p>}
        <SourceDisclosure data={data} />
      </div>
    </aside>
  );
}
