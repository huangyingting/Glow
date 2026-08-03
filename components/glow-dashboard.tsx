"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  CircleGauge,
  CloudFog,
  CloudRain,
  CloudSun,
  Crosshair,
  Database,
  Droplets,
  Eclipse,
  Eye,
  Layers3,
  LocateFixed,
  MapPin,
  MoonStar,
  Navigation,
  Orbit,
  RefreshCw,
  Search,
  Sparkles,
  SunMedium,
  Sunrise,
  Sunset,
  Telescope,
  Thermometer,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CITIES } from "@/lib/cities";
import type {
  City,
  DayForecast,
  EclipseForecast,
  EventForecast,
  FogForecast,
  ForecastResponse,
  HourlyWeatherPoint,
  PhotographyMode,
  ScoreResult,
} from "@/lib/types";

const WeatherMap = dynamic(() => import("@/components/weather-map"), {
  ssr: false,
  loading: () => <div className="map-module-loading"><span /><p>地图引擎启动中</p></div>,
});

type LoadingState = "loading" | "updating" | "ready" | "error";
type GlowKind = "dawn" | "dusk";

interface ModeDefinition {
  id: PhotographyMode;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

const MODES: ModeDefinition[] = [
  { id: "glow", label: "朝霞 / 晚霞", shortLabel: "霞光", description: "分层云与散射", icon: Sparkles },
  { id: "fog", label: "平流雾 / 雾景", shortLabel: "雾景", description: "露点与低层输送", icon: CloudFog },
  { id: "sun", label: "日出 / 日落", shortLabel: "太阳", description: "方位与黄金时段", icon: SunMedium },
  { id: "moon", label: "月相 / 月升", shortLabel: "月亮", description: "月相与地平坐标", icon: MoonStar },
  { id: "lunar-eclipse", label: "月食", shortLabel: "月食", description: "本地可见食象", icon: Orbit },
  { id: "solar-eclipse", label: "日食", shortLabel: "日食", description: "本地遮掩与高度", icon: Eclipse },
];

const KIND_LABEL: Record<EclipseForecast["kind"], string> = {
  penumbral: "半影食",
  partial: "偏食",
  annular: "环食",
  total: "全食",
};

function localTime(value: string | null) {
  if (!value) return "—";
  if (!value.endsWith("Z")) return value.slice(11, 16);
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(value));
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function longDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function compass(value: number | null) {
  if (value === null) return "—";
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return `${directions[Math.round(value / 45) % 8]} ${Math.round(value)}°`;
}

function probabilityTone(value: number) {
  if (value >= 76) return "excellent";
  if (value >= 58) return "good";
  if (value >= 38) return "fair";
  return "low";
}

function modeScore(mode: PhotographyMode, day: DayForecast, data: ForecastResponse, glowKind: GlowKind) {
  if (mode === "glow") return day[glowKind].probability;
  if (mode === "fog") return day.fog.probability;
  if (mode === "sun") return Math.max(day.dawn.probability, day.dusk.probability);
  if (mode === "moon") {
    const clouds = [day.dusk.metrics.lowCloud, day.dusk.metrics.midCloud, day.dusk.metrics.highCloud].filter((value): value is number => value !== null);
    return Math.round(100 - (clouds.length ? clouds.reduce((sum, value) => sum + value, 0) / clouds.length : 50));
  }
  return Math.round((mode === "lunar-eclipse" ? data.astronomy.nextLunarEclipse.obscuration : data.astronomy.nextSolarEclipse.obscuration) * 100);
}

function LocationSearch({ current, onSelect, onLocate }: { current: City; onSelect: (city: City) => void; onLocate: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return CITIES.slice(0, 9);
    return CITIES.filter((city) => `${city.name}${city.province}${city.region}${city.id}`.toLowerCase().includes(keyword)).slice(0, 10);
  }, [query]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, []);

  return (
    <div className="workspace-location" ref={rootRef}>
      <div className="workspace-search">
        <Search size={16} />
        <input
          aria-label="搜索中国城市"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          placeholder={`${current.name} · 搜索城市或在地图落点`}
        />
        {query ? <button type="button" aria-label="清空搜索" onClick={() => setQuery("")}><X size={14} /></button> : <span className="search-shortcut">⌘ K</span>}
      </div>
      {open && (
        <div className="workspace-results" role="listbox" aria-label="城市搜索结果">
          <div className="results-caption"><span>常用观测地</span><small>{filtered.length} 个结果</small></div>
          {filtered.map((city) => (
            <button
              key={city.id}
              type="button"
              role="option"
              aria-selected={current.id === city.id}
              onClick={() => { onSelect(city); setOpen(false); setQuery(""); }}
            >
              <MapPin size={14} />
              <span><strong>{city.name}</strong><small>{city.province} · {city.latitude.toFixed(2)}°N</small></span>
              {current.id === city.id && <Check size={14} />}
            </button>
          ))}
          {!filtered.length && <p>未找到城市，可直接在地图上点击任意中国境内位置。</p>}
          <button className="result-locate" type="button" onClick={() => { onLocate(); setOpen(false); }}><LocateFixed size={15} /> 使用当前定位</button>
        </div>
      )}
    </div>
  );
}

function ModeRail({ active, onChange }: { active: PhotographyMode; onChange: (mode: PhotographyMode) => void }) {
  return (
    <nav className="mode-rail" aria-label="摄影场景">
      <span className="rail-label">PHOTO MODE</span>
      {MODES.map((mode, index) => {
        const Icon = mode.icon;
        return (
          <button key={mode.id} type="button" aria-current={active === mode.id ? "page" : undefined} onClick={() => onChange(mode.id)} title={mode.label}>
            <span className="mode-index">0{index + 1}</span><Icon size={19} /><strong>{mode.shortLabel}</strong>
            <span className="mode-tooltip"><b>{mode.label}</b><small>{mode.description}</small></span>
          </button>
        );
      })}
      <div className="rail-spacer" />
      <button type="button" className="rail-data" title="三源数据在线"><Database size={18} /><i /></button>
    </nav>
  );
}

function ScoreRing({ value, label, confidence }: { value: number; label: string; confidence?: number }) {
  return (
    <div className={`score-ring tone-${probabilityTone(value)}`} style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value}</strong><span>%</span><small>{label}</small></div>
      {confidence !== undefined && <b>置信 {confidence}</b>}
    </div>
  );
}

function CloudProfile({ event }: { event: EventForecast }) {
  const layers = [
    { label: "高云", altitude: "6–13 km", value: event.metrics.highCloud, color: "high" },
    { label: "中云", altitude: "2–7 km", value: event.metrics.midCloud, color: "mid" },
    { label: "低云", altitude: "0–2 km", value: event.metrics.lowCloud, color: "low" },
  ];
  return (
    <section className="cloud-profile compact-section">
      <header><span><Layers3 size={15} /> 云层垂直剖面</span><small>日出日前后 ± 75 min</small></header>
      <div className="cloud-stack">
        {layers.map((layer) => (
          <div key={layer.label}>
            <span>{layer.label}<small>{layer.altitude}</small></span>
            <div className={layer.color}><i style={{ width: `${layer.value ?? 0}%` }} /></div>
            <strong>{layer.value === null ? "—" : `${Math.round(layer.value)}%`}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModelAgreement({ scores }: { scores: { model: string; probability: number }[] }) {
  return (
    <section className="model-agreement compact-section">
      <header><span><CircleGauge size={15} /> 模式一致性</span><small>独立模式</small></header>
      {scores.map((score) => <div key={score.model}><span>{score.model}</span><i><b style={{ width: `${score.probability}%` }} /></i><strong>{score.probability}</strong></div>)}
    </section>
  );
}

function FactorCompact({ items }: { items: ScoreResult["contributions"] }) {
  return (
    <section className="factor-compact compact-section">
      <header><span><CircleGauge size={15} /> 关键依据</span><small>贡献值</small></header>
      <div>
        {items.slice(0, 5).map((item) => (
          <article key={item.name} className={item.direction}>
            <i />
            <span><strong>{item.name}</strong><small>{item.detail}</small></span>
            <b>{item.value > 0 ? "+" : ""}{item.value}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function Meteogram({ hourly }: { hourly: HourlyWeatherPoint[] }) {
  const width = 720;
  const left = 30;
  const step = (width - left - 10) / Math.max(hourly.length, 1);
  const temperatures = hourly.flatMap((point) => [point.temperature, point.dewPoint]).filter((value): value is number => value !== null);
  const minTemp = Math.floor(Math.min(...temperatures, 0) - 2);
  const maxTemp = Math.ceil(Math.max(...temperatures, 10) + 2);
  const temperatureY = (value: number) => 126 - ((value - minTemp) / Math.max(maxTemp - minTemp, 1)) * 47;
  const path = (key: "temperature" | "dewPoint") => hourly.flatMap((point, index) => point[key] === null ? [] : [`${index ? "L" : "M"}${left + step * (index + .5)},${temperatureY(point[key] as number)}`]).join(" ");
  return (
    <section className="meteogram compact-section">
      <header><span><CloudRain size={15} /> 逐小时气象图</span><div className="meteo-legend"><i className="temp" />气温<i className="dew" />露点</div></header>
      <div className="meteogram-scroll">
        <svg viewBox={`0 0 ${width} 178`} role="img" aria-label="选定日期逐小时云层、温度、露点和降水图">
          <text x="2" y="20" className="axis-label">H</text><text x="2" y="38" className="axis-label">M</text><text x="2" y="56" className="axis-label">L</text>
          {hourly.map((point, index) => {
            const x = left + step * index;
            return <g key={point.time}>
              {[point.highCloud, point.midCloud, point.lowCloud].map((value, layer) => <rect key={layer} x={x + 1} y={10 + layer * 18} width={Math.max(step - 2, 2)} height="13" rx="2" className={`cloud-cell layer-${layer}`} opacity={.06 + (value ?? 0) / 112} />)}
              <rect x={x + step * .25} y={160 - Math.min((point.precipitation ?? 0) * 10, 20)} width={step * .5} height={Math.min((point.precipitation ?? 0) * 10, 20)} rx="1" className="rain-bar"><title>{`${point.time.slice(11)} · 降水 ${(point.precipitation ?? 0).toFixed(1)}mm`}</title></rect>
              {index % 3 === 0 && <text x={x + step / 2} y="174" textAnchor="middle" className="hour-label">{point.time.slice(11, 13)}</text>}
            </g>;
          })}
          {[80, 103, 126].map((y) => <line key={y} x1={left} x2={width - 10} y1={y} y2={y} className="meteo-grid" />)}
          <path d={path("temperature")} className="temp-line" />
          <path d={path("dewPoint")} className="dew-line" />
          <text x="2" y="91" className="temp-value">{maxTemp}°</text><text x="2" y="127" className="temp-value">{minTemp}°</text>
          <text x="2" y="159" className="axis-label">P</text>
        </svg>
      </div>
    </section>
  );
}

function GlowPanel({ day, kind, setKind, hourly }: { day: DayForecast; kind: GlowKind; setKind: (kind: GlowKind) => void; hourly: HourlyWeatherPoint[] }) {
  const event = day[kind];
  return (
    <>
      <div className="binary-switch" role="tablist" aria-label="选择朝霞或晚霞">
        <button type="button" role="tab" aria-selected={kind === "dawn"} onClick={() => setKind("dawn")}><Sunrise size={15} /> 朝霞 <span>{day.dawn.probability}%</span></button>
        <button type="button" role="tab" aria-selected={kind === "dusk"} onClick={() => setKind("dusk")}><Sunset size={15} /> 晚霞 <span>{day.dusk.probability}%</span></button>
      </div>
      <div className="primary-readout">
        <ScoreRing value={event.probability} label={event.level} confidence={event.confidence} />
        <div><span className="readout-time">{localTime(event.time)}</span><small>{kind === "dawn" ? "日出" : "日落"}时刻</small><p>{event.summary}</p></div>
      </div>
      <div className="quick-metrics">
        <span><Eye />能见度<strong>{event.metrics.visibility === null ? "—" : `${Math.round(event.metrics.visibility / 1000)} km`}</strong></span>
        <span><Droplets />湿度<strong>{event.metrics.humidity === null ? "—" : `${Math.round(event.metrics.humidity)}%`}</strong></span>
        <span><CloudRain />降水<strong>{event.metrics.precipitationProbability === null ? "—" : `${Math.round(event.metrics.precipitationProbability)}%`}</strong></span>
      </div>
      <CloudProfile event={event} />
      <Meteogram hourly={hourly} />
      <FactorCompact items={event.contributions} />
      <ModelAgreement scores={event.modelScores} />
    </>
  );
}

function FogPanel({ fog, hourly }: { fog: FogForecast; hourly: HourlyWeatherPoint[] }) {
  const spread = fog.metrics.temperature !== null && fog.metrics.dewPoint !== null ? fog.metrics.temperature - fog.metrics.dewPoint : null;
  return (
    <>
      <div className="primary-readout fog-readout">
        <ScoreRing value={fog.probability} label={`${fog.level}潜势`} confidence={fog.confidence} />
        <div><span className="readout-time">{localTime(fog.time)}</span><small>最佳雾景窗口</small><p>{fog.summary}</p></div>
      </div>
      <div className="quick-metrics four">
        <span><Thermometer />露点差<strong>{spread === null ? "—" : `${spread.toFixed(1)}°`}</strong></span>
        <span><Droplets />湿度<strong>{fog.metrics.humidity === null ? "—" : `${Math.round(fog.metrics.humidity)}%`}</strong></span>
        <span><Wind />风速<strong>{fog.metrics.windSpeed === null ? "—" : `${Math.round(fog.metrics.windSpeed)} km/h`}</strong></span>
        <span><Eye />能见度<strong>{fog.metrics.visibility === null ? "—" : `${(fog.metrics.visibility / 1000).toFixed(1)} km`}</strong></span>
      </div>
      <div className="method-alert"><AlertTriangle size={14} /><span><strong>雾景潜势，不等同于局地平流雾预报</strong>山谷、水面距离和坡向尚未进入模型，落点时应结合实际地形。</span></div>
      <Meteogram hourly={hourly} />
      <FactorCompact items={fog.contributions} />
      <ModelAgreement scores={fog.modelScores} />
    </>
  );
}

function SunArc({ day }: { day: DayForecast }) {
  const solar = day.solar;
  return (
    <section className="sun-arc-card">
      <div className="sun-arc-visual" aria-hidden="true"><span className="sun-path" /><i /><b /></div>
      <div className="sun-times">
        <span><small>蓝调开始</small><strong>{localTime(solar.morningBlueStart)}</strong></span>
        <span><small>日出</small><strong>{localTime(day.sunrise)}</strong><em>{compass(solar.sunriseAzimuth)}</em></span>
        <span><small>日落</small><strong>{localTime(day.sunset)}</strong><em>{compass(solar.sunsetAzimuth)}</em></span>
        <span><small>蓝调结束</small><strong>{localTime(solar.eveningBlueEnd)}</strong></span>
      </div>
    </section>
  );
}

function SunPanel({ day, hourly }: { day: DayForecast; hourly: HourlyWeatherPoint[] }) {
  return (
    <>
      <SunArc day={day} />
      <div className="solar-window-grid">
        <article><Sunrise /><span><small>晨间金色时段</small><strong>{localTime(day.sunrise)} – {localTime(day.solar.morningGoldenEnd)}</strong></span></article>
        <article><Sunset /><span><small>傍晚金色时段</small><strong>{localTime(day.solar.eveningGoldenStart)} – {localTime(day.sunset)}</strong></span></article>
        <article><SunMedium /><span><small>日照长度</small><strong>{Math.floor(day.solar.daylightMinutes / 60)}h {day.solar.daylightMinutes % 60}m</strong></span></article>
      </div>
      <Meteogram hourly={hourly} />
      <p className="panel-footnote">地图中的黄色与红色虚线分别指向日出、日落方位；未计入山体和建筑遮挡。</p>
    </>
  );
}

function MoonPanel({ data, day, hourly }: { data: ForecastResponse; day: DayForecast; hourly: HourlyWeatherPoint[] }) {
  const moon = data.astronomy.moon;
  return (
    <>
      <section className="moon-readout">
        <div className="moon-disc" style={{ "--moon-light": `${moon.illumination}%` } as React.CSSProperties}><i /></div>
        <div><span className="scene-eyebrow">CURRENT MOON</span><h3>{moon.phaseName}</h3><strong>{moon.illumination}% <small>照明</small></strong><p>{moon.altitude > 0 ? `当前位于地平线上 ${moon.altitude.toFixed(1)}°` : `当前位于地平线下 ${Math.abs(moon.altitude).toFixed(1)}°`}</p></div>
      </section>
      <div className="quick-metrics four">
        <span><ArrowDown />月升<strong>{localTime(moon.rise)}</strong></span>
        <span><ArrowDown className="up-icon" />月落<strong>{localTime(moon.set)}</strong></span>
        <span><Navigation />方位<strong>{compass(moon.azimuth)}</strong></span>
        <span><Telescope />高度<strong>{moon.altitude.toFixed(1)}°</strong></span>
      </div>
      <section className="night-condition compact-section"><header><span><CloudSun size={15} /> 当晚天气背景</span><small>{day.shortDate}</small></header><p>晚霞时段云量可作为入夜后的短期参考；远离该时刻后应以逐小时气象图为准。</p></section>
      <Meteogram hourly={hourly} />
    </>
  );
}

function EclipsePanel({ event, type, data }: { event: EclipseForecast; type: "lunar" | "solar"; data: ForecastResponse }) {
  const isLunar = type === "lunar";
  return (
    <>
      <section className={`eclipse-hero ${isLunar ? "lunar" : "solar"}`}>
        <div className="eclipse-symbol"><span /><i /></div>
        <span className="scene-eyebrow">NEXT LOCALLY VISIBLE EVENT</span>
        <h3>{KIND_LABEL[event.kind]} · {isLunar ? "月食" : "日食"}</h3>
        <p>{data.location.name}定位点的下一次峰值可见事件</p>
      </section>
      <div className="eclipse-primary">
        <ScoreRing value={Math.round(event.obscuration * 100)} label="最大遮掩" />
        <div><small>峰值时间 · 北京时间</small><strong>{longDateTime(event.peak)}</strong><p>天体高度 {event.altitude.toFixed(1)}° · {event.visible ? "地平线上可见" : "峰值不可见"}</p></div>
      </div>
      <div className="eclipse-timeline">
        <span><i />初始<strong>{localDateTime(event.begin)}</strong></span><b /><span><i />食甚<strong>{localDateTime(event.peak)}</strong></span><b /><span><i />结束<strong>{localDateTime(event.end)}</strong></span>
      </div>
      <div className="method-alert"><AlertTriangle size={14} /><span><strong>天文几何可长期精确计算，天气不能</strong>食象日期来自 Astronomy Engine；云量只能在进入七天天气窗口后评估。</span></div>
      {!isLunar && <p className="safety-note">严禁用肉眼或普通减光镜直视太阳，拍摄日食必须使用合格的太阳滤镜。</p>}
    </>
  );
}

function SourceDisclosure({ data }: { data: ForecastResponse }) {
  return (
    <details className="source-disclosure">
      <summary><span><Database size={14} /> 数据与模型</span><ChevronDown size={14} /></summary>
      <div>
        {data.sources.map((source) => <p key={source.id}><i className={source.status} /><span><strong>{source.name}</strong><small>{source.role}</small></span></p>)}
        <p><i className="available" /><span><strong>Astronomy Engine</strong><small>VSOP87 / 天体位置与食象搜索</small></span></p>
      </div>
    </details>
  );
}

function Inspector({ data, day, mode, glowKind, setGlowKind, hourly }: { data: ForecastResponse; day: DayForecast; mode: PhotographyMode; glowKind: GlowKind; setGlowKind: (kind: GlowKind) => void; hourly: HourlyWeatherPoint[] }) {
  const definition = MODES.find((item) => item.id === mode) ?? MODES[0];
  const Icon = definition.icon;
  return (
    <aside className="inspector" aria-label={`${definition.label}专业数据面板`}>
      <header className="inspector-header">
        <div className="scene-title"><span><Icon size={18} /></span><div><small>ACTIVE SCENE</small><h2>{definition.label}</h2></div></div>
        <span className="data-fresh"><i /> {new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(data.generatedAt))}</span>
      </header>
      <div className="inspector-scroll">
        {mode === "glow" && <GlowPanel day={day} kind={glowKind} setKind={setGlowKind} hourly={hourly} />}
        {mode === "fog" && <FogPanel fog={day.fog} hourly={hourly} />}
        {mode === "sun" && <SunPanel day={day} hourly={hourly} />}
        {mode === "moon" && <MoonPanel data={data} day={day} hourly={hourly} />}
        {mode === "lunar-eclipse" && <EclipsePanel event={data.astronomy.nextLunarEclipse} type="lunar" data={data} />}
        {mode === "solar-eclipse" && <EclipsePanel event={data.astronomy.nextSolarEclipse} type="solar" data={data} />}
        <SourceDisclosure data={data} />
        <p className="inspector-disclaimer">机会指数用于摄影计划，不替代气象灾害预警。山体、建筑和局地微气候仍需现场判断。</p>
      </div>
    </aside>
  );
}

function DayTimeline({ data, selected, mode, glowKind, onSelect }: { data: ForecastResponse; selected: number; mode: PhotographyMode; glowKind: GlowKind; onSelect: (index: number) => void }) {
  return (
    <div className="map-timeline" role="tablist" aria-label="七天摄影窗口">
      <div className="timeline-now"><span>7 DAY</span><strong>机会窗口</strong></div>
      <div className="timeline-days">
        {data.days.map((day, index) => {
          const value = modeScore(mode, day, data, glowKind);
          return <button type="button" role="tab" aria-selected={selected === index} key={day.date} onClick={() => onSelect(index)}><span>{index === data.recommendedIndex ? "推荐" : day.weekday}</span><strong>{day.shortDate}</strong><i><b style={{ height: `${Math.max(value * .25, 3)}px` }} /></i><em>{value}</em></button>;
        })}
      </div>
    </div>
  );
}

export function GlowDashboard() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [status, setStatus] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PhotographyMode>("glow");
  const [glowKind, setGlowKind] = useState<GlowKind>("dusk");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const requestRef = useRef(0);

  const loadForecast = useCallback(async (url: string) => {
    const request = ++requestRef.current;
    setStatus((current) => current === "loading" ? "loading" : "updating");
    setError(null);
    try {
      const response = await fetch(url);
      const payload = await response.json() as ForecastResponse | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "天气数据加载失败");
      if (request !== requestRef.current) return;
      setData(payload);
      setSelectedIndex(payload.recommendedIndex);
      setStatus("ready");
    } catch (reason) {
      if (request !== requestRef.current) return;
      setError(reason instanceof Error ? reason.message : "天气数据加载失败");
      setStatus((current) => current === "updating" ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadForecast("/api/forecast?city=beijing"), 0);
    return () => window.clearTimeout(task);
  }, [loadForecast]);

  const current = data?.location ?? CITIES[0];
  const day = data?.days[selectedIndex] ?? null;
  const hourly = useMemo(() => data && day ? data.hourly.filter((point) => point.time.startsWith(day.date)) : [], [data, day]);
  const score = data && day ? modeScore(mode, day, data, glowKind) : 0;
  const pickCoordinate = useCallback((latitude: number, longitude: number) => {
    void loadForecast(`/api/forecast?lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}&name=${encodeURIComponent("地图落点")}`);
  }, [loadForecast]);
  const locate = () => {
    if (!navigator.geolocation) { setError("当前浏览器不支持定位"); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pickCoordinate(coords.latitude, coords.longitude),
      () => setError("无法获取位置，请检查浏览器定位权限"),
      { maximumAge: 600000, timeout: 8000 },
    );
  };

  const showSunDirections = mode === "glow" || mode === "sun";
  const showMoonDirection = mode === "moon" || mode === "lunar-eclipse";
  return (
    <main className="photo-workspace">
      <header className="workspace-header">
        <a className="workspace-brand" href="#workspace" aria-label="霁光摄影天气工作台"><BrandMark /><span className="product-edition">PRO</span></a>
        <LocationSearch current={current} onSelect={(city) => void loadForecast(`/api/forecast?city=${city.id}`)} onLocate={locate} />
        <div className="header-status">
          <span className={status === "updating" ? "syncing" : ""}><RefreshCw size={14} />{status === "updating" ? "重算中" : "数据同步"}</span>
          <button type="button" onClick={locate} aria-label="定位我的位置"><Crosshair size={17} /></button>
        </div>
      </header>

      <div className="workspace-body" id="workspace">
        <ModeRail active={mode} onChange={setMode} />
        <section className="map-stage">
          <WeatherMap
            location={current}
            mode={mode}
            score={score}
            sunriseAzimuth={showSunDirections ? day?.solar.sunriseAzimuth ?? null : null}
            sunsetAzimuth={showSunDirections ? day?.solar.sunsetAzimuth ?? null : null}
            moonAzimuth={showMoonDirection ? data?.astronomy.moon.azimuth ?? null : null}
            onPick={pickCoordinate}
          />
          <div className="map-instruction"><MapPin size={15} /><span><strong>单击地图放置观测点</strong><small>或拖动标记精确调整</small></span></div>
          {(showSunDirections || showMoonDirection) && (
            <div className="map-direction-legend">
              {showSunDirections && <><span className="sunrise-line">日出 {compass(day?.solar.sunriseAzimuth ?? null)}</span><span className="sunset-line">日落 {compass(day?.solar.sunsetAzimuth ?? null)}</span></>}
              {showMoonDirection && <span className="moon-line">月亮 {compass(data?.astronomy.moon.azimuth ?? null)}</span>}
            </div>
          )}
          <div className="coordinate-hud">
            <span><i /> {current.name}</span><strong>{current.latitude.toFixed(4)}°N</strong><strong>{current.longitude.toFixed(4)}°E</strong><small>WGS 84</small>
          </div>
          {day && data && (
            <div className="map-weather-strip">
              <span><Thermometer />{hourly[12]?.temperature?.toFixed(0) ?? "—"}°<small>气温</small></span>
              <span><Wind />{hourly[12]?.windSpeed?.toFixed(0) ?? "—"}<small>km/h</small></span>
              <span><Eye />{day[glowKind].metrics.visibility === null ? "—" : Math.round(day[glowKind].metrics.visibility / 1000)}<small>km 能见度</small></span>
              <span><CloudSun />{day[glowKind].metrics.lowCloud === null ? "—" : Math.round(day[glowKind].metrics.lowCloud)}%<small>低云</small></span>
            </div>
          )}
          {data && <DayTimeline data={data} selected={selectedIndex} mode={mode} glowKind={glowKind} onSelect={setSelectedIndex} />}
          {status === "updating" && <div className="map-recalculating"><RefreshCw />正在为新落点重算 168 小时数据</div>}
        </section>

        {data && day ? <Inspector data={data} day={day} mode={mode} glowKind={glowKind} setGlowKind={setGlowKind} hourly={hourly} /> : (
          <aside className="inspector inspector-loading">
            <div className="loading-heading"><span /><div><i /><b /></div></div><div className="loading-score" /><div className="loading-block" /><div className="loading-block short" />
            {status === "error" && <div className="workspace-error"><AlertTriangle /><h2>数据暂时不可用</h2><p>{error}</p><button type="button" onClick={() => void loadForecast("/api/forecast?city=beijing")}>重新连接</button></div>}
          </aside>
        )}
      </div>
      {error && data && <div className="workspace-toast" role="alert"><AlertTriangle size={16} /><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={14} /></button></div>}
    </main>
  );
}
