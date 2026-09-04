-- Migration: Add ON DELETE CASCADE, RLS Delete Policies, and SECURITY DEFINER Cascade Delete Functions

-- 0. Ensure helper function is_coordinator_of exists safely
CREATE OR REPLACE FUNCTION public.is_coordinator_of(user_id uuid, dept_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coordinator_departments
    WHERE profile_id = user_id AND department_id = dept_id
  );
EXCEPTION WHEN undefined_table THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Add ON DELETE CASCADE to foreign key constraint
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_timeslot_id_fkey,
  ADD CONSTRAINT appointments_timeslot_id_fkey
    FOREIGN KEY (timeslot_id) REFERENCES public.timeslots(id) ON DELETE CASCADE;

-- 2. RLS DELETE policy for appointments
DROP POLICY IF EXISTS "Department users can delete department appointments" ON public.appointments;
CREATE POLICY "Department users can delete department appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.timeslots t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = appointments.timeslot_id
        AND (
          p.role::text = 'admin'
          OR (p.role::text = 'department' AND (t.department_id = p.department_id OR t.department_id = public.get_head_department_id(auth.uid())))
          OR (p.role::text = 'coordinator' AND public.is_coordinator_of(auth.uid(), t.department_id))
        )
    )
  );

-- 3. SECURITY DEFINER RPC function for single timeslot deletion
CREATE OR REPLACE FUNCTION public.delete_timeslot_cascade(p_timeslot_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.appointments WHERE timeslot_id = p_timeslot_id;
  DELETE FROM public.timeslots WHERE id = p_timeslot_id;
END;
$$;

-- 4. SECURITY DEFINER RPC function for bulk timeslot deletion
CREATE OR REPLACE FUNCTION public.delete_timeslots_bulk_cascade(p_timeslot_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.appointments WHERE timeslot_id = ANY(p_timeslot_ids);
  DELETE FROM public.timeslots WHERE id = ANY(p_timeslot_ids);
END;
$$;
