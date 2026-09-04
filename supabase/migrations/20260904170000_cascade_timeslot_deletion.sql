-- Migration: Add ON DELETE CASCADE, RLS Delete Policies, SECURITY DEFINER Cascade Delete Functions, and GRANTS

-- 1. Redefinir a foreign key da tabela appointments para ON DELETE CASCADE
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_timeslot_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_timeslot_id_fkey
    FOREIGN KEY (timeslot_id) REFERENCES public.timeslots(id) ON DELETE CASCADE;

-- 2. Garantir função helper is_coordinator_of
CREATE OR REPLACE FUNCTION public.is_coordinator_of(user_id uuid, dept_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coordinator_departments
    WHERE profile_id = user_id AND department_id = dept_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar política RLS de deleção na tabela appointments
DROP POLICY IF EXISTS "Department users can delete department appointments" ON public.appointments;
CREATE POLICY "Department users can delete department appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (true);

-- 4. Função RPC com privilégios de Administrador para deleção individual
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

-- 5. Função RPC com privilégios de Administrador para deleção em lote
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

-- 6. Conceder permissão de execução às funções RPC
GRANT EXECUTE ON FUNCTION public.delete_timeslot_cascade(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_timeslots_bulk_cascade(UUID[]) TO authenticated, anon, service_role;

-- 7. Atualizar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
