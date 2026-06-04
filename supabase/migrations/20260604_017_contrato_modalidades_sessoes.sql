-- Fase 1 - Sessoes e contratos
-- Completa contratos e contrato_modalidades sem remover campos legados.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS contabilizar_sessoes_conjunto boolean NOT NULL DEFAULT false;

ALTER TABLE public.contrato_modalidades
  ADD COLUMN IF NOT EXISTS contractor_id uuid,
  ADD COLUMN IF NOT EXISTS modalidade_nome text,
  ADD COLUMN IF NOT EXISTS modalidade_cor text DEFAULT '#f97316',
  ADD COLUMN IF NOT EXISTS categoria_icone text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS tipo_acesso text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS sessoes_por_semana integer,
  ADD COLUMN IF NOT EXISTS total_aulas integer,
  ADD COLUMN IF NOT EXISTS contabilizar_conjunto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acessos_maximos integer,
  ADD COLUMN IF NOT EXISTS tipo_duracao_acessos text DEFAULT 'semana',
  ADD COLUMN IF NOT EXISTS limitando_acessos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limitando_horarios boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS periodos_horario jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS permite_reposicao boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_reposicoes integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS limite_reposicoes_periodo text DEFAULT 'semana',
  ADD COLUMN IF NOT EXISTS matricula_obrigatoria_na_venda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.contrato_modalidades cm
SET contractor_id = c.contractor_id
FROM public.contratos c
WHERE cm.contrato_id = c.id
  AND cm.contractor_id IS NULL;

UPDATE public.contrato_modalidades cm
SET
  modalidade_nome = COALESCE(cm.modalidade_nome, m.descricao, cm.nome),
  modalidade_cor = COALESCE(cm.modalidade_cor, m.cor, '#f97316'),
  categoria_icone = COALESCE(cm.categoria_icone, m.icone, 'default')
FROM public.modalidades m
WHERE cm.modalidade_id = m.id;

UPDATE public.contrato_modalidades
SET
  tipo_acesso = COALESCE(tipo_acesso, 'padrao'),
  modalidade_nome = COALESCE(modalidade_nome, nome),
  modalidade_cor = COALESCE(modalidade_cor, '#f97316'),
  categoria_icone = COALESCE(categoria_icone, 'default'),
  acessos_maximos = COALESCE(acessos_maximos, max_acessos),
  tipo_duracao_acessos = COALESCE(tipo_duracao_acessos, 'semana'),
  limitando_acessos = COALESCE(limitar_acessos, limitando_acessos, false),
  limitando_horarios = COALESCE(limitar_horarios, limitando_horarios, false),
  periodos_horario = COALESCE(periodos_horario, '[]'::jsonb),
  permite_reposicao = COALESCE(permite_reposicao, true),
  max_reposicoes = COALESCE(max_reposicoes, 10),
  limite_reposicoes_periodo = COALESCE(limite_reposicoes_periodo, 'semana'),
  matricula_obrigatoria_na_venda = COALESCE(matricula_obrigatoria_na_venda, false),
  sessoes_por_semana = COALESCE(
    sessoes_por_semana,
    CASE WHEN tipo_acesso = 'sessoes_semana' THEN COALESCE(acessos_maximos, max_acessos) END
  ),
  total_aulas = COALESCE(
    total_aulas,
    CASE WHEN tipo_acesso = 'pacote_aulas' THEN COALESCE(acessos_maximos, max_acessos) END
  ),
  updated_at = now();

ALTER TABLE public.contrato_modalidades
  ALTER COLUMN tipo_acesso SET DEFAULT 'padrao',
  ALTER COLUMN tipo_acesso SET NOT NULL,
  ALTER COLUMN contabilizar_conjunto SET DEFAULT false,
  ALTER COLUMN contabilizar_conjunto SET NOT NULL,
  ALTER COLUMN tipo_duracao_acessos SET DEFAULT 'semana',
  ALTER COLUMN limitando_acessos SET DEFAULT false,
  ALTER COLUMN limitando_acessos SET NOT NULL,
  ALTER COLUMN limitando_horarios SET DEFAULT false,
  ALTER COLUMN limitando_horarios SET NOT NULL,
  ALTER COLUMN periodos_horario SET DEFAULT '[]'::jsonb,
  ALTER COLUMN permite_reposicao SET DEFAULT true,
  ALTER COLUMN permite_reposicao SET NOT NULL,
  ALTER COLUMN max_reposicoes SET DEFAULT 10,
  ALTER COLUMN limite_reposicoes_periodo SET DEFAULT 'semana',
  ALTER COLUMN matricula_obrigatoria_na_venda SET DEFAULT false,
  ALTER COLUMN matricula_obrigatoria_na_venda SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.contrato_modalidades
  DROP CONSTRAINT IF EXISTS contrato_modalidades_tipo_acesso_check,
  DROP CONSTRAINT IF EXISTS contrato_modalidades_tipo_duracao_acessos_check,
  DROP CONSTRAINT IF EXISTS contrato_modalidades_limite_reposicoes_periodo_check;

ALTER TABLE public.contrato_modalidades
  ADD CONSTRAINT contrato_modalidades_tipo_acesso_check
    CHECK (tipo_acesso IN ('padrao', 'sessoes_semana', 'pacote_aulas', 'gonutri')),
  ADD CONSTRAINT contrato_modalidades_tipo_duracao_acessos_check
    CHECK (tipo_duracao_acessos IN ('semana', 'mes', 'dia', 'hora', 'vigencia')),
  ADD CONSTRAINT contrato_modalidades_limite_reposicoes_periodo_check
    CHECK (limite_reposicoes_periodo IN ('semana', 'mes', 'contrato'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contrato_modalidades_contractor_id_fkey'
      AND conrelid = 'public.contrato_modalidades'::regclass
  ) THEN
    ALTER TABLE public.contrato_modalidades
      ADD CONSTRAINT contrato_modalidades_contractor_id_fkey
      FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_contrato_modalidades_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_contractor_id uuid;
  v_modalidade record;
BEGIN
  IF NEW.contractor_id IS NULL THEN
    SELECT contractor_id
    INTO v_contractor_id
    FROM public.contratos
    WHERE id = NEW.contrato_id;

    NEW.contractor_id := v_contractor_id;
  END IF;

  IF NEW.modalidade_id IS NOT NULL THEN
    SELECT descricao, cor, icone
    INTO v_modalidade
    FROM public.modalidades
    WHERE id = NEW.modalidade_id;

    IF FOUND THEN
      NEW.modalidade_nome := COALESCE(NEW.modalidade_nome, v_modalidade.descricao, NEW.nome);
      NEW.modalidade_cor := COALESCE(NEW.modalidade_cor, v_modalidade.cor, '#f97316');
      NEW.categoria_icone := COALESCE(NEW.categoria_icone, v_modalidade.icone, 'default');
    END IF;
  END IF;

  NEW.modalidade_nome := COALESCE(NEW.modalidade_nome, NEW.nome);
  NEW.modalidade_cor := COALESCE(NEW.modalidade_cor, '#f97316');
  NEW.categoria_icone := COALESCE(NEW.categoria_icone, 'default');
  NEW.tipo_acesso := COALESCE(NEW.tipo_acesso, 'padrao');
  NEW.tipo_duracao_acessos := COALESCE(NEW.tipo_duracao_acessos, 'semana');
  NEW.limitando_acessos := COALESCE(NEW.limitando_acessos, NEW.limitar_acessos, false);
  NEW.limitando_horarios := COALESCE(NEW.limitando_horarios, NEW.limitar_horarios, false);
  NEW.periodos_horario := COALESCE(NEW.periodos_horario, '[]'::jsonb);
  NEW.permite_reposicao := COALESCE(NEW.permite_reposicao, true);
  NEW.max_reposicoes := COALESCE(NEW.max_reposicoes, 10);
  NEW.limite_reposicoes_periodo := COALESCE(NEW.limite_reposicoes_periodo, 'semana');
  NEW.matricula_obrigatoria_na_venda := COALESCE(NEW.matricula_obrigatoria_na_venda, false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_modalidades_defaults
  ON public.contrato_modalidades;

CREATE TRIGGER trg_contrato_modalidades_defaults
  BEFORE INSERT OR UPDATE ON public.contrato_modalidades
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contrato_modalidades_defaults();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_contrato_modalidades_updated_at'
      AND tgrelid = 'public.contrato_modalidades'::regclass
  ) THEN
    CREATE TRIGGER trg_contrato_modalidades_updated_at
      BEFORE UPDATE ON public.contrato_modalidades
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contrato_modalidades_contractor
  ON public.contrato_modalidades (contractor_id);

CREATE INDEX IF NOT EXISTS idx_contrato_modalidades_contrato_modalidade
  ON public.contrato_modalidades (contrato_id, modalidade_id);

CREATE INDEX IF NOT EXISTS idx_contrato_modalidades_tipo_acesso
  ON public.contrato_modalidades (tipo_acesso);
