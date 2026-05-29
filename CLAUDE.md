# GoFit — Sistema de Gestão de Academias

## O que é este projeto

**GoFit** (nome interno: FitCore) é um SaaS de gestão para academias, estúdios e box de CrossFit,
construído para ter paridade funcional com o NextFit — principal concorrente de referência no Brasil.
É um sistema multi-tenant: cada academia é um "contractor" com seus próprios alunos, staff e dados isolados.

## Stack tecnológica

- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS + Shadcn/UI + Radix UI
- **Backend/DB:** Supabase (PostgreSQL + Auth + RLS + Storage)
- **Estado:** TanStack React Query + React Context (AuthContext)
- **Gráficos:** Recharts
- **Deploy:** Vercel
- **Ícones:** Lucide React

## Estrutura de pastas relevante

```
src/
├── pages/app/          # Páginas protegidas do sistema
├── pages/public/       # Páginas públicas (convite, anamnese)
├── components/app/     # Componentes de layout, modais
├── components/ui/      # Shadcn components
├── contexts/           # AuthContext
├── hooks/              # useCEP, use-toast
├── integrations/supabase/ # client.ts + types.ts (schema TS)
supabase/migrations/    # SQL de criação do banco
```

## Autenticação e papéis

- **owner** — superadmin da plataforma (credenciais em env vars)
- **contractor** — dono/gestor da academia (login por email ou CNPJ)
- **staff** — funcionário da academia (professor, recepcionista, nutricionista, etc.)
- **público** — aluno acessa anamnese/convite via token sem login

Auth armazenada em `localStorage` via `AuthContext`. `AuthGuard` protege rotas por papel.

## Banco de dados — tabelas existentes

### Núcleo
- `contractors` — empresas/academias cadastradas
- `contractor_auth` — hash de senha do contractor
- `staff` — funcionários com roles: teacher | receptionist | sales | nutritionist | physiotherapist | evaluator
- `invites` — tokens de convite para alunos e staff

### Alunos
- `students` — cadastro completo (status: lead | ativo | inativo | cancelado)
- `student_documents` — documentos do aluno
- `student_exams` — exames/avaliações

### Treinos
- `exercise_groups` — categorias de exercício
- `exercises` — biblioteca de exercícios (intensidade, equipamento, demo URL)
- `sessions` — sessões de treino (blocos reutilizáveis)
- `session_exercises` + `session_exercise_series` — exercícios e séries dentro de sessão
- `workouts` — programas de treino (nível, gênero, faixa etária, objetivo)
- `workout_sessions` — sessões vinculadas ao treino (por semana)
- `workout_session_exercises` + `workout_session_exercise_series` — detalhes dos exercícios

### Anamnese (avaliação de saúde)
- `anamnese_questoes` — biblioteca de perguntas reutilizáveis
- `anamnese_modelos` — templates de formulário
- `anamnese_modelo_questoes` — questões vinculadas ao modelo
- `anamnese_respostas` — instâncias enviadas ao aluno (token público)
- `anamnese_resposta_itens` — respostas individuais

### Outras
- `rewards` — catálogo do clube de recompensas (pontos, foto)

## Módulos já implementados (100% funcionais)

| Módulo | Página |
|--------|--------|
| Autenticação multi-tenant | `LoginPage.tsx` |
| Dashboard contractor | `ContractorDashboard.tsx` |
| Gestão de alunos | `AlunosPage.tsx`, `AlunoFormPage.tsx` |
| Dashboard individual do aluno | `ClienteDashboardPage.tsx` |
| Biblioteca de exercícios | `ExerciciosPage.tsx`, `GruposExerciciosPage.tsx` |
| Criação de treinos | `TreinosPage.tsx`, `TreinoFormPage.tsx` |
| Sessões de treino | `SessoesPage.tsx` |
| WOD (calendário) | `WodPage.tsx`, `WodFormPage.tsx` |
| Anamnese | `AnamneseBibliotecaPage.tsx`, `AnamneseModelosPage.tsx`, `AnamneseModeloEditPage.tsx` |
| Anamnese pública (link) | `AnamnesePublicPage.tsx` |
| Clube de Recompensas | `ClubeRecompensasPage.tsx` |
| Equipe / Staff | `EquipePage.tsx` |
| Convite público | `ConvitePage.tsx` |
| Relatórios (shell) | `RelatoriosPage.tsx` |

## Módulos a construir — Roadmap por fases

### FASE 1 — Contratos & Matrícula ← PRÓXIMA
Sem isso o sistema não consegue vender nem vincular aluno a plano.
- Tabelas: `modalities`, `contracts`, `student_contracts`, `contract_templates`
- Telas: cadastro de modalidades, criação de contratos/planos, matrícula do aluno, assinatura eletrônica
- Lógica: bloqueio por inadimplência, suspensão, congelamento, reativação

### FASE 2 — Financeiro Básico
- Tabelas: `transactions`, `receivables`, `cash_sessions`, `payment_methods`
- Telas: lançar venda, registrar recebimento, caixa (abertura/fechamento), inadimplentes
- Lógica: mensalidades recorrentes, juros/multa, relatório de devedores

### FASE 3 — Agenda & Check-in
- Tabelas: `schedule_grids`, `schedule_slots`, `bookings`, `checkins`
- Telas: grade de horários por professor/modalidade, agendamento de aluno, check-in manual/QR
- Lógica: capacidade máxima, lista de espera, presença

### FASE 4 — Avaliação Física + Graduações
- Tabelas: `physical_evaluations`, `graduations`, `graduation_levels`
- Telas: protocolo de avaliação (peso, IMC, dobras, circunferências), histórico com gráficos, sistema de faixas/níveis

### FASE 5 — CRM
- Tabelas: `opportunities`, `activities`, `campaigns`, `campaign_messages`
- Telas: funil de oportunidades (lead → visita → proposta → matrícula), atividades, campanhas automáticas

### FASE 6 — Dashboards & Relatórios
- 11 dashboards: CRM, Operacional, Professor, Financeiro, Gestão, Agenda, WOD, Aluno, Comissão, DRE, Fluxo de caixa

### FASE 7 — Configurações Avançadas
- Perfis de acesso por papel (permissões granulares)
- Parâmetros financeiros (juros, multa, tolerância)
- Multi-unidades

### FASE 8 — Integrações Externas
- Wellhub/Gympass, ClassPass, TotalPass
- NFS-e, NFC-e
- GoFit Pay (pagamento recorrente via cartão)

## Referência de concorrente

NextFit (https://nextfit.com.br) é o sistema de referência.
Central de ajuda: https://ajuda.nextfit.com.br/support/home
Toda nova funcionalidade deve ser avaliada à luz do que o NextFit oferece naquele módulo.

## Padrões de código obrigatórios

- **TypeScript strict** — sem `any`, tipar sempre
- **React Query** para toda busca de dados do Supabase
- **Supabase RLS** em toda tabela nova — nunca expor dados cross-tenant
- **Shadcn/UI** para novos componentes — manter consistência visual
- **TailwindCSS** para estilo — sem CSS separado
- **Sem comentários óbvios** — só comentar WHY não-óbvio
- **Nomenclatura em português** para entidades de negócio (aluno, treino, contrato), inglês para código técnico (hooks, utils, types)

## Visual / Design

- Paleta: cinzas escuros + laranja como cor de ação primária + verde para sucesso + vermelho para erro
- Sidebar de navegação lateral fixa (`AppLayout.tsx`)
- Modais via Shadcn Dialog para formulários rápidos
- Páginas completas para cadastros extensos
- Tabelas com busca e filtro de status padrão

## Env vars necessárias

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_ROLE_KEY=
VITE_OWNER_EMAIL=owner@fitcoresys.com.br
VITE_OWNER_PASSWORD=FitCore@2025!
```

## Como rodar localmente

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de produção
```
