-- ══════════════════════════════════════════════════════════════════
-- Fase 2 — Loja de Módulos GoFit
-- Tabelas: modules (catálogo global) + company_modules (ativação por empresa)
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Catálogo global de módulos ──────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text        NOT NULL,
  route       text,
  icon        text,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','coming_soon','beta','deprecated')),
  is_visible  boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Ativação por empresa ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_modules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  module_id     uuid        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'inactive'
                            CHECK (status IN ('inactive','active','pending','in_review','cancelled','coming_soon')),
  activated_at  timestamptz,
  cancelled_at  timestamptz,
  config_json   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, module_id)
);

-- ── 3. Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_company_modules_contractor ON company_modules (contractor_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_module     ON company_modules (module_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_status     ON company_modules (status);

-- ── 4. RLS — modules é leitura pública ─────────────────────────
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_select_all" ON modules FOR SELECT USING (true);

-- ── 5. RLS — company_modules restrito ao contractor ─────────────
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_modules_select"
  ON company_modules FOR SELECT
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "company_modules_insert"
  ON company_modules FOR INSERT
  WITH CHECK (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "company_modules_update"
  ON company_modules FOR UPDATE
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );
