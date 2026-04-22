"use client";

import { ChevronLeft, ChevronRight, Loader2, Wifi, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addMonths,
  getCalendarDays,
  getMonthBounds,
  getMonthLabel,
  monthKeyFromDate,
} from "@/lib/dates";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { HabitMarkRow, HabitRow } from "@/lib/supabase-types";
import type { CalendarToken } from "@/lib/jwt";

type HabitSummary = Pick<HabitRow, "id" | "name" | "slug" | "color">;
type HabitMarkSummary = Pick<HabitMarkRow, "id" | "habit_id" | "mark_date" | "created_at">;

type MewingCalendarProps = {
  shareCode: string;
  habit: HabitSummary;
  today: string;
  initialMonth: string;
  initialMarks: HabitMarkSummary[];
  initialToken: CalendarToken;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function isDuplicateInsertError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export function MewingCalendar({
  shareCode,
  habit,
  today,
  initialMonth,
  initialMarks,
  initialToken,
  supabaseUrl,
  supabasePublishableKey,
}: MewingCalendarProps) {
  const tokenRef = useRef(initialToken.accessToken);
  const tokenExpiresAtRef = useRef(Date.parse(initialToken.expiresAt));
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [marks, setMarks] = useState<HabitMarkSummary[]>(initialMarks);
  const [isToggling, setIsToggling] = useState(false);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(() => {
    const client = createBrowserSupabaseClient(supabaseUrl, supabasePublishableKey, async () => tokenRef.current);
    client.realtime.setAuth(tokenRef.current);
    return client;
  }, [supabasePublishableKey, supabaseUrl]);

  const refreshToken = useCallback(async () => {
    const response = await fetch(`/api/session?code=${encodeURIComponent(shareCode)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to refresh calendar access.");
    }

    const nextToken = (await response.json()) as CalendarToken;
    tokenRef.current = nextToken.accessToken;
    tokenExpiresAtRef.current = Date.parse(nextToken.expiresAt);
    supabase.realtime.setAuth(nextToken.accessToken);
  }, [shareCode, supabase]);

  const ensureFreshToken = useCallback(async () => {
    const twoMinutes = 2 * 60 * 1000;

    if (Date.now() > tokenExpiresAtRef.current - twoMinutes) {
      await refreshToken();
    }
  }, [refreshToken]);

  const loadMarks = useCallback(
    async (monthKey: string) => {
      await ensureFreshToken();

      const { start, end } = getMonthBounds(monthKey);
      const { data, error } = await supabase
        .from("habit_marks")
        .select("id, habit_id, mark_date, created_at")
        .eq("habit_id", habit.id)
        .gte("mark_date", start)
        .lte("mark_date", end)
        .order("mark_date", { ascending: true });

      if (error) {
        throw error;
      }

      setMarks(data ?? []);
    },
    [ensureFreshToken, habit.id, supabase],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshToken().catch(() => setStatus("offline"));
    }, 10 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [refreshToken]);

  useEffect(() => {
    let ignore = false;

    setIsLoadingMonth(true);
    loadMarks(visibleMonth)
      .catch(() => {
        if (!ignore) {
          setMessage("Could not load this month.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingMonth(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [loadMarks, visibleMonth]);

  useEffect(() => {
    const channel = supabase
      .channel(`habit_marks:${habit.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_marks",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const nextMark = payload.new as HabitMarkSummary;

            if (nextMark.habit_id === habit.id && monthKeyFromDate(nextMark.mark_date) === visibleMonth) {
              setMarks((current) => {
                if (current.some((mark) => mark.id === nextMark.id)) {
                  return current;
                }

                return [...current, nextMark].sort((left, right) =>
                  left.mark_date.localeCompare(right.mark_date),
                );
              });
            }

            return;
          }

          loadMarks(visibleMonth).catch(() => setMessage("Could not refresh marks."));
        },
      )
      .subscribe((nextStatus) => {
        if (nextStatus === "SUBSCRIBED") {
          setStatus("live");
          return;
        }

        if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT" || nextStatus === "CLOSED") {
          setStatus("offline");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [habit.id, loadMarks, supabase, visibleMonth]);

  const marksByDate = useMemo(() => {
    return new Map(marks.map((mark) => [mark.mark_date, mark]));
  }, [marks]);

  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const todayMonth = monthKeyFromDate(today);
  const monthLabel = getMonthLabel(visibleMonth);
  const markedCount = marks.filter((mark) => monthKeyFromDate(mark.mark_date) === visibleMonth).length;

  async function toggleToday(date: string) {
    if (date !== today || isToggling) {
      return;
    }

    const existing = marksByDate.get(date);
    const previousMarks = marks;
    const optimisticMark: HabitMarkSummary = {
      id: `optimistic-${Date.now()}`,
      habit_id: habit.id,
      mark_date: date,
      created_at: new Date().toISOString(),
    };

    setIsToggling(true);
    setMessage(null);
    setMarks((current) =>
      existing ? current.filter((mark) => mark.mark_date !== date) : [...current, optimisticMark],
    );

    let saveError: { code?: string } | null = null;

    try {
      await ensureFreshToken();

      const result = existing
        ? await supabase.from("habit_marks").delete().eq("habit_id", habit.id).eq("mark_date", date)
        : await supabase.from("habit_marks").insert({ habit_id: habit.id, mark_date: date });

      saveError = result.error;
    } catch {
      saveError = {};
    }

    if (saveError && !isDuplicateInsertError(saveError)) {
      setMarks(previousMarks);
      setMessage("Could not save the X.");
      setIsToggling(false);
      return;
    }

    await loadMarks(visibleMonth).catch(() => setMessage("Saved, but refresh failed."));
    setIsToggling(false);
  }

  return (
    <main className="app-shell">
      <section className="calendar-panel" aria-label={`${habit.name} calendar`}>
        <header className="app-header">
          <div>
            <p className="eyebrow">Daily habit</p>
            <h1>{habit.name}</h1>
          </div>
          <div className={`live-pill live-pill-${status}`} title={status === "live" ? "Realtime connected" : "Realtime disconnected"}>
            {status === "live" ? <Wifi aria-hidden="true" size={16} /> : <WifiOff aria-hidden="true" size={16} />}
            <span>{status === "live" ? "Live" : "Offline"}</span>
          </div>
        </header>

        <div className="month-bar">
          <button
            aria-label="Previous month"
            className="icon-button"
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
          >
            <ChevronLeft aria-hidden="true" size={22} />
          </button>
          <div className="month-title">
            <h2>{monthLabel}</h2>
            <p>{markedCount} marked</p>
          </div>
          <button
            aria-label="Next month"
            className="icon-button"
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
          >
            <ChevronRight aria-hidden="true" size={22} />
          </button>
        </div>

        <div className="weekday-row" aria-hidden="true">
          {weekDays.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className={`calendar-grid ${isLoadingMonth ? "calendar-grid-loading" : ""}`}>
          {days.map((day) => {
            const mark = marksByDate.get(day.date);
            const isToday = day.date === today;
            const isVisibleTodayMonth = visibleMonth === todayMonth;

            return (
              <button
                key={day.date}
                aria-label={`${day.date}${mark ? ", marked" : ""}`}
                aria-pressed={Boolean(mark)}
                className={[
                  "day-cell",
                  day.inCurrentMonth ? "" : "day-cell-muted",
                  mark ? "day-cell-marked" : "",
                  isToday ? "day-cell-today" : "",
                  isToday && isVisibleTodayMonth ? "day-cell-actionable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!isToday || !isVisibleTodayMonth || isToggling}
                type="button"
                onClick={() => toggleToday(day.date)}
              >
                <span className="day-number">{day.dayNumber}</span>
                {mark ? (
                  <span className="day-x" aria-hidden="true">
                    <X size={44} strokeWidth={3.4} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <footer className="calendar-footer">
          <button
            className="today-button"
            disabled={visibleMonth === todayMonth}
            type="button"
            onClick={() => setVisibleMonth(todayMonth)}
          >
            Today
          </button>
          <div className="footer-message" role="status">
            {isToggling ? (
              <>
                <Loader2 aria-hidden="true" className="spin" size={16} /> Saving
              </>
            ) : (
              message ?? today
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
