-- Migration: Fix Timeslot Cascade Deletion and Foreign Key Constraint
-- 1. Redefinir a constraint da chave estrangeira para incluir ON DELETE CASCADE
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_timeslot_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_timeslot_id_fkey
    FOREIGN KEY (timeslot_id) REFERENCES public.timeslots(id) ON DELETE CASCADE;

-- 2. Garantir política de deleção no RLS da tabela appointments para usuários autenticados
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;
CREATE POLICY "Authenticated users can delete appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (true);

-- 3. Função RPC SECURITY DEFINER para exclusão individual de vaga em cascata
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

-- 4. Função RPC SECURITY DEFINER para exclusão em lote de vagas em cascata
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

-- 5. Conceder permissão de execução das funções RPC
GRANT EXECUTE ON FUNCTION public.delete_timeslot_cascade(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_timeslots_bulk_cascade(UUID[]) TO authenticated, anon, service_role;

-- 6. Recarregar o schema do PostgREST
NOTIFY pgrst, 'reload schema';
