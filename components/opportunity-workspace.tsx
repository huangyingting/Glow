"use client";

import { AlertTriangle, CloudFog, Compass, MoonStar, Rainbow, Sparkles, Star, Sun, Sunrise, Sunset, Telescope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DailyOpportunity, DayForecast, ForecastResponse, OpportunityKind, SpaceWeatherResponse } from "@/lib/types";
import { CatalogHead, DateTabs, DockAstro, FieldBriefing, PanelCard, ScoreDial, SourceDisclosure, closestHour, compass, forecastInstant, localTime, minuteOfDay } from "@/components/workspace-common";

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

function scoreLabel(item: DailyOpportunity) {
  if (item.scoreType === "geometry-only") return "几何时刻";
  return item.score === null ? "暂无" : `${item.score}/100`;
}

/** Left rail: every window of the selected day, always visible without scrolling the detail panel. */
export function OpportunityCatalog({ opportunities, selectedId, onSelect }: {
  opportunities: DailyOpportunity[];
  selectedId: OpportunityKind;
  onSelect: (item: DailyOpportunity) => void;
}) {
  const scored = opportunities.filter((item) => item.score !== null);
  const best = scored.reduce<DailyOpportunity | null>((current, item) => !current || (item.score ?? -1) > (current.score ?? -1) ? item : current, null);
  const worthwhile = scored.filter((item) => (item.score ?? 0) >= 42).length;
  return (
    <section className="catalog-rail" aria-label="每日拍摄机会列表">
      <CatalogHead icon={Sparkles} eyebrow="DAILY AGENDA" title="每日拍摄机会" badge={`${worthwhile} 个可关注`} />
      <div className="catalog-scroll">
        <p className="catalog-summary">
          <strong>{best ? `最佳 ${best.title} ${best.score}/100` : "正在等待可靠预测"}</strong>
          <span>共 {opportunities.length} 个窗口，低分机会不会被隐藏；“暂无”表示数据缺失或超出有效期，不等于 0 分。</span>
        </p>
        <div className="opportunity-list" aria-label="按时间排序的拍摄机会">
          {opportunities.map((item) => {
            const ItemIcon = OPPORTUNITY_ICONS[item.id];
            return (
              <button type="button" key={item.id} aria-pressed={selectedId === item.id} data-status={item.status} onClick={() => onSelect(item)}>
                <span className="opportunity-icon"><ItemIcon /></span>
                <span className="opportunity-copy"><strong>{item.title}</strong><small>{localTime(item.start)}–{localTime(item.end)} · 峰值 {localTime(item.peak)}</small></span>
                <span className="opportunity-score"><strong>{scoreLabel(item)}</strong><small>{STATUS_LABEL[item.status]}</small></span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Bottom dock: seven days plus a full-width 24 hour clock carrying every window of the day. */
export function OpportunityDock({ data, day, dayIndex, opportunities, selectedId, selectedInstant, onDay, onOpportunity, onInstant }: {
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
  const currentMinutes = minuteOfDay(new Date(selectedInstant).toISOString());
  const sunrise = minuteOfDay(day.sunrise);
  const sunset = minuteOfDay(day.sunset);
  const selected = opportunities.find((item) => item.id === selectedId) ?? opportunities[0];
  const start = minuteOfDay(selected.start);
  const end = minuteOfDay(selected.end);
  const windowWidth = end >= start ? (end - start) / 14.4 : (1440 - start) / 14.4;
  const SelectedIcon = OPPORTUNITY_ICONS[selected.id];
  return (
    <div className="planner-timeline opportunity-dock" aria-label="日期与每日机会时间轴">
      <div className="dock-lead">
        <span className="dock-eyebrow"><SelectedIcon size={12} /> {selected.shortTitle}</span>
        <strong>{localTime(new Date(selectedInstant).toISOString())}</strong>
        <small>{day.shortDate} · 窗口 {localTime(selected.start)}–{localTime(selected.end)}</small>
      </div>
      <div className="dock-main">
        <DateTabs data={data} selected={dayIndex} onSelect={onDay} label="七天机会日期" />
        <div className="clock-track">
          <span className="daylight-band" style={{ left: `${sunrise / 14.4}%`, width: `${Math.max(0, sunset - sunrise) / 14.4}%` }} />
          <span className="selected-window" style={{ left: `${start / 14.4}%`, width: `${windowWidth}%` }} />
          <span className="clock-cursor" aria-hidden="true" style={{ left: `${currentMinutes / 14.4}%` }} />
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => <i key={hour} style={{ left: `${hour / 24 * 100}%` }}><small>{String(hour).padStart(2, "0")}</small></i>)}
          {opportunities.map((item, index) => {
            const Icon = OPPORTUNITY_ICONS[item.id];
            return (
              <button
                type="button"
                key={item.id}
                className="opportunity-node"
                data-row={index % 2}
                data-status={item.status}
                aria-pressed={selectedId === item.id}
                aria-label={`${item.title}，峰值 ${localTime(item.peak)}，${scoreLabel(item)}`}
                title={`${item.title} · ${localTime(item.peak)}`}
                style={{ left: `${minuteOfDay(item.peak) / 14.4}%` }}
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
      <DockAstro day={day} />
    </div>
  );
}

/** Right inspector: everything about the one window the photographer is committing to. */
export function OpportunityPanel({ data, opportunities, selectedId, selectedInstant, spaceWeatherStatus, onSelect }: {
  data: ForecastResponse;
  opportunities: DailyOpportunity[];
  selectedId: OpportunityKind;
  selectedInstant: number;
  spaceWeatherStatus?: SpaceWeatherResponse["status"];
  onSelect: (item: DailyOpportunity) => void;
}) {
  const selected = opportunities.find((item) => item.id === selectedId) ?? opportunities[0];
  const Icon = OPPORTUNITY_ICONS[selected.id];
  const fieldPoint = closestHour(data.hourly, new Date(selectedInstant).toISOString());
  const index = opportunities.findIndex((item) => item.id === selected.id);
  const step = (delta: number) => onSelect(opportunities[(index + delta + opportunities.length) % opportunities.length]);
  return (
    <aside className="inspector agenda-inspector" aria-label="所选拍摄机会详情">
      <header className="inspector-head">
        <div><small>SELECTED WINDOW</small><strong>峰值 {localTime(selected.peak)}</strong></div>
        <span className="inspector-steppers">
          <button type="button" aria-label="上一个拍摄机会" onClick={() => step(-1)}>‹</button>
          <button type="button" aria-label="下一个拍摄机会" onClick={() => step(1)}>›</button>
        </span>
      </header>
      <div className="inspector-scroll" id="workspace-detail" role="tabpanel">
        <section className="selected-opportunity" aria-live="polite">
          <div className="detail-title"><span className="inspector-icon"><Icon size={17} /></span><h2>{selected.title}</h2></div>
          <div className="detail-headline">
            <ScoreDial
              percent={selected.score ?? 0}
              primary={selected.scoreType === "geometry-only" ? "几何" : selected.score === null ? "暂无" : String(selected.score)}
              caption={selected.scoreType === "geometry-only" ? "确定性时刻" : "机会指数"}
              tone={selected.status}
              label={`${selected.title} ${scoreLabel(selected)}，${STATUS_LABEL[selected.status]}`}
            />
            <div>
              <span className={`status-pill status-${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
              <b>{localTime(selected.start)}–{localTime(selected.end)}</b>
              <em>预测参考度 {selected.confidence === null ? "暂无" : `${selected.confidence}/100`}</em>
            </div>
          </div>
          <p>{selected.summary}</p>
          <div className="detail-grid">
            {selected.details.map((detail) => <span key={detail.label}><small>{detail.label}</small><strong>{detail.value}</strong></span>)}
            {selected.direction && <span><small>地图方向</small><strong>{selected.direction.label} · {compass(selected.direction.azimuth)}</strong></span>}
          </div>
          <p className="method-inline"><AlertTriangle /> {selected.limitation}</p>
        </section>
        {selected.direction && (
          <PanelCard icon={Compass} title="现场朝向" meta={`${Math.round(selected.direction.azimuth)}°`}>
            <p className="card-note">地图上的虚线从观测点指向 {compass(selected.direction.azimuth)}，只表示方位角，长度不代表距离，也未计入山体与建筑遮挡。</p>
          </PanelCard>
        )}
        <FieldBriefing point={fieldPoint} label={`${localTime(new Date(selectedInstant).toISOString())} 时刻`} elevation={data.location.elevation} />
        <SourceDisclosure data={data} includeSpaceWeather spaceWeatherStatus={spaceWeatherStatus} />
        <p className="inspector-disclaimer">机会指数用于摄影计划，不是统计概率，也不替代气象灾害预警与现场安全判断。</p>
      </div>
    </aside>
  );
}
