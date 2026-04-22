-- Run this once to add the Manga habit to an existing calendar.
-- Make sure calendar_uuid matches CALENDAR_ID.

do $$
declare
  calendar_uuid uuid := 'c5fe366a-77b8-4087-ada7-cedf60ff977d'::uuid;
begin
  insert into public.habits (calendar_id, name, slug, color)
  values (calendar_uuid, 'Manga', 'manga', '#0f8a62')
  on conflict (calendar_id, slug) do update
  set name = excluded.name,
      color = excluded.color;
end $$;
