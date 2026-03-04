ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activities text;
ALTER TABLE public.timeslots ADD COLUMN IF NOT EXISTS requires_24h_advance boolean NOT NULL DEFAULT false;