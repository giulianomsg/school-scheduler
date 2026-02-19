-- Trigger: mark timeslot unavailable when appointment is created
CREATE TRIGGER on_appointment_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_insert();

-- Trigger: revert timeslot availability when appointment is cancelled
CREATE TRIGGER on_appointment_cancel
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_cancel();
