-- Adicionar role 'coordinator' ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinator';

-- Criar tabela de relacionamento para coordenadores
CREATE TABLE IF NOT EXISTS public.coordinator_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, department_id)
);

-- Ativar RLS
ALTER TABLE public.coordinator_departments ENABLE ROW LEVEL SECURITY;

-- Politicas basicas (Apenas Admin pode gerenciar livremente)
CREATE POLICY "Admins full access on coordinator_departments"
ON public.coordinator_departments
FOR ALL
USING ( public.has_role(auth.uid(), 'admin'::app_role) );

-- O proprio coordenador pode ver suas associacoes
CREATE POLICY "Coordinators can view their own departments"
ON public.coordinator_departments
FOR SELECT
USING ( profile_id = auth.uid() );
