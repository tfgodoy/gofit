-- ══════════════════════════════════════════════════════════════════
-- Fase 3 — Seed de Planos e Migração de Contractors para Assinaturas
-- Idempotente: ON CONFLICT DO NOTHING em todas as inserções
-- ══════════════════════════════════════════════════════════════════

-- Seed: 4 planos padrão GoFit (equivalem aos valores legacy de contractors.plan)
INSERT INTO public.saas_plans (name, slug, description, price_monthly, price_yearly, max_students, max_staff, max_units, trial_days, sort_order, status)
VALUES
  ('Trial',        'trial',        'Acesso gratuito por período de avaliação',   0,   NULL, 50,   5,    1, 14, 0, 'active'),
  ('Starter',      'starter',      'Ideal para academias em crescimento',         89,  890,  200,  15,   1, 14, 1, 'active'),
  ('Profissional', 'profissional', 'Para academias estabelecidas e em expansão', 179, 1790, 500,  30,   1, 14, 2, 'active'),
  ('Empresarial',  'empresarial',  'Solução completa para redes de academias',   299, 2990, NULL, NULL, 5, 14, 3, 'active')
ON CONFLICT (slug) DO NOTHING;

-- Migrar contractors existentes para saas_subscriptions
-- Mapeia contractors.status → saas_subscriptions.status:
--   active    → active
--   trial     → trialing
--   inactive  → cancelled
--   suspended → blocked
-- Só cria assinatura se o contractor ainda não tem uma (idempotente)
INSERT INTO public.saas_subscriptions (
  contractor_id,
  plan_id,
  status,
  trial_start,
  trial_end,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT
  c.id,
  p.id,
  CASE c.status
    WHEN 'active'    THEN 'active'::text
    WHEN 'trial'     THEN 'trialing'::text
    WHEN 'inactive'  THEN 'cancelled'::text
    WHEN 'suspended' THEN 'blocked'::text
    ELSE                  'active'::text
  END,
  CASE WHEN c.status = 'trial' THEN c.created_at ELSE NULL END,
  CASE WHEN c.status = 'trial' THEN c.trial_ends_at ELSE NULL END,
  CASE WHEN c.status = 'active' THEN date_trunc('month', now()) ELSE NULL END,
  CASE WHEN c.status = 'active' THEN date_trunc('month', now()) + interval '1 month' ELSE NULL END,
  c.created_at,
  now()
FROM public.contractors c
JOIN public.saas_plans p ON p.slug = c.plan
WHERE NOT EXISTS (
  SELECT 1 FROM public.saas_subscriptions s WHERE s.contractor_id = c.id
);

-- Fallback: contractors cujo plan não bate nenhum slug (usa 'trial' como plano base)
INSERT INTO public.saas_subscriptions (
  contractor_id, plan_id, status, created_at, updated_at
)
SELECT
  c.id,
  (SELECT id FROM public.saas_plans WHERE slug = 'trial' LIMIT 1),
  'trialing',
  c.created_at,
  now()
FROM public.contractors c
WHERE NOT EXISTS (
  SELECT 1 FROM public.saas_subscriptions s WHERE s.contractor_id = c.id
)
AND (SELECT id FROM public.saas_plans WHERE slug = 'trial' LIMIT 1) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Criar evento SUBSCRIPTION_CREATED para cada assinatura migrada (marco histórico inicial)
INSERT INTO public.saas_subscription_events (
  subscription_id, contractor_id, event_type, new_value, metadata, created_by, created_at
)
SELECT
  s.id,
  s.contractor_id,
  'SUBSCRIPTION_CREATED',
  jsonb_build_object('status', s.status, 'plan_slug', p.slug, 'price_monthly', p.price_monthly),
  jsonb_build_object('source', 'migration_fase3'),
  NULL,
  s.created_at
FROM public.saas_subscriptions s
JOIN public.saas_plans p ON p.id = s.plan_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.saas_subscription_events e
  WHERE e.subscription_id = s.id AND e.event_type = 'SUBSCRIPTION_CREATED'
);
