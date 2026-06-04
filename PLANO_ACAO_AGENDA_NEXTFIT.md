# Plano de ação - Agenda estilo NextFit

Data/hora da última atualização do estado: 04/06/2026 09:46:33 -03:00

Este documento registra o planejamento para evoluir a agenda do GoFit com base no fluxo observado nas telas da NextFit. A implantação já avançou além da Fase 0; este arquivo agora serve como plano e também como controle do estado atual por fase.

## Objetivo

Transformar a agenda atual em uma operação completa de aula, permitindo que recepção, professor e gestão acompanhem alunos, leads, cancelamentos, fila de espera, presença/falta, histórico e alterações pontuais de uma aula específica.

O foco principal é evitar inconsistências no dia a dia, principalmente em três pontos:

- ocupação real da aula;
- consumo correto de créditos/sessões do contrato;
- origem correta de cada pessoa adicionada ao horário.

## Situação atual do GoFit

O GoFit já possui uma implantação operacional avançada da agenda estilo NextFit:

- criação de grades recorrentes e geração de aulas na agenda;
- professor, local/sala, modalidade, capacidade, cor e status da aula;
- regras de check-in, cancelamento, acesso, gênero, leads, clientes especiais, fila de espera e agenda livre;
- agenda semanal visual por horários, dias da semana e aulas simultâneas;
- filtros por busca, modalidade, professor, local e status;
- contadores de aulas, reservas, lotação e fila;
- modal da aula com abas Clientes / Leads, Cancelados, Fila e Histórico;
- adição de cliente com contrato, lead e cliente especial;
- cadastro rápido de lead pelo modal;
- presença, falta e desfazer presença/falta;
- cancelamento de participação com motivo, responsável e registro de cancelamento;
- geração básica de crédito de reposição no cancelamento elegível;
- fila de espera com movimentação para a aula quando houver vaga;
- histórico operacional da aula;
- consumo de sessão registrado em tabela própria e estorno ao desfazer presença/falta;
- cancelamento e conclusão da aula;
- geração de comissão por aula concluída.
- alteração pontual de uma aula específica sem alterar a grade recorrente.

## Estado de implantação por fase

| Fase | Estado | Observação |
| --- | --- | --- |
| Fase 0 - Backup e auditoria | Concluída | Backup, bundle, tag e auditoria inicial foram registrados. |
| Fase 1 - Modelagem de origem e tipo de agendamento | Implantada | `bookings` recebeu origem, tipo de pessoa, vínculo com contrato, controle de crédito e dados de cancelamento. Também foi criada a base de histórico. |
| Fase 2 - Abas do modal da aula | Implantada | Modal separado em Clientes / Leads, Cancelados, Fila e Histórico. |
| Fase 3 - Adicionar cliente com contrato | Parcialmente implantada | O fluxo adiciona cliente com contrato ativo e valida modalidade/bloqueio/gênero. Ainda falta validar saldo real disponível antes da entrada e tratar uso explícito de reposição. |
| Fase 4 - Adicionar lead | Implantada | Busca lead existente e permite cadastro rápido no próprio modal. O agendamento público também grava origem de lead e histórico. |
| Fase 5 - Adicionar cliente especial | Implantada | Cliente especial entra sem consumo de crédito e com origem própria. |
| Fase 6 - Cancelados, desistentes e reposição | Parcialmente implantada | Cancelados aparecem em aba própria e podem gerar crédito de reposição. Ainda falta fluxo para usar o crédito gerado e regras configuráveis de prazo/elegibilidade. |
| Fase 7 - Fila de espera | Implantada com regra básica | Pessoas entram como `lista_espera` quando a aula está cheia e podem ser movidas para a aula. Ainda pode evoluir em regras de prazo e permissões administrativas. |
| Fase 8 - Presença, falta e consumo real de sessões | Parcialmente implantada | Presença/falta gravam consumo em `schedule_session_usage` e desfazer estorna. Ainda falta consolidar saldo real do contrato/pacote e bloquear entrada por saldo insuficiente. |
| Fase 9 - Histórico da aula | Implantada | Histórico registra criação, inclusão, cancelamento, fila, presença/falta, desfazer, cancelamento, conclusão e alteração pontual da aula. |
| Fase 10 - Alterar somente esta aula | Implantada | Modal permite editar modalidade, professor, local/sala, data, horário, duração, capacidade, cor, descrição e link online somente em `schedule_slots`, com histórico e confirmação quando há reservas. |
| Fase 11 - Agenda visual semanal | Implantada | Agenda semanal por horários, filtros, busca, lotação, fila, aulas simultâneas e ajustes visuais posteriores. |

O que ainda falta para chegar no fluxo completo observado na NextFit:

- permitir usar crédito de reposição disponível ao adicionar aluno em nova aula;
- validar e exibir saldo real de sessões/aulas do contrato antes de adicionar cliente com contrato;
- consolidar relatórios ou cálculo de saldo com base em `schedule_session_usage`;
- transformar regras de reposição em configuração operacional, incluindo prazo, modalidade permitida e professor/local;
- testar o fluxo completo contra o Supabase publicado após aplicar as migrations no ambiente alvo.

## Uso real no dia a dia

Na prática, a agenda precisa atender estes cenários:

- Professor abre a aula e vê quem está reservado.
- Recepção adiciona um aluno com contrato em uma vaga disponível.
- Recepção adiciona um lead para aula experimental.
- Recepção cadastra um lead na hora e já coloca na aula.
- Recepção adiciona um cliente especial/aula brinde sem consumir crédito.
- Aluno cancela pelo app e aparece em cancelados/desistentes.
- Aluno com cancelamento válido pode usar crédito de reposição.
- Professor marca presença ou falta.
- Presença/falta impacta o saldo de sessões quando aplicável.
- Gestão consulta o histórico para entender quem alterou, adicionou, removeu, cancelou ou concluiu a aula.
- Uma aula específica pode ser alterada sem afetar as demais aulas geradas pela grade.

## Fase 0 - Backup e auditoria antes de iniciar

Antes de qualquer implantação:

- criar backup Git do estado atual;
- criar bundle do projeto;
- se houver alteração no banco, criar backup do schema/dados atuais do Supabase;
- revisar tabelas envolvidas antes de aplicar migration;
- registrar commit atual, tag de backup e local do backup.

Critério de conclusão:

- backup salvo;
- estado atual conhecido;
- plano da fase revisado antes de qualquer alteração.

## Fase 1 - Modelagem de origem e tipo de agendamento

Objetivo:

Criar a base para que cada pessoa na aula tenha uma origem clara.

Campos ou estrutura necessária:

- tipo da pessoa: cliente, lead ou cliente especial;
- origem do agendamento: matrícula, app aluno, contrato, reposição, lead, cliente especial, aula brinde;
- se consome crédito do contrato: sim ou não;
- vínculo com contrato, quando existir;
- usuário que adicionou;
- data/hora da inclusão;
- motivo ou observação, quando necessário.

Regras:

- cliente com contrato pode consumir crédito;
- lead não consome crédito;
- cliente especial não consome crédito;
- reposição deve usar crédito de aula cancelada, se a regra for válida;
- toda inclusão precisa respeitar vaga disponível, exceto se for criada regra explícita de excedente.

Critério de conclusão:

- banco preparado;
- tipos/origens padronizados;
- fluxo atual continua funcionando sem quebrar a agenda.

## Fase 2 - Abas do modal da aula

Objetivo:

Organizar o modal da aula com as mesmas áreas operacionais observadas na NextFit.

Abas necessárias:

- Clientes / Leads;
- Cancelados / Desistentes;
- Fila de espera;
- Histórico.

Na aba Clientes / Leads:

- listar alunos/clientes/leads ativos na aula;
- mostrar nome;
- mostrar situação: reservado, presente, falta, cancelado;
- mostrar origem: matrícula, app aluno, contrato, lead, cliente especial;
- permitir presença/falta;
- permitir ações adicionais por menu.

Na aba Cancelados / Desistentes:

- listar pessoas canceladas;
- mostrar origem original;
- mostrar motivo/data do cancelamento quando existir;
- permitir análise de reposição quando aplicável.

Na aba Fila de espera:

- listar pessoas aguardando vaga;
- permitir mover para aula se abrir vaga;
- respeitar período permitido para entrada na fila.

Na aba Histórico:

- mostrar eventos da aula;
- exemplo: aula criada, aluno adicionado, aluno cancelado, presença marcada, falta marcada, aula alterada, aula concluída.

Critério de conclusão:

- modal mais próximo do fluxo NextFit;
- dados separados por aba;
- professor consegue entender rapidamente a situação da aula.

## Fase 3 - Adicionar cliente com contrato

Objetivo:

Permitir adicionar na aula um cliente que possui contrato válido ou crédito de reposição.

Fluxo:

1. Usuário clica em Adicionar cliente com contrato.
2. Sistema abre modal de busca.
3. Usuário pesquisa e seleciona o cliente.
4. Sistema valida contrato, modalidade, crédito disponível e vaga.
5. Sistema adiciona o cliente na aula.
6. Origem fica registrada como contrato, matrícula ou reposição.

Validações necessárias:

- contrato ativo;
- modalidade permitida pelo contrato;
- saldo de aulas/sessões disponível;
- crédito de reposição, quando vier de aula cancelada;
- horário com vaga;
- cliente ainda não está na mesma aula.

Impacto no consumo:

- se for aula normal do contrato, deve consumir crédito quando presença/falta for processada conforme a regra definida;
- se for reposição, deve consumir o crédito de reposição;
- o sistema precisa impedir duplicidade de consumo.

Critério de conclusão:

- cliente com contrato pode ser adicionado com segurança;
- origem fica correta;
- aula aparece com ocupação atualizada;
- nenhuma aula é consumida indevidamente.

## Fase 4 - Adicionar lead

Objetivo:

Permitir adicionar um lead já cadastrado ou cadastrar um novo lead na hora.

Fluxo:

1. Usuário clica em Adicionar lead.
2. Sistema abre modal de busca de lead.
3. Usuário seleciona um lead existente ou clica em + para cadastrar.
4. Sistema valida vaga.
5. Sistema adiciona o lead na aula.

Regras:

- lead não consome crédito de contrato;
- lead entra com origem lead;
- lead pode ser tratado como aula experimental;
- se o lead virar cliente depois, o histórico da aula deve permanecer correto.

Critério de conclusão:

- recepção consegue cadastrar ou selecionar lead sem sair da agenda;
- lead entra na aula com origem correta;
- ocupação da aula é atualizada.

## Fase 5 - Adicionar cliente especial

Objetivo:

Permitir adicionar um cliente como aula especial, brinde ou cortesia, sem consumir crédito do contrato.

Fluxo:

1. Usuário clica em Adicionar cliente especial.
2. Sistema abre modal de busca de cliente.
3. Sistema mostra aviso claro: essa inclusão não consome créditos de aula.
4. Usuário seleciona o cliente.
5. Sistema valida vaga.
6. Sistema adiciona o cliente como especial.

Regras:

- pode ter contrato ou não;
- não consome crédito;
- conta na ocupação da aula;
- deve aparecer na origem como cliente especial ou aula brinde;
- precisa ficar registrado em histórico.

Critério de conclusão:

- cliente especial entra na aula sem afetar saldo de contrato;
- professor e gestão enxergam que foi uma inclusão especial;
- histórico registra a ação.

## Fase 6 - Cancelados, desistentes e reposição

Objetivo:

Controlar cancelamentos de aula de forma rastreável e permitir reposição quando a regra permitir.

Regras a definir:

- até quando o aluno pode cancelar sem perder crédito;
- quando o cancelamento gera crédito de reposição;
- prazo de validade da reposição;
- se reposição precisa ser na mesma modalidade;
- se reposição pode ser usada em qualquer professor/local.

Dados necessários:

- data/hora do cancelamento;
- quem cancelou: aluno, recepção, professor ou sistema;
- motivo;
- se gerou crédito;
- se o crédito já foi usado.

Critério de conclusão:

- aba Cancelados / Desistentes mostra dados confiáveis;
- crédito de reposição é rastreável;
- sistema evita reaproveitamento duplicado.

## Fase 7 - Fila de espera

Objetivo:

Permitir que pessoas entrem na fila quando a aula estiver lotada.

Fluxo:

1. Aula está sem vaga.
2. Cliente ou recepção adiciona pessoa na fila.
3. Se uma vaga abrir, recepção pode mover a pessoa para a aula.
4. Histórico registra a movimentação.

Regras:

- fila deve respeitar ordem de entrada, salvo permissão administrativa;
- pessoa movida para aula deve passar pelas mesmas validações de contrato/origem;
- fila precisa ter prazo de encerramento antes da aula.

Critério de conclusão:

- aula lotada não impede controle de demanda;
- recepção consegue preencher vaga liberada;
- histórico mostra entrada e saída da fila.

## Fase 8 - Presença, falta e consumo real de sessões

Objetivo:

Conectar presença/falta ao saldo real do contrato do aluno.

Regras a revisar antes:

- em que momento a sessão é consumida;
- se falta consome aula;
- se presença consome aula;
- se reserva já bloqueia crédito;
- se cancelamento tardio consome crédito;
- se cliente especial nunca consome crédito;
- se lead nunca consome crédito.

Comportamento esperado:

- marcar presente atualiza situação e, se aplicável, consome sessão;
- marcar falta atualiza situação e, se aplicável, consome sessão;
- desfazer presença/falta deve reverter consumo quando permitido;
- concluir aula deve travar ou consolidar os lançamentos.

Critério de conclusão:

- saldo do contrato não fica divergente;
- presença/falta têm impacto previsível;
- professor consegue operar sem entender regra financeira complexa.

## Fase 9 - Histórico da aula

Objetivo:

Registrar todas as ações relevantes da aula.

Eventos mínimos:

- aula criada;
- aula alterada;
- cliente adicionado;
- lead adicionado;
- cliente especial adicionado;
- pessoa cancelada;
- pessoa movida para fila;
- pessoa saiu da fila;
- presença marcada;
- falta marcada;
- presença/falta desfeita;
- aula cancelada;
- aula concluída.

Critério de conclusão:

- gestão consegue auditar o que aconteceu;
- suporte consegue investigar divergências;
- histórico aparece dentro do modal da aula.

## Fase 10 - Alterar somente esta aula

Objetivo:

Permitir alterar uma aula específica sem alterar as demais aulas da grade.

Campos editáveis:

- modalidade;
- descrição;
- professor;
- local/sala;
- data/hora;
- duração;
- cor;
- link online;
- capacidade, se necessário.

Regras:

- alteração deve afetar apenas o registro da aula em schedule_slots;
- não deve alterar schedule_grids;
- histórico deve registrar a alteração;
- se houver pessoas na aula, mudanças críticas devem pedir confirmação.

Critério de conclusão:

- recepção consegue corrigir uma aula específica;
- grade recorrente permanece intacta;
- histórico mostra o que mudou.

## Fase 11 - Agenda visual semanal

Objetivo:

Aproximar a agenda visual do uso operacional observado na NextFit.

Melhorias:

- grade por horários;
- visual semanal com colunas por dia;
- cards com cor da modalidade/aula;
- destaque para lotado;
- contador de ocupação;
- filtros por professor, modalidade, local e status;
- navegação por semana;
- botão de buscar horários.

Critério de conclusão:

- recepção encontra horários rapidamente;
- aulas lotadas ficam evidentes;
- visão semanal ajuda planejamento do dia.

## Ordem recomendada de implantação

1. Backup e auditoria - concluído.
2. Modelagem de origem e tipo de agendamento - implantado.
3. Abas do modal da aula - implantado.
4. Adicionar cliente com contrato - implantado parcialmente; falta saldo real e reposição.
5. Adicionar lead com cadastro rápido - implantado.
6. Adicionar cliente especial sem consumo de crédito - implantado.
7. Cancelados/desistentes e reposição - implantado parcialmente; falta uso do crédito gerado.
8. Fila de espera - implantado com regra básica.
9. Presença/falta com consumo real de sessões - implantado parcialmente; falta saldo consolidado do contrato.
10. Histórico da aula - implantado.
11. Alterar somente esta aula - implantado.
12. Melhorias visuais da agenda semanal - implantado antes da Fase 10, com ajustes posteriores.

## Riscos principais

- Consumir aula duas vezes do mesmo contrato.
- Cliente especial consumir crédito por engano.
- Lead entrar como cliente e afetar relatórios.
- Cancelamento gerar crédito indevido.
- Alterar uma aula específica e acabar alterando a grade inteira.
- Ocupação da aula ficar diferente da lista real de pessoas.

## Estratégia de implantação

Cada fase deve seguir o mesmo ritual:

1. Criar backup.
2. Aplicar alteração pequena.
3. Rodar testes/build.
4. Testar fluxo manual na interface.
5. Conferir dados no Supabase.
6. Commitar.
7. Fazer push.
8. Validar no ambiente publicado.

Assim, se algo falhar, a correção fica localizada e conseguimos voltar para o ponto anterior com segurança.
