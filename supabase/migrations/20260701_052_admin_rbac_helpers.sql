-- Fase 6 — RBAC Administrativo: função auxiliar para /admin/users
--
-- O frontend não pode consultar auth.users diretamente (sem RLS pública).
-- Esta função permite localizar um usuário Supabase Auth existente pelo
-- e-mail, para vincular um admin_users sem precisar de service role no
-- frontend. Só platform_owners ou admin_users ativos podem chamar.
CREATE OR REPLACE FUNCTION public.find_auth_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND status = 'active')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text FROM auth.users u WHERE lower(u.email) = lower(p_email) LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_auth_user_by_email(text) TO authenticated;
