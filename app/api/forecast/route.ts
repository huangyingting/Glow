import { NextRequest, NextResponse } from "next/server";
import { findCity, isWithinChina, nearestCity } from "@/lib/cities";
import { getForecast } from "@/lib/weather";
import type { City } from "@/lib/types";

export const runtime = "nodejs";

function requestCity(request: NextRequest): City {
  const params = request.nextUrl.searchParams;
  const rawLatitude = params.get("lat");
  const rawLongitude = params.get("lon");
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if ((rawLatitude === null) !== (rawLongitude === null) || (rawLatitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude)))) {
    throw new Error("坐标格式无效，请同时提供有效的纬度和经度");
  }
  if (rawLatitude !== null && rawLongitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (!isWithinChina(latitude, longitude)) throw new Error("当前版本仅支持中国境内坐标");
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
  return findCity(params.get("city"));
}

export async function GET(request: NextRequest) {
  try {
    const data = await getForecast(requestCity(request));
    const isCoordinateRequest = request.nextUrl.searchParams.has("lat");
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isCoordinateRequest
          ? "private, max-age=600"
          : "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "天气数据暂时不可用";
    const status = message.includes("中国境内") || message.includes("坐标格式") ? 400 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
