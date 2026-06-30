-- ══════════════════════════════════════════════════════════════════
-- Fase 3 — Assinaturas e Eventos de Assinatura
-- ══════════════════════════════════════════════════════════════════

-- saas_subscriptions: uma assinatura por contractor (enforced via UNIQUE)
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id        uuid NOT NULL UNIQUE REFERENCES public.contractors(id) ON DELETE RESTRICT,
  plan_id              uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE RESTRICT,
  status               text NOT NULL DEFAULT 'trialing'
                       CHECK (status IN ('trialing','active','past_due','paused','blocked','cancelled','expired')),
  trial_start          timestamptz,
  trial_end            timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at            timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- saas_subscription_events: histórico imutável de todas as alterações de assinatura
CREATE TABLE IF NOT EXISTS public.saas_subscription_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.saas_subscriptions(id) ON DELETE CASCADE,
  contractor_id   uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  old_value       jsonb,
  new_value       jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_subscription_events ENABLE ROW LEVEL SECURITY;

-- Assinaturas: apenas platform_owners têm acesso completo (Fase 3)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saas_subscriptions' AND policyname = 'saas_subscriptions_owners'
  ) THEN
    CREATE POLICY "saas_subscriptions_owners" ON public.saas_subscriptions
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Eventos: apenas platform_owners
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saas_subscription_events' AND policyname = 'saas_subscription_events_owners'
  ) THEN
    CREATE POLICY "saas_subscription_events_owners" ON public.saas_subscription_events
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_status
  ON public.saas_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_saas_subscription_events_sub
  ON public.saas_subscription_events (subscription_id);
CREATE INDEX IF NOT EXISTS idx_saas_subscription_events_contractor
  ON public.saas_subscription_events (contractor_id);
CREATE INDEX IF NOT EXISTS idx_saas_subscription_events_type
  ON public.saas_subscription_events (event_type);
CREATE INDEX IF NOT EXISTS idx_saas_subscription_events_created
  ON public.saas_subscription_events (created_at DESC);
