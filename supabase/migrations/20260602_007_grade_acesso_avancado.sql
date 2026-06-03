-- Fase 2: Limites por tipo, cancelamento de check-in, acesso fisico e modo app

ALTER TABLE schedule_grids
  ADD COLUMN IF NOT EXISTS max_clientes_especiais integer,
  ADD COLUMN IF NOT EXISTS max_leads integer,
  ADD COLUMN IF NOT EXISTS permite_cancelar_checkin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancelar_checkin_limite_min integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS acesso_antecedencia_min integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS acesso_tolerancia_atraso_min integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS exibir_app_modo text NOT NULL DEFAULT 'todos'
    CHECK (exibir_app_modo IN ('todos', 'contrato_ativo')),
  ADD COLUMN IF NOT EXISTS checkin_app_modo text NOT NULL DEFAULT 'todos'
    CHECK (checkin_app_modo IN ('todos', 'contrato_ativo'));
