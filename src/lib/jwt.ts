import { SignJWT } from "jose";

import { TOKEN_TTL_SECONDS } from "@/lib/app-config";

const textEncoder = new TextEncoder();

export type CalendarToken = {
  accessToken: string;
  expiresAt: string;
};

export async function issueCalendarAccessToken(params: {
  calendarId: string;
  jwtSecret: string;
}): Promise<CalendarToken> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS;

  const accessToken = await new SignJWT({
    role: "authenticated",
    calendar_id: params.calendarId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.calendarId)
    .setAudience("authenticated")
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(textEncoder.encode(params.jwtSecret));

  return {
    accessToken,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}
