-- Migration: Prevent double booking of active timeslots
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_timeslot_appointment 
ON public.appointments (timeslot_id) 
WHERE status = 'active';
