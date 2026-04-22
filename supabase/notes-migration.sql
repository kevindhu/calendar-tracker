-- Run this once on an existing Mewing Calendar database to add notes.

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

grant select, insert, update, delete on public.habit_marks to authenticated;
