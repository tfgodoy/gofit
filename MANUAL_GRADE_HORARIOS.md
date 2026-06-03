# Manual do Usuário - Grade de Horários GoFit

Este manual explica como usar os recursos implantados no módulo de Grade de Horários, Agenda e Comissão.

Use este guia para configurar aulas, controlar permissões, finalizar aulas e gerar comissão automática para professores.

## 1. Onde Acessar

No menu lateral do sistema, acesse:

- Agenda > Grades de horários
- Agenda
- Financeiro > Comissão

Use Grades de horários para criar ou editar regras fixas de aulas.

Use Agenda para acompanhar as aulas geradas e operar o dia a dia.

Use Comissão para consultar e pagar comissões geradas.

## 2. Criar Uma Nova Grade

1. Acesse Agenda > Grades de horários.
2. Clique em + GRADE.
3. Na aba Dados, preencha as informações principais.
4. Depois configure Permissões e, se necessário, Comissão.
5. Clique em CRIAR GRADE.

Ao criar a grade, o sistema gera automaticamente as aulas futuras da agenda.

## 3. Aba Dados

Na aba Dados você configura a estrutura básica da aula.

### Tipo da Grade

Escolha uma das opções:

- Contrato: aula vinculada ao plano ou contrato do aluno.
- Serviço: aula avulsa ou vinculada a um serviço específico.

### Nome

Campo opcional para identificar melhor a grade.

Exemplos:

- Musculação Manhã
- Cross Training Noite
- Aula Experimental Sábado

### Modalidade

Selecione a modalidade da aula.

Exemplos:

- Musculação
- Cross
- Jiu-jitsu
- Funcional

### Professor

Selecione o professor responsável.

Importante: para usar comissão automática, a grade precisa ter professor selecionado.

### Local / Sala

Selecione onde a aula acontece.

Exemplos:

- Unidade Principal
- Sala 1
- Tatame
- Box Cross

### Dias da Semana

Selecione os dias em que a aula acontece.

Exemplo:

- Segunda, Quarta e Sexta

### Hora Início e Duração

Informe:

- Horário de início
- Duração em minutos

O sistema calcula o horário de término automaticamente.

Exemplo:

- Início: 07:00
- Duração: 50 minutos
- Término calculado: 07:50

### Capacidade Máxima

Informe o limite total de alunos na aula.

Exemplo:

- 20 alunos

### Cor

Escolha uma cor para facilitar a identificação visual da aula na agenda.

## 4. Aba Permissões

A aba Permissões controla quem pode entrar na aula, como funciona check-in, fila, app e regras avançadas.

## 5. Permitir Leads

Ative Permite agendar leads quando quiser adicionar pessoas do CRM em uma aula.

Uso comum:

- Aula experimental
- Aula teste
- Primeira visita

Quando ativado, você pode definir o Máximo de leads por aula.

Exemplo:

- Permitir leads: ativado
- Máximo de leads: 3

Resultado:

- A aula pode receber até 3 leads.
- Ao atingir o limite, o sistema bloqueia novos leads.

## 6. Clientes Especiais

Ative Permite clientes especiais quando quiser permitir alunos fora da regra comum de contrato.

Uso comum:

- Aluno convidado
- Cliente com condição especial
- Acesso autorizado manualmente

Você também pode definir o Máximo de clientes especiais por aula.

Observação: a regra fica configurada na grade e preparada para fluxos especiais. O uso completo depende de como a academia classifica esses alunos no dia a dia.

## 7. Fila de Espera

Ative Fila de espera ativa quando quiser permitir reserva mesmo após a aula lotar.

Exemplo:

- Capacidade máxima: 10 alunos
- Fila de espera: ativada

Resultado:

- Os 10 primeiros entram como reservados.
- Os próximos entram na fila de espera.

## 8. Check-in

Configure quando o check-in abre e fecha.

Nos campos de tempo, informe o número e escolha a unidade:

- minutos
- horas
- dias

### Abre check-in

Define quanto tempo antes da aula o aluno pode fazer check-in.

Exemplo:

- 1 hora antes

### Fecha check-in

Define quanto tempo antes da aula o check-in deixa de ser permitido.

Exemplo:

- 15 minutos antes

## 9. Cancelamento de Check-in

Ative Permite cancelar check-in se o aluno puder cancelar a presença pelo app.

Depois informe até quantos minutos antes da aula ele pode cancelar.

Você pode escolher a unidade em minutos, horas ou dias.

Exemplo:

- Permite cancelar check-in: ativado
- Limite: 10 minutos antes

Resultado:

- O aluno consegue cancelar até 10 minutos antes da aula.

Regra importante:

- O tempo para cancelar check-in precisa ser igual ou maior que o tempo de fechamento do check-in.
- Exemplo: se o check-in fecha 10 minutos antes da aula, o cancelamento também deve ser permitido até pelo menos 10 minutos antes.
- O sistema ajusta ou bloqueia valores menores para evitar inconsistência.

## 10. Controle de Acesso Físico

Use essa seção para configurar a janela de entrada em catraca, biometria ou controle físico.

Campos:

- Pode entrar antes
- Tolerância de atraso

Em ambos, informe o número e escolha a unidade:

- minutos
- horas
- dias

Exemplo:

- Pode entrar: 10 minutos antes
- Tolerância: 5 minutos depois

Resultado:

- Para uma aula às 08:00, o acesso físico fica preparado para permitir entrada entre 07:50 e 08:05.

Observação: esta configuração prepara a regra. A aplicação completa depende da integração com catraca ou biometria.

## 11. App do Aluno

Use essa seção para controlar visibilidade e check-in pelo app.

### Exibir grade no app para

Opções:

- Todos os alunos
- Só alunos com contrato ativo na modalidade

### Permite check-in pelo app para

Opções:

- Todos os alunos
- Só alunos com contrato ativo na modalidade

Uso comum:

- Aulas abertas: todos os alunos veem.
- Aulas exclusivas: somente alunos com contrato ativo na modalidade.

## 12. Configurações Avançadas

No final da aba Permissões, abra Configurações Avançadas.

Essa seção possui:

- Restrição por gênero
- Agenda livre

## 13. Restrição por Gênero

Use Restringir por gênero quando a aula for exclusiva para público feminino ou masculino.

Passo a passo:

1. Abra Configurações Avançadas.
2. Ative Restringir por gênero.
3. Escolha Feminino ou Masculino.
4. Salve a grade.

Exemplo:

- Restrição: Feminino

Resultado:

- Ao tentar adicionar um aluno com sexo masculino, o sistema bloqueia.
- A mensagem exibida será: Esta grade é restrita ao público feminino.

Observação: a regra usa o campo Sexo do cadastro do aluno. Se o aluno estiver sem sexo preenchido, a validação pode não bloquear automaticamente.

## 14. Agenda Livre

Use Agenda livre quando o aluno puder participar sem consumir sessões, créditos ou limite do contrato.

Uso comum:

- Aula bônus
- Evento especial
- Aula demonstrativa
- Aula aberta para alunos ativos

Passo a passo:

1. Abra Configurações Avançadas.
2. Ative Agenda livre.
3. Salve a grade.

Resultado:

- Ao adicionar um aluno nessa aula, o booking é marcado como não descontado do contrato.
- No detalhe da aula aparece o selo Agenda livre.

Observação: o sistema já marca corretamente a reserva como agenda livre. Caso exista uma rotina separada de débito de créditos ou sessões, ela deve respeitar esse campo.

## 15. Aba Comissão

Use a aba Comissão para gerar comissão automática ao finalizar uma aula.

Importante: selecione um professor na aba Dados antes de configurar comissão.

## 16. Comissionar Instrutor

Passo a passo:

1. Abra a aba Comissão.
2. Ative Comissionar instrutor.
3. Escolha o tipo de comissão.
4. Informe o valor.
5. Configure mínimo de alunos, se necessário.
6. Salve a grade.

## 17. Tipo de Comissão

Existem dois tipos:

### Por Aula

Gera um valor fixo por aula finalizada.

Exemplo:

- Tipo: Por aula
- Valor: R$ 15,00

Resultado:

- Ao finalizar a aula, gera R$ 15,00 de comissão, independente do número de alunos.

### Por Aluno

Gera comissão multiplicando o valor pelo número de alunos contados.

Exemplo:

- Tipo: Por aluno
- Valor: R$ 3,00
- Alunos presentes: 6

Resultado:

- Comissão gerada: R$ 18,00

## 18. Mínimo de Alunos

Ative Exigir mínimo de alunos se a comissão só deve ser gerada com uma quantidade mínima de alunos.

Exemplo:

- Mínimo: 4 alunos
- Presentes: 3 alunos

Resultado:

- A aula é finalizada.
- A comissão não é gerada.
- O sistema informa que ficou abaixo do mínimo.

## 19. Considerar Faltantes

Ative Considerar clientes faltantes se alunos marcados como falta também devem contar no cálculo da comissão.

Uso comum:

- Quando a academia paga o professor pela reserva, mesmo se o aluno faltou.

## 20. Duplicar Grade

Na tela Grades de horários, use o botão de duplicar quando quiser criar uma grade parecida com outra.

Passo a passo:

1. Localize a grade desejada.
2. Clique no ícone de duplicar.
3. Ajuste nome, horário, dias, professor ou permissões.
4. Salve.

Uso comum:

- Criar a mesma aula em outro horário.
- Criar uma versão para outro professor.
- Criar uma grade similar para outra sala.

## 21. Editar Grade Existente

1. Acesse Agenda > Grades de horários.
2. Clique no ícone de editar.
3. Faça os ajustes.
4. Clique em Salvar.

Importante: ao editar uma grade, as aulas futuras são recriadas com as novas configurações. Reservas existentes não são afetadas.

## 22. Usar a Aula na Agenda

Depois de criada a grade, vá em Agenda.

Na aula, você pode:

- Ver reservas
- Adicionar aluno
- Adicionar lead, se permitido
- Marcar presença
- Marcar falta
- Finalizar aula
- Cancelar aula

## 23. Adicionar Aluno na Aula

1. Abra a aula na Agenda.
2. Clique em Adicionar aluno.
3. Busque o aluno.
4. Selecione.
5. Clique em Adicionar.

O sistema verifica:

- Capacidade da aula
- Fila de espera
- Restrição por gênero
- Agenda livre

## 24. Adicionar Lead na Aula

1. Abra a aula.
2. Clique em Adicionar lead.
3. Busque o lead.
4. Selecione.
5. Clique em Adicionar.

O botão só aparece se a grade permitir leads.

Se houver limite de leads e ele já tiver sido atingido, o sistema bloqueia a inclusão.

## 25. Marcar Presença ou Falta

No detalhe da aula:

1. Localize o aluno ou lead.
2. Clique no ícone de presença para marcar presente.
3. Clique no ícone de falta para marcar faltou.

Essas marcações influenciam a comissão quando a grade estiver configurada para comissionar.

## 26. Finalizar Aula

Use Finalizar aula ao fim da aula para encerrar o slot e, se configurado, gerar comissão.

Passo a passo:

1. Abra a aula na Agenda.
2. Confira os alunos presentes e faltantes.
3. Clique em Finalizar aula.
4. Confirme em Sim.

Resultado:

- A aula fica com status Concluída.
- O sistema tenta calcular comissão.
- Se a regra estiver válida, a comissão é gerada automaticamente.

## 27. Quando a Comissão Não É Gerada

A comissão não será gerada quando:

- A grade não comissiona instrutor.
- A grade não tem professor.
- O valor da comissão não foi configurado.
- O número de alunos ficou abaixo do mínimo.
- A comissão daquela aula já tinha sido gerada antes.

Isso evita comissão duplicada.

## 28. Consultar Comissão Gerada

1. Acesse Financeiro > Comissão.
2. Procure o lançamento do tipo aula.
3. Confira descrição, professor, valor e status.

A comissão gerada automaticamente entra como pendente.

## 29. Pagar Comissão

Na tela de Comissão:

1. Localize a comissão pendente.
2. Confira o valor.
3. Marque como paga quando realizar o pagamento.

## 30. Exemplos Práticos

### Aula comum por contrato

Configuração:

- Tipo: Contrato
- Agenda livre: desligado
- Comissão: desligada

Uso:

- Aula normal do plano.

### Aula experimental com leads

Configuração:

- Tipo: Serviço ou Contrato, conforme a operação da academia.
- Permite leads: ligado
- Máximo de leads: 3

Uso:

- Receber interessados do CRM em uma aula teste.

### Aula feminina

Configuração:

- Restrição por gênero: Feminino

Uso:

- Turmas exclusivas para público feminino.

### Aula bônus sem descontar contrato

Configuração:

- Agenda livre: ligada

Uso:

- Evento, aulão, aula bônus ou demonstração.

### Aula com comissão fixa

Configuração:

- Professor selecionado
- Comissionar instrutor: ligado
- Tipo: Por aula
- Valor: R$ 15,00

Uso:

- Ao finalizar a aula, gera comissão fixa para o professor.

### Aula com comissão por aluno

Configuração:

- Professor selecionado
- Comissionar instrutor: ligado
- Tipo: Por aluno
- Valor: R$ 3,00
- Mínimo: 4 alunos

Uso:

- Com 6 alunos presentes, gera R$ 18,00.
- Com 3 alunos presentes, não gera comissão.

## 31. Boas Práticas

- Configure primeiro a grade com calma antes de começar a usar na agenda.
- Sempre selecione professor quando quiser usar comissão.
- Use limite de leads para evitar superlotação de aulas experimentais.
- Use agenda livre somente em aulas que realmente não devem consumir contrato.
- Mantenha o campo Sexo preenchido no cadastro dos alunos se usar restrição por gênero.
- Antes de finalizar uma aula, revise presenças e faltas.
- Consulte Financeiro > Comissão após finalizar aulas com comissão ativa.

## 32. Resumo Rápido

Para criar uma aula normal:

1. Grades de horários > + GRADE.
2. Preencha Dados.
3. Ajuste Permissões.
4. Salve.

Para criar aula com comissão:

1. Selecione professor.
2. Abra aba Comissão.
3. Ative Comissionar instrutor.
4. Configure valor e regra.
5. Salve.
6. Finalize a aula pela Agenda.

Para criar aula sem descontar contrato:

1. Abra Permissões.
2. Abra Configurações Avançadas.
3. Ative Agenda livre.
4. Salve.

Para criar aula restrita por gênero:

1. Abra Permissões.
2. Abra Configurações Avançadas.
3. Ative Restringir por gênero.
4. Escolha Feminino ou Masculino.
5. Salve.
