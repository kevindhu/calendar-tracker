# Routine Calendar Tracker

A private shared calendar for tracking daily routines with notes, streaks, and live updates across clients.

This started as a mewing tracker, but the app is now a general-purpose routine tracker. The current UI supports multiple habits in one calendar, each with its own completion history, notes, and streak.

## What It Does

- Tracks multiple routines in a single shared calendar
- Uses a private route: `/c/[shareCode]`
- Lets anyone with the link view the calendar and update today's entry
- Syncs completion and note changes live across clients with Supabase Realtime
- Stores both completion state and an optional note for each habit/day
- Shows a current streak for every habit
- Uses flame tiers for streaks:
  - default flame: `0-29` days
  - blue flame: `30-99` days
  - purple flame: `100+` days
- Shows a prominent streak badge for the active habit and a streak label in the left sidebar
- Updates the browser tab title to include the active habit and current streak count
- Confirms before marking a completed day back to incomplete
- Shows a confetti celebration when a habit is marked complete

## Current Behavior

- Only **today** can be edited
- Past days are read-only
- Notes are limited to `280` characters
- A day can be:
  - incomplete
  - complete
  - note-only
  - complete with a note
- If a completed day also has a note, the calendar cell shows both the large `X` and a separate note icon
- Streaks use a "grace today" rule:
  - if today is not complete yet, the current streak can still continue through yesterday
  - once today is marked complete, the streak increments immediately

## Stack

- Next.js
- React
- TypeScript
- Supabase Postgres
- Supabase Realtime
- Vercel

## Local Development

```bash
npm install
npm run dev
```

Create `.env.local` before opening the private route.

## Environment Variables

Use these exact variable names:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key"
SUPABASE_SECRET_KEY="sb_secret_your-key"
SUPABASE_JWT_SECRET="your-jwt-secret"
CALENDAR_SHARE_CODE="your-long-private-url-code"
CALENDAR_ID="your-calendar-uuid"
```

The app still supports the older names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, but the names above match the current Supabase dashboard.

## Supabase Setup

Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md), then run the SQL in [supabase/schema.sql](./supabase/schema.sql).

Important setup notes:

- Make sure the `calendar_uuid` near the bottom of `supabase/schema.sql` matches `CALENDAR_ID`
- The starter data currently inserts example habits named `Mewing`, `Manga`, and `Bouldering`
- Those are just seed rows; this app is not limited to those routines

If you want different starter routines, edit the `public.habits` inserts near the bottom of [supabase/schema.sql](./supabase/schema.sql) before running it, or update the rows later in Supabase.

## Realtime

Realtime must be enabled for `public.habit_marks`.

If you prefer SQL, run:

```sql
alter publication supabase_realtime add table public.habit_marks;
```

You can verify it with:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

Expected row:

```txt
public | habit_marks
```

Without this, the app still works, but mark/note/streak changes will not live update across open clients.

## Legacy Migrations

If you already created the original database before notes existed, run [supabase/notes-migration.sql](./supabase/notes-migration.sql).

If you are upgrading an older setup and want the Manga or Bouldering examples inserted, run [supabase/add-manga-habit.sql](./supabase/add-manga-habit.sql) or [supabase/add-bouldering-habit.sql](./supabase/add-bouldering-habit.sql).

For brand new installs, use [supabase/schema.sql](./supabase/schema.sql) and you do not need those extra migrations.

## Private Route Behavior

- `/` intentionally returns `404`
- invalid share codes return `404`
- the main app lives at `/c/[shareCode]`
- the route issues a short-lived session token used for RLS and Realtime access

## Streak Flames

The app uses animated GIF flames from `public/`:

- `cute_flame3.gif`
- `cute_flame3_blue.gif`
- `cute_flame3_purple.gif`

There is also a helper script for recoloring flame GIFs:

- [scripts/colorize_flame_gif.py](./scripts/colorize_flame_gif.py)

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
```

## Deploying

Add the same environment variables in Vercel and redeploy.

Your live route will look like:

```txt
https://yourdomain.com/c/YOUR_CALENDAR_SHARE_CODE
```
