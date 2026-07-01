---
name: gofit-admin-architect
description: >
  Contexto mestre e guia de arquitetura para toda implementação da área administrativa do GoFit App (/admin/*).
  Use esta skill sempre que o usuário pedir para implementar, criar, ajustar ou evoluir qualquer funcionalidade
  do Admin GoFit: gestão de empresas, planos SaaS, assinaturas, módulos, financeiro SaaS, RBAC administrativo,
  auditoria, suporte ou impersonação. Também use quando o usuário mencionar "Owner", "área admin", "painel GoFit",
  "área administrativa da GoFit", "fase 1/2/3/4/5/6/7 do admin", "platform_owners", "admin_audit_logs" ou qualquer
  outra entidade relacionada à operação interna da plataforma GoFit. Esta skill NÃO cobre funcionalidades das
  academias clientes (/app/*) — apenas a plataforma GoFit em si.
---

# GoFit Admin Architect — Contexto Mestre

## Visão geral

O GoFit App é um SaaS multi-tenant para gestão de academias, estúdios e boxes. Cada academia é um **contractor**.
A área `/app/*` serve as academias clientes. A área `/admin/*` serve a equipe da própria GoFit.

Estas duas áreas são **completamente separadas** em rota, autenticação, permissões e escopo de dados.

---

## Stack

- React 19 + TypeScript + Vite
- Supabase (Auth + Database + RLS + Storage)
- React Router v6
- Tailwind CSS + Radix UI + Shadcn/UI
- Recharts
- Vercel (deploy)

---

## Separação obrigatória: Academia vs. GoFit Admin

| Aspecto | Área da Academia (`/app/*`) | Área Admin GoFit (`/admin/*`) |
|---|---|---|
| Usuários | Donos, gestores e funcionários da academia | Equipe interna da GoFit |
| Escopo | Apenas dados do próprio `contractor_id` | Plataforma inteira |
| Autenticação | Supabase Auth ou tabela `staff` | Supabase Auth + `platform_owners` |
| Permissões | `role_permissions` (por academia) | `admin_role_permissions` (global) |
| Filtro obrigatório | `contractor_id` em toda query | Sem filtro de contractor (acesso total controlado) |

**Nunca misture permissões de funcionário de academia com permissões administrativas da GoFit.**

---

## Autenticação do Admin GoFit

O Owner/Admin autentica **exclusivamente** via:
1. Rota `/admin/login`
2. Função `adminLogin(email, password)` no `AuthContext`
3. `supabase.auth.signInWithPassword` com email e senha
4. Consulta à tabela `platform_owners` para confirmar acesso

`/login` é a entrada das academias/clientes — não tem e nunca deve ter aba, modo ou lógica de acesso admin.

**Regras permanentes de autenticação:**
- Nunca recriar aba Owner em `/login`
- Nunca usar `login()` comum para acesso administrativo
- Nunca permitir acesso Admin por `/login`
- Sempre usar `/admin/login` + `adminLogin()` para Admin GoFit
- Nunca usar service role dentro de `src/`
- Nunca usar variável `VITE_` para segredo de servidor
- A service role, se necessária localmente ou em scripts, deve usar `SUPABASE_SERVICE_ROLE_KEY` (sem prefixo `VITE_`)

Tabela central de identidade de admins:
```sql
platform_owners (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

---

## Estado atual do projeto — Fases 1 e 2 concluídas

### Arquivos da área Admin

| Arquivo | Status |
|---|---|
| `src/pages/admin/AdminLoginPage.tsx` | ✅ Criado (Fase 1) |
| `src/pages/admin/AdminDashboard.tsx` | ✅ Criado — dados de MRR/Churn mockados com `// TODO Fase 3` |
| `src/pages/admin/AdminCompaniesPage.tsx` | ✅ Criado (Fase 2) |
| `src/pages/admin/AdminCompanyDetailsPage.tsx` | ✅ Criado (Fase 2) |
| `src/components/auth/AdminGuard.tsx` | ✅ Criado (Fase 1) |
| `src/lib/adminAudit.ts` | ✅ Criado (Fase 1) |
| `src/contexts/AuthContext.tsx` | ✅ Atualizado com `adminLogin()` e auditoria no logout |
| `src/App.tsx` | ✅ Atualizado com rotas `/admin/*` incluindo companies |
| `src/pages/LoginPage.tsx` | ✅ Aba Owner removida — exclusivo para academias/clientes |
| `supabase/migrations/20260630_041_admin_audit_logs.sql` | ✅ Aplicada (Fase 1) |
| `supabase/migrations/20260630_042_admin_platform_policies.sql` | ✅ Aplicada (Fase 2) |
| `src/pages/OwnerDashboard.tsx` | ✅ Deletado |
| `.env.example` | ✅ `SUPABASE_SERVICE_ROLE_KEY` sem prefixo `VITE_` |

### Rotas

| Rota | Status |
|---|---|
| `/admin/login` | ✅ Única entrada administrativa |
| `/admin/dashboard` | ✅ Funcional (KPIs, alertas trial, tabela com link Detalhes) |
| `/admin/companies` | ✅ Lista com busca, filtros status/plano, ações inline |
| `/admin/companies/:id` | ✅ Detalhe: dados, staff, módulos, ações administrativas |
| `/admin/*` (catch-all) | ✅ Protegido por `AdminGuard` → redireciona para `/admin/dashboard` |
| `/owner/dashboard` | ✅ Redirect legado para `/admin/dashboard` |
| `/owner/*` | ✅ Redirect legado para `/admin/dashboard` |
| `/login` | ✅ Exclusivo para academias/clientes — sem acesso admin |
| `/app/*` | ✅ Intacto, não alterado |

### Tabelas Admin no banco

| Tabela | Status |
|---|---|
| `platform_owners` | ✅ Criada (Fase 1) |
| `admin_audit_logs` | ✅ Criada com RLS + função SECURITY DEFINER (Fase 1) |
| `contractors` | ✅ UPDATE liberado para platform_owners (Fase 2) |
| `company_modules` | ✅ SELECT liberado para platform_owners (Fase 2) |
| `staff` | ✅ SELECT liberado para platform_owners (Fase 2) |

### Eventos de auditoria implementados

| Evento | Quando é registrado |
|---|---|
| `ADMIN_LOGIN_SUCCESS` | Login aprovado via `adminLogin()` |
| `ADMIN_LOGIN_DENIED` | Credenciais inválidas ou usuário não está em `platform_owners` |
| `ADMIN_LOGOUT` | Logout de usuário com role `"owner"` |
| `ADMIN_ACCESS_DENIED` | Usuário autenticado tenta acessar `/admin/*` sem role `"owner"` |
| `COMPANY_VIEWED` | Ao abrir `/admin/companies/:id` (1x por visita, via `useRef`) |
| `COMPANY_BLOCKED` | Ao bloquear empresa → status `suspended` |
| `COMPANY_UNBLOCKED` | Ao reativar empresa → status `active` |
| `COMPANY_CANCELLED` | Ao cancelar conta → status `inactive` |
| `TRIAL_EXTENDED` | Ao estender trial por +14 dias |

### Pendências do AdminDashboard (a resolver na Fase 3)

- Dados de MRR e Churn são **mockados** — marcados com `// TODO Fase 3` no código
- `totalStudents` usa estimativa `active.length * 120` — marcado com `// TODO Fase 3`
- Trends `+18%` e `+12%` nos KPIs são hardcoded — marcados com `// TODO Fase 3`
- `ip_address` não é capturado — implementar via Edge Function em fase futura

### Pendências conhecidas para fases futuras

- **`suspended` não bloqueia `/app/*`** — o AuthGuard não verifica `contractor.status`. Uma empresa suspensa ainda acessa o sistema. O bloqueio real deve ser implementado na Fase 3 via `AuthContext` (checar status no login ou em cada requisição protegida).
- **UPDATE policy em `contractors` não é column-restricted** — platform_owners podem atualizar qualquer campo. O código só usa `status` e `trial_ends_at`, mas a policy é ampla. Restringir colunas na Fase 3 se necessário.

### O que NÃO deve ser alterado nas próximas fases

- Não recriar `/admin/login`, `AdminGuard`, `admin_audit_logs`, `logAdminAudit()`
- Não recriar `AdminCompaniesPage` ou `AdminCompanyDetailsPage` do zero
- Não adicionar aba Owner em `/login`
- Não usar `login()` para acesso admin
- Não reverter redirect `/owner/*`
- Não quebrar `/app/*`
- Não remover policies RLS criadas em `20260630_042` (apenas adicionar novas se necessário)

---

## Ordem de trabalho obrigatória

Antes de escrever qualquer linha de código, sempre:

1. **Ler esta skill** e identificar a fase solicitada
2. **Verificar arquivos existentes** relevantes (lista acima e no projeto)
3. **Verificar migrations existentes** em `supabase/migrations/`
4. **Avaliar impacto em `/app/*`** — nunca quebrar o fluxo das academias
5. **Verificar se já existe tabela/campo equivalente** antes de criar algo novo
6. **Criar migration segura e idempotente** se necessário
7. **Criar tipos TypeScript** atualizando `src/integrations/supabase/types.ts`
8. **Criar serviços/hooks** de acesso a dados
9. **Criar componentes/telas**
10. **Criar proteção de rota e validação de permissão**
11. **Criar registro de auditoria** para toda ação sensível usando `logAdminAudit()`
12. **Rodar `tsc --noEmit`** e corrigir erros antes do commit
13. **Confirmar que `/app/*` não quebrou**
14. **Documentar o que foi alterado** ao final

---

## Arquivos a analisar antes de qualquer alteração

- `src/App.tsx` — rotas e guards
- `src/contexts/AuthContext.tsx` — autenticação e roles
- `src/lib/adminAudit.ts` — helper de auditoria (usar sempre, não recriar)
- `src/components/auth/AdminGuard.tsx` — guard admin (não recriar)
- `src/pages/admin/` — páginas admin existentes
- `src/hooks/` — hooks existentes
- `supabase/migrations/` — histórico do banco
- Tabelas: `contractors`, `staff`, `role_permissions`, `modules`, `company_modules`, `platform_owners`, `admin_audit_logs`

---

## Checklist de segurança (verificar antes de cada entrega)

- [ ] Nenhuma credencial ou `service_role` exposta em variável `VITE_*`
- [ ] Toda rota `/admin/*` protegida por `AdminGuard`
- [ ] Toda query admin valida sessão Supabase ativa
- [ ] Toda ação sensível registrada via `logAdminAudit()` de `src/lib/adminAudit.ts`
- [ ] RLS ativa em todas as tabelas novas
- [ ] Nenhuma policy `USING (true)` para `anon` em tabela sensível
- [ ] Migrations idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- [ ] `btoa()` não usado para hash de senha (usar bcrypt via Edge Function)
- [ ] Lógica de autorização validada no backend (Supabase RLS/Functions), não apenas no frontend
- [ ] `tsc --noEmit` sem erros antes do commit
- [ ] `/login` continua sem acesso admin

---

## Checklist pós-implementação (entregar sempre)

1. Confirmar rotas criadas e funcionando
2. Confirmar guards/permissões ativos
3. Confirmar eventos de auditoria registrados
4. Confirmar RLS nas tabelas novas/alteradas
5. Confirmar que `/app/*` não quebrou
6. Confirmar que build TypeScript passa
7. Listar pendências para a próxima fase

---

## Fases de implementação

### ✅ FASE 1 — Base segura do Admin GoFit (CONCLUÍDA DEFINITIVAMENTE)

**Status:** Concluída e validada. Inclui validação técnica e correções pós-validação.

**O que foi implementado:**
- `/admin/login` — única entrada administrativa, usa `adminLogin()` com auditoria
- `/admin/dashboard` — dashboard com KPIs, gráficos e tabela de empresas
- `AdminGuard` — protege todas as rotas `/admin/*`
- `adminLogin()` no `AuthContext` — Supabase Auth + validação em `platform_owners`
- Tabela `admin_audit_logs` com RLS + função `SECURITY DEFINER` para logs de tentativas negadas
- Helper `logAdminAudit()` centralizado em `src/lib/adminAudit.ts`
- Eventos auditados: `ADMIN_LOGIN_SUCCESS`, `ADMIN_LOGIN_DENIED`, `ADMIN_LOGOUT`, `ADMIN_ACCESS_DENIED`
- Redirect `/owner/*` → `/admin/dashboard`
- Aba Owner removida de `LoginPage.tsx` — `/login` é exclusivo para academias
- `src/pages/OwnerDashboard.tsx` deletado
- `VITE_SUPABASE_SERVICE_ROLE_KEY` renomeado para `SUPABASE_SERVICE_ROLE_KEY`
- `/app/*` preservado intacto

---

### ✅ FASE 2 — Gestão de Empresas/Academias (CONCLUÍDA DEFINITIVAMENTE)

**Status:** Concluída, validada e corrigida pós-validação.

**O que foi implementado:**
- `/admin/companies` — lista paginável com busca (nome, email, CNPJ), filtros por status e plano, ações inline (bloquear, reativar, cancelar, estender trial), contador por status
- `/admin/companies/:id` — detalhe completo: dados cadastrais, staff, módulos, painel de ações administrativas, resumo KPIs
- `supabase/migrations/20260630_042_admin_platform_policies.sql` — 4 novas RLS policies (UPDATE contractors, SELECT company_modules, SELECT staff para platform_owners) + índice `idx_contractors_nome_fantasia`
- Botão "Ver todas" e coluna "Detalhes" no AdminDashboard conectados
- Sidebar: navItem Empresas ativado em todas as páginas admin
- 5 eventos de auditoria: `COMPANY_VIEWED`, `COMPANY_BLOCKED`, `COMPANY_UNBLOCKED`, `COMPANY_CANCELLED`, `TRIAL_EXTENDED`
- Correções pós-validação: imports mortos removidos, filtro local convertido para `useMemo`, `Date.now()` movido para `useState lazy initializer`, `useRef viewedLogged` para evitar duplo audit, `trial_ends_at` condicionado a `status === "trial"`

**Padrões técnicos relevantes desta fase:**
- Filtros locais (client-side) com `useMemo` para evitar round-trips e o erro `react-hooks/set-state-in-effect`
- Tempo de referência capturado via `const [now] = useState(() => Date.now())` — único padrão aceito pelo `react-hooks/purity`
- Auditoria one-shot com `useRef` (como `AdminGuard` usa `deniedLogged`)
- Confirmação `window.confirm()` obrigatória antes de qualquer ação destrutiva

---

### ✅ FASE 3 — Planos, Assinaturas e Trials (CONCLUÍDA DEFINITIVAMENTE)

**Status:** Concluída e validada. tsc: OK. build: OK. lint nos arquivos admin: OK (565 erros pré-existentes em supabase/functions/gofit-pay-base/ não são desta fase).

**O que foi implementado:**
- Migrations: `20260701_043_saas_plans.sql`, `20260701_044_saas_subscriptions.sql`, `20260701_045_saas_seed.sql` (aplicadas)
- Tabelas: `saas_plans`, `saas_plan_features`, `saas_subscriptions`, `saas_subscription_events` com RLS platform_owners
- Seed: 4 planos padrão (trial/starter/profissional/empresarial) + migração de contractors existentes
- `AdminPlansPage.tsx` (`/admin/plans`): CRUD de planos, create/edit modal, toggle ativo/inativo
- `AdminSubscriptionsPage.tsx` (`/admin/subscriptions`): lista com filtros + busca, troca de plano, status change, trial extend, cancel, reactivate
- `AdminCompanyDetailsPage.tsx`: seção "Assinatura SaaS" com plan, status badge, datas e últimos 6 eventos
- `AdminDashboard.tsx`: MRR e distribuição de planos via `saas_subscriptions` (dados reais, TODOs Fase 3 removidos)
- `adminAudit.ts`: 12 novos tipos de ação (PLAN_*, SUBSCRIPTION_*, TRIAL_*)
- Sidebar de todos os pages admin atualizado com Planos e Assinaturas
- Rotas `/admin/plans` e `/admin/subscriptions` com AdminGuard no App.tsx
- Commit principal: `c1cfa1939`
- Commit de ajustes pós-validação: `ea50f4455`

**Padrões técnicos consolidados após ajustes obrigatórios:**
- `saas_subscriptions.trial_end` é a fonte da verdade para trial
- `contractors.trial_ends_at` é mantido em sincronia como campo legado (sempre atualizar AMBOS ao estender trial)
- Qualquer extensão de trial deve inserir evento em `saas_subscription_events` + `logAdminAudit(TRIAL_EXTENDED)`
- Dashboard: coluna Plano usa `subPlanMap` (saas_subscriptions → saas_plans.name); fallback para `contractors.plan` apenas se sem assinatura
- Dashboard: alertas de trial usam `saas_subscriptions.status='trialing'` + `trial_end`

**O que NÃO deve ser alterado nas próximas fases:**
- Não recriar AdminPlansPage ou AdminSubscriptionsPage
- Não recriar as migrations 043/044/045
- Não recriar os novos tipos de auditoria
- Não remover as seções de Assinatura SaaS do AdminCompanyDetailsPage

**Objetivo:** Controle SaaS comercial da GoFit.

**Tabelas a criar:**
```sql
saas_plans (id, name, slug, price_monthly, price_yearly, max_students, max_staff, features JSONB, active, created_at)
saas_subscriptions (id, contractor_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, cancelled_at, created_at)
saas_subscription_events (id, subscription_id, contractor_id, event_type, metadata JSONB, created_by UUID, created_at)
```

**Status de assinatura:** `trialing` | `active` | `past_due` | `paused` | `blocked` | `cancelled` | `expired`

**Telas:**
- `/admin/plans` — criar, editar, ativar/inativar planos
- `/admin/subscriptions` — vincular empresa a plano, trocar plano, estender trial, cancelar

**Critérios de aceite:**
- Uma empresa tem exatamente uma assinatura ativa por vez
- Troca de plano gera evento em `saas_subscription_events`
- Dados reais de MRR substituem os mocks do AdminDashboard (remover `// TODO Fase 3`)

---

### FASE 4 — Módulos e Feature Flags

**Objetivo:** Controlar quais recursos cada empresa pode usar.

**Tabelas existentes a reaproveitar:** `modules`, `company_modules`
**Criar se não existir:** `feature_flags`, `company_feature_flags`

**Módulos sugeridos:** Agenda, Alunos, Contratos, Financeiro, Contas a Pagar/Receber, GoFit Pay, Relatórios, Avaliação Física, WhatsApp, IA, Multiunidade

**Telas:**
- `/admin/modules` — listar módulos globais, ativar/desativar por empresa ou por plano

**Regra central:** Toda checagem de módulo deve ser centralizada num hook/serviço — nunca espalhada em componentes.

**Critérios de aceite:**
- Empresa sem módulo financeiro não vê financeiro
- Alteração de módulo gera log
- Módulos podem ser controlados por plano ou manualmente por empresa

---

### FASE 5 — Financeiro SaaS da GoFit

**Objetivo:** Financeiro da GoFit separado do financeiro das academias clientes.

**Tabelas:**
```sql
saas_invoices (id, contractor_id, subscription_id, amount, due_date, status, paid_at, created_at)
saas_payments (id, invoice_id, contractor_id, amount, method, status, processed_at, created_at)
```

**Status de fatura:** `pending` | `paid` | `overdue` | `failed` | `cancelled` | `refunded`

**Telas:**
- `/admin/billing` — MRR, ARR, inadimplência
- `/admin/billing/invoices` — faturas com filtro
- `/admin/billing/overdue` — cobranças vencidas + ação de bloqueio

**Régua de cobrança sugerida:**
- D+1: status `past_due`
- D+5: alerta interno
- D+10: bloquear módulos premium
- D+15: bloquear acesso (exceto tela de pagamento)
- Após pagamento: reativar automaticamente

**Critérios de aceite:**
- Financeiro GoFit não se mistura com financeiro dos clientes
- Admin vê MRR, ARR e inadimplência
- Todas as mudanças geram auditoria

---

### FASE 6 — RBAC Administrativo

**Objetivo:** Evoluir de Owner único para equipe administrativa com permissões.

**Tabelas:**
```sql
admin_users (id, user_id UUID REFERENCES auth.users, name, email, role_id, active, created_at)
admin_roles (id, name, slug, description, created_at)
admin_permissions (id, key TEXT UNIQUE, description)
admin_role_permissions (role_id, permission_key)
```

**Papéis sugeridos:** Super Admin, Financeiro, Comercial, Suporte, Técnico/Ops, Leitura

**Permissões sugeridas:**
```
companies.view / companies.update / companies.block / companies.cancel
billing.view / billing.manage / billing.refund
plans.view / plans.manage
modules.view / modules.manage
admin_users.view / admin_users.manage
support.impersonate
audit_logs.view
settings.update
```

**Telas:**
- `/admin/users` — criar, editar, ativar/inativar, atribuir role

**Critérios de aceite:**
- Nem todo admin é Super Admin
- Cada ação valida permissão específica antes de executar
- Toda ação registrada em auditoria

---

### FASE 7 — Auditoria, Suporte e Impersonação

**Objetivo:** Rastreabilidade profissional e suporte seguro.

**Eventos de auditoria a adicionar:**
```
COMPANY_VIEWED / COMPANY_UPDATED / COMPANY_BLOCKED / COMPANY_UNBLOCKED / COMPANY_CANCELLED
PLAN_CHANGED / MODULE_ENABLED / MODULE_DISABLED
SUBSCRIPTION_CANCELLED / TRIAL_EXTENDED
SUPPORT_IMPERSONATION_STARTED / SUPPORT_IMPERSONATION_ENDED
```

**Tabela de suporte:**
```sql
support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES contractors(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES admin_users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

**Impersonação — regras obrigatórias:**
- Apenas admin com permissão `support.impersonate`
- Exigir motivo textual antes de iniciar
- Registrar `SUPPORT_IMPERSONATION_STARTED` com motivo e timestamp
- Registrar `SUPPORT_IMPERSONATION_ENDED` ao sair
- Mostrar banner visual: "Você está acessando esta empresa como suporte GoFit"
- Nunca exibir ou usar senha do cliente

**Critérios de aceite:**
- Toda impersonação rastreada com motivo, admin, empresa, início e fim
- Banner sempre visível durante impersonação

---

## Cuidados críticos (nunca fazer)

- `btoa()` para hash de senha — usar Edge Function com bcrypt
- `service_role` em variável `VITE_*` — usar `SUPABASE_SERVICE_ROLE_KEY` sem prefixo
- Policy `USING (true)` para `anon` em tabela sensível
- Lógica de plano/módulo espalhada em vários componentes — centralizar
- Criar tabela nova sem verificar se já existe equivalente
- Migration não idempotente (usar `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Confiar apenas em bloqueio visual no frontend — validar no backend
- Misturar autenticação de academia com autenticação admin
- Alterar tabelas existentes sem avaliar impacto em `/app/*`
- Recriar arquivos que já existem da Fase 1 (AdminGuard, adminAudit, AdminLoginPage, etc.)
- Adicionar aba/modo Owner em `/login`
- Usar `login()` para autenticar admin GoFit

---

## O que reportar ao final de cada implementação

1. **Migrations criadas** — nome e o que fazem
2. **Tabelas novas ou alteradas**
3. **Arquivos frontend criados ou modificados**
4. **Rotas novas** adicionadas ao `App.tsx`
5. **Eventos de auditoria** adicionados
6. **Testes manuais recomendados** — fluxo feliz, acesso negado, isolamento entre empresas
7. **O que ainda não foi implementado** nesta fase (próximos passos)
