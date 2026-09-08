ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;