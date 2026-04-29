export const APP_NAME = "Mewing Calendar";
export const APP_TIME_ZONE = "America/Los_Angeles";
export const DEFAULT_HABIT_NAME = "Roblox";
export const DEFAULT_HABIT_SLUG = "roblox";
export const TOKEN_TTL_SECONDS = 15 * 60;

export type RuntimeConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseSecretKey: string;
  supabaseJwtSecret: string;
  calendarShareCode: string;
  calendarId: string;
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
    calendarShareCode: process.env.CALENDAR_SHARE_CODE ?? "",
    calendarId: process.env.CALENDAR_ID ?? "",
  };
}

export function getMissingConfig(config: RuntimeConfig): Array<keyof RuntimeConfig> {
  return (Object.keys(config) as Array<keyof RuntimeConfig>).filter((key) => config[key].trim() === "");
}

export const ENV_LABELS: Record<keyof RuntimeConfig, string> = {
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabasePublishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  supabaseSecretKey: "SUPABASE_SECRET_KEY",
  supabaseJwtSecret: "SUPABASE_JWT_SECRET",
  calendarShareCode: "CALENDAR_SHARE_CODE",
  calendarId: "CALENDAR_ID",
};

export function getMissingEnvVars(config: RuntimeConfig): string[] {
  return getMissingConfig(config).map((key) => ENV_LABELS[key]);
}
