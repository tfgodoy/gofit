-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Seed de módulos padrão da plataforma GoFit
-- Idempotente: ON CONFLICT (slug) DO NOTHING
-- ══════════════════════════════════════════════════════════════════

INSERT INTO public.modules (slug, name, description, route, icon, status, is_visible, sort_order)
VALUES
  -- Módulos de pagamento/marketplace
  ('gofit_pay',
   'GoFit Pay',
   'Receba pagamentos via Pix, Boleto e Cartão integrados ao GoFit, sem sair da plataforma.',
   '/app/gofit-pay',
   'CreditCard',
   'active',
   true,
   1),

  -- Módulos de comunicação
  ('gofit_mensagens',
   'GoFit Mensagens',
   'Automatize comunicações com alunos via WhatsApp e SMS: confirmações de treino, cobranças e aniversários.',
   '/app/mensagens',
   'MessageSquare',
   'coming_soon',
   true,
   2),

  -- Módulos de IA
  ('gofit_ia',
   'GoFit IA',
   'Assistente inteligente com insights sobre churn, sugestões de treino e análise de desempenho da academia.',
   '/app/ia',
   'Sparkles',
   'coming_soon',
   true,
   3),

  -- Módulos de saúde
  ('gofit_nutri',
   'GoFit Nutri',
   'Planos alimentares personalizados, fichas nutricionais e integração com avaliações físicas.',
   '/app/nutri',
   'Apple',
   'coming_soon',
   true,
   4),

  -- Módulos de avaliação física
  ('gofit_avaliacoes',
   'GoFit Avaliações',
   'Protocolos de avaliação física completos com gráficos de evolução, composição corporal e histórico.',
   '/app/avaliacoes',
   'ClipboardList',
   'coming_soon',
   true,
   5),

  -- Módulos core do sistema (já presentes mas controlados por plano)
  ('agenda',
   'Agenda e Horários',
   'Grade de horários por professor e modalidade, agendamento de alunos e controle de capacidade.',
   '/app/agenda',
   'Calendar',
   'coming_soon',
   true,
   10),

  ('contratos',
   'Contratos e Matrículas',
   'Gestão de contratos, matrículas, modalidades e assinatura eletrônica de documentos.',
   '/app/contratos',
   'FileText',
   'coming_soon',
   true,
   11),

  ('financeiro',
   'Financeiro',
   'Contas a receber, lançamentos, caixa, inadimplência e relatórios financeiros da academia.',
   '/app/financeiro',
   'DollarSign',
   'coming_soon',
   true,
   12),

  ('relatorios',
   'Relatórios e Dashboards',
   'Dashboards gerenciais, relatórios de alunos, financeiro, WOD e desempenho da equipe.',
   '/app/relatorios',
   'BarChart2',
   'active',
   true,
   13),

  ('multiunidade',
   'Multiunidade',
   'Gerencie múltiplas unidades da sua academia em uma única conta, com dados separados por unidade.',
   NULL,
   'Building2',
   'coming_soon',
   true,
   20)

ON CONFLICT (slug) DO NOTHING;

-- ── Seed de features por plano (saas_plan_features) ─────────────
-- Liga os planos SaaS aos slugs de módulo via feature_key
-- Idempotente: ON CONFLICT (plan_id, feature_key) DO NOTHING

-- Plano Trial: apenas relatórios básicos (sem acesso a módulos premium)
INSERT INTO public.saas_plan_features (plan_id, feature_key, enabled, limit_value)
SELECT p.id, 'relatorios', true, NULL
FROM public.saas_plans p WHERE p.slug = 'trial'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Plano Starter: relatórios + contratos + financeiro básico
INSERT INTO public.saas_plan_features (plan_id, feature_key, enabled, limit_value)
SELECT p.id, feat.feature_key, true, feat.lv
FROM public.saas_plans p
CROSS JOIN (VALUES
  ('relatorios',  NULL),
  ('contratos',   NULL),
  ('financeiro',  NULL)
) AS feat(feature_key, lv)
WHERE p.slug = 'starter'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Plano Profissional: todos os módulos core + agenda
INSERT INTO public.saas_plan_features (plan_id, feature_key, enabled, limit_value)
SELECT p.id, feat.feature_key, true, feat.lv
FROM public.saas_plans p
CROSS JOIN (VALUES
  ('relatorios',       NULL),
  ('contratos',        NULL),
  ('financeiro',       NULL),
  ('agenda',           NULL),
  ('gofit_avaliacoes', NULL)
) AS feat(feature_key, lv)
WHERE p.slug = 'profissional'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Plano Empresarial: todos os módulos + multiunidade
INSERT INTO public.saas_plan_features (plan_id, feature_key, enabled, limit_value)
SELECT p.id, feat.feature_key, true, feat.lv
FROM public.saas_plans p
CROSS JOIN (VALUES
  ('relatorios',       NULL),
  ('contratos',        NULL),
  ('financeiro',       NULL),
  ('agenda',           NULL),
  ('gofit_avaliacoes', NULL),
  ('multiunidade',     NULL),
  ('gofit_mensagens',  NULL),
  ('gofit_ia',         NULL)
) AS feat(feature_key, lv)
WHERE p.slug = 'empresarial'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
