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

O Owner/Admin autentica via:
1. Função `adminLogin(email, password)` no `AuthContext`
2. `supabase.auth.signInWithPassword` com email e senha
3. Consulta à tabela `platform_owners` para confirmar acesso

**Jamais usar `VITE_OWNER_EMAIL` ou `VITE_OWNER_PASSWORD` — essas variáveis foram removidas.**
**Jamais expor `service_role` em variável `VITE_*`.**

Tabela central de identidade de admins:
```sql
platform_owners (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

---

## Estado atual do projeto (atualizado após Fase 1)

### Arquivos existentes na área Admin

| Arquivo | Status |
|---|---|
| `src/pages/admin/AdminLoginPage.tsx` | ✅ Criado |
| `src/pages/admin/AdminDashboard.tsx` | ✅ Criado |
| `src/components/auth/AdminGuard.tsx` | ✅ Criado |
| `src/lib/adminAudit.ts` | ✅ Criado |
| `src/contexts/AuthContext.tsx` | ✅ Atualizado com `adminLogin()` e auditoria no logout |
| `src/App.tsx` | ✅ Atualizado com rotas `/admin/*` e redirects `/owner/*` |
| `supabase/migrations/20260630_041_admin_audit_logs.sql` | ✅ Aplicada |
| `src/pages/OwnerDashboard.tsx` | ✅ Removido (arquivo deletado após validação Fase 1) |
| `src/pages/LoginPage.tsx` | ✅ Aba Owner removida — apenas entrada de academias/clientes |

### Rotas existentes

| Rota | Status |
|---|---|
| `/admin/login` | ✅ Funcional |
| `/admin/dashboard` | ✅ Funcional |
| `/admin/*` (catch-all) | ✅ Redireciona para `/admin/dashboard` via AdminGuard |
| `/owner/dashboard` | ✅ Redireciona para `/admin/dashboard` |
| `/owner/*` | ✅ Redireciona para `/admin/dashboard` |
| `/app/*` | ✅ Intacto, não alterado |

### Tabelas Admin existentes no banco

| Tabela | Status |
|---|---|
| `platform_owners` | ✅ Existe (criada via MCP) |
| `admin_audit_logs` | ✅ Criada na Fase 1 com RLS + função SECURITY DEFINER |

### Eventos de auditoria implementados

| Evento | Quando é registrado |
|---|---|
| `ADMIN_LOGIN_SUCCESS` | Login aprovado via `adminLogin()` |
| `ADMIN_LOGIN_DENIED` | Credenciais inválidas ou usuário não está em `platform_owners` |
| `ADMIN_LOGOUT` | Logout de usuário com role `"owner"` |
| `ADMIN_ACCESS_DENIED` | Usuário autenticado tenta acessar `/admin/*` sem role `"owner"` |

### Pendências conhecidas do Admin Dashboard (Fase 1)

- Gráficos de MRR e Churn ainda usam **dados mockados** — serão substituídos na Fase 3 (assinaturas)
- Botões "Ver todas" e "Detalhes" na tabela de empresas ainda são **stubs**
- Sidebar: itens Planos, Financeiro, Auditoria e Configurações marcados como **"em breve"**
- `ip_address` **não é capturado** — frontend não consegue obter o IP real de forma segura. Implementar via Edge Function em fase futura

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

### ✅ FASE 1 — Base segura do Admin GoFit (CONCLUÍDA)

**Status:** Concluída. Pendente apenas validação manual final.

**O que foi implementado:**
- `/admin/login` — página de login exclusiva do admin
- `/admin/dashboard` — dashboard com KPIs, gráficos e tabela de empresas
- `AdminGuard` — protege todas as rotas `/admin/*`
- `adminLogin()` no `AuthContext` — autenticação separada com auditoria
- Tabela `admin_audit_logs` com RLS + função `SECURITY DEFINER` para logs de tentativas negadas
- Helper `logAdminAudit()` centralizado em `src/lib/adminAudit.ts`
- Redirect `/owner/*` → `/admin/*`
- `/app/*` preservado intacto

**O que NÃO deve ser refeito nas próximas fases:**
- Não recriar `/admin/login`
- Não recriar `/admin/dashboard` do zero
- Não recriar `AdminGuard`
- Não recriar `admin_audit_logs` — apenas evoluir com novos eventos se necessário
- Não mexer no fluxo `/app/*`
- Não reverter redirect `/owner/*`

---

### 🔜 FASE 2 — Gestão de Empresas/Academias (PRÓXIMA)

**Objetivo:** Admin GoFit controla todos os contractors com ações administrativas.

**Pré-requisito obrigatório:** Diagnosticar a estrutura real da tabela `contractors` antes de codar.

**O que implementar:**

1. `/admin/companies` — lista de contractors com busca por nome, email, status, plano
2. `/admin/companies/:id` — detalhe da empresa: dados, usuários, plano, módulos ativos
3. Ações administrativas (todas com `logAdminAudit()`):
   - Visualizar empresa → `COMPANY_VIEWED`
   - Ativar empresa → `COMPANY_UNBLOCKED` ou equivalente
   - Bloquear empresa → `COMPANY_BLOCKED`
   - Cancelar empresa → `COMPANY_CANCELLED` (se existir campo/status adequado)
   - Estender trial → `TRIAL_EXTENDED` (somente se existir estrutura de trial)
4. Reaproveitamento de `modules` e `company_modules` para mostrar módulos ativos

**Regras para Fase 2:**
- Verificar campos existentes em `contractors` antes de criar novos
- Não criar assinatura SaaS completa — isso é Fase 3
- Não criar financeiro SaaS — isso é Fase 5
- Não criar RBAC completo — isso é Fase 6
- Não criar suporte/impersonação — isso é Fase 7
- Toda alteração respeita RLS

**Critérios de aceite:**
- Owner vê todas as empresas (sem filtro de `contractor_id`)
- Cada ação sensível gera entrada em `admin_audit_logs`
- Isolamento por `contractor_id` não é afetado nas outras empresas
- `/app/*` continua funcionando normalmente

---

### FASE 3 — Planos, Assinaturas e Trials

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
- Dados reais de MRR substituem os dados mockados do Admin Dashboard

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
- `service_role` em variável `VITE_*`
- Policy `USING (true)` para `anon` em tabela sensível
- Lógica de plano/módulo espalhada em vários componentes — centralizar
- Criar tabela nova sem verificar se já existe equivalente
- Migration não idempotente (usar `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Confiar apenas em bloqueio visual no frontend — validar no backend
- Misturar autenticação de academia com autenticação admin
- Alterar tabelas existentes sem avaliar impacto em `/app/*`
- Recriar arquivos que já existem da Fase 1 (AdminGuard, adminAudit, etc.)

---

## O que reportar ao final de cada implementação

1. **Migrations criadas** — nome e o que fazem
2. **Tabelas novas ou alteradas**
3. **Arquivos frontend criados ou modificados**
4. **Rotas novas** adicionadas ao `App.tsx`
5. **Eventos de auditoria** adicionados
6. **Testes manuais recomendados** — fluxo feliz, acesso negado, isolamento entre empresas
7. **O que ainda não foi implementado** nesta fase (próximos passos)
