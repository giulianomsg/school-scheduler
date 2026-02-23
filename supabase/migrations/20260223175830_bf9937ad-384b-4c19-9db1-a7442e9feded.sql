
-- Corrigir política de INSERT para ser mais restritiva (apenas admins podem inserir via client; service role bypassa RLS)
DROP POLICY "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
