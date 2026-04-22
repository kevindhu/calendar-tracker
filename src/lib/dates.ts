import { APP_TIME_ZONE } from "@/lib/app-config";

export type CalendarDay = {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function getTodayInAppTimeZone(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format the app date.");
  }

  return `${year}-${month}-${day}`;
}

export function monthKeyFromDate(dateString: string): string {
  return dateString.slice(0, 7);
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

export function addMonths(monthKey: string, amount: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

export function getMonthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function getMonthBounds(monthKey: string): { start: string; end: string } {
  const { year, month } = parseMonthKey(monthKey);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

export function getCalendarGridBounds(monthKey: string): { start: string; end: string } {
  const days = getCalendarDays(monthKey);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return {
    start: firstDay.date,
    end: lastDay.date,
  };
}

export function getCalendarDays(monthKey: string): CalendarDay[] {
  const { year, month } = parseMonthKey(monthKey);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = firstDay.getUTCDay();

  return Array.from({ length: 42 }, (_, index) => {
    const dayOfMonth = index - leadingDays + 1;
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth));

    return {
      date: formatUtcDate(date),
      dayNumber: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === month - 1,
    };
  });
}
