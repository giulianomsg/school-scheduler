-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has a role assigned via metadata (indicating an invitation)
  IF NEW.raw_user_meta_data->>'role' IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Apenas usuários previamente convidados pelo administrador podem acessar o sistema.';
  END IF;

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
