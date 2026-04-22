# Calendar Habit Tracker Plan

## Goal

Build a small shared calendar app where a date can be marked with an X. Version 1 tracks one habit, Mewing, but the app should be structured so more habits can be added later.

## Recommended Stack

- Next.js with the App Router
- TypeScript
- Supabase Postgres for saved marks
- Supabase Realtime so two people can see changes without refreshing
- Vercel for hosting and the custom domain

## MVP Scope

Version 1 should include:

- Month calendar view
- Previous/next month navigation
- Today indicator
- Click/tap a day to toggle an X
- Cloud persistence through Supabase
- Live updates across open browsers/devices
- One default habit: Mewing
- Mobile-friendly layout

Version 1 can skip:

- Multiple habit management UI
- Analytics/streak charts
- Push notifications
- Complex roles/permissions
- Native mobile app packaging

## Future-Friendly Data Model

Even though the UI starts with one habit, the database should have a `habits` table and a `habit_marks` table.

That gives us a clean path to add:

- multiple habits
- habit colors/icons
- archived habits
- per-person progress
- notes or mood values per date
- streak/history pages

## Authentication Options

### Option A: Private Shared Link

Fastest MVP. The app is protected by an unguessable calendar URL or access code.

Pros:

- simplest
- no login friction
- good for two trusted users

Cons:

- anyone with the link can edit
- harder to show who marked what
- less future-proof

### Option B: Supabase Auth

Both users log in. Supabase policies control who can read/write the calendar.

Pros:

- cleaner security
- better for expansion
- supports user-specific marks later

Cons:

- more setup
- slightly more friction

Version 1 uses the private shared link model.

## Shared Mark vs Per-Person Mark

There are two possible behaviors:

### One shared X per date

If either person marks a date, that date is marked for everyone. Clicking again removes the shared X.

Best when the habit is truly shared, like "we did the thing today."

### One X per person per date

Each person has their own mark. A date could show none, one person, or both.

Best when the habit is individual but shared for accountability.

Version 1 uses one shared X per date.

## Suggested Build Phases

1. Create the Next.js app scaffold.
2. Add base UI: calendar grid, month navigation, responsive layout.
3. Add local mock state for toggling X marks.
4. Add Supabase client, short-lived server-issued JWTs, and environment variables.
5. Create Supabase tables, RLS policies, and starter Mewing habit.
6. Replace mock state with database reads/writes.
7. Add realtime subscription for `habit_marks`.
8. Add private-link protection.
9. Deploy to Vercel.
10. Add custom domain.

## Configuration Approach

Use `.env.local` for Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
SUPABASE_SECRET_KEY=""
SUPABASE_JWT_SECRET=""
CALENDAR_SHARE_CODE=""
CALENDAR_ID=""
```

Use app config only for non-secret values, such as:

```json
{
  "defaultHabitSlug": "daily-habit",
  "appName": "Calendar Tracker"
}
```

Secrets should never live in a committed JSON file.

## Open Questions

1. Future: should multiple habits be selectable from the same route or separate secret routes?
2. Future: should per-person marks be added after login exists?
3. Future: should a yearly overview be added once enough history exists?
