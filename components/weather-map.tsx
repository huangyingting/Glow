"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, Marker, StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { City, PhotographyMode } from "@/lib/types";

interface WeatherMapProps {
  location: City;
  mode: PhotographyMode;
  score: number;
  sunriseAzimuth: number | null;
  sunsetAzimuth: number | null;
  moonAzimuth: number | null;
  onPick: (latitude: number, longitude: number) => void;
}

const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
      maxzoom: 20,
    },
  },
  layers: [{ id: "carto-base", type: "raster", source: "carto", minzoom: 0, maxzoom: 22 }],
};
const MAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE;

function destination(longitude: number, latitude: number, bearing: number, distanceKm = 240) {
  const radius = 6371;
  const angular = distanceKm / radius;
  const startLat = latitude * Math.PI / 180;
  const startLon = longitude * Math.PI / 180;
  const angle = bearing * Math.PI / 180;
  const endLat = Math.asin(Math.sin(startLat) * Math.cos(angular) + Math.cos(startLat) * Math.sin(angular) * Math.cos(angle));
  const endLon = startLon + Math.atan2(Math.sin(angle) * Math.sin(angular) * Math.cos(startLat), Math.cos(angular) - Math.sin(startLat) * Math.sin(endLat));
  return [endLon * 180 / Math.PI, endLat * 180 / Math.PI];
}

function directionData(location: City, sunrise: number | null, sunset: number | null, moon: number | null) {
  const origin = [location.longitude, location.latitude];
  const features = [
    sunrise === null ? null : { type: "Feature" as const, properties: { kind: "sunrise" }, geometry: { type: "LineString" as const, coordinates: [origin, destination(location.longitude, location.latitude, sunrise)] } },
    sunset === null ? null : { type: "Feature" as const, properties: { kind: "sunset" }, geometry: { type: "LineString" as const, coordinates: [origin, destination(location.longitude, location.latitude, sunset)] } },
    moon === null ? null : { type: "Feature" as const, properties: { kind: "moon" }, geometry: { type: "LineString" as const, coordinates: [origin, destination(location.longitude, location.latitude, moon)] } },
  ].filter((item) => item !== null);
  return { type: "FeatureCollection" as const, features };
}

function pointData(location: City, score: number, mode: PhotographyMode) {
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      properties: { score, mode },
      geometry: { type: "Point" as const, coordinates: [location.longitude, location.latitude] },
    }],
  };
}

export default function WeatherMap({ location, mode, score, sunriseAzimuth, sunsetAzimuth, moonAzimuth, onPick }: WeatherMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const directionOverlayRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const pickRef = useRef(onPick);
  const initialRef = useRef({ location, mode, score, sunriseAzimuth, sunsetAzimuth, moonAzimuth });
  const directionRef = useRef({ location, sunriseAzimuth, sunsetAzimuth, moonAzimuth });
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState(false);

  useEffect(() => { pickRef.current = onPick; }, [onPick]);

  const positionDirectionOverlay = useCallback((map: MapLibreMap) => {
    const overlay = directionOverlayRef.current;
    if (!overlay) return;
    const current = directionRef.current;
    const origin = map.project([current.location.longitude, current.location.latitude]);
    const values = { sunrise: current.sunriseAzimuth, sunset: current.sunsetAzimuth, moon: current.moonAzimuth };
    Object.entries(values).forEach(([kind, bearing]) => {
      const line = overlay.querySelector<HTMLElement>(`[data-kind="${kind}"]`);
      if (!line || bearing === null) return;
      const target = destination(current.location.longitude, current.location.latitude, bearing);
      const end = map.project(target as [number, number]);
      const dx = end.x - origin.x;
      const dy = end.y - origin.y;
      line.style.left = `${origin.x}px`;
      line.style.top = `${origin.y}px`;
      line.style.width = `${Math.hypot(dx, dy)}px`;
      line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial = initialRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [initial.location.longitude, initial.location.latitude],
      zoom: 4.35,
      minZoom: 2.8,
      maxZoom: 15,
      maxBounds: [[69, 12], [140, 57]],
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "天气 · ECMWF / CMA / CAMS" }), "bottom-left");

    const markerNode = document.createElement("div");
    markerNode.className = "map-pin-marker";
    const ring = document.createElement("span");
    const dot = document.createElement("i");
    const label = document.createElement("b");
    label.textContent = "拖动定位";
    markerNode.append(ring, dot, label);
    const marker = new maplibregl.Marker({ element: markerNode, draggable: true, anchor: "center" })
      .setLngLat([initial.location.longitude, initial.location.latitude])
      .addTo(map);
    markerRef.current = marker;
    marker.on("dragstart", () => containerRef.current?.classList.add("map-moving"));
    marker.on("dragend", () => {
      containerRef.current?.classList.remove("map-moving");
      const point = marker.getLngLat();
      pickRef.current(point.lat, point.lng);
    });
    map.on("click", (event: MapMouseEvent) => {
      marker.setLngLat(event.lngLat);
      pickRef.current(event.lngLat.lat, event.lngLat.lng);
    });
    map.on("move", () => positionDirectionOverlay(map));
    map.on("error", () => setWarning(true));
    map.once("style.load", () => {
      map.addSource("forecast-point", { type: "geojson", data: pointData(initial.location, initial.score, initial.mode) });
      map.addLayer({
        id: "forecast-halo",
        type: "circle",
        source: "forecast-point",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 25, 9, 65],
          "circle-color": ["interpolate", ["linear"], ["get", "score"], 0, "#607080", 50, "#ef9a62", 100, "#ed5b47"],
          "circle-opacity": .2,
          "circle-blur": .55,
        },
      });
      map.addSource("photo-directions", { type: "geojson", data: directionData(initial.location, initial.sunriseAzimuth, initial.sunsetAzimuth, initial.moonAzimuth) });
      map.addLayer({
        id: "photo-directions",
        type: "line",
        source: "photo-directions",
        paint: {
          "line-color": ["match", ["get", "kind"], "sunrise", "#f4b55f", "sunset", "#ed755d", "#8171b6"],
          "line-width": 2,
          "line-opacity": .86,
          "line-dasharray": [2, 2],
        },
      });
      setReady(true);
      window.requestAnimationFrame(() => positionDirectionOverlay(map));
    });
    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [positionDirectionOverlay]);

  useEffect(() => {
    directionRef.current = { location, sunriseAzimuth, sunsetAzimuth, moonAzimuth };
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLngLat([location.longitude, location.latitude]);
    const current = map.getCenter();
    if (Math.abs(current.lng - location.longitude) > 2.5 || Math.abs(current.lat - location.latitude) > 2.5) {
      containerRef.current?.classList.add("map-moving");
      map.easeTo({ center: [location.longitude, location.latitude], duration: 650, zoom: Math.max(map.getZoom(), 5) });
      map.once("moveend", () => containerRef.current?.classList.remove("map-moving"));
    }
    (map.getSource("forecast-point") as GeoJSONSource | undefined)?.setData(pointData(location, score, mode));
    (map.getSource("photo-directions") as GeoJSONSource | undefined)?.setData(directionData(location, sunriseAzimuth, sunsetAzimuth, moonAzimuth));
    marker.getElement().style.setProperty("--pin-score", `${score}%`);
    marker.getElement().dataset.mode = mode;
    window.requestAnimationFrame(() => positionDirectionOverlay(map));
  }, [location, mode, moonAzimuth, positionDirectionOverlay, score, sunriseAzimuth, sunsetAzimuth]);

  return (
    <div className="weather-map" ref={containerRef} data-map-ready={ready ? "true" : "false"} aria-label="可点击和拖动定位点的中国天气地图">
      <div className="map-direction-overlay" ref={directionOverlayRef} aria-hidden="true">
        {sunriseAzimuth !== null && <i data-kind="sunrise" />}
        {sunsetAzimuth !== null && <i data-kind="sunset" />}
        {moonAzimuth !== null && <i data-kind="moon" />}
      </div>
      {!ready && <div className="map-loading"><span /><p>正在绘制地理底图</p></div>}
      {warning && <div className="map-warning">部分底图瓦片暂不可用，定位与预测仍可使用</div>}
    </div>
  );
}
