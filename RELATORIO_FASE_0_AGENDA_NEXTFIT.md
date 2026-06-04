# Relatório da Fase 0 - Agenda estilo NextFit

Data: 03/06/2026

Esta fase foi executada apenas para segurança e auditoria. Nenhuma implantação funcional foi realizada.

## Backup criado

Backup local:

`C:\tmp\gofit-backups\20260603_210651`

Arquivos principais:

- Bundle Git: `C:\tmp\gofit-backups\20260603_210651\gofit_backup-fase-0-agenda-nextfit-20260603_210651.bundle`
- Manifesto Git: `C:\tmp\gofit-backups\20260603_210651\backup_manifest.json`
- Backup REST Supabase: `C:\tmp\gofit-backups\20260603_210651\supabase_rest`
- Manifesto Supabase: `C:\tmp\gofit-backups\20260603_210651\supabase_rest\supabase_backup_manifest.json`

Tag Git:

`backup-fase-0-agenda-nextfit-20260603_210651`

Commit base:

`e22f8afc000aaccad3f93a8729802ffc33a26d88`

Estado do repositório antes da Fase 0:

- branch `main`;
- sincronizado com `origin/main`;
- sem alterações pendentes.

## Backup do Supabase

O backup REST do Supabase foi concluído com sucesso.

- Total de tabelas exportadas: 68
- Tabelas com sucesso: 68
- Tabelas com erro: 0

## Contagem de dados relevantes

| Tabela | Registros |
| --- | ---: |
| `schedule_slots` | 64 |
| `bookings` | 0 |
| `fixed_enrollments` | 0 |
| `student_contracts` | 1 |
| `contratos` | 2 |
| `contrato_modalidades` | 0 |
| `students` | 3 |
| `opportunities` | 3 |

## Estruturas existentes relevantes

### `schedule_slots`

Já guarda as aulas geradas na agenda.

Campos relevantes existentes:

- `id`
- `contractor_id`
- `grid_id`
- `modalidade_id`
- `modalidade_nome`
- `staff_id`
- `staff_nome`
- `data`
- `hora_inicio`
- `hora_fim`
- `capacidade_maxima`
- `cor`
- `status`
- `observacoes`
- `tipo`
- `unit_id`
- `unit_nome`

Uso atual:

- base para exibir aulas na agenda;
- permite cancelar/finalizar aula;
- ainda não possui estrutura própria de histórico;
- ainda não possui controle de alteração pontual com auditoria detalhada.

### `bookings`

Já é a tabela central para pessoas dentro da aula.

Campos relevantes existentes:

- `id`
- `contractor_id`
- `slot_id`
- `student_id`
- `student_nome`
- `lead_id`
- `lead_nome`
- `tipo`
- `status`
- `reservado_em`
- `checkin_em`
- `observacoes`
- `anamnese_resposta_id`
- `descontou_contrato`

Uso atual:

- permite aluno;
- permite lead;
- permite aula experimental;
- permite status como reservado, presente, faltou, cancelado e fila de espera;
- já possui `descontou_contrato`, mas ainda não há controle real de saldo/sessão do contrato.

Lacunas:

- não diferencia claramente origem do agendamento;
- não possui vínculo com contrato usado na aula;
- não possui campos claros para cancelamento, motivo e quem cancelou;
- não possui origem `cliente_especial` de forma separada e auditável;
- não possui controle de reposição de aula cancelada.

### `fixed_enrollments`

Já existe para matrícula fixa em grade.

Campos relevantes existentes:

- `id`
- `contractor_id`
- `student_id`
- `grid_id`
- `student_nome`
- `ativo`
- `created_at`

Uso atual:

- usado na tela de ocupação da agenda;
- permite matricular aluno em horário fixo da grade.

Lacunas:

- ainda não gera automaticamente booking nas aulas futuras;
- ainda não aparece de forma integrada no modal da aula estilo NextFit;
- não tem origem/histórico vinculados ao slot específico.

### `student_contracts`, `contratos` e `contrato_modalidades`

Já existe base de contratos e vínculos com alunos.

Ponto crítico encontrado:

- há `student_contracts` e `contratos`, mas `contrato_modalidades` está sem registros no backup atual.

Impacto:

- para validar se um aluno pode entrar em determinada modalidade, será necessário confirmar como os contratos reais estão configurados;
- sem `contrato_modalidades`, a regra de modalidade permitida pelo contrato pode ficar incompleta.

## Estado atual da interface

### Agenda

Arquivo principal:

`src/pages/app/AgendaPage.tsx`

O que já faz:

- exibe a semana;
- lista aulas por dia;
- mostra ocupação da aula;
- abre o modal de detalhe da aula;
- permite cancelar todas as aulas de um dia.

Lacunas em relação à NextFit:

- ainda não é uma grade horária por linhas de horário;
- não tem filtros avançados;
- não destaca visualmente o dia/horário como a agenda da NextFit;
- não tem botão de buscar horários no mesmo fluxo.

### Modal da aula

Arquivo principal:

`src/components/app/SlotDetailModal.tsx`

O que já faz:

- mostra dados básicos da aula;
- lista alunos/leads ativos;
- permite adicionar aluno;
- permite adicionar lead;
- permite presença;
- permite falta;
- permite desfazer presença/falta;
- permite cancelar aula;
- permite concluir aula;
- calcula comissão ao concluir.

Lacunas em relação à NextFit:

- ainda não tem abas `Clientes / Leads`, `Cancelados / Desistentes`, `Fila de espera` e `Histórico`;
- cancelados são filtrados fora da consulta principal;
- não mostra origem detalhada do agendamento;
- não separa cliente com contrato, lead e cliente especial como fluxos independentes;
- não tem cadastro rápido de lead dentro do modal de adicionar lead;
- não valida crédito/saldo real do contrato;
- não controla reposição de aula cancelada;
- não registra histórico operacional da aula.

## Análise operacional

O sistema já tem uma base forte para agenda, mas ainda está mais próximo de uma agenda simples com reserva/presença/falta do que de uma operação completa de aula.

No uso real da recepção e do professor, o principal risco hoje é misturar situações diferentes dentro do mesmo conceito de booking:

- aluno regular com contrato;
- aluno de matrícula fixa;
- lead experimental;
- cliente especial/aula brinde;
- aluno em reposição;
- pessoa cancelada;
- pessoa na fila de espera.

Essas situações precisam ficar separadas porque afetam coisas diferentes:

- ocupação da aula;
- saldo do contrato;
- comissão;
- relatórios;
- histórico;
- experiência do professor na chamada;
- conferência da recepção.

## Próxima fase recomendada

A próxima etapa deve ser a Fase 1: modelagem de origem e tipo de agendamento.

Recomendação técnica:

- adicionar campos em `bookings` para origem detalhada;
- adicionar vínculo opcional com contrato;
- adicionar controle explícito de consumo de crédito;
- adicionar estrutura mínima de cancelamento;
- criar tabela de histórico da aula;
- não mexer ainda no visual completo da agenda antes de preparar os dados.

Motivo:

Se o visual for implementado antes da modelagem, a interface pode parecer correta, mas os dados continuarão ambíguos. A prioridade deve ser garantir que cada pessoa na aula tenha uma origem e uma regra de consumo bem definidas.

## Critério de Fase 0 concluída

- Backup Git criado.
- Bundle criado.
- Backup Supabase exportado.
- Auditoria das tabelas relevantes feita.
- Auditoria das telas atuais feita.
- Nenhuma implantação funcional realizada.
- Projeto pronto para iniciar a Fase 1 com segurança.
