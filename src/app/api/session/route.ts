import { NextResponse } from "next/server";

import { ENV_LABELS, getMissingConfig, getRuntimeConfig } from "@/lib/app-config";
import { issueCalendarAccessToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shareCode = url.searchParams.get("code") ?? "";
  const config = getRuntimeConfig();

  if (!config.calendarShareCode || shareCode !== config.calendarShareCode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const missing = getMissingConfig(config).filter((key) =>
    ["calendarId", "supabaseJwtSecret"].includes(key),
  );

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing calendar configuration", missing: missing.map((key) => ENV_LABELS[key]) },
      { status: 500 },
    );
  }

  const token = await issueCalendarAccessToken({
    calendarId: config.calendarId,
    jwtSecret: config.supabaseJwtSecret,
  });

  return NextResponse.json(token, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
