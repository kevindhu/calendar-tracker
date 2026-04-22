# Mewing Calendar

A tiny shared calendar app for tracking habits like **Mewing** and **Manga**.

Version 1 is built with Next.js, Supabase Postgres, Supabase Realtime, and Vercel. The app is private by route: `/c/[shareCode]`.

## Local Development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` before opening the private route.

## Supabase

Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md), then run the SQL in [supabase/schema.sql](./supabase/schema.sql).

If you already created the original database, run [supabase/notes-migration.sql](./supabase/notes-migration.sql) before deploying the notes UI.

To add Manga to an existing database, run [supabase/add-manga-habit.sql](./supabase/add-manga-habit.sql).

## Scripts

```bash
npm run typecheck
npm run build
```
