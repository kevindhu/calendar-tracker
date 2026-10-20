import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import CalendarPage from "../src/app/c/[shareCode]/page";
import { CalendarLoadError } from "../src/components/calendar-load-error";
import { MewingCalendar } from "../src/components/mewing-calendar";
import { SetupPanel } from "../src/components/setup-panel";

const calendarId = "11111111-1111-4111-8111-111111111111";
const calendar = { id: calendarId, name: "Test calendar", created_at: "2026-01-01" };
const habit = {
  id: "22222222-2222-4222-8222-222222222222",
  calendar_id: calendarId,
  name: "Roblox",
  slug: "roblox",
  color: "#111827",
  created_at: "2026-01-01",
};
const originalEnv = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://calendar-test.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SECRET_KEY: "test-secret-key",
    SUPABASE_JWT_SECRET: "test-jwt-secret-for-calendar-loading",
    CALENDAR_SHARE_CODE: "test-share-code",
    CALENDAR_ID: calendarId,
  });
  mock.method(console, "error", () => undefined);
});

afterEach(() => {
  mock.restoreAll();
  process.env = { ...originalEnv };
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function healthyResponse(url: URL) {
  if (url.pathname.endsWith("/calendars")) return json([calendar]);
  if (url.pathname.endsWith("/habits")) return json([habit]);
  return json([]);
}

function renderCalendar(shareCode = "test-share-code") {
  return CalendarPage({ params: Promise.resolve({ shareCode }) });
}

test("gateway timeouts offer retry and the calendar loads when the service recovers", async () => {
  let unavailable = true;
  const requests: string[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    return unavailable ? json({ message: "Gateway Timeout" }, 504) : healthyResponse(url);
  });

  const result = await renderCalendar();
  assert.equal(result.type, CalendarLoadError);
  assert.equal(requests.filter((path) => path.endsWith("/calendars")).length, 2);
  assert.equal(requests.filter((path) => path.endsWith("/habits")).length, 2);

  unavailable = false;
  const recovered = await renderCalendar();
  assert.equal(recovered.type, MewingCalendar);
  assert.equal(recovered.props.calendarId, calendarId);
  assert.equal(recovered.props.habits[0].id, habit.id);
});

test("network errors do not multiply the fetch wrapper's two attempts", async () => {
  let attempts = 0;
  mock.method(globalThis, "fetch", async () => {
    attempts += 1;
    throw new TypeError("fetch failed");
  });

  assert.equal((await renderCalendar()).type, CalendarLoadError);
  assert.equal(attempts, 4); // Calendar and habits each get two attempts.
});

test("a successful query with no calendar still reports missing setup", async () => {
  mock.method(globalThis, "fetch", async () => json([]));
  const result = await renderCalendar();
  assert.equal(result.type, SetupPanel);
  assert.equal(result.props.title, "Calendar row not found");
});

test("a successful query with no habits still reports missing setup", async () => {
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    return url.pathname.endsWith("/calendars") ? json([calendar]) : json([]);
  });
  const result = await renderCalendar();
  assert.equal(result.type, SetupPanel);
  assert.equal(result.props.title, "Habits not found");
});

for (const resource of ["habits", "marks", "streaks"]) {
  test(`${resource} request failures offer retry instead of setup instructions`, async () => {
    mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const failing = resource === "habits"
        ? url.pathname.endsWith("/habits")
        : url.pathname.endsWith("/habit_marks") &&
          url.searchParams.has("completed") === (resource === "streaks");
      return failing ? json({ message: "Service Unavailable" }, 503) : healthyResponse(url);
    });
    assert.equal((await renderCalendar()).type, CalendarLoadError);
  });
}

test("invalid share codes are rejected before any database request", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => json([]));
  await assert.rejects(renderCalendar("wrong-code"), /NEXT_HTTP_ERROR_FALLBACK;404/);
  assert.equal(fetch.mock.callCount(), 0);
});
