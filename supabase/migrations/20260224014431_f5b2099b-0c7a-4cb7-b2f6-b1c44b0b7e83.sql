ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'no-show';