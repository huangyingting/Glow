import { NextRequest, NextResponse } from "next/server";
import { findCity, isWithinChina, nearestCity } from "@/lib/cities";
import { getForecast } from "@/lib/weather";
import type { City } from "@/lib/types";

export const runtime = "nodejs";

class RequestValidationError extends Error {}

const coordinateBuckets = new Map<string, { count: number; resetAt: number }>();
const COORDINATE_LIMIT = 90;
const RATE_WINDOW_MS = 60_000;
const MAX_COORDINATE_BUCKETS = 2_000;

function invalidRequest(message: string): never {
  throw new RequestValidationError(message);
}

function coordinateRateLimit(request: NextRequest) {
  const now = Date.now();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "anonymous";
  const current = coordinateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    if (coordinateBuckets.size >= MAX_COORDINATE_BUCKETS) {
      for (const [bucketKey, bucket] of coordinateBuckets) {
        if (bucket.resetAt <= now) coordinateBuckets.delete(bucketKey);
      }
      while (coordinateBuckets.size >= MAX_COORDINATE_BUCKETS) {
        const oldestKey = coordinateBuckets.keys().next().value;
        if (oldestKey === undefined) break;
        coordinateBuckets.delete(oldestKey);
      }
    }
    coordinateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }
  current.count += 1;
  if (current.count <= COORDINATE_LIMIT) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
}

function requestCity(request: NextRequest): City {
  const params = request.nextUrl.searchParams;
  const rawLatitude = params.get("lat");
  const rawLongitude = params.get("lon");
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if ((rawLatitude === null) !== (rawLongitude === null) || (rawLatitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude)))) {
    invalidRequest("坐标格式无效，请同时提供有效的纬度和经度");
  }
  if (rawLatitude !== null && rawLongitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (!isWithinChina(latitude, longitude)) invalidRequest("当前版本仅支持中国天气区域内的坐标");
    const nearest = nearestCity(latitude, longitude);
    const rawName = params.get("name")?.trim().slice(0, 24);
    return {
      ...nearest,
      id: `coordinate-${latitude.toFixed(3)}-${longitude.toFixed(3)}`,
      name: rawName || "我的位置",
      province: `距${nearest.name}最近`,
      latitude,
      longitude,
    };
  }
  const city = findCity(params.get("city"));
  if (!city) invalidRequest("城市参数无效，请从支持的城市列表中选择");
  return city;
}

export async function GET(request: NextRequest) {
  try {
    const isCoordinateRequest = request.nextUrl.searchParams.has("lat");
    const city = requestCity(request);
    const retryAfter = isCoordinateRequest ? coordinateRateLimit(request) : null;
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: "坐标更新过于频繁，请稍后再试" },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": retryAfter.toString() } },
      );
    }
    const data = await getForecast(city);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isCoordinateRequest
          ? "private, max-age=600"
          : "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Forecast request failed", error);
    return NextResponse.json(
      { error: "天气数据暂时不可用，请稍后再试" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
