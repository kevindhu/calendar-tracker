-- Safe to run against an existing calendar database.
-- Speeds up the growing streak-history query without indexing incomplete rows.
create index if not exists habit_marks_completed_streak_idx
  on public.habit_marks (habit_id, mark_date desc)
  where completed = true;
