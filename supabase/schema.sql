-- Mewing Calendar MVP schema.
-- Replace the placeholder UUID with the same value you put in CALENDAR_ID.

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#df322d',
  created_at timestamptz not null default now(),
  unique (calendar_id, slug)
);

create table if not exists public.habit_marks (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  mark_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, mark_date)
);

alter table public.habit_marks replica identity full;

create or replace function public.current_calendar_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'calendar_id', '')::uuid;
$$;

create or replace function public.app_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

alter table public.calendars enable row level security;
alter table public.habits enable row level security;
alter table public.habit_marks enable row level security;

drop policy if exists "Calendars are visible to their secret token" on public.calendars;
create policy "Calendars are visible to their secret token"
on public.calendars
for select
to authenticated
using (id = public.current_calendar_id());

drop policy if exists "Habits are visible to their calendar token" on public.habits;
create policy "Habits are visible to their calendar token"
on public.habits
for select
to authenticated
using (calendar_id = public.current_calendar_id());

drop policy if exists "Marks are visible to their calendar token" on public.habit_marks;
create policy "Marks are visible to their calendar token"
on public.habit_marks
for select
to authenticated
using (
  exists (
    select 1
    from public.habits
    where habits.id = habit_marks.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

drop policy if exists "Only today can be marked" on public.habit_marks;
create policy "Only today can be marked"
on public.habit_marks
for insert
to authenticated
with check (
  mark_date = public.app_today()
  and exists (
    select 1
    from public.habits
    where habits.id = habit_marks.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

drop policy if exists "Only today's mark can be removed" on public.habit_marks;
create policy "Only today's mark can be removed"
on public.habit_marks
for delete
to authenticated
using (
  mark_date = public.app_today()
  and exists (
    select 1
    from public.habits
    where habits.id = habit_marks.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

grant usage on schema public to authenticated;
grant select on public.calendars to authenticated;
grant select on public.habits to authenticated;
grant select, insert, delete on public.habit_marks to authenticated;

-- Run this separately if the publication does not already include habit_marks.
-- alter publication supabase_realtime add table public.habit_marks;

-- Starter data. Replace this one UUID before running.
do $$
declare
  calendar_uuid uuid := 'c5fe366a-77b8-4087-ada7-cedf60ff977d'::uuid;
begin
  insert into public.calendars (id, name)
  values (calendar_uuid, 'Mewing Calendar')
  on conflict (id) do update set name = excluded.name;

  insert into public.habits (calendar_id, name, slug, color)
  values (calendar_uuid, 'Mewing', 'mewing', '#df322d')
  on conflict (calendar_id, slug) do update
  set name = excluded.name,
      color = excluded.color;
end $$;
