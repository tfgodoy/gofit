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

**Arquitetura SaaS — regras canônicas (obrigatórias em todas as fases futuras):**

**Fonte da verdade para assinaturas:**
- `saas_subscriptions` é a fonte da verdade para status de assinatura SaaS de cada empresa
- `saas_subscriptions.trial_end` é a fonte da verdade para data de término do trial
- `contractors.trial_ends_at` é campo legado de compatibilidade — deve ser sempre mantido em sincronia, mas nunca usado como fonte principal
- `contractors.plan` é campo legado — nunca usar como fonte principal de plano em novas telas

**Regra de extensão de trial (obrigatória):** toda extensão de trial DEVE:
1. Atualizar `saas_subscriptions.trial_end` (fonte da verdade)
2. Inserir evento em `saas_subscription_events` (tipo `TRIAL_EXTENDED`)
3. Registrar em `admin_audit_logs` via `logAdminAudit(TRIAL_EXTENDED)`
4. Sincronizar `contractors.trial_ends_at` (compatibilidade legada)

**Regras do AdminDashboard:**
- Coluna Plano na tabela de empresas: usa `subPlanMap` derivado de `saas_subscriptions → saas_plans.name`; `contractors.plan` apenas como fallback explicitamente comentado para empresas sem assinatura
- Alertas de trial expirando: usar `saas_subscriptions.status = 'trialing'` + `saas_subscriptions.trial_end`; nunca usar `contractors.status` ou `contractors.trial_ends_at` para esta finalidade
- MRR: somar apenas `saas_subscriptions` com `status = 'active'`; trials, cancelled, expired, blocked e paused são excluídos

**O que esta fase NÃO implementou (escopo preservado para fases futuras):**
- Asaas, pagamentos, invoices, billing real e dunning → Fase 5
- Assinaturas de alunos das academias → nunca alterar aqui
- Financeiro interno das academias → nunca alterar aqui
- `/app/*` → não foi alterado e não deve ser

**O que NÃO deve ser alterado nas próximas fases:**
- Não recriar AdminPlansPage ou AdminSubscriptionsPage
- Não recriar as migrations 043/044/045
- Não recriar os tipos de auditoria da Fase 3
- Não remover as seções de Assinatura SaaS do AdminCompanyDetailsPage
- Não reverter a lógica de subPlanMap e expiringTrials do AdminDashboard

---

### ✅ FASE 4 — Módulos e Feature Flags (CONCLUÍDA DEFINITIVAMENTE)

**Status:** Concluída. tsc: OK. build: OK. lint: OK. Commits: `432b2aa11` (implementação) + ajuste de segurança (migration 048).

**O que foi implementado:**
- Migrations: `20260701_046_modules_admin_policies.sql` (write RLS para platform_owners em modules e company_modules), `20260701_047_modules_seed.sql` (10 módulos padrão + features por plano seed)
- `src/lib/moduleAccess.ts`: helper centralizado com 6 regras de precedência para checar acesso a módulo
- `AdminModulesPage.tsx` (`/admin/modules`): Tab Catálogo Global (criar/editar/toggle módulos), Tab Features por Plano (CRUD de saas_plan_features com limites)
- `AdminCompanyDetailsPage.tsx`: seção Módulos expandida com toggle de override por empresa e botão para adicionar override
- `adminAudit.ts`: 11 novos tipos de ação (MODULE_*, PLAN_FEATURE_*, COMPANY_MODULE_*)
- Sidebar de todos os pages admin atualizado com "Módulos"
- Rota `/admin/modules` com AdminGuard no App.tsx

**Tabelas utilizadas (sem criar duplicatas):**
- `modules` (existia): catálogo global de módulos
- `company_modules` (existia): overrides por empresa
- `saas_plan_features` (criada na Fase 3): features e limites por plano — feature_key usa o módulo slug como chave implícita

**Regras de precedência de acesso (obrigatórias em todas as fases futuras):**
1. `modules.status != 'active'` → sempre bloqueado (módulo global inativo)
2. `company_modules.status = 'active'` → liberado por override manual
3. `company_modules.status = 'cancelled'` → bloqueado por override manual
4. `saas_plan_features.enabled = true` no plano ativo → liberado via plano
5. Sem assinatura `active` ou `trialing` → bloqueado
6. Feature ausente/desabilitada no plano → bloqueado

**Para integração futura com `/app/*`:**
- `saas_subscriptions` precisará de policy SELECT para `contractor_auth`/`staff` antes de usar `getModuleAccess()` no /app/*
- `company_modules` já tem policy SELECT para contractor_auth/staff (existia desde Fase 2 do app)
- O helper `src/lib/moduleAccess.ts` está pronto — apenas as policies de banco precisam ser adicionadas

**O que NÃO deve ser alterado nas próximas fases:**
- Não recriar AdminModulesPage
- Não recriar migrations 046/047
- Não recriar moduleAccess.ts
- Não remover a seção de módulos expandida do AdminCompanyDetailsPage
- Não alterar as regras de precedência sem revisar o helper

---

### ✅ FASE 5 — Financeiro SaaS da GoFit (CONCLUÍDA DEFINITIVAMENTE)

**Status:** Concluída e validada. tsc: OK. build: OK. lint: OK. Commits: `e53fb31be` (implementação) + `0f0c87d2f` (ajustes pós-validação).

**O que foi implementado:**
- Migration `20260701_049_saas_billing.sql`: 4 tabelas com RLS completa
  - `saas_asaas_customers` — contractor → Asaas customer na conta PRINCIPAL GoFit (não subconta)
  - `saas_invoices` — faturas SaaS (draft→pending→paid/overdue/failed/cancelled/refunded); `asaas_payment_id UNIQUE`
  - `saas_payments` — pagamentos confirmados imutáveis (auditoria financeira)
  - `saas_billing_events` — log imutável de todos os eventos de billing
- Edge Function `create-saas-payment`: cria customer + cobrança Asaas para invoice; auth via platform_owner; idempotente
- Edge Function `asaas-saas-webhook`: webhook Asaas SaaS separado do gofit-pay; filtra por `externalReference gofit:saas-invoice:*`; valida token em constant-time; idempotente via saas_billing_events
- `/admin/billing` — dashboard: receita recebida, prevista, inadimplência, resumo por status, faturas recentes
- `/admin/billing/invoices` — lista com filtros, ações: cobrar Asaas, marcar pago manual, vencer, cancelar
- `/admin/billing/overdue` — faturas vencidas com dias em atraso; bloquear/reativar assinatura; criar cobrança Asaas
- `AdminCompanyDetailsPage` — seção de faturas recentes por empresa
- `AdminSubscriptionsPage` — link para Financeiro SaaS no header
- navItem "Financeiro" ativado (`active: true`) em todas as páginas admin
- `adminAudit.ts` — 7 novos tipos: `INVOICE_CREATED`, `INVOICE_CANCELLED`, `INVOICE_PAID_MANUAL`, `INVOICE_MARKED_OVERDUE`, `SAAS_ASAAS_PAYMENT_REQUESTED`, `SUBSCRIPTION_BLOCKED_NON_PAYMENT`, `SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT`

**Separação de contextos (regra canônica — obrigatória em todas as fases futuras):**
- `payment_customers` / `payment_charges` → academias cobrando **alunos** via GoFit Pay (subconta Asaas)
- `saas_asaas_customers` / `saas_invoices` → GoFit cobrando **academias** pela assinatura SaaS (conta principal Asaas)
- `externalReference` dos pagamentos SaaS = `gofit:saas-invoice:{invoice_id}` — prefixo obrigatório para roteamento do webhook
- `externalReference` dos pagamentos GoFit Pay = diferente → webhook SaaS ignora silenciosamente

**Regras de webhook (obrigatórias):**
- `asaas-saas-webhook` valida `ASAAS_WEBHOOK_TOKEN` em constant-time antes de processar qualquer dado
- Webhook registra evento bruto em `saas_billing_events` ANTES de tentar processar, mesmo se fatura não encontrada
- Webhook é idempotente: checa `saas_billing_events` para evento duplicado antes de processar
- `saas_payments` só é inserido quando `newInvoiceStatus === "paid"` — nunca duplica
- Assinatura SaaS volta a `active` automaticamente quando fatura é paga (via webhook ou manual)

**Segredos necessários (Supabase Secrets — nunca VITE_):**
- `ASAAS_API_KEY` — conta principal GoFit (NÃO subconta de academia)
- `ASAAS_BASE_URL` — URL base da API Asaas
- `ASAAS_WEBHOOK_TOKEN` — token configurado no painel Asaas para o endpoint `asaas-saas-webhook`

**Regras canônicas de sincronização de assinatura (obrigatórias em todas as fases futuras):**
- `handleMarkPaid()` DEVE: inserir `saas_payments` (payment_method=MANUAL), verificar se subscription está `past_due` ou `blocked` e, se sim, atualizar para `active` + inserir `saas_subscription_events` (SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT). Não reativar `cancelled`, `expired` ou `paused`.
- `handleMarkOverdue()` DEVE: verificar se subscription está `active` ou `trialing` e, se sim, atualizar para `past_due` + inserir `saas_subscription_events` (SUBSCRIPTION_MARKED_PAST_DUE). Não alterar `blocked`, `cancelled`, `expired` ou `paused`.
- Toda mudança de saas_subscriptions.status DEVE registrar em `saas_subscription_events`.
- Toda mudança financeira DEVE registrar em `saas_billing_events`.
- Pagamentos manuais DEVEM inserir em `saas_payments` (além de `saas_billing_events`).
- `saas_payments.asaas_payment_id` tem constraint UNIQUE (migration 050) — múltiplos NULLs permitidos para pagamentos manuais.

**Padrão de estado em página com refresh manual (obrigatório):**
- Usar `const [refreshKey, setRefreshKey] = useState(0)` + `function refresh() { setLoading(true); setRefreshKey(k => k + 1); }`
- Definir `async function doLoad()` DENTRO do `useEffect`, com guard `let active = true`
- `useEffect` depende de `[refreshKey]`
- Botão de refresh chama `refresh()` diretamente — nunca `void load()` no efeito

**O que NÃO deve ser alterado nas próximas fases:**
- Não recriar as páginas billing, edge functions ou migrations 049/050
- Não mesclar saas_asaas_customers com payment_customers
- Não chamar Asaas diretamente do frontend
- Não usar VITE_ para chaves Asaas ou service role
- Não remover a lógica de sincronização de subscription em handleMarkPaid/handleMarkOverdue

---

### ✅ FASE 6 — RBAC Administrativo (CONCLUÍDA DEFINITIVAMENTE)

**Status:** Concluída e validada em browser real (login, /admin/users, /admin/roles). tsc: OK. build: OK. lint: OK. Commit: `63136da9f`.

**O que foi implementado:**
- Migration `20260701_051_admin_rbac.sql`: 5 tabelas com RLS completa
  - `admin_roles` — papéis (super_admin, financeiro, comercial, suporte, operacoes, leitura), com `is_system_role` protegendo super_admin
  - `admin_permissions` — 29 permissões seedadas, agrupadas por categoria (Empresas, Planos e Assinaturas, Módulos, Financeiro SaaS, Admin/RBAC, Auditoria, Suporte, Configurações)
  - `admin_users` — vincula `auth.users` existente à área `/admin/*`; status `active/inactive/suspended`
  - `admin_user_roles` — vínculo N:N usuário↔papel
  - `admin_role_permissions` — vínculo N:N papel↔permissão, seedado por role conforme regras de negócio
  - Bootstrap automático: todo `user_id` já em `platform_owners` vira `admin_users` ativo com role `super_admin` (idempotente)
- Migration `20260701_052_admin_rbac_helpers.sql`: RPC `find_auth_user_by_email` (SECURITY DEFINER) — localiza usuário Supabase Auth existente pelo e-mail sem expor `auth.users` no frontend nem usar service role
- Migration `20260701_053_admin_rbac_fix_recursion.sql`: **correção crítica** — as policies `*_admin_users_select` faziam `EXISTS (SELECT ... FROM admin_users ...)` diretamente, o que causa recursão infinita porque `admin_users` tem RLS habilitada com essa mesma policy (erro 500 em produção). Corrigido com função `SECURITY DEFINER is_active_admin_user(uuid)` que quebra a recursão.
- `src/hooks/useAdminPermissions.ts` — hook central: resolve `isSuperAdmin`, `isPlatformOwner`, `roles`, `permissions` e expõe `hasAdminPermission()` / `hasAnyAdminPermission()` / `hasAllAdminPermissions()`. `platform_owners` é sempre super_admin implícito, mesmo sem linha em `admin_user_roles`.
- `src/components/auth/RequireAdminPermission.tsx` — gate de rota/UI; bloqueia com mensagem amigável e registra `ADMIN_ACCESS_DENIED_BY_PERMISSION`
- `AdminGuard` atualizado: revalida (a cada navegação) se o usuário é `platform_owner` OU `admin_users` com `status='active'`; se um admin_user for desativado, a sessão local é derrubada no próximo acesso a `/admin/*`
- `adminLogin()` no `AuthContext` atualizado: aceita `platform_owners` OU `admin_users` ativos (antes só aceitava platform_owners); atualiza `last_login_at`
- `/admin/users` — lista admins, cria vínculo por e-mail (via RPC), ativa/desativa, atribui/remove papel; protege contra remover o último `super_admin` ativo
- `/admin/roles` — visualização de papéis e permissões (edição de permissões fica para Fase 7 — decisão consciente para reduzir risco de erro humano em produção; papéis são geridos via seed de migration)
- Permissões aplicadas via `hasAdminPermission()` no início de todo handler sensível existente: `AdminCompaniesPage`, `AdminCompanyDetailsPage`, `AdminPlansPage`, `AdminSubscriptionsPage`, `AdminModulesPage`, `AdminBillingInvoicesPage`, `AdminBillingOverduePage`, `AdminUsersPage`
- 12 novos eventos de auditoria: `ADMIN_USER_CREATED/UPDATED/ACTIVATED/DEACTIVATED`, `ADMIN_ROLE_ASSIGNED/REMOVED/CREATED/UPDATED/DEACTIVATED`, `ADMIN_PERMISSION_GRANTED/REVOKED`, `ADMIN_ACCESS_DENIED_BY_PERMISSION`

**Mapeamento de permissões por rota/ação (regra canônica):**
| Recurso | View | Ações sensíveis |
|---|---|---|
| Empresas | `companies.view` | `companies.update`, `companies.block`, `companies.cancel` |
| Planos | `plans.view` | `plans.manage` |
| Assinaturas | `subscriptions.view` | `subscriptions.manage` (troca plano, status, trial, cancelar, reativar) |
| Módulos | `modules.view` | `modules.manage`, `plan_features.manage`, `company_modules.manage` |
| Financeiro SaaS | `billing.view` | `billing.create_invoice`, `billing.mark_paid`, `billing.manage` (marcar vencida), `billing.cancel_invoice`, `billing.block_subscription`, `billing.reactivate_subscription` |
| RBAC | `admin_users.view`, `admin_roles.view` | `admin_users.manage` |

**Regras de segurança RBAC (obrigatórias em todas as fases futuras):**
- Nunca remover o último `super_admin` ativo (checado em `handleToggleStatus` e `handleRemoveRole` de `AdminUsersPage`)
- `platform_owners` sempre bootstrap/fallback — nunca removido nem substituído
- Toda checagem de permissão sensível deve ocorrer no handler (não só ocultar botão) — defesa em profundidade
- RLS de tabelas RBAC nunca deve ter policy para `anon`
- Qualquer nova policy SELECT em tabela RBAC que precise checar "sou admin ativo" DEVE usar `public.is_active_admin_user(auth.uid())` — nunca um `EXISTS (SELECT ... FROM admin_users ...)` inline, para não reintroduzir a recursão corrigida na migration 053

**O que NÃO deve ser alterado nas próximas fases:**
- Não recriar as tabelas RBAC, RPCs ou as 3 migrations 051/052/053
- Não recriar `useAdminPermissions`, `RequireAdminPermission`
- Não reverter a checagem de `admin_users.status` no `AdminGuard`
- Não editar permissões de `admin_roles` diretamente por UI ainda — fica para Fase 7

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

## Regras permanentes para fases futuras

Estas regras foram estabelecidas ao longo das Fases 1–3 e são obrigatórias em toda implementação futura:

### Segurança e autenticação
- Nunca usar `service_role` em variável `VITE_*`
- Nunca usar `service_role` dentro de `src/`
- Nunca adicionar aba/modo Owner em `/login`
- Nunca usar `login()` para autenticar admin GoFit — sempre `adminLogin()`
- Nunca usar `btoa()` para hash de senha
- Toda rota `/admin/*` protegida por `AdminGuard`

### Banco de dados e migrations
- Toda migration deve ser idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Nunca criar tabela nova sem verificar se já existe equivalente
- Nunca criar campo novo em `contractors` sem verificar se já existe equivalente em tabelas SaaS
- RLS obrigatória em toda tabela nova — nunca policy `USING (true)` para `anon`
- Nunca bloquear academias reais sem regra clara, testada e reversível

### Arquitetura SaaS
- `saas_subscriptions` é a fonte da verdade para assinatura — nunca `contractors.plan`
- `saas_subscriptions.trial_end` é a fonte da verdade para trial — nunca `contractors.trial_ends_at` sozinho
- `contractors.plan` e `contractors.trial_ends_at` são campos legados de compatibilidade — sempre manter em sincronia, nunca usar como fonte principal
- MRR conta apenas `status = 'active'`
- Toda alteração de assinatura deve registrar em `saas_subscription_events`

### Auditoria
- Toda ação sensível registrada via `logAdminAudit()` de `src/lib/adminAudit.ts`
- Toda alteração de assinatura registra também em `saas_subscription_events`
- Toda extensão de trial atualiza AMBOS: `saas_subscriptions.trial_end` + `contractors.trial_ends_at`

### Isolamento de escopo
- Nunca alterar `/app/*` nas fases admin
- Nunca alterar assinaturas de alunos das academias
- Nunca alterar financeiro interno das academias clientes
- Financeiro SaaS da GoFit (Fase 5+) é completamente separado do financeiro das academias

### Módulos globais (tabela `modules`) — regras permanentes (Fase 4+)
- **Nunca DELETE físico em `modules`** — módulos são registros estruturais referenciados por `company_modules`, `saas_plan_features`, auditorias e feature flags
- Para "remover" um módulo: usar `status = 'deprecated'` ou `status = 'coming_soon'` + `is_visible = false`
- Módulo global com `status != 'active'` bloqueia acesso de qualquer empresa, mesmo que exista override positivo em `company_modules`
- Override positivo em `company_modules` só libera acesso se o módulo global estiver `status = 'active'`
- A policy de banco NUNCA deve incluir `FOR ALL` ou `FOR DELETE` em `modules` — apenas `FOR INSERT` e `FOR UPDATE` para platform_owners
- DELETE poderá ser reavaliado no futuro apenas com: verificação de integridade referencial, cascata explícita e aprovação explícita nesta skill

### Padrões React
- Estado de loading inicializado como `true`; nunca chamar `setLoading(true)` sincronamente no corpo do `useEffect`
- Async data loading: definir função async dentro do `useEffect`, chamar sem `await`, setar estado apenas dentro da função (após pelo menos um `await`)
- `refreshKey` pattern para recarregar dados após mutação (não `useCallback` + `useEffect([fn])`)
- Tempo de referência: `const [now] = useState(() => Date.now())` — nunca `Date.now()` direto no render

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
- Criar policy `FOR ALL` ou `FOR DELETE` em `modules` — usar apenas `FOR INSERT` + `FOR UPDATE`
- Deletar registro de `modules` fisicamente — usar `status = 'deprecated'` ou `is_visible = false`

---

## O que reportar ao final de cada implementação

1. **Migrations criadas** — nome e o que fazem
2. **Tabelas novas ou alteradas**
3. **Arquivos frontend criados ou modificados**
4. **Rotas novas** adicionadas ao `App.tsx`
5. **Eventos de auditoria** adicionados
6. **Testes manuais recomendados** — fluxo feliz, acesso negado, isolamento entre empresas
7. **O que ainda não foi implementado** nesta fase (próximos passos)
