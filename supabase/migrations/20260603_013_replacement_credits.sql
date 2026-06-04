CREATE TABLE IF NOT EXISTS public.schedule_replacement_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  student_nome text,
  contrato_id uuid,
  student_contract_id uuid,
  original_slot_id uuid NOT NULL,
  original_booking_id uuid NOT NULL,
  used_slot_id uuid,
  used_booking_id uuid,
  modalidade_id uuid,
  modalidade_nome text,
  status text NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'usado', 'expirado', 'cancelado')),
  motivo text,
  gerado_por text,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz,
  validade date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_replacement_credits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_replacement_credits'
      AND policyname = 'schedule_replacement_credits_anon_all'
  ) THEN
    CREATE POLICY "schedule_replacement_credits_anon_all"
      ON public.schedule_replacement_credits
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_schedule_replacement_credits_updated_at'
      AND tgrelid = 'public.schedule_replacement_credits'::regclass
  ) THEN
    CREATE TRIGGER trg_schedule_replacement_credits_updated_at
      BEFORE UPDATE ON public.schedule_replacement_credits
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_replacement_credits_student_status
  ON public.schedule_replacement_credits (contractor_id, student_id, status);

CREATE INDEX IF NOT EXISTS idx_schedule_replacement_credits_original_booking
  ON public.schedule_replacement_credits (original_booking_id);

CREATE INDEX IF NOT EXISTS idx_schedule_replacement_credits_used_booking
  ON public.schedule_replacement_credits (used_booking_id);

CREATE INDEX IF NOT EXISTS idx_schedule_replacement_credits_validade
  ON public.schedule_replacement_credits (validade);
