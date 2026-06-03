# Plano de ação - Agenda estilo NextFit

Este documento registra o planejamento para evoluir a agenda do GoFit com base no fluxo observado nas telas da NextFit. Nenhuma implantação foi realizada neste plano; ele serve como guia por fases para implementação futura.

## Objetivo

Transformar a agenda atual em uma operação completa de aula, permitindo que recepção, professor e gestão acompanhem alunos, leads, cancelamentos, fila de espera, presença/falta, histórico e alterações pontuais de uma aula específica.

O foco principal é evitar inconsistências no dia a dia, principalmente em três pontos:

- ocupação real da aula;
- consumo correto de créditos/sessões do contrato;
- origem correta de cada pessoa adicionada ao horário.

## Situação atual do GoFit

O GoFit já possui a base inicial da grade de horários:

- criação de grades recorrentes;
- geração de aulas na agenda;
- professor, local/sala e modalidade;
- capacidade da aula;
- regras de check-in, cancelamento e acesso;
- modal básico da aula;
- adição de aluno/lead de forma inicial;
- presença, falta e desfazer presença/falta;
- cancelamento e conclusão da aula;
- geração de comissão por aula concluída;
- restrições avançadas como gênero e agenda livre.

O que ainda falta para chegar no fluxo completo observado na NextFit:

- separar claramente alunos ativos, cancelados/desistentes e fila de espera;
- registrar origem detalhada do agendamento;
- diferenciar cliente com contrato, lead e cliente especial;
- controlar consumo real de crédito/sessão do contrato;
- permitir reposição de aula cancelada;
- exibir histórico completo da aula;
- permitir alteração apenas daquela aula, sem alterar a grade inteira;
- criar fluxo operacional mais claro para recepção e professor.

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

1. Backup e auditoria.
2. Modelagem de origem e tipo de agendamento.
3. Abas do modal da aula.
4. Adicionar cliente com contrato.
5. Adicionar lead com cadastro rápido.
6. Adicionar cliente especial sem consumo de crédito.
7. Cancelados/desistentes e reposição.
8. Fila de espera.
9. Presença/falta com consumo real de sessões.
10. Histórico da aula.
11. Alterar somente esta aula.
12. Melhorias visuais da agenda semanal.

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
