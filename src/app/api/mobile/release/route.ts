import { NextResponse } from "next/server";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET() {
  const updateUrl = String(process.env.SOMOS_ANDROID_UPDATE_URL || "").trim();
  return NextResponse.json({
    latestVersionCode: positiveInteger(process.env.SOMOS_ANDROID_LATEST_VERSION_CODE, 17),
    minimumVersionCode: positiveInteger(process.env.SOMOS_ANDROID_MINIMUM_VERSION_CODE, 17),
    updateUrl: /^https:\/\//.test(updateUrl) ? updateUrl : "",
  }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
