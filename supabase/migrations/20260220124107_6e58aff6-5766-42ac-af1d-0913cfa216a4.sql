
-- 1. Add department_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 2. Create security definer function to get user's department_id from profiles
CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id
$$;

-- 3. Drop old RLS policies on timeslots that use get_head_department_id
DROP POLICY IF EXISTS "Department heads can manage own timeslots" ON public.timeslots;
DROP POLICY IF EXISTS "Department heads can update own timeslots" ON public.timeslots;
DROP POLICY IF EXISTS "Department heads can delete own timeslots" ON public.timeslots;

-- Recreate using get_user_department_id
CREATE POLICY "Department users can insert own timeslots"
ON public.timeslots FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'department'::app_role) 
  AND department_id = get_user_department_id(auth.uid())
);

CREATE POLICY "Department users can update own timeslots"
ON public.timeslots FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'department'::app_role) 
  AND department_id = get_user_department_id(auth.uid())
);

CREATE POLICY "Department users can delete own timeslots"
ON public.timeslots FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'department'::app_role) 
  AND department_id = get_user_department_id(auth.uid())
);

-- 4. Drop old RLS policy on appointments that uses get_head_department_id
DROP POLICY IF EXISTS "Department can view own department appointments" ON public.appointments;

-- Recreate using get_user_department_id
CREATE POLICY "Department can view own department appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'department'::app_role) 
  AND timeslot_id IN (
    SELECT t.id FROM timeslots t 
    WHERE t.department_id = get_user_department_id(auth.uid())
  )
);
