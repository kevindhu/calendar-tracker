-- Adds calendar-wide important day flags.

create table if not exists public.calendar_day_flags (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  flag_date date not null,
  important boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, flag_date)
);

alter table public.calendar_day_flags
  add column if not exists important boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.calendar_day_flags replica identity full;

drop trigger if exists set_calendar_day_flags_updated_at on public.calendar_day_flags;
create trigger set_calendar_day_flags_updated_at
before update on public.calendar_day_flags
for each row
execute function public.set_updated_at();

alter table public.calendar_day_flags enable row level security;

drop policy if exists "Day flags are visible to their calendar token" on public.calendar_day_flags;
create policy "Day flags are visible to their calendar token"
on public.calendar_day_flags
for select
to authenticated
using (calendar_id = public.current_calendar_id());

drop policy if exists "Day flags can be added to their calendar" on public.calendar_day_flags;
create policy "Day flags can be added to their calendar"
on public.calendar_day_flags
for insert
to authenticated
with check (calendar_id = public.current_calendar_id());

drop policy if exists "Day flags can be updated in their calendar" on public.calendar_day_flags;
create policy "Day flags can be updated in their calendar"
on public.calendar_day_flags
for update
to authenticated
using (calendar_id = public.current_calendar_id())
with check (calendar_id = public.current_calendar_id());

drop policy if exists "Day flags can be removed from their calendar" on public.calendar_day_flags;
create policy "Day flags can be removed from their calendar"
on public.calendar_day_flags
for delete
to authenticated
using (calendar_id = public.current_calendar_id());

grant select, insert, update, delete on public.calendar_day_flags to authenticated;

-- Run this separately if the publication does not already include calendar_day_flags.
-- alter publication supabase_realtime add table public.calendar_day_flags;
