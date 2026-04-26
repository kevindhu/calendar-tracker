-- Mewing Calendar MVP schema.
-- Make sure the calendar_uuid near the bottom matches CALENDAR_ID.

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
  completed boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, mark_date)
);

alter table public.habit_marks
  add column if not exists completed boolean not null default true,
  add column if not exists note text not null default '',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habit_marks_note_length_check'
      and conrelid = 'public.habit_marks'::regclass
  ) then
    alter table public.habit_marks
      add constraint habit_marks_note_length_check
      check (char_length(note) <= 280);
  end if;
end $$;

alter table public.habit_marks replica identity full;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_habit_marks_updated_at on public.habit_marks;
create trigger set_habit_marks_updated_at
before update on public.habit_marks
for each row
execute function public.set_updated_at();

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

drop policy if exists "Only today can be updated" on public.habit_marks;
create policy "Only today can be updated"
on public.habit_marks
for update
to authenticated
using (
  mark_date = public.app_today()
  and exists (
    select 1
    from public.habits
    where habits.id = habit_marks.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
)
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
grant select, insert, update, delete on public.habit_marks to authenticated;

-- Run this separately if the publication does not already include habit_marks.
-- alter publication supabase_realtime add table public.habit_marks;

-- Starter data. Make sure this UUID matches CALENDAR_ID.
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

  insert into public.habits (calendar_id, name, slug, color)
  values (calendar_uuid, 'Manga', 'manga', '#0f8a62')
  on conflict (calendar_id, slug) do update
  set name = excluded.name,
      color = excluded.color;

  insert into public.habits (calendar_id, name, slug, color)
  values (calendar_uuid, 'Bouldering', 'bouldering', '#2563eb')
  on conflict (calendar_id, slug) do update
  set name = excluded.name,
      color = excluded.color;
end $$;
