-- ══════════════════════════════════════════════════════════════════
-- Fase 6 — RBAC Administrativo da GoFit
--
-- Evolui o modelo "platform_owner = acesso total" para um RBAC real
-- com usuários administrativos, papéis (roles) e permissões (permissions).
--
-- platform_owners CONTINUA existindo como mecanismo de bootstrap/super admin.
-- Não é substituído nem removido nesta fase. Qualquer user_id presente em
-- platform_owners é tratado como super_admin implícito pelo helper de
-- permissões no frontend, independente de estar ou não vinculado em
-- admin_user_roles — isso garante que o Owner atual nunca fica bloqueado.
--
-- Este RBAC é EXCLUSIVO da equipe interna da GoFit (acesso a /admin/*).
-- Não tem nenhuma relação com role_permissions (permissões de staff da
-- academia, usadas em /app/*) — são domínios completamente separados.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Papéis administrativos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  slug           text        NOT NULL UNIQUE,
  description    text,
  is_system_role boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Permissões administrativas ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  category    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Usuários administrativos ─────────────────────────────────────
-- Vincula um usuário Supabase Auth existente à área /admin/*.
-- Não confundir com `staff` (funcionários da academia) nem com `contractors`.
CREATE TABLE IF NOT EXISTS public.admin_users (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  email          text        NOT NULL,
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_status  ON public.admin_users (status);

-- ── 4. Vínculo usuário admin ↔ role ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_user_roles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid        NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  role_id       uuid        NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user ON public.admin_user_roles (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role ON public.admin_user_roles (role_id);

-- ── 5. Vínculo role ↔ permission ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid        NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id uuid        NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role ON public.admin_role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_perm ON public.admin_role_permissions (permission_id);

-- ══════════════════════════════════════════════════════════════════
-- RLS — habilitar em todas as tabelas
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════
-- Policies — platform_owners tem controle total (bootstrap/super admin);
-- admin_users ativos podem SELECT (necessário para telas e para o
-- helper de permissões resolver roles/permissions do próprio usuário).
-- Nenhuma policy para anon em nenhuma tabela.
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_roles' AND policyname = 'admin_roles_owners') THEN
    CREATE POLICY "admin_roles_owners" ON public.admin_roles FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_roles' AND policyname = 'admin_roles_admin_users_select') THEN
    CREATE POLICY "admin_roles_admin_users_select" ON public.admin_roles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.user_id = auth.uid() AND au.status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_permissions' AND policyname = 'admin_permissions_owners') THEN
    CREATE POLICY "admin_permissions_owners" ON public.admin_permissions FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_permissions' AND policyname = 'admin_permissions_admin_users_select') THEN
    CREATE POLICY "admin_permissions_admin_users_select" ON public.admin_permissions FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.user_id = auth.uid() AND au.status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'admin_users_owners') THEN
    CREATE POLICY "admin_users_owners" ON public.admin_users FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Um admin_user ativo pode ver a própria linha e a de colegas (necessário para telas de listagem)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'admin_users_admin_users_select') THEN
    CREATE POLICY "admin_users_admin_users_select" ON public.admin_users FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.user_id = auth.uid() AND au.status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_user_roles' AND policyname = 'admin_user_roles_owners') THEN
    CREATE POLICY "admin_user_roles_owners" ON public.admin_user_roles FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_user_roles' AND policyname = 'admin_user_roles_admin_users_select') THEN
    CREATE POLICY "admin_user_roles_admin_users_select" ON public.admin_user_roles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.user_id = auth.uid() AND au.status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_role_permissions' AND policyname = 'admin_role_permissions_owners') THEN
    CREATE POLICY "admin_role_permissions_owners" ON public.admin_role_permissions FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_role_permissions' AND policyname = 'admin_role_permissions_admin_users_select') THEN
    CREATE POLICY "admin_role_permissions_admin_users_select" ON public.admin_role_permissions FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.user_id = auth.uid() AND au.status = 'active'
      ));
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- Seed: roles iniciais
-- ══════════════════════════════════════════════════════════════════
INSERT INTO public.admin_roles (name, slug, description, is_system_role) VALUES
  ('Super Admin', 'super_admin', 'Acesso total à plataforma. Pode gerenciar usuários, papéis e permissões.', true),
  ('Financeiro',  'financeiro',  'Gerencia o financeiro SaaS: cobranças, faturas e inadimplência.', false),
  ('Comercial',   'comercial',   'Gerencia empresas, planos, assinaturas e trials.', false),
  ('Suporte',     'suporte',     'Visualiza empresas e módulos para atendimento ao cliente.', false),
  ('Operações',   'operacoes',   'Gerencia módulos e features da plataforma.', false),
  ('Leitura',     'leitura',     'Apenas visualização, sem ações sensíveis.', false)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- Seed: permissões iniciais
-- ══════════════════════════════════════════════════════════════════
INSERT INTO public.admin_permissions (key, name, category) VALUES
  ('companies.view',    'Ver empresas',           'Empresas'),
  ('companies.update',  'Atualizar empresas',     'Empresas'),
  ('companies.block',   'Bloquear empresas',      'Empresas'),
  ('companies.cancel',  'Cancelar empresas',      'Empresas'),

  ('plans.view',            'Ver planos',              'Planos e Assinaturas'),
  ('plans.manage',          'Gerenciar planos',        'Planos e Assinaturas'),
  ('subscriptions.view',    'Ver assinaturas',         'Planos e Assinaturas'),
  ('subscriptions.manage',  'Gerenciar assinaturas',   'Planos e Assinaturas'),

  ('modules.view',           'Ver módulos',                    'Módulos'),
  ('modules.manage',         'Gerenciar módulos',              'Módulos'),
  ('plan_features.manage',  'Gerenciar features de plano',     'Módulos'),
  ('company_modules.manage','Gerenciar overrides de empresa',  'Módulos'),

  ('billing.view',                     'Ver financeiro SaaS',            'Financeiro SaaS'),
  ('billing.manage',                   'Gerenciar financeiro SaaS',       'Financeiro SaaS'),
  ('billing.create_invoice',           'Criar cobrança Asaas',            'Financeiro SaaS'),
  ('billing.mark_paid',                'Marcar fatura como paga',         'Financeiro SaaS'),
  ('billing.cancel_invoice',           'Cancelar fatura',                 'Financeiro SaaS'),
  ('billing.block_subscription',       'Bloquear assinatura',             'Financeiro SaaS'),
  ('billing.reactivate_subscription',  'Reativar assinatura',             'Financeiro SaaS'),

  ('admin_users.view',    'Ver usuários admin',    'Admin/RBAC'),
  ('admin_users.manage',  'Gerenciar usuários admin', 'Admin/RBAC'),
  ('admin_roles.view',    'Ver papéis',            'Admin/RBAC'),
  ('admin_roles.manage',  'Gerenciar papéis',      'Admin/RBAC'),
  ('permissions.view',    'Ver permissões',        'Admin/RBAC'),

  ('audit_logs.view', 'Ver logs de auditoria', 'Auditoria'),

  ('support.view',        'Ver suporte',          'Suporte'),
  ('support.manage',      'Gerenciar suporte',    'Suporte'),
  ('support.impersonate', 'Impersonar empresa',   'Suporte'),

  ('settings.view',   'Ver configurações',        'Configurações'),
  ('settings.update', 'Atualizar configurações',  'Configurações')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- Seed: vínculo role → permissions
-- ══════════════════════════════════════════════════════════════════

-- super_admin: todas as permissões
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- financeiro
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.slug = 'financeiro' AND p.key IN (
  'companies.view', 'subscriptions.view',
  'billing.view', 'billing.manage', 'billing.create_invoice', 'billing.mark_paid',
  'billing.cancel_invoice', 'billing.block_subscription', 'billing.reactivate_subscription',
  'audit_logs.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- comercial
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.slug = 'comercial' AND p.key IN (
  'companies.view', 'companies.update',
  'plans.view', 'plans.manage', 'subscriptions.view', 'subscriptions.manage',
  'billing.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- suporte
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.slug = 'suporte' AND p.key IN (
  'companies.view', 'modules.view', 'support.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- operacoes
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.slug = 'operacoes' AND p.key IN (
  'companies.view', 'modules.view', 'modules.manage',
  'plan_features.manage', 'company_modules.manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- leitura: view de tudo, nenhuma ação de manage/create/update/block/cancel
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.slug = 'leitura' AND p.key IN (
  'companies.view', 'plans.view', 'subscriptions.view', 'modules.view',
  'billing.view', 'admin_users.view', 'admin_roles.view', 'permissions.view',
  'audit_logs.view', 'support.view', 'settings.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- Bootstrap: todo user_id já presente em platform_owners vira admin_user
-- ativo com role super_admin. Garante que o Owner atual nunca fica
-- bloqueado — mesmo que essa migration seja reexecutada, é idempotente.
-- ══════════════════════════════════════════════════════════════════
INSERT INTO public.admin_users (user_id, name, email, status)
SELECT po.user_id, COALESCE(u.raw_user_meta_data->>'name', 'GoFit Admin'), COALESCE(u.email, ''), 'active'
FROM public.platform_owners po
JOIN auth.users u ON u.id = po.user_id
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.admin_user_roles (admin_user_id, role_id)
SELECT au.id, r.id
FROM public.admin_users au
JOIN public.platform_owners po ON po.user_id = au.user_id
JOIN public.admin_roles r ON r.slug = 'super_admin'
ON CONFLICT (admin_user_id, role_id) DO NOTHING;
