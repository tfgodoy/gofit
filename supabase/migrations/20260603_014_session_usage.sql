CREATE TABLE IF NOT EXISTS public.schedule_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  student_id uuid NOT NULL,
  student_nome text,
  contrato_id uuid,
  student_contract_id uuid,
  modalidade_id uuid,
  modalidade_nome text,
  origem_agendamento text,
  status_booking text NOT NULL
    CHECK (status_booking IN ('presente', 'faltou')),
  tipo_consumo text NOT NULL DEFAULT 'aula'
    CHECK (tipo_consumo IN ('aula', 'reposicao')),
  quantidade numeric NOT NULL DEFAULT 1,
  motivo text,
  criado_por text,
  estornado boolean NOT NULL DEFAULT false,
  estornado_em timestamptz,
  estornado_por text,
  motivo_estorno text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_session_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_session_usage'
      AND policyname = 'schedule_session_usage_anon_all'
  ) THEN
    CREATE POLICY "schedule_session_usage_anon_all"
      ON public.schedule_session_usage
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
    WHERE tgname = 'trg_schedule_session_usage_updated_at'
      AND tgrelid = 'public.schedule_session_usage'::regclass
  ) THEN
    CREATE TRIGGER trg_schedule_session_usage_updated_at
      BEFORE UPDATE ON public.schedule_session_usage
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_session_usage_booking_active
  ON public.schedule_session_usage (booking_id)
  WHERE estornado = false;

CREATE INDEX IF NOT EXISTS idx_schedule_session_usage_student_period
  ON public.schedule_session_usage (contractor_id, student_id, created_at)
  WHERE estornado = false;

CREATE INDEX IF NOT EXISTS idx_schedule_session_usage_contract
  ON public.schedule_session_usage (student_contract_id, created_at)
  WHERE estornado = false;

CREATE INDEX IF NOT EXISTS idx_schedule_session_usage_slot
  ON public.schedule_session_usage (slot_id);
