-- Migration: Add ON DELETE CASCADE to appointments_timeslot_id_fkey so deleting timeslots cascades automatically
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_timeslot_id_fkey,
  ADD CONSTRAINT appointments_timeslot_id_fkey
    FOREIGN KEY (timeslot_id) REFERENCES public.timeslots(id) ON DELETE CASCADE;
