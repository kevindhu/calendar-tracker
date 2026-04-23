import { notFound } from "next/navigation";

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

  const { data: calendar, error: calendarError } = await supabase
    .from("calendars")
    .select("id, name, created_at")
    .eq("id", config.calendarId)
    .single();

  if (calendarError || !calendar) {
    return (
      <SetupPanel
        title="Calendar row not found"
        detail="Run the SQL setup and make sure CALENDAR_ID matches the calendar row in Supabase."
      />
    );
  }

  const { data: habits, error: habitsError } = await supabase
    .from("habits")
    .select("id, name, slug, color, calendar_id, created_at")
    .eq("calendar_id", calendar.id)
    .order("created_at", { ascending: true });

  if (habitsError || !habits || habits.length === 0) {
    return (
      <SetupPanel
        title="Habits not found"
        detail="Run the SQL setup and make sure the starter habits exist in Supabase."
      />
    );
  }

  const habitIds = habits.map((habit) => habit.id);
  const { data: marks, error: marksError } = await supabase
    .from("habit_marks")
    .select("id, habit_id, mark_date, completed, note, created_at, updated_at")
    .in("habit_id", habitIds)
    .gte("mark_date", start)
    .lte("mark_date", end)
    .order("mark_date", { ascending: true });

  if (marksError) {
    return (
      <SetupPanel
        title="Could not load calendar marks"
        detail="Check that the Supabase service role key and database schema are configured correctly."
      />
    );
  }

  const { data: streakMarks, error: streakMarksError } = await supabase
    .from("habit_marks")
    .select("habit_id, mark_date")
    .in("habit_id", habitIds)
    .eq("completed", true)
    .lte("mark_date", today)
    .order("mark_date", { ascending: true });

  if (streakMarksError) {
    return (
      <SetupPanel
        title="Could not load streaks"
        detail="Check that the Supabase service role key and database schema are configured correctly."
      />
    );
  }

  const initialToken = await issueCalendarAccessToken({
    calendarId: calendar.id,
    jwtSecret: config.supabaseJwtSecret,
  });

  return (
    <MewingCalendar
      shareCode={shareCode}
      habits={habits}
      today={today}
      initialMonth={initialMonth}
      initialMarks={marks ?? []}
      initialStreakMarks={streakMarks ?? []}
      initialToken={initialToken}
      supabaseUrl={config.supabaseUrl}
      supabasePublishableKey={config.supabasePublishableKey}
    />
  );
}
