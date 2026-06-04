ALTER TABLE public.schedule_slots
  ADD COLUMN IF NOT EXISTS link_online text;
