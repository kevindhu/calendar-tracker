"use client";

import type { CSSProperties } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Menu,
  RotateCcw,
  Save,
  Sparkles,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addMonths,
  getCalendarDays,
  getCalendarGridBounds,
  getMonthLabel,
  monthKeyFromDate,
} from "@/lib/dates";
import type { CalendarToken } from "@/lib/jwt";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { HabitMarkRow, HabitRow } from "@/lib/supabase-types";

const NOTE_LIMIT = 280;
const DEFAULT_ACTIVE_HABIT = "mewing";

type HabitSummary = Pick<HabitRow, "id" | "name" | "slug" | "color">;
type HabitEntrySummary = Pick<
  HabitMarkRow,
  "id" | "habit_id" | "mark_date" | "completed" | "note" | "created_at" | "updated_at"
>;

type MewingCalendarProps = {
  shareCode: string;
  habits: HabitSummary[];
  today: string;
  initialMonth: string;
  initialMarks: HabitEntrySummary[];
  initialToken: CalendarToken;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

type HabitVisual = {
  icon: "sparkles" | "book";
  accent: string;
  soft: string;
};

type HabitStyle = CSSProperties & {
  "--accent"?: string;
  "--accent-soft"?: string;
};

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

const habitVisuals: Record<string, HabitVisual> = {
  mewing: {
    icon: "sparkles",
    accent: "#df322d",
    soft: "#ffe4e2",
  },
  manga: {
    icon: "book",
    accent: "#0f8a62",
    soft: "#e2f7ed",
  },
};

function sortEntries(entries: HabitEntrySummary[]): HabitEntrySummary[] {
  return [...entries].sort((left, right) => left.mark_date.localeCompare(right.mark_date));
}

function sortHabits(habits: HabitSummary[]): HabitSummary[] {
  return [...habits].sort((left, right) => {
    if (left.slug === DEFAULT_ACTIVE_HABIT) return -1;
    if (right.slug === DEFAULT_ACTIVE_HABIT) return 1;
    return left.name.localeCompare(right.name);
  });
}

function formatDateLabel(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getHabitVisual(habit: HabitSummary): HabitVisual {
  return habitVisuals[habit.slug] ?? {
    icon: "sparkles",
    accent: habit.color,
    soft: "#eaf3ff",
  };
}

function HabitIcon({ habit }: { habit: HabitSummary }) {
  const visual = getHabitVisual(habit);

  if (visual.icon === "book") {
    return <BookOpen aria-hidden="true" size={18} />;
  }

  return <Sparkles aria-hidden="true" size={18} />;
}

function buildOptimisticEntry(params: {
  existing?: HabitEntrySummary;
  habitId: string;
  date: string;
  completed: boolean;
  note: string;
}): HabitEntrySummary {
  const timestamp = new Date().toISOString();

  return {
    id: params.existing?.id ?? `optimistic-${Date.now()}`,
    habit_id: params.habitId,
    mark_date: params.date,
    completed: params.completed,
    note: params.note,
    created_at: params.existing?.created_at ?? timestamp,
    updated_at: timestamp,
  };
}

export function MewingCalendar({
  shareCode,
  habits,
  today,
  initialMonth,
  initialMarks,
  initialToken,
  supabaseUrl,
  supabasePublishableKey,
}: MewingCalendarProps) {
  const sortedHabits = useMemo(() => sortHabits(habits), [habits]);
  const defaultHabit = sortedHabits.find((habit) => habit.slug === DEFAULT_ACTIVE_HABIT) ?? sortedHabits[0];
  const [activeHabitId, setActiveHabitId] = useState(defaultHabit.id);
  const tokenRef = useRef(initialToken.accessToken);
  const tokenExpiresAtRef = useRef(Date.parse(initialToken.expiresAt));
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [entries, setEntries] = useState<HabitEntrySummary[]>(initialMarks);
  const [selectedDate, setSelectedDate] = useState(today);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isHabitDrawerOpen, setIsHabitDrawerOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [message, setMessage] = useState<string | null>(null);

  const activeHabit = sortedHabits.find((habit) => habit.id === activeHabitId) ?? defaultHabit;
  const activeVisual = getHabitVisual(activeHabit);
  const habitIds = useMemo(() => sortedHabits.map((habit) => habit.id), [sortedHabits]);
  const busy = isSavingNote || isTogglingCompletion;

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

  const loadEntries = useCallback(
    async (monthKey: string) => {
      await ensureFreshToken();

      const { start, end } = getCalendarGridBounds(monthKey);
      const { data, error } = await supabase
        .from("habit_marks")
        .select("id, habit_id, mark_date, completed, note, created_at, updated_at")
        .in("habit_id", habitIds)
        .gte("mark_date", start)
        .lte("mark_date", end)
        .order("mark_date", { ascending: true });

      if (error) {
        throw error;
      }

      setEntries(data ?? []);
    },
    [ensureFreshToken, habitIds, supabase],
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
    loadEntries(visibleMonth)
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
  }, [loadEntries, visibleMonth]);

  useEffect(() => {
    const channel = supabase
      .channel("habit_marks:calendar")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_marks",
        },
        () => {
          loadEntries(visibleMonth).catch(() => setMessage("Could not refresh entries."));
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
  }, [loadEntries, supabase, visibleMonth]);

  const activeEntries = useMemo(() => {
    return entries.filter((entry) => entry.habit_id === activeHabit.id);
  }, [activeHabit.id, entries]);

  const entriesByDate = useMemo(() => {
    return new Map(activeEntries.map((entry) => [entry.mark_date, entry]));
  }, [activeEntries]);

  const countsByHabitId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const habit of sortedHabits) {
      counts.set(habit.id, 0);
    }

    for (const entry of entries) {
      if (entry.completed && monthKeyFromDate(entry.mark_date) === visibleMonth) {
        counts.set(entry.habit_id, (counts.get(entry.habit_id) ?? 0) + 1);
      }
    }

    return counts;
  }, [entries, sortedHabits, visibleMonth]);

  const selectedEntry = entriesByDate.get(selectedDate);
  const selectedCompleted = selectedEntry?.completed ?? false;
  const selectedNote = selectedEntry?.note ?? "";
  const selectedHasNote = selectedNote.trim().length > 0;
  const selectedIsEditable = selectedDate === today;

  useEffect(() => {
    setDraftNote(selectedNote);
  }, [activeHabit.id, selectedDate, selectedEntry?.updated_at, selectedNote]);

  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const todayMonth = monthKeyFromDate(today);
  const monthLabel = getMonthLabel(visibleMonth);
  const completedCount = countsByHabitId.get(activeHabit.id) ?? 0;
  const noteDirty = draftNote !== selectedNote;
  const habitStyle: HabitStyle = {
    "--accent": activeVisual.accent,
    "--accent-soft": activeVisual.soft,
  };

  function handleDayClick(date: string) {
    if (isDetailOpen && selectedDate === date) {
      setIsDetailOpen(false);
      return;
    }

    setSelectedDate(date);
    setIsDetailOpen(true);
  }

  function handleHabitSelect(habit: HabitSummary) {
    if (habit.id === activeHabit.id) {
      setIsHabitDrawerOpen(false);
      return;
    }

    if (noteDirty) {
      setMessage("Save or revert the note before switching habits.");
      return;
    }

    setActiveHabitId(habit.id);
    setIsHabitDrawerOpen(false);
    setMessage(null);
  }

  async function persistTodayEntry(params: { completed: boolean; note: string; loadingKind: "note" | "completion" }) {
    if (selectedDate !== today || busy) {
      return;
    }

    const cleanNote = params.note.trim();
    const previousEntries = entries;
    const existing = entriesByDate.get(today);
    const nextEntry = buildOptimisticEntry({
      existing,
      habitId: activeHabit.id,
      date: today,
      completed: params.completed,
      note: cleanNote,
    });
    const shouldDelete = !params.completed && cleanNote.length === 0;

    if (params.loadingKind === "note") {
      setIsSavingNote(true);
    } else {
      setIsTogglingCompletion(true);
    }

    setMessage(null);
    setEntries((current) => {
      const withoutToday = current.filter(
        (entry) => !(entry.habit_id === activeHabit.id && entry.mark_date === today),
      );
      return shouldDelete ? withoutToday : sortEntries([...withoutToday, nextEntry]);
    });

    try {
      await ensureFreshToken();

      if (shouldDelete) {
        const { error } = await supabase
          .from("habit_marks")
          .delete()
          .eq("habit_id", activeHabit.id)
          .eq("mark_date", today);

        if (error) {
          throw error;
        }

        setDraftNote("");
      } else {
        const { data, error } = await supabase
          .from("habit_marks")
          .upsert(
            {
              habit_id: activeHabit.id,
              mark_date: today,
              completed: params.completed,
              note: cleanNote,
            },
            { onConflict: "habit_id,mark_date" },
          )
          .select("id, habit_id, mark_date, completed, note, created_at, updated_at")
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setEntries((current) =>
            sortEntries([
              ...current.filter((entry) => !(entry.habit_id === activeHabit.id && entry.mark_date === today)),
              data,
            ]),
          );
          setDraftNote(data.note);
        }
      }

      setMessage(params.loadingKind === "note" ? "Note saved." : "Completion updated.");
      await loadEntries(visibleMonth).catch(() => setMessage("Saved, but refresh failed."));
    } catch {
      setEntries(previousEntries);
      setMessage(params.loadingKind === "note" ? "Could not save the note." : "Could not update completion.");
    } finally {
      setIsSavingNote(false);
      setIsTogglingCompletion(false);
    }
  }

  return (
    <main
      className={[
        "app-shell",
        "app-shell-detail",
        "app-shell-with-nav",
        isDetailOpen ? "app-shell-panel-open" : "app-shell-panel-closed",
        isHabitDrawerOpen ? "habit-drawer-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={habitStyle}
    >
      <div className="mobile-nav-row">
        <button
          aria-label="Open habit navigation"
          className="mobile-menu-button"
          type="button"
          onClick={() => setIsHabitDrawerOpen(true)}
        >
          <Menu aria-hidden="true" size={22} />
        </button>
        <span>{activeHabit.name}</span>
      </div>

      <aside className="habit-sidebar" aria-label="Habit navigation">
        <div className="habit-sidebar-header">
          <p className="eyebrow">Trackers</p>
          <h2>Habits</h2>
        </div>
        <nav className="habit-list">
          {sortedHabits.map((habit) => {
            const isActive = habit.id === activeHabit.id;
            const visual = getHabitVisual(habit);
            const itemStyle: HabitStyle = {
              "--accent": visual.accent,
              "--accent-soft": visual.soft,
            };

            return (
              <button
                key={habit.id}
                aria-current={isActive ? "page" : undefined}
                className={`habit-nav-item ${isActive ? "habit-nav-item-active" : ""}`}
                style={itemStyle}
                type="button"
                onClick={() => handleHabitSelect(habit)}
              >
                <span className="habit-nav-icon">
                  <HabitIcon habit={habit} />
                </span>
                <span className="habit-nav-copy">
                  <span>{habit.name}</span>
                  <small>{countsByHabitId.get(habit.id) ?? 0} complete</small>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <button
        aria-label="Close habit navigation"
        className="habit-drawer-scrim"
        type="button"
        onClick={() => setIsHabitDrawerOpen(false)}
      />

      <section className="calendar-panel" aria-label={`${activeHabit.name} calendar`}>
        <header className="app-header">
          <div>
            <p className="eyebrow">Daily habit</p>
            <h1>{activeHabit.name}</h1>
          </div>
          <div
            className={`live-pill live-pill-${status}`}
            title={status === "live" ? "Realtime connected" : "Realtime disconnected"}
          >
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
            <p>{completedCount} complete</p>
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
            const entry = entriesByDate.get(day.date);
            const hasNoteOnly = Boolean(entry && !entry.completed && entry.note.trim().length > 0);
            const isToday = day.date === today;
            const isSelected = isDetailOpen && day.date === selectedDate;

            return (
              <button
                key={day.date}
                aria-label={`${day.date}${entry?.completed ? ", complete" : ""}${
                  entry?.note.trim() ? ", has note" : ""
                }`}
                aria-pressed={isSelected}
                className={[
                  "day-cell",
                  "day-cell-clickable",
                  day.inCurrentMonth ? "" : "day-cell-muted",
                  entry?.completed ? "day-cell-marked" : "",
                  hasNoteOnly ? "day-cell-note-only" : "",
                  isToday ? "day-cell-today" : "",
                  isSelected ? "day-cell-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                onClick={() => handleDayClick(day.date)}
              >
                <span className="day-number">{day.dayNumber}</span>
                {entry?.completed ? (
                  <span className="day-x" aria-hidden="true">
                    <X size={44} strokeWidth={3.4} />
                  </span>
                ) : null}
                {hasNoteOnly ? <span className="note-dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <footer className="calendar-footer">
          <button
            className="today-button"
            disabled={visibleMonth === todayMonth}
            type="button"
            onClick={() => {
              setVisibleMonth(todayMonth);
              setSelectedDate(today);
              setIsDetailOpen(true);
            }}
          >
            Today
          </button>
          <div className="footer-message" role="status">
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="spin" size={16} /> Saving
              </>
            ) : (
              message ?? today
            )}
          </div>
        </footer>
      </section>

      <aside
        className={`detail-panel ${isDetailOpen ? "detail-panel-open" : ""}`}
        aria-hidden={!isDetailOpen}
        aria-label={`${formatDateLabel(selectedDate)} details`}
      >
        <header className="detail-header">
          <div>
            <p className="eyebrow">{selectedIsEditable ? "Today" : "Read only"}</p>
            <h2>{formatDateLabel(selectedDate)}</h2>
          </div>
          <div className="detail-header-actions">
            <div className={`completion-chip ${selectedCompleted ? "completion-chip-done" : ""}`}>
              {selectedCompleted ? (
                <CheckCircle2 aria-hidden="true" size={17} />
              ) : (
                <FileText aria-hidden="true" size={17} />
              )}
              <span>{selectedCompleted ? "Complete" : selectedHasNote ? "Note" : "Open"}</span>
            </div>
            <button
              aria-label="Close details"
              className="detail-close-button"
              type="button"
              onClick={() => setIsDetailOpen(false)}
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
        </header>

        <div className="note-editor">
          <label htmlFor="daily-note">Note</label>
          <textarea
            id="daily-note"
            maxLength={NOTE_LIMIT}
            placeholder={selectedIsEditable ? `Add a short note for ${activeHabit.name} today...` : "No note for this day."}
            readOnly={!selectedIsEditable || busy}
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
          />
          <div className="note-meta">
            <span>{selectedIsEditable ? "Shared with anyone using this calendar link." : "Only today can be edited."}</span>
            <span>
              {draftNote.length}/{NOTE_LIMIT}
            </span>
          </div>
        </div>

        <div className="detail-actions">
          <div className="note-action-row">
            <button
              className="save-note-button"
              disabled={!selectedIsEditable || !noteDirty || isSavingNote || isTogglingCompletion}
              type="button"
              onClick={() =>
                persistTodayEntry({
                  completed: selectedCompleted,
                  note: draftNote,
                  loadingKind: "note",
                })
              }
            >
              {isSavingNote ? <Loader2 aria-hidden="true" className="spin" size={18} /> : <Save aria-hidden="true" size={18} />}
              <span>Save note</span>
            </button>
            <button
              className="revert-note-button"
              disabled={!noteDirty || isSavingNote || isTogglingCompletion}
              type="button"
              onClick={() => {
                setDraftNote(selectedNote);
                setMessage("Note reverted.");
              }}
            >
              <RotateCcw aria-hidden="true" size={18} />
              <span>Revert</span>
            </button>
          </div>

          <button
            className={`completion-button ${selectedCompleted ? "completion-button-incomplete" : ""}`}
            disabled={!selectedIsEditable || isSavingNote || isTogglingCompletion}
            type="button"
            onClick={() =>
              persistTodayEntry({
                completed: !selectedCompleted,
                note: draftNote,
                loadingKind: "completion",
              })
            }
          >
            {isTogglingCompletion ? (
              <Loader2 aria-hidden="true" className="spin" size={22} />
            ) : selectedCompleted ? (
              <XCircle aria-hidden="true" size={22} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={22} />
            )}
            <span>{selectedCompleted ? "Mark incomplete" : "Mark complete"}</span>
          </button>
        </div>
      </aside>
    </main>
  );
}
