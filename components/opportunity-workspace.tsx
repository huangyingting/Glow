"use client";

import { AlertTriangle, CloudFog, MoonStar, Rainbow, Sparkles, Star, Sun, Sunrise, Sunset, Telescope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DailyOpportunity, DayForecast, ForecastResponse, OpportunityKind } from "@/lib/types";
import { DateTabs, FieldBriefing, SourceDisclosure, closestHour, compass, forecastInstant, localTime } from "@/components/workspace-common";

const OPPORTUNITY_ICONS: Record<OpportunityKind, LucideIcon> = {
  "dawn-glow": Sunrise,
  sunrise: Sun,
  fog: CloudFog,
  rainbow: Rainbow,
  sunset: Sunset,
  "dusk-glow": Sparkles,
  moon: MoonStar,
  stars: Star,
  aurora: Telescope,
};

const STATUS_LABEL: Record<DailyOpportunity["status"], string> = {
  excellent: "值得出发",
  watch: "可以关注",
  poor: "条件不利",
  unavailable: "暂无可靠预测",
};

function minuteOfDay(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).formatToParts(new Date(forecastInstant(value)));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function scoreLabel(item: DailyOpportunity) {
  if (item.scoreType === "geometry-only") return "几何时刻";
  return item.score === null ? "暂无" : `${item.score}/100`;
}

export function OpportunityTimeline({
  data,
  day,
  dayIndex,
  opportunities,
  selectedId,
  selectedInstant,
  onDay,
  onOpportunity,
  onInstant,
}: {
  data: ForecastResponse;
  day: DayForecast;
  dayIndex: number;
  opportunities: DailyOpportunity[];
  selectedId: OpportunityKind;
  selectedInstant: number;
  onDay: (index: number) => void;
  onOpportunity: (item: DailyOpportunity) => void;
  onInstant: (instant: number) => void;
}) {
  const currentMinutes = Math.max(0, Math.min(1439, Math.round((selectedInstant - forecastInstant(`${day.date}T00:00`)) / 60_000)));
  const sunrise = minuteOfDay(day.sunrise);
  const sunset = minuteOfDay(day.sunset);
  const selected = opportunities.find((item) => item.id === selectedId) ?? opportunities[0];
  const start = minuteOfDay(selected.start);
  const end = minuteOfDay(selected.end);
  const windowLeft = start / 14.4;
  const windowWidth = end >= start ? (end - start) / 14.4 : (1440 - start) / 14.4;
  return (
    <div className="planner-timeline opportunity-timeline" aria-label="日期与每日机会时间轴">
      <DateTabs data={data} selected={dayIndex} onSelect={onDay} label="七天机会日期" />
      <div className="day-clock">
        <div className="clock-label"><span>{day.shortDate}</span><strong>{localTime(new Date(selectedInstant).toISOString())}</strong></div>
        <div className="clock-track">
          <span className="daylight-band" style={{ left: `${sunrise / 14.4}%`, width: `${Math.max(0, sunset - sunrise) / 14.4}%` }} />
          <span className="selected-window" style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }} />
          {[0, 6, 12, 18, 24].map((hour) => <i key={hour} style={{ left: `${hour / 24 * 100}%` }}><small>{String(hour).padStart(2, "0")}</small></i>)}
          {opportunities.map((item, index) => {
            const Icon = OPPORTUNITY_ICONS[item.id];
            const minute = minuteOfDay(item.peak);
            return (
              <button
                type="button"
                key={item.id}
                className="opportunity-node"
                data-row={index % 2}
                aria-pressed={selectedId === item.id}
                aria-label={`${item.title}，峰值 ${localTime(item.peak)}，${scoreLabel(item)}`}
                title={`${item.title} · ${localTime(item.peak)}`}
                style={{ left: `${minute / 14.4}%` }}
                onClick={() => onOpportunity(item)}
              ><Icon /></button>
            );
          })}
          <input
            type="range"
            min="0"
            max="1439"
            step="15"
            value={currentMinutes}
            aria-label="选择当日查看时刻"
            aria-valuetext={`${day.shortDate} ${localTime(new Date(selectedInstant).toISOString())}`}
            onChange={(event) => onInstant(forecastInstant(`${day.date}T00:00`) + Number(event.target.value) * 60_000)}
          />
        </div>
      </div>
    </div>
  );
}

export function OpportunityPanel({ data, opportunities, selectedId, selectedInstant, onSelect }: {
  data: ForecastResponse;
  opportunities: DailyOpportunity[];
  selectedId: OpportunityKind;
  selectedInstant: number;
  onSelect: (item: DailyOpportunity) => void;
}) {
  const selected = opportunities.find((item) => item.id === selectedId) ?? opportunities[0];
  const Icon = OPPORTUNITY_ICONS[selected.id];
  const scored = opportunities.filter((item) => item.score !== null);
  const best = scored.reduce<DailyOpportunity | null>((current, item) => !current || (item.score ?? -1) > (current.score ?? -1) ? item : current, null);
  const availableCount = scored.filter((item) => (item.score ?? 0) >= 42).length;
  const fieldPoint = closestHour(data.hourly, new Date(selectedInstant).toISOString());
  return (
    <aside className="inspector agenda-inspector" aria-label="每日拍摄机会面板">
      <header className="inspector-header">
        <div className="scene-title"><span><Sparkles size={18} /></span><div><small>DAILY PHOTO AGENDA</small><h1>每日拍摄机会</h1></div></div>
        <span className="data-fresh"><i /> {availableCount} 个可关注</span>
      </header>
      <div className="inspector-scroll" id="workspace-detail" role="tabpanel">
        <section className="agenda-summary">
          <div><span>所选日期共 {opportunities.length} 个窗口</span><strong>{best ? `最佳：${best.title} ${best.score}/100` : "正在等待可靠预测"}</strong></div>
          <p>低分机会不会被隐藏；“暂无”表示数据缺失或超出有效期，不等于 0 分。</p>
        </section>
        <div className="opportunity-list" aria-label="按时间排序的拍摄机会">
          {opportunities.map((item) => {
            const ItemIcon = OPPORTUNITY_ICONS[item.id];
            return (
              <button type="button" key={item.id} aria-pressed={selected.id === item.id} data-status={item.status} onClick={() => onSelect(item)}>
                <span className="opportunity-icon"><ItemIcon /></span>
                <span className="opportunity-copy"><strong>{item.title}</strong><small>{localTime(item.start)}–{localTime(item.end)} · 峰值 {localTime(item.peak)}</small></span>
                <span className="opportunity-score"><strong>{scoreLabel(item)}</strong><small>{STATUS_LABEL[item.status]}</small></span>
              </button>
            );
          })}
        </div>
        <section className="selected-opportunity workspace-card" aria-live="polite">
          <header>
            <span className="selected-opportunity-icon"><Icon /></span>
            <div><small>SELECTED · {localTime(selected.peak)}</small><h2>{selected.title}</h2></div>
            <span className={`selected-score status-${selected.status}`}><strong>{scoreLabel(selected)}</strong><small>{selected.scoreType === "geometry-only" ? "确定性几何" : "机会指数"}</small></span>
          </header>
          <p>{selected.summary}</p>
          <div className="opportunity-details">
            {selected.details.map((detail) => <span key={detail.label}><small>{detail.label}</small><strong>{detail.value}</strong></span>)}
            {selected.direction && <span><small>地图方向</small><strong>{selected.direction.label} · {compass(selected.direction.azimuth)}</strong></span>}
            <span><small>预测可信度</small><strong>{selected.confidence === null ? "暂无" : `${selected.confidence}/100`}</strong></span>
          </div>
          <p className="method-inline"><AlertTriangle /> {selected.limitation}</p>
        </section>
        <FieldBriefing point={fieldPoint} label={`${localTime(new Date(selectedInstant).toISOString())} 时刻`} elevation={data.location.elevation} />
        <SourceDisclosure data={data} includeSpaceWeather />
        <p className="inspector-disclaimer">机会指数用于摄影计划，不是统计概率，也不替代气象灾害预警与现场安全判断。</p>
      </div>
    </aside>
  );
}

