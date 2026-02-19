
-- 1. Create unidades_escolares table
CREATE TABLE public.unidades_escolares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_escola TEXT NOT NULL,
  tipo_escola TEXT,
  etapa_ano TEXT,
  email_escola TEXT,
  telefone_escola TEXT,
  telefone_escola2 TEXT,
  celular_escola TEXT,
  whatsapp_escola TEXT,
  endereco_escola TEXT,
  numero_endereco TEXT,
  bairro_escola TEXT,
  macro_regiao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.unidades_escolares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view unidades_escolares"
ON public.unidades_escolares FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert unidades_escolares"
ON public.unidades_escolares FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update unidades_escolares"
ON public.unidades_escolares FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete unidades_escolares"
ON public.unidades_escolares FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_unidades_escolares_updated_at
BEFORE UPDATE ON public.unidades_escolares
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Alter profiles: drop school_unit, add school_unit_id, cargo, whatsapp
ALTER TABLE public.profiles DROP COLUMN IF EXISTS school_unit;

ALTER TABLE public.profiles
  ADD COLUMN school_unit_id UUID REFERENCES public.unidades_escolares(id) ON DELETE SET NULL,
  ADD COLUMN cargo TEXT,
  ADD COLUMN whatsapp TEXT;

-- 3. Fix RLS on appointments
-- Drop the permissive global SELECT
DROP POLICY IF EXISTS "All authenticated can view appointments" ON public.appointments;

-- School can only see own appointments
CREATE POLICY "School can view own appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'school'::app_role) AND requester_id = auth.uid())
);

-- Department can see appointments for their department's timeslots
CREATE POLICY "Department can view own department appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'department'::app_role)
  AND timeslot_id IN (
    SELECT t.id FROM public.timeslots t
    WHERE t.department_id = get_head_department_id(auth.uid())
  )
);

-- Admin can see all
CREATE POLICY "Admin can view all appointments"
ON public.appointments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate INSERT policy with double-booking prevention
DROP POLICY IF EXISTS "School users can create appointments" ON public.appointments;

CREATE POLICY "School users can create appointments no double booking"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND has_role(auth.uid(), 'school'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.timeslots
    WHERE id = timeslot_id AND is_available = true
  )
);

-- 4. Update handle_new_user trigger to remove school_unit reference
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'school')
  );
  RETURN NEW;
END;
$$;
