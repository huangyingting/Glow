"use client";

import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CloudSun,
  Crosshair,
  Database,
  Droplets,
  ExternalLink,
  Eye,
  Gauge,
  Info,
  LocateFixed,
  MapPin,
  Menu,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sunrise,
  Sunset,
  Wind,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CITIES } from "@/lib/cities";
import type { City, DayForecast, EventForecast, ForecastResponse, ScoreResult } from "@/lib/types";

type LoadingState = "loading" | "updating" | "ready" | "error";

const MAP_CITY_IDS = new Set([
  "beijing", "shanghai", "guangzhou", "chengdu", "chongqing", "hangzhou", "wuhan", "xian",
  "kunming", "lhasa", "urumqi", "lanzhou", "shenyang", "harbin", "haikou", "nanning", "qingdao",
]);

function timeOnly(value: string) {
  return value.slice(11, 16);
}

function probabilityTone(value: number) {
  if (value >= 76) return "excellent";
  if (value >= 58) return "good";
  if (value >= 38) return "fair";
  return "low";
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function LocationPicker({
  current,
  onSelect,
  onLocate,
}: {
  current: City | null;
  onSelect: (city: City) => void;
  onLocate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CITIES.slice(0, 12);
    return CITIES.filter((city) => `${city.name}${city.province}${city.region}${city.id}`.toLowerCase().includes(needle)).slice(0, 12);
  }, [query]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div className="location-picker" ref={rootRef}>
      <button className="location-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="location-trigger-icon"><MapPin size={18} /></span>
        <span>
          <small>当前观测地</small>
          <strong>{current?.name ?? "选择城市"}</strong>
        </span>
        <ChevronDown size={17} className={open ? "rotate" : ""} />
      </button>
      {open && (
        <div className="location-popover">
          <div className="search-box">
            <Search size={17} />
            <input
              autoFocus
              aria-label="搜索中国城市"
              placeholder="搜索城市、省份或区域"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && <button type="button" aria-label="清空搜索" onClick={() => setQuery("")}><X size={15} /></button>}
          </div>
          <div className="location-list" role="listbox" aria-label="城市列表">
            {filtered.map((city) => (
              <button
                type="button"
                role="option"
                aria-selected={current?.id === city.id}
                key={city.id}
                onClick={() => { onSelect(city); setOpen(false); setQuery(""); }}
              >
                <span><strong>{city.name}</strong><small>{city.province} · {city.region}</small></span>
                {current?.id === city.id ? <Check size={16} /> : <ArrowRight size={15} />}
              </button>
            ))}
            {!filtered.length && <p className="empty-search">暂未收录该城市，可以使用“定位”获取任意境内坐标。</p>}
          </div>
          <button className="locate-action" type="button" onClick={() => { onLocate(); setOpen(false); }}>
            <LocateFixed size={17} /> 使用我的当前位置
          </button>
        </div>
      )}
    </div>
  );
}

function AtmosphericPreview({ data, day }: { data: ForecastResponse; day: DayForecast }) {
  const event = day.dusk;
  return (
    <div className={`atmosphere-card tone-${probabilityTone(event.probability)}`}>
      <div className="atmosphere-sky" aria-hidden="true">
        <div className="sky-grain" />
        <div className="sun-orb" />
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
        <div className="horizon-ridge" />
      </div>
      <div className="atmosphere-top">
        <span><span className="live-dot" /> LIVE FORECAST</span>
        <span>{day.shortDate}</span>
      </div>
      <div className="atmosphere-copy">
        <p>{data.location.name} · 今晚晚霞</p>
        <div className="hero-probability"><strong>{event.probability}</strong><span>%</span></div>
        <div className="hero-grade"><Sparkles size={15} /> {event.level}</div>
      </div>
      <div className="atmosphere-bottom">
        <span><Sunset size={16} /> 日落 {timeOnly(event.time)}</span>
        <span>置信度 {event.confidence}%</span>
      </div>
    </div>
  );
}

function LoadingPreview() {
  return (
    <div className="atmosphere-card loading-preview" aria-label="正在连接天气数据">
      <div className="loading-sun" />
      <div className="loading-lines"><span /><span /><span /></div>
      <p><RefreshCw size={17} /> 正在对齐天空数据</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function EventCard({ event }: { event: EventForecast }) {
  const isDawn = event.kind === "dawn";
  const metrics = event.metrics;
  return (
    <article className={`event-card ${isDawn ? "dawn-card" : "dusk-card"}`}>
      <div className="event-card-head">
        <div className="event-title">
          <span className="event-icon">{isDawn ? <Sunrise /> : <Sunset />}</span>
          <div><small>{isDawn ? "MORNING GLOW" : "EVENING GLOW"}</small><h3>{isDawn ? "朝霞" : "晚霞"}</h3></div>
        </div>
        <span className="event-time">{timeOnly(event.time)}</span>
      </div>
      <div className="event-score-row">
        <div className="event-score"><strong>{event.probability}</strong><span>%</span></div>
        <div className="event-verdict"><span className={`tone-dot ${probabilityTone(event.probability)}`} /> <strong>{event.level}</strong><small>模型置信度 {event.confidence}%</small></div>
      </div>
      <p className="event-summary">{event.summary}</p>
      <div className="confidence-track" aria-label={`置信度 ${event.confidence}%`}><span style={{ width: `${event.confidence}%` }} /></div>
      <div className="metrics-grid">
        <Metric icon={<CloudSun size={17} />} label="中高云" value={`${Math.round(((metrics.midCloud ?? 0) + (metrics.highCloud ?? 0)) / 2)}%`} />
        <Metric icon={<Droplets size={17} />} label="低云" value={metrics.lowCloud === null ? "—" : `${Math.round(metrics.lowCloud)}%`} />
        <Metric icon={<Eye size={17} />} label="能见度" value={metrics.visibility === null ? "—" : `${Math.round(metrics.visibility / 1000)} km`} />
        <Metric icon={<Wind size={17} />} label="降水" value={metrics.precipitationProbability === null ? `${(metrics.precipitation ?? 0).toFixed(1)} mm` : `${Math.round(metrics.precipitationProbability)}%`} />
      </div>
      <div className="model-comparison">
        {event.modelScores.map((model) => (
          <div key={model.model}>
            <span>{model.model}</span>
            <div><i style={{ width: `${model.probability}%` }} /></div>
            <strong>{model.probability}%</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ChinaMap({ current, onSelect }: { current: City; onSelect: (city: City) => void }) {
  const points = CITIES.filter((city) => MAP_CITY_IDS.has(city.id));
  const position = (city: City) => ({
    left: `${7 + ((city.longitude - 73) / 62) * 86}%`,
    top: `${7 + ((54 - city.latitude) / 36) * 81}%`,
  });

  return (
    <div className="map-card">
      <div className="panel-heading">
        <div><span className="section-kicker">LOCATION</span><h3>从地图选择天空</h3></div>
        <span className="map-caption"><Crosshair size={14} /> 城市示意投影</span>
      </div>
      <div className="china-map" aria-label="中国主要城市选择地图">
        <svg className="map-grid" viewBox="0 0 680 420" aria-hidden="true">
          <defs>
            <linearGradient id="mapFill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#f6c8a1" stopOpacity=".66" />
              <stop offset=".55" stopColor="#eb8f74" stopOpacity=".36" />
              <stop offset="1" stopColor="#9b72ae" stopOpacity=".35" />
            </linearGradient>
            <filter id="mapShadow"><feGaussianBlur stdDeviation="10" /></filter>
          </defs>
          <path className="map-shadow" d="M80 115L151 67 232 82 288 64 342 91 386 88 428 112 481 96 518 123 566 120 591 155 636 179 625 218 594 240 584 273 550 284 536 323 501 317 468 354 428 342 394 372 356 353 327 329 292 344 262 318 224 315 204 282 166 278 144 245 107 230 86 198 44 179 54 141Z" />
          <path className="map-land" d="M80 115L151 67 232 82 288 64 342 91 386 88 428 112 481 96 518 123 566 120 591 155 636 179 625 218 594 240 584 273 550 284 536 323 501 317 468 354 428 342 394 372 356 353 327 329 292 344 262 318 224 315 204 282 166 278 144 245 107 230 86 198 44 179 54 141Z" />
          <path className="map-line" d="M150 68L176 137 122 196M232 82L238 160 171 210M288 64L310 137 258 206 289 275M386 88L370 155 423 207 390 278 428 342M481 96L464 158 520 208 472 264 501 317M566 120L548 177 594 240" />
          <ellipse className="map-land" cx="520" cy="372" rx="23" ry="12" />
        </svg>
        {points.map((city) => {
          const active = current.id === city.id || (current.id.startsWith("coordinate") && city.id === CITIES.reduce((best, next) => {
            const bd = (best.latitude - current.latitude) ** 2 + (best.longitude - current.longitude) ** 2;
            const nd = (next.latitude - current.latitude) ** 2 + (next.longitude - current.longitude) ** 2;
            return nd < bd ? next : best;
          }).id);
          return (
            <button
              type="button"
              key={city.id}
              style={position(city)}
              className={`map-point ${active ? "active" : ""}`}
              onClick={() => onSelect(city)}
              aria-label={`查看${city.name}`}
              title={city.name}
            >
              <span />
              {(active || ["beijing", "shanghai", "chengdu", "guangzhou", "urumqi"].includes(city.id)) && <small>{city.name}</small>}
            </button>
          );
        })}
        <div className="map-location-chip"><MapPin size={14} /><span>{current.name}<small>{current.latitude.toFixed(2)}°N · {current.longitude.toFixed(2)}°E</small></span></div>
      </div>
    </div>
  );
}

function TrendChart({ days, selectedIndex, onSelect }: { days: DayForecast[]; selectedIndex: number; onSelect: (index: number) => void }) {
  const width = 720;
  const height = 224;
  const paddingX = 38;
  const plotBottom = 174;
  const plotHeight = 130;
  const x = (index: number) => paddingX + index * ((width - paddingX * 2) / (days.length - 1));
  const y = (value: number) => plotBottom - (value / 100) * plotHeight;
  const line = (kind: "dawn" | "dusk") => days.map((day, index) => `${index ? "L" : "M"}${x(index)},${y(day[kind].probability)}`).join(" ");
  const area = `${line("dusk")} L${x(days.length - 1)},${plotBottom} L${x(0)},${plotBottom} Z`;

  return (
    <div className="trend-card">
      <div className="panel-heading">
        <div><span className="section-kicker">7-DAY OUTLOOK</span><h3>未来七天霞光趋势</h3></div>
        <div className="chart-legend"><span><i className="dawn-legend" />朝霞</span><span><i className="dusk-legend" />晚霞</span></div>
      </div>
      <div className="trend-chart-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="未来七天朝霞和晚霞概率折线图">
          <defs>
            <linearGradient id="duskArea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9795d" stopOpacity=".26" /><stop offset="1" stopColor="#e9795d" stopOpacity="0" /></linearGradient>
          </defs>
          {[25, 50, 75, 100].map((value) => <line className="chart-grid-line" key={value} x1={paddingX} x2={width - paddingX} y1={y(value)} y2={y(value)} />)}
          <path className="chart-area" d={area} />
          <path className="chart-line dawn-line" d={line("dawn")} />
          <path className="chart-line dusk-line" d={line("dusk")} />
          {days.map((day, index) => (
            <g
              key={day.date}
              className={selectedIndex === index ? "selected-point" : ""}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(index); }}
              role="button"
              tabIndex={0}
              aria-label={`${day.shortDate}朝霞${day.dawn.probability}%晚霞${day.dusk.probability}%`}
            >
              {selectedIndex === index && <rect className="selection-column" x={x(index) - 34} y="22" width="68" height="169" rx="16" />}
              <circle className="chart-point dawn-point" cx={x(index)} cy={y(day.dawn.probability)} r="5" />
              <circle className="chart-point dusk-point" cx={x(index)} cy={y(day.dusk.probability)} r="5" />
              <text className="chart-day" x={x(index)} y="207" textAnchor="middle">{day.weekday}</text>
              <text className="chart-date" x={x(index)} y="221" textAnchor="middle">{day.shortDate}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function FactorList({ contributions }: { contributions: ScoreResult["contributions"] }) {
  return (
    <div className="factor-card">
      <div className="panel-heading"><div><span className="section-kicker">WHY THIS SCORE</span><h3>这次为什么有霞</h3></div><Gauge size={20} /></div>
      <div className="factor-list">
        {contributions.slice(0, 5).map((item) => (
          <div key={item.name} className={`factor ${item.direction}`}>
            <span className="factor-symbol">{item.direction === "positive" ? <Plus size={14} /> : item.direction === "negative" ? <Minus size={14} /> : <Info size={14} />}</span>
            <div><strong>{item.name}</strong><small>{item.detail}</small></div>
            <b>{item.value > 0 ? "+" : ""}{item.value}</b>
          </div>
        ))}
      </div>
      <p className="factor-note"><Info size={14} /> 每项贡献相加后再由数据完整度校正，避免缺失值制造虚假高分。</p>
    </div>
  );
}

function MethodSection({ sources }: { sources: ForecastResponse["sources"] }) {
  const providers = [
    { tag: "当前采用", name: "ECMWF IFS", detail: "强项是全球大尺度环流和中期云系。通过 Open-Meteo 无密钥接入，适合做稳定的基础模式。", meta: "全球 · 约 9–25 km · 每日 4 次", href: "https://www.ecmwf.int/en/forecasts/datasets/open-data" },
    { tag: "当前采用", name: "CMA GRAPES", detail: "中国气象局自研数值模式，在中国区域提供独立判断，用与 ECMWF 的分歧衡量不确定性。", meta: "中国优势 · 约 15 km · 每日 4 次", href: "https://data.cma.cn/en" },
    { tag: "空气成分", name: "CAMS", detail: "气溶胶和颗粒物会改变霞光散射。适量可能增色，过量则形成灰霾，因此不能简单地“越多越红”。", meta: "全球 · 大气成分 · 每日更新", href: "https://atmosphere.copernicus.eu/" },
  ];
  return (
    <section className="method-section" id="method">
      <div className="section-intro">
        <span className="section-kicker">DATA & METHOD</span>
        <h2>准确，不来自一个神奇接口。</h2>
        <p>“最准确”会随地点、预报时效和天气过程改变。霁光选择两套独立数值模式，再加入大气成分；模式越一致、时间越临近，置信度才越高。</p>
      </div>
      <div className="source-status-row">
        {sources.map((source) => <span key={source.id} className={source.status}><i />{source.name} · {source.status === "available" ? "在线" : "暂缺"}</span>)}
      </div>
      <div className="provider-grid">
        {providers.map((provider, index) => (
          <a className="provider-card" href={provider.href} target="_blank" rel="noreferrer" key={provider.name}>
            <div className="provider-number">0{index + 1}</div>
            <span className="provider-tag">{provider.tag}</span>
            <h3>{provider.name}</h3>
            <p>{provider.detail}</p>
            <div><small>{provider.meta}</small><ExternalLink size={16} /></div>
          </a>
        ))}
      </div>
      <div className="research-note">
        <Database size={22} />
        <div><strong>更高精度的中国商业方案</strong><p>彩云天气提供约 1 km / 1 分钟的临近降水能力，和风天气提供成熟的中国城市 API；两者需要密钥与商业授权，适合作为下一阶段可插拔增强源，而不是把密钥写进前端。</p></div>
        <a href="https://docs.caiyunapp.com/weather-api/" target="_blank" rel="noreferrer">查看调研 <ArrowRight size={15} /></a>
      </div>
    </section>
  );
}

function ForecastSkeleton() {
  return (
    <section className="dashboard-section skeleton-section" aria-label="正在加载预报">
      <div className="skeleton wide" />
      <div className="skeleton-tabs">{Array.from({ length: 7 }, (_, index) => <div className="skeleton" key={index} />)}</div>
      <div className="skeleton-columns"><div className="skeleton card" /><div className="skeleton card" /></div>
    </section>
  );
}

export function GlowDashboard() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentRequest = useRef(0);

  const loadForecast = useCallback(async (url: string) => {
    const request = ++currentRequest.current;
    setStatus((current) => current === "loading" ? "loading" : "updating");
    setError(null);
    try {
      const response = await fetch(url);
      const payload = await response.json() as ForecastResponse | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "天气数据加载失败");
      if (request !== currentRequest.current) return;
      setData(payload);
      setSelectedIndex(payload.recommendedIndex);
      setStatus("ready");
    } catch (reason) {
      if (request !== currentRequest.current) return;
      setError(reason instanceof Error ? reason.message : "天气数据加载失败");
      setStatus((current) => current === "updating" ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadForecast("/api/forecast?city=beijing"), 0);
    return () => window.clearTimeout(task);
  }, [loadForecast]);

  const selectCity = (city: City) => void loadForecast(`/api/forecast?city=${encodeURIComponent(city.id)}`);
  const locate = () => {
    if (!navigator.geolocation) { setError("当前浏览器不支持定位，请从城市列表中选择"); return; }
    setStatus(data ? "updating" : "loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void loadForecast(`/api/forecast?lat=${coords.latitude}&lon=${coords.longitude}&name=${encodeURIComponent("我的位置")}`),
      () => { setStatus(data ? "ready" : "error"); setError("无法获取位置，请检查浏览器定位权限"); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const selectedDay = data?.days[selectedIndex] ?? null;
  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a href="#top" className="logo-link"><BrandMark /></a>
          <nav className={menuOpen ? "open" : ""} aria-label="主导航">
            <a href="#forecast" onClick={() => setMenuOpen(false)}>霞光预报</a>
            <a href="#map" onClick={() => setMenuOpen(false)}>城市地图</a>
            <a href="#method" onClick={() => setMenuOpen(false)}>数据方法</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>关于霁光</a>
          </nav>
          <div className="header-actions">
            <LocationPicker current={data?.location ?? CITIES[0]} onSelect={selectCity} onLocate={locate} />
            <button className="menu-button" type="button" aria-label="打开导航" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-ambient hero-ambient-one" /><div className="hero-ambient hero-ambient-two" />
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"><span /> SKY MOMENT FORECAST</span>
            <h1>把下一场霞光，<br /><em>提前装进口袋。</em></h1>
            <p>融合全球与中国数值天气模式，读懂每一层云、每一束光。为摄影、散步，也为那些值得抬头的时刻。</p>
            <div className="hero-actions">
              <a className="primary-action" href="#forecast">查看七天机会 <ArrowDown size={17} /></a>
              <button className="text-action" type="button" onClick={locate}><LocateFixed size={17} /> 定位我的天空</button>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars"><span>EC</span><span>CM</span><span>CA</span></div>
              <p><strong>3 类数据协同判断</strong><small>ECMWF · CMA · CAMS</small></p>
            </div>
          </div>
          {data && selectedDay ? <AtmosphericPreview data={data} day={selectedDay} /> : <LoadingPreview />}
        </div>
        <a className="scroll-cue" href="#forecast" aria-label="向下查看预报"><span>SCROLL TO DISCOVER</span><ArrowDown size={16} /></a>
      </section>

      {error && <div className="error-banner" role="alert"><Info size={17} /><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={15} /></button></div>}

      {!data && status !== "error" && <ForecastSkeleton />}
      {!data && status === "error" && (
        <section className="fatal-error"><CloudSun size={42} /><h2>天空数据暂时走丢了</h2><p>{error}</p><button type="button" onClick={() => void loadForecast("/api/forecast?city=beijing")}><RefreshCw size={16} /> 重新连接</button></section>
      )}

      {data && selectedDay && (
        <>
          <section className="dashboard-section" id="forecast">
            <div className="dashboard-title-row">
              <div>
                <span className="section-kicker">LOCAL SKY · {data.location.latitude.toFixed(2)}°N</span>
                <h2>{data.location.name}的霞光窗口</h2>
                <p>{data.location.province} · 海拔 {data.location.elevation === null ? "未知" : `${Math.round(data.location.elevation)} m`} · 北京时间</p>
              </div>
              <div className="update-state"><span className={status === "updating" ? "spinning" : ""}><RefreshCw size={15} /></span>{status === "updating" ? "正在更新" : `${formatUpdated(data.generatedAt)} 更新`}</div>
            </div>
            <div className="day-tabs" role="tablist" aria-label="选择预报日期">
              {data.days.map((day, index) => (
                <button key={day.date} type="button" role="tab" aria-selected={selectedIndex === index} onClick={() => setSelectedIndex(index)}>
                  <span>{index === data.recommendedIndex ? "推荐" : day.weekday}</span><strong>{day.shortDate}</strong><small><i style={{ height: `${Math.max(day.dawn.probability, day.dusk.probability) * .28}px` }} />{Math.max(day.dawn.probability, day.dusk.probability)}%</small>
                </button>
              ))}
            </div>
            <div className="event-grid"><EventCard event={selectedDay.dawn} /><EventCard event={selectedDay.dusk} /></div>
            <p className="model-disclaimer"><Info size={14} /> {data.disclaimer}</p>
          </section>

          <section className="insight-section" id="map">
            <div className="insight-grid"><ChinaMap current={data.location} onSelect={selectCity} /><FactorList contributions={selectedDay.dusk.contributions} /></div>
            <TrendChart days={data.days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
          </section>

          <MethodSection sources={data.sources} />
        </>
      )}

      <section className="closing-section" id="about">
        <div className="closing-orb" aria-hidden="true" />
        <span className="section-kicker">LOOK UP, MORE OFTEN</span>
        <h2>不是每一天都有霞光，<br />但每一次抬头都算数。</h2>
        <p>霁光目前覆盖中国境内坐标。下一步将加入全球时区、山体地平线、实时卫星云图与用户实拍校准，让预测真正越用越准。</p>
        <a href="#top">再看一座城市 <ArrowRight size={16} /></a>
      </section>

      <footer>
        <BrandMark />
        <p>天气数据经 <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> 接入；产品不替代官方灾害预警。</p>
        <span>© 2026 霁光 JIGUANG</span>
      </footer>
    </main>
  );
}
