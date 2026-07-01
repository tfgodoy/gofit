-- ══════════════════════════════════════════════════════════════════
-- Fase 5 — Financeiro SaaS da GoFit
--
-- Estas tabelas registram a relação financeira entre a GoFit e as
-- academias clientes (contractors). NÃO se confundem com:
--   - payment_charges / receivables  → academias cobrando ALUNOS via GoFit Pay
--   - financeiro interno do contractor
--
-- Aqui: GoFit cobra a ACADEMIA pela assinatura do sistema.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Mapeamento contractor → customer Asaas (conta principal GoFit) ──
-- Separado de payment_customers (que mapeia ALUNOS → customer Asaas de subcontas)
CREATE TABLE IF NOT EXISTS public.saas_asaas_customers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     uuid        NOT NULL UNIQUE REFERENCES public.contractors(id) ON DELETE CASCADE,
  asaas_customer_id text        NOT NULL,
  name              text,
  email             text,
  cpf_cnpj          text,
  phone             text,
  metadata          jsonb       NOT NULL DEFAULT '{}',
  synced_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saas_asaas_customers_contractor
  ON public.saas_asaas_customers (contractor_id);
CREATE INDEX IF NOT EXISTS idx_saas_asaas_customers_asaas_id
  ON public.saas_asaas_customers (asaas_customer_id);

ALTER TABLE public.saas_asaas_customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_asaas_customers' AND policyname = 'saas_asaas_customers_owners'
  ) THEN
    CREATE POLICY "saas_asaas_customers_owners"
      ON public.saas_asaas_customers FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── 2. Faturas SaaS ────────────────────────────────────────────────────
-- Uma fatura por período de cobrança por contractor.
-- status lifecycle: draft → pending → paid | overdue | failed | cancelled | refunded
CREATE TABLE IF NOT EXISTS public.saas_invoices (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id        uuid          NOT NULL REFERENCES public.contractors(id) ON DELETE RESTRICT,
  subscription_id      uuid          NOT NULL REFERENCES public.saas_subscriptions(id) ON DELETE RESTRICT,
  plan_id              uuid          NOT NULL REFERENCES public.saas_plans(id) ON DELETE RESTRICT,

  amount               numeric(14,2) NOT NULL CHECK (amount > 0),
  currency             text          NOT NULL DEFAULT 'BRL',
  due_date             date          NOT NULL,
  period_start         date,
  period_end           date,

  status               text          NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','pending','paid','overdue','failed','cancelled','refunded')),

  payment_method       text          CHECK (
    payment_method IN ('PIX','BOLETO','CREDIT_CARD','MANUAL') OR payment_method IS NULL
  ),

  -- Campos Asaas (preenchidos pela Edge Function create-saas-payment)
  -- NUNCA preencher diretamente do frontend — apenas via Edge Function
  asaas_customer_id    text,
  asaas_payment_id     text          UNIQUE,
  asaas_invoice_url    text,
  asaas_bank_slip_url  text,
  asaas_pix_qr_code    text,

  paid_at              timestamptz,
  cancelled_at         timestamptz,
  metadata             jsonb         NOT NULL DEFAULT '{}',
  notes                text,
  created_by           uuid          REFERENCES auth.users(id),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saas_invoices_contractor
  ON public.saas_invoices (contractor_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_subscription
  ON public.saas_invoices (subscription_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_status
  ON public.saas_invoices (status);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_due_date
  ON public.saas_invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_paid_at
  ON public.saas_invoices (paid_at) WHERE paid_at IS NOT NULL;

ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_invoices' AND policyname = 'saas_invoices_owners'
  ) THEN
    CREATE POLICY "saas_invoices_owners"
      ON public.saas_invoices FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Service role pode inserir/atualizar via Edge Function de webhook
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_invoices' AND policyname = 'saas_invoices_service_role'
  ) THEN
    CREATE POLICY "saas_invoices_service_role"
      ON public.saas_invoices FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 3. Pagamentos SaaS confirmados ─────────────────────────────────────
-- Registra cada pagamento confirmado para uma invoice SaaS.
-- Imutável após inserção — auditoria financeira.
CREATE TABLE IF NOT EXISTS public.saas_payments (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid          NOT NULL REFERENCES public.saas_invoices(id) ON DELETE RESTRICT,
  contractor_id    uuid          NOT NULL REFERENCES public.contractors(id) ON DELETE RESTRICT,
  subscription_id  uuid          REFERENCES public.saas_subscriptions(id) ON DELETE SET NULL,

  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method   text,
  status           text          NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending','confirmed','received','failed','refunded','cancelled')),

  asaas_payment_id text,
  asaas_event_id   text,

  paid_at          timestamptz,
  metadata         jsonb         NOT NULL DEFAULT '{}',
  created_by       uuid          REFERENCES auth.users(id),
  created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saas_payments_invoice
  ON public.saas_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_saas_payments_contractor
  ON public.saas_payments (contractor_id);
CREATE INDEX IF NOT EXISTS idx_saas_payments_asaas_id
  ON public.saas_payments (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

ALTER TABLE public.saas_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_payments' AND policyname = 'saas_payments_owners'
  ) THEN
    CREATE POLICY "saas_payments_owners"
      ON public.saas_payments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_payments' AND policyname = 'saas_payments_service_role'
  ) THEN
    CREATE POLICY "saas_payments_service_role"
      ON public.saas_payments FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 4. Eventos de billing SaaS ─────────────────────────────────────────
-- Log imutável de todos os eventos financeiros SaaS.
-- Complementa saas_subscription_events com eventos específicos de cobrança.
CREATE TABLE IF NOT EXISTS public.saas_billing_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid        REFERENCES public.saas_invoices(id) ON DELETE SET NULL,
  subscription_id uuid        REFERENCES public.saas_subscriptions(id) ON DELETE SET NULL,
  contractor_id   uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  old_value       jsonb,
  new_value       jsonb,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Eventos suportados (documentação — não é constraint para permitir extensão sem migration):
-- INVOICE_CREATED, INVOICE_SENT, INVOICE_PAID, INVOICE_PAID_MANUAL,
-- INVOICE_OVERDUE, INVOICE_CANCELLED, INVOICE_FAILED,
-- PAYMENT_CONFIRMED, PAYMENT_FAILED,
-- SUBSCRIPTION_MARKED_PAST_DUE, SUBSCRIPTION_BLOCKED_FOR_NON_PAYMENT,
-- SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT,
-- ASAAS_PAYMENT_CREATED, ASAAS_WEBHOOK_RECEIVED,
-- ASAAS_WEBHOOK_PROCESSED, ASAAS_WEBHOOK_FAILED

CREATE INDEX IF NOT EXISTS idx_saas_billing_events_invoice
  ON public.saas_billing_events (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saas_billing_events_contractor
  ON public.saas_billing_events (contractor_id);
CREATE INDEX IF NOT EXISTS idx_saas_billing_events_type
  ON public.saas_billing_events (event_type);
CREATE INDEX IF NOT EXISTS idx_saas_billing_events_created
  ON public.saas_billing_events (created_at DESC);

ALTER TABLE public.saas_billing_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_billing_events' AND policyname = 'saas_billing_events_owners'
  ) THEN
    CREATE POLICY "saas_billing_events_owners"
      ON public.saas_billing_events FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_billing_events' AND policyname = 'saas_billing_events_service_role'
  ) THEN
    CREATE POLICY "saas_billing_events_service_role"
      ON public.saas_billing_events FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
