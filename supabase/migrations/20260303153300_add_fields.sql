-- Migration: Add fields for phone, activities, requested_attendant_id, requires_24h_advance

-- profiles: phone, activities (department_id is already there)
ALTER TABLE public.profiles
ADD COLUMN phone text,
ADD COLUMN activities text;

-- appointments: requested_attendant_id
ALTER TABLE public.appointments
ADD COLUMN requested_attendant_id uuid REFERENCES public.profiles(id);

-- timeslots: requires_24h_advance
ALTER TABLE public.timeslots
ADD COLUMN requires_24h_advance boolean NOT NULL DEFAULT true;
