-- ══════════════════════════════════════════════════════════════════
-- Fase 3 — Catálogo de Planos SaaS da GoFit
-- ══════════════════════════════════════════════════════════════════

-- saas_plans: planos comerciais da plataforma
CREATE TABLE IF NOT EXISTS public.saas_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  slug           text NOT NULL UNIQUE,
  description    text,
  price_monthly  numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly   numeric(10,2),
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive','archived')),
  max_students   integer,         -- NULL = ilimitado
  max_staff      integer,         -- NULL = ilimitado
  max_units      integer NOT NULL DEFAULT 1,
  trial_days     integer NOT NULL DEFAULT 14,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- saas_plan_features: recursos e limites por plano (reservado para Fase 4)
CREATE TABLE IF NOT EXISTS public.saas_plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  limit_value integer,  -- NULL = ilimitado
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

-- RLS
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plan_features ENABLE ROW LEVEL SECURITY;

-- Planos: leitura para qualquer usuário autenticado (academias poderão consultar planos futuramente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saas_plans' AND policyname = 'saas_plans_select_authenticated'
  ) THEN
    CREATE POLICY "saas_plans_select_authenticated" ON public.saas_plans
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Planos: escrita exclusiva para platform_owners
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saas_plans' AND policyname = 'saas_plans_write_owners'
  ) THEN
    CREATE POLICY "saas_plans_write_owners" ON public.saas_plans
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Features: mesmas regras dos planos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saas_plan_features' AND policyname = 'saas_plan_features_select_authenticated'
  ) THEN
    CREATE POLICY "saas_plan_features_select_authenticated" ON public.saas_plan_features
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saas_plan_features' AND policyname = 'saas_plan_features_write_owners'
  ) THEN
    CREATE POLICY "saas_plan_features_write_owners" ON public.saas_plan_features
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saas_plans_status ON public.saas_plans (status);
CREATE INDEX IF NOT EXISTS idx_saas_plans_sort ON public.saas_plans (sort_order);
