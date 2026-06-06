-- Adds habit-specific important day flags.

create table if not exists public.calendar_day_flags (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  flag_date date not null,
  important boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, flag_date)
);

alter table public.calendar_day_flags
  add column if not exists habit_id uuid references public.habits(id) on delete cascade,
  add column if not exists important boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'calendar_day_flags_calendar_id_flag_date_key'
      and conrelid = 'public.calendar_day_flags'::regclass
  ) then
    alter table public.calendar_day_flags
      drop constraint calendar_day_flags_calendar_id_flag_date_key;
  end if;
end $$;

-- Existing calendar-wide flags did not store the source habit, so preserve
-- them by copying each old flag to every habit in that calendar.
insert into public.calendar_day_flags (calendar_id, habit_id, flag_date, important, created_at, updated_at)
select
  calendar_day_flags.calendar_id,
  habits.id,
  calendar_day_flags.flag_date,
  calendar_day_flags.important,
  calendar_day_flags.created_at,
  calendar_day_flags.updated_at
from public.calendar_day_flags
join public.habits
  on habits.calendar_id = calendar_day_flags.calendar_id
where calendar_day_flags.habit_id is null
  and not exists (
    select 1
    from public.calendar_day_flags existing_flags
    where existing_flags.habit_id = habits.id
      and existing_flags.flag_date = calendar_day_flags.flag_date
  );

delete from public.calendar_day_flags
where habit_id is null;

delete from public.calendar_day_flags duplicate_flags
using public.calendar_day_flags kept_flags
where duplicate_flags.habit_id = kept_flags.habit_id
  and duplicate_flags.flag_date = kept_flags.flag_date
  and duplicate_flags.id > kept_flags.id;

alter table public.calendar_day_flags
  alter column habit_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_day_flags_habit_id_flag_date_key'
      and conrelid = 'public.calendar_day_flags'::regclass
  ) then
    alter table public.calendar_day_flags
      add constraint calendar_day_flags_habit_id_flag_date_key
      unique (habit_id, flag_date);
  end if;
end $$;

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
using (
  calendar_id = public.current_calendar_id()
  and exists (
    select 1
    from public.habits
    where habits.id = calendar_day_flags.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

drop policy if exists "Day flags can be added to their calendar" on public.calendar_day_flags;
create policy "Day flags can be added to their calendar"
on public.calendar_day_flags
for insert
to authenticated
with check (
  calendar_id = public.current_calendar_id()
  and exists (
    select 1
    from public.habits
    where habits.id = calendar_day_flags.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

drop policy if exists "Day flags can be updated in their calendar" on public.calendar_day_flags;
create policy "Day flags can be updated in their calendar"
on public.calendar_day_flags
for update
to authenticated
using (
  calendar_id = public.current_calendar_id()
  and exists (
    select 1
    from public.habits
    where habits.id = calendar_day_flags.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
)
with check (
  calendar_id = public.current_calendar_id()
  and exists (
    select 1
    from public.habits
    where habits.id = calendar_day_flags.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

drop policy if exists "Day flags can be removed from their calendar" on public.calendar_day_flags;
create policy "Day flags can be removed from their calendar"
on public.calendar_day_flags
for delete
to authenticated
using (
  calendar_id = public.current_calendar_id()
  and exists (
    select 1
    from public.habits
    where habits.id = calendar_day_flags.habit_id
      and habits.calendar_id = public.current_calendar_id()
  )
);

grant select, insert, update, delete on public.calendar_day_flags to authenticated;

-- Run this separately if the publication does not already include calendar_day_flags.
-- alter publication supabase_realtime add table public.calendar_day_flags;
