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
1. `supabase.auth.signInWithPassword` com email e senha
2. Consulta à tabela `platform_owners` para confirmar acesso

**Jamais usar `VITE_OWNER_EMAIL` ou `VITE_OWNER_PASSWORD` — essas variáveis foram removidas.**  
**Jamais expor `service_role` em variável `VITE_*`.**

Tabela central de identidade de admins:
```sql
platform_owners (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id)
)
```

---

## Ordem de trabalho obrigatória

Antes de escrever qualquer linha de código, sempre:

1. **Identificar a fase** solicitada (ver seção Fases)
2. **Verificar arquivos existentes** relevantes (lista abaixo)
3. **Verificar migrations existentes** em `supabase/migrations/`
4. **Avaliar impacto em `/app/*`** — nunca quebrar o fluxo das academias
5. **Criar migration segura e idempotente**
6. **Criar tipos TypeScript** atualizando `src/integrations/supabase/types.ts`
7. **Criar serviços/hooks** de acesso a dados
8. **Criar componentes/telas**
9. **Criar proteção de rota e validação de permissão**
10. **Criar registro de auditoria** para toda ação sensível
11. **Verificar fluxo feliz**
12. **Verificar acesso negado** (usuário não autenticado, não autorizado, de outra empresa)
13. **Confirmar que outro contractor não é afetado**
14. **Documentar o que foi alterado**

---

## Arquivos a analisar antes de qualquer alteração

- `src/App.tsx` — rotas e guards
- `src/contexts/AuthContext.tsx` — autenticação e roles
- `src/pages/owner/` — painel owner legado (manter ou redirecionar para `/admin`)
- `src/pages/admin/` — nova área admin (criar se não existir)
- `src/components/auth/AuthGuard.tsx` — proteção de rotas
- `src/hooks/` — hooks existentes
- `supabase/migrations/` — histórico do banco
- Tabelas: `contractors`, `staff`, `role_permissions`, `modules`, `company_modules`, `platform_owners`

---

## Checklist de segurança (sempre verificar)

- [ ] Nenhuma credencial ou `service_role` exposta em variável `VITE_*`
- [ ] Toda rota `/admin/*` protegida por `AuthGuard` com role `"owner"`
- [ ] Toda query admin valida sessão Supabase ativa
- [ ] Toda ação sensível registrada em `admin_audit_logs`
- [ ] RLS ativa em todas as tabelas novas
- [ ] Nenhuma policy `USING (true)` para `anon` em tabela sensível
- [ ] Migrations idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- [ ] `btoa()` não usado para hash de senha (usar bcrypt via Edge Function)
- [ ] Lógica de autorização validada no backend (Supabase RLS/Functions), não apenas no frontend
- [ ] Impersonação rastreada com início, fim e motivo

---

## Fases de implementação

### FASE 1 — Base segura do Admin GoFit

**Objetivo:** Fundação segura da área administrativa.

**O que implementar:**
1. Estrutura de rotas `/admin/*` no `App.tsx`
2. Página de login `/admin/login` (ou redirecionar do login principal)
3. `AdminGuard` — protege rotas admin, verifica `platform_owners`
4. Revisar/criar tabela `platform_owners`
5. Criar tabela `admin_audit_logs`
6. Registrar: `ADMIN_LOGIN`, `ADMIN_LOGOUT`, `ADMIN_ACCESS_DENIED`
7. Dashboard inicial `/admin/dashboard` com cards de resumo
8. Redirecionar `/owner/*` para `/admin/*` (manter temporariamente como alias)

**Schema de auditoria:**
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,        -- ex: 'ADMIN_LOGIN', 'COMPANY_BLOCKED'
  target_type TEXT,            -- ex: 'contractor', 'subscription'
  target_id UUID,
  contractor_id UUID,          -- empresa afetada (se houver)
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Critérios de aceite:**
- Não autenticado → redireciona para login
- Autenticado mas não em `platform_owners` → acesso negado + log
- Owner em `platform_owners` → acessa `/admin/dashboard`
- Login e logout registrados em auditoria
- `/app/*` continua funcionando normalmente

---

### FASE 2 — Gestão de Empresas/Academias

**Objetivo:** Admin GoFit controla todos os contractors.

**Telas:**
- `/admin/companies` — lista com busca por nome, email, status, plano
- `/admin/companies/:id` — detalhe: dados, usuários, plano, módulos

**Ações (todas com log):**
- Ativar empresa
- Bloquear empresa
- Cancelar empresa
- Estender trial
- Adicionar observações internas

**Critérios de aceite:**
- Owner vê todas as empresas (sem filtro de `contractor_id`)
- Cada ação sensível gera entrada em `admin_audit_logs`
- Isolamento por `contractor_id` não é afetado nas outras empresas

---

### FASE 3 — Planos, Assinaturas e Trials

**Objetivo:** Controle SaaS comercial da GoFit.

**Tabelas:**
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
- Admin vê situação comercial de cada empresa

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
admin_permissions (id, key TEXT UNIQUE, description)  -- ex: 'companies.block'
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

**Eventos de auditoria obrigatórios:**
```
ADMIN_LOGIN / ADMIN_LOGOUT / ADMIN_ACCESS_DENIED
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
  status TEXT DEFAULT 'open',   -- open | in_progress | waiting_customer | resolved | closed
  priority TEXT DEFAULT 'medium', -- low | medium | high | critical
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
- Mostrar banner visual enquanto ativo: "Você está acessando esta empresa como suporte GoFit"
- Nunca exibir ou usar senha do cliente
- Não permitir ações sensíveis sem confirmação adicional

**Critérios de aceite:**
- Toda impersonação rastreada com motivo, admin, empresa, início e fim
- Banner sempre visível durante impersonação
- Logs completos permitem auditoria de qualquer ação

---

## Cuidados críticos (nunca fazer)

- `btoa()` para hash de senha — use Edge Function com bcrypt
- `service_role` em variável `VITE_*`
- Policy `USING (true)` para `anon` em tabela sensível
- Lógica de plano/módulo espalhada em vários componentes — centralizar
- Criar tabela nova sem verificar se já existe equivalente
- Migration não idempotente (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Confiar apenas em bloqueio visual no frontend — validar no backend
- Misturar autenticação de academia com autenticação admin
- Alterar tabelas existentes sem avaliar impacto em `/app/*`

---

## O que reportar ao final de cada implementação

Ao concluir qualquer fase ou funcionalidade, sempre informe:

1. **Migrations criadas** — nome e o que fazem
2. **Tabelas novas ou alteradas**
3. **Arquivos frontend criados ou modificados**
4. **Rotas novas** adicionadas ao `App.tsx`
5. **Eventos de auditoria** adicionados
6. **Testes manuais recomendados** — fluxo feliz, acesso negado, isolamento entre empresas
7. **O que ainda não foi implementado** nesta fase (próximos passos)
