-- Admin audit log table for GoFit platform administration
-- Tracks all administrative actions for security and compliance

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action          TEXT        NOT NULL,
  target_type     TEXT,
  target_id       UUID,
  contractor_id   UUID,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only platform owners can read audit logs
CREATE POLICY "platform_owners_select_audit_logs"
  ON public.admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_owners
      WHERE user_id = auth.uid()
    )
  );

-- SECURITY DEFINER function allows audit insertion even before/after auth session,
-- covering denied login attempts and logout events where RLS would otherwise block.
-- Anyone can call this function but writes go to the append-only audit table only.
CREATE OR REPLACE FUNCTION public.insert_admin_audit_log(
  p_admin_user_id UUID,
  p_action        TEXT,
  p_target_type   TEXT    DEFAULT NULL,
  p_target_id     UUID    DEFAULT NULL,
  p_contractor_id UUID    DEFAULT NULL,
  p_metadata      JSONB   DEFAULT '{}',
  p_user_agent    TEXT    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    admin_user_id, action, target_type, target_id,
    contractor_id, metadata, user_agent
  ) VALUES (
    p_admin_user_id, p_action, p_target_type, p_target_id,
    p_contractor_id, COALESCE(p_metadata, '{}'), p_user_agent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_admin_audit_log TO anon, authenticated;

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action      ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user  ON public.admin_audit_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at  ON public.admin_audit_logs (created_at DESC);
