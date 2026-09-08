CREATE TABLE IF NOT EXISTS public.coordinator_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, department_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coordinator_departments TO authenticated;
GRANT ALL ON public.coordinator_departments TO service_role;

ALTER TABLE public.coordinator_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam vinculos de coordenadores"
ON public.coordinator_departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Usuario ve seus proprios vinculos"
ON public.coordinator_departments FOR SELECT TO authenticated
USING (profile_id = auth.uid());