ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pessoa_tipo text,
  ADD COLUMN IF NOT EXISTS origem_agendamento text,
  ADD COLUMN IF NOT EXISTS consome_credito boolean,
  ADD COLUMN IF NOT EXISTS contrato_id uuid,
  ADD COLUMN IF NOT EXISTS student_contract_id uuid,
  ADD COLUMN IF NOT EXISTS credito_reposicao_id uuid,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por text,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text,
  ADD COLUMN IF NOT EXISTS criado_por text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_pessoa_tipo_check,
  DROP CONSTRAINT IF EXISTS bookings_origem_agendamento_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_pessoa_tipo_check
    CHECK (pessoa_tipo IS NULL OR pessoa_tipo IN ('cliente', 'lead', 'cliente_especial')),
  ADD CONSTRAINT bookings_origem_agendamento_check
    CHECK (
      origem_agendamento IS NULL OR origem_agendamento IN (
        'matricula',
        'app_aluno',
        'contrato',
        'reposicao',
        'lead',
        'cliente_especial',
        'aula_brinde',
        'manual'
      )
    );

UPDATE public.bookings
SET
  pessoa_tipo = COALESCE(
    pessoa_tipo,
    CASE
      WHEN tipo IN ('lead', 'experimental') OR lead_id IS NOT NULL THEN 'lead'
      WHEN tipo = 'especial' THEN 'cliente_especial'
      ELSE 'cliente'
    END
  ),
  origem_agendamento = COALESCE(
    origem_agendamento,
    CASE
      WHEN tipo = 'experimental' THEN 'lead'
      WHEN tipo = 'lead' THEN 'lead'
      WHEN tipo = 'especial' THEN 'cliente_especial'
      ELSE 'manual'
    END
  ),
  consome_credito = COALESCE(
    consome_credito,
    CASE
      WHEN tipo IN ('lead', 'experimental', 'especial') THEN false
      ELSE COALESCE(descontou_contrato, true)
    END
  ),
  updated_at = now();

ALTER TABLE public.bookings
  ALTER COLUMN pessoa_tipo SET DEFAULT 'cliente',
  ALTER COLUMN origem_agendamento SET DEFAULT 'manual',
  ALTER COLUMN consome_credito SET DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_bookings_origem_agendamento
  ON public.bookings (contractor_id, origem_agendamento);

CREATE INDEX IF NOT EXISTS idx_bookings_pessoa_tipo
  ON public.bookings (contractor_id, pessoa_tipo);

CREATE INDEX IF NOT EXISTS idx_bookings_student_contract
  ON public.bookings (student_contract_id);

CREATE INDEX IF NOT EXISTS idx_bookings_contrato
  ON public.bookings (contrato_id);

CREATE INDEX IF NOT EXISTS idx_bookings_cancelado_em
  ON public.bookings (cancelado_em);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_bookings_updated_at'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_bookings_updated_at
      BEFORE UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schedule_slot_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  booking_id uuid,
  student_id uuid,
  lead_id uuid,
  evento text NOT NULL,
  descricao text NOT NULL,
  origem_agendamento text,
  pessoa_tipo text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_slot_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_slot_history'
      AND policyname = 'schedule_slot_history_anon_all'
  ) THEN
    CREATE POLICY "schedule_slot_history_anon_all"
      ON public.schedule_slot_history
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_slot_history_slot
  ON public.schedule_slot_history (slot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_slot_history_contractor
  ON public.schedule_slot_history (contractor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_slot_history_evento
  ON public.schedule_slot_history (evento);
