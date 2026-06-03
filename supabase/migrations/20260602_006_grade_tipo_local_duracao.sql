-- Fase 1: Tipo da grade, Local (unidade), Duracao em minutos

ALTER TABLE schedule_grids
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'contrato'
    CHECK (tipo IN ('contrato', 'servico')),
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_nome text,
  ADD COLUMN IF NOT EXISTS duracao_minutos integer;

UPDATE schedule_grids
SET duracao_minutos = EXTRACT(EPOCH FROM (hora_fim::time - hora_inicio::time)) / 60
WHERE duracao_minutos IS NULL;

ALTER TABLE schedule_slots
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'contrato',
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_nome text;
