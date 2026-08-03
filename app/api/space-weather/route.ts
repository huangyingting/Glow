import { NextResponse } from "next/server";
import { getSpaceWeather, unavailableSpaceWeather } from "@/lib/space-weather";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getSpaceWeather();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    console.error("Space weather request failed", error);
    return NextResponse.json(unavailableSpaceWeather(), {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  }
}

