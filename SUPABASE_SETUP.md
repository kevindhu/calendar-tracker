# Supabase Setup

These steps match the newer Supabase dashboard with **API Keys**, **JWT Keys**, **Publishable key**, and **Secret keys**.

## What You Need

Create `.env.local` in this project with these exact variable names:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key"
SUPABASE_SECRET_KEY="sb_secret_your-key"
SUPABASE_JWT_SECRET="your-jwt-secret"
CALENDAR_SHARE_CODE="your-long-private-url-code"
CALENDAR_ID="your-calendar-uuid"
```

The app still supports the old names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, but the names above match the dashboard you are seeing now.

## Step 1: Get the Project URL

1. In the Supabase project, click the green **Connect** button in the top bar.
2. Find/copy the **Project URL**.
3. Put it in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
```

It should look like `https://abcxyz.supabase.co`.

## Step 2: Get the Publishable Key

You are already on the right screen in your screenshot.

1. Go to **Settings > API Keys**.
2. Stay on **Publishable and secret API keys**.
3. Under **Publishable key**, copy the `default` key.
4. Put it in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

This key is safe to use in browser code when RLS policies are configured.

## Step 3: Get the Secret Key

On that same **Settings > API Keys** screen:

1. Under **Secret keys**, find the `default` secret key.
2. Click the reveal/copy button.
3. Put it in `.env.local`:

```bash
SUPABASE_SECRET_KEY="sb_secret_..."
```

This key is server-only. Do not add `NEXT_PUBLIC_` to it.

## Step 4: Get the JWT Secret

This app mints short-lived custom JWTs so Supabase Realtime and RLS can work with the private URL.

1. In the left sidebar, click **JWT Keys**.
2. Open the **Legacy JWT Secret** tab if it is shown.
3. Reveal/copy the JWT secret.
4. Put it in `.env.local`:

```bash
SUPABASE_JWT_SECRET="..."
```

If you cannot reveal an existing secret, use the dashboard option to create/change the legacy secret and choose **Create my own secret**. Use the same secret value in `SUPABASE_JWT_SECRET`.

## Step 5: Create a Calendar UUID

Open **SQL Editor** and run:

```sql
select gen_random_uuid();
```

Copy the UUID result into `.env.local`:

```bash
CALENDAR_ID="the-uuid-you-generated"
```

## Step 6: Choose Your Private URL Code

Pick a long code that only you and your friend know:

```bash
CALENDAR_SHARE_CODE="mewing-something-long-random"
```

Your local app URL will be:

```txt
http://localhost:3000/c/mewing-something-long-random
```

Your production app URL will be:

```txt
https://yourdomain.com/c/mewing-something-long-random
```

The homepage `/` intentionally returns 404.

## Step 7: Run the Database SQL

Open `supabase/schema.sql`.

Near the bottom, replace the one placeholder UUID:

```txt
00000000-0000-0000-0000-000000000000
```

with the same UUID from `CALENDAR_ID`.

Then copy the full file into the Supabase **SQL Editor** and run it. It creates:

- `calendars`
- `habits`
- `habit_marks`
- RLS policies
- the starter `Mewing` habit

## Step 8: Enable Realtime

In Supabase:

1. Go to **Database > Publications**.
2. Open `supabase_realtime`.
3. Enable `habit_marks`.

If you prefer SQL, run:

```sql
alter publication supabase_realtime add table public.habit_marks;
```

If Supabase says the table is already in the publication, that is fine.

## Step 9: Run Locally

```bash
npm install
npm run dev
```

Open your private URL:

```txt
http://localhost:3000/c/YOUR_CALENDAR_SHARE_CODE
```

Expected behavior:

- `/` returns 404.
- Wrong share codes return 404.
- The valid route opens the Mewing calendar.
- Only today can be toggled.
- Two browser windows sync changes live.

## Vercel

Add the same six variables in **Vercel > Project > Settings > Environment Variables**, then redeploy.
