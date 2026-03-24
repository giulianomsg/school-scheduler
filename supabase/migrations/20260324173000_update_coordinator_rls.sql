-- Helper function check 
CREATE OR REPLACE FUNCTION public.is_coordinator_of(user_id uuid, dept_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coordinator_departments
    WHERE profile_id = user_id AND department_id = dept_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TIMESLOTS POLICIES for Coordinator
CREATE POLICY "Coordinator can insert own timeslots" ON public.timeslots 
FOR INSERT TO authenticated 
WITH CHECK (
  public.has_role(auth.uid(), 'coordinator'::public.app_role) AND 
  public.is_coordinator_of(auth.uid(), department_id)
);

CREATE POLICY "Coordinator can update own timeslots" ON public.timeslots 
FOR UPDATE TO authenticated 
USING (
  public.has_role(auth.uid(), 'coordinator'::public.app_role) AND 
  public.is_coordinator_of(auth.uid(), department_id)
);

CREATE POLICY "Coordinator can delete own timeslots" ON public.timeslots 
FOR DELETE TO authenticated 
USING (
  public.has_role(auth.uid(), 'coordinator'::public.app_role) AND 
  public.is_coordinator_of(auth.uid(), department_id)
);

-- APPOINTMENTS POLICIES for Coordinator
CREATE POLICY "Coordinator can view own department appointments" ON public.appointments 
FOR SELECT TO authenticated 
USING (
  public.has_role(auth.uid(), 'coordinator'::public.app_role) AND 
  (timeslot_id IN (
    SELECT t.id FROM public.timeslots t 
    WHERE public.is_coordinator_of(auth.uid(), t.department_id)
  ))
);

CREATE POLICY "Coordinator can update own department appointments" ON public.appointments 
FOR UPDATE TO authenticated 
USING (
  public.has_role(auth.uid(), 'coordinator'::public.app_role) AND 
  (timeslot_id IN (
    SELECT t.id FROM public.timeslots t 
    WHERE public.is_coordinator_of(auth.uid(), t.department_id)
  ))
);
