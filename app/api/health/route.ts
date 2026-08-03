import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "jiguang-sky-forecast", checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
