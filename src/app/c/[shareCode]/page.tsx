import { notFound } from "next/navigation";

import { MewingCalendar } from "@/components/mewing-calendar";
import { SetupPanel } from "@/components/setup-panel";
import { DEFAULT_HABIT_SLUG } from "@/lib/app-config";
import { getMissingConfig, getMissingEnvVars, getRuntimeConfig } from "@/lib/app-config";
import { getMonthBounds, getTodayInAppTimeZone, monthKeyFromDate } from "@/lib/dates";
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
  const { start, end } = getMonthBounds(initialMonth);

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

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, name, slug, color, calendar_id, created_at")
    .eq("calendar_id", calendar.id)
    .eq("slug", DEFAULT_HABIT_SLUG)
    .single();

  if (habitError || !habit) {
    return (
      <SetupPanel
        title="Mewing habit not found"
        detail="Run the SQL setup and make sure the starter habit slug is mewing."
      />
    );
  }

  const { data: marks, error: marksError } = await supabase
    .from("habit_marks")
    .select("id, habit_id, mark_date, created_at")
    .eq("habit_id", habit.id)
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

  const initialToken = await issueCalendarAccessToken({
    calendarId: calendar.id,
    jwtSecret: config.supabaseJwtSecret,
  });

  return (
    <MewingCalendar
      shareCode={shareCode}
      habit={habit}
      today={today}
      initialMonth={initialMonth}
      initialMarks={marks ?? []}
      initialToken={initialToken}
      supabaseUrl={config.supabaseUrl}
      supabasePublishableKey={config.supabasePublishableKey}
    />
  );
}
