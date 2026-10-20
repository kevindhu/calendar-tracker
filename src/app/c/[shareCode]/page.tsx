import { notFound } from "next/navigation";

import { CalendarLoadError } from "@/components/calendar-load-error";
import { MewingCalendar } from "@/components/mewing-calendar";
import { SetupPanel } from "@/components/setup-panel";
import { getMissingConfig, getMissingEnvVars, getRuntimeConfig } from "@/lib/app-config";
import { getCalendarGridBounds, getTodayInAppTimeZone, monthKeyFromDate } from "@/lib/dates";
import { issueCalendarAccessToken } from "@/lib/jwt";
import { createServiceSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  params: Promise<{
    shareCode: string;
  }>;
};

function databaseLoadError(
  resource: string,
  result: { status: number; error: { code?: string } | null },
) {
  // Keep diagnostics on the server; upstream errors can contain raw HTML.
  console.error("Calendar database request failed", {
    resource,
    status: result.status,
    code: result.error?.code,
  });
  return <CalendarLoadError />;
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { shareCode } = await params;
  const config = getRuntimeConfig();

  if (!config.calendarShareCode) {
    return (
      <SetupPanel
        title="Add the private calendar code"
        detail="Set the required environment variables before opening the shared calendar route."
        missing={getMissingEnvVars(config)}
      />
    );
  }

  if (shareCode !== config.calendarShareCode) {
    notFound();
  }

  const missingConfig = getMissingConfig(config);

  if (missingConfig.length > 0) {
    return (
      <SetupPanel
        title="Finish the Supabase setup"
        detail="The private route is valid, but the app still needs its Supabase and calendar environment variables."
        missing={getMissingEnvVars(config)}
      />
    );
  }

  const supabase = createServiceSupabaseClient(config.supabaseUrl, config.supabaseSecretKey);
  const today = getTodayInAppTimeZone();
  const initialMonth = monthKeyFromDate(today);
  const { start, end } = getCalendarGridBounds(initialMonth);

  // Our fetch wrapper already retries reads. Disable SDK retries so an outage
  // doesn't multiply those attempts and leave the loading screen up for a minute.
  const [calendarResult, habitsResult] = await Promise.all([
    supabase
      .from("calendars")
      .select("id, name, created_at")
      .eq("id", config.calendarId)
      .maybeSingle()
      .retry(false),
    supabase
      .from("habits")
      .select("id, name, slug, color, calendar_id, created_at")
      .eq("calendar_id", config.calendarId)
      .order("created_at", { ascending: true })
      .retry(false),
  ]);

  const { data: calendar, error: calendarError } = calendarResult;

  if (calendarError) {
    return databaseLoadError("calendar", calendarResult);
  }

  if (!calendar) {
    return (
      <SetupPanel
        title="Calendar row not found"
        detail="Run the SQL setup and make sure CALENDAR_ID matches the calendar row in Supabase."
      />
    );
  }

  const { data: habits, error: habitsError } = habitsResult;

  if (habitsError) {
    return databaseLoadError("habits", habitsResult);
  }

  if (!habits || habits.length === 0) {
    return (
      <SetupPanel
        title="Habits not found"
        detail="Run the SQL setup and make sure the starter habits exist in Supabase."
      />
    );
  }

  const habitIds = habits.map((habit) => habit.id);
  const [marksResult, streakMarksResult, dayFlagsResult, initialToken] = await Promise.all([
    supabase
      .from("habit_marks")
      .select("id, habit_id, mark_date, completed, note, created_at, updated_at")
      .in("habit_id", habitIds)
      .gte("mark_date", start)
      .lte("mark_date", end)
      .order("mark_date", { ascending: true })
      .retry(false),
    supabase
      .from("habit_marks")
      .select("habit_id, mark_date")
      .in("habit_id", habitIds)
      .eq("completed", true)
      .lte("mark_date", today)
      .order("mark_date", { ascending: true })
      .retry(false),
    supabase
      .from("calendar_day_flags")
      .select("id, calendar_id, habit_id, flag_date, important, created_at, updated_at")
      .eq("calendar_id", calendar.id)
      .in("habit_id", habitIds)
      .gte("flag_date", start)
      .lte("flag_date", end)
      .eq("important", true)
      .order("flag_date", { ascending: true })
      .retry(false),
    issueCalendarAccessToken({
      calendarId: calendar.id,
      jwtSecret: config.supabaseJwtSecret,
    }),
  ]);

  const { data: marks, error: marksError } = marksResult;

  if (marksError) {
    return databaseLoadError("marks", marksResult);
  }

  const { data: streakMarks, error: streakMarksError } = streakMarksResult;

  if (streakMarksError) {
    return databaseLoadError("streaks", streakMarksResult);
  }

  const { data: dayFlags, error: dayFlagsError } = dayFlagsResult;

  return (
    <MewingCalendar
      shareCode={shareCode}
      calendarId={calendar.id}
      habits={habits}
      today={today}
      initialMonth={initialMonth}
      initialMarks={marks ?? []}
      initialStreakMarks={streakMarks ?? []}
      initialDayFlags={dayFlagsError ? [] : (dayFlags ?? [])}
      initialDayFlagsLoadFailed={Boolean(dayFlagsError)}
      initialToken={initialToken}
      supabaseUrl={config.supabaseUrl}
      supabasePublishableKey={config.supabasePublishableKey}
    />
  );
}
