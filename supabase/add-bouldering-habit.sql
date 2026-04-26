-- Run this once to add the Bouldering habit to an existing calendar.
-- Make sure calendar_uuid matches CALENDAR_ID.

do $$
declare
  calendar_uuid uuid := 'c5fe366a-77b8-4087-ada7-cedf60ff977d'::uuid;
begin
  insert into public.habits (calendar_id, name, slug, color)
  values (calendar_uuid, 'Bouldering', 'bouldering', '#2563eb')
  on conflict (calendar_id, slug) do update
  set name = excluded.name,
      color = excluded.color;
end $$;
