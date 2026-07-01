-- Fase 6 — Corrige recursão infinita nas RLS policies do RBAC
--
-- As policies "*_admin_users_select" faziam EXISTS (SELECT 1 FROM admin_users ...)
-- diretamente. Como admin_users também tem RLS habilitada com essa mesma policy,
-- o Postgres reavalia a policy recursivamente ao checar a subquery, causando
-- "infinite recursion detected in policy for relation admin_users" (erro 500 em
-- todas as tabelas RBAC). A correção usa uma função SECURITY DEFINER, que
-- roda com privilégios do dono da função e ignora RLS internamente — sem
-- recursão.
CREATE OR REPLACE FUNCTION public.is_active_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = p_user_id AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_admin_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "admin_roles_admin_users_select" ON public.admin_roles;
CREATE POLICY "admin_roles_admin_users_select" ON public.admin_roles FOR SELECT
  USING (public.is_active_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admin_permissions_admin_users_select" ON public.admin_permissions;
CREATE POLICY "admin_permissions_admin_users_select" ON public.admin_permissions FOR SELECT
  USING (public.is_active_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admin_users_admin_users_select" ON public.admin_users;
CREATE POLICY "admin_users_admin_users_select" ON public.admin_users FOR SELECT
  USING (public.is_active_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admin_user_roles_admin_users_select" ON public.admin_user_roles;
CREATE POLICY "admin_user_roles_admin_users_select" ON public.admin_user_roles FOR SELECT
  USING (public.is_active_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admin_role_permissions_admin_users_select" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_admin_users_select" ON public.admin_role_permissions FOR SELECT
  USING (public.is_active_admin_user(auth.uid()));
