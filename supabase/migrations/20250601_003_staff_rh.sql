-- ============================================================
-- Staff RH Module: Employment data, Salary History, Vacations, Occurrences
-- ============================================================

-- Employment + banking columns on staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS data_admissao       date,
  ADD COLUMN IF NOT EXISTS data_demissao       date,
  ADD COLUMN IF NOT EXISTS tipo_contrato       text CHECK (tipo_contrato IN ('clt','pj','autonomo','estagiario')),
  ADD COLUMN IF NOT EXISTS cargo_descricao     text,
  ADD COLUMN IF NOT EXISTS carga_horaria_semanal integer,
  ADD COLUMN IF NOT EXISTS valor_passagem      numeric(10,2),
  ADD COLUMN IF NOT EXISTS pis_pasep           text,
  ADD COLUMN IF NOT EXISTS ctps_numero         text,
  ADD COLUMN IF NOT EXISTS ctps_serie          text,
  ADD COLUMN IF NOT EXISTS banco               text,
  ADD COLUMN IF NOT EXISTS agencia             text,
  ADD COLUMN IF NOT EXISTS conta               text,
  ADD COLUMN IF NOT EXISTS tipo_conta          text CHECK (tipo_conta IN ('corrente','poupanca')),
  ADD COLUMN IF NOT EXISTS chave_pix           text;

-- ============================================================
-- SALARY HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_salarios (
  id            uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      uuid          NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  contractor_id uuid          NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  data_vigencia date          NOT NULL,
  valor         numeric(10,2) NOT NULL CHECK (valor > 0),
  motivo        text          NOT NULL CHECK (motivo IN ('admissao','reajuste','promocao','correcao')),
  observacao    text,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- VACATION CONTROL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_ferias (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      uuid        NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  data_inicio   date        NOT NULL,
  data_fim      date        NOT NULL,
  dias          integer     NOT NULL DEFAULT 30,
  status        text        NOT NULL DEFAULT 'agendado'
                            CHECK (status IN ('agendado','em_andamento','concluido','cancelado')),
  observacao    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ferias_datas_validas CHECK (data_fim >= data_inicio)
);

-- ============================================================
-- OCCURRENCES (absences, day-offs, bonuses, leaves)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_ocorrencias (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      uuid        NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  tipo          text        NOT NULL
                            CHECK (tipo IN ('falta','falta_justificada','dayoff','bonus_folga',
                                            'licenca_medica','licenca','suspensao')),
  data_inicio   date        NOT NULL,
  data_fim      date,
  descricao     text,
  status        text        NOT NULL DEFAULT 'aprovado'
                            CHECK (status IN ('pendente','aprovado','reprovado')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_staff_salarios_staff    ON public.staff_salarios(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_salarios_vigencia ON public.staff_salarios(data_vigencia DESC);
CREATE INDEX IF NOT EXISTS idx_staff_ferias_staff      ON public.staff_ferias(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_ferias_datas      ON public.staff_ferias(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_staff_ocorrencias_staff ON public.staff_ocorrencias(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_ocorrencias_data  ON public.staff_ocorrencias(data_inicio DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.staff_salarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_ferias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all anon" ON public.staff_salarios
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all anon" ON public.staff_ferias
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all anon" ON public.staff_ocorrencias
  FOR ALL TO anon USING (true) WITH CHECK (true);
