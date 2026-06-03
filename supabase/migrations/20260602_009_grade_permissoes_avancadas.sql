-- Fase 4: Permissoes avancadas (genero, agenda livre)

ALTER TABLE schedule_grids
  ADD COLUMN IF NOT EXISTS restricao_genero text
    CHECK (restricao_genero IN ('masculino', 'feminino')),
  ADD COLUMN IF NOT EXISTS agenda_livre boolean NOT NULL DEFAULT false;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS descontou_contrato boolean NOT NULL DEFAULT true;
