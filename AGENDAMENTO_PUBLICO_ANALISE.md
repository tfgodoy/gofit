# Análise: Agendamento Público de Aula Experimental
## Referência: NextFit → https://agendamento.nextfit.com.br/{contractor_id}
## Status: Documentação para futura implementação no FitCore Sys (gofit)

---

## 1. O QUE É ESSE RECURSO

O link de agendamento público é uma **página web independente**, sem login, sem recepcionista,
acessível por qualquer pessoa via link único da academia. Quando a IA da FitCore envia o link
para um lead, ele acessa, escolhe a modalidade, o dia e horário disponível, preenche seus
dados e a anamnese — tudo sozinho, 24h por dia.

**Link atual da FitCore no NextFit:**
```
https://agendamento.nextfit.com.br/5ddae543-2f36-4745-bf87-f4668849c1dd
```
O UUID no final é o `contractor_id` da academia no banco de dados.

---

## 2. FLUXO COMPLETO DO LEAD (passo a passo)

```
LEAD recebe o link via WhatsApp/IA
        ↓
[TELA 1] Tela de boas-vindas
  - Logo + nome da academia
  - Endereço e telefone
  - Botão: "AGENDAR MINHA AULA EXPERIMENTAL"
        ↓
[TELA 2] Escolha da Modalidade
  - Lista de modalidades disponíveis para agendamento
  - Ex: Musculação, CrossFit, FitCross, Musculação Noite, etc.
  - Cada modalidade mostra: nome, ícone/cor, descrição
  - Apenas modalidades com `utiliza_agenda = true` E `permite_leads = true`
        ↓
[TELA 3] Escolha da Data
  - Calendário dos próximos 30 dias
  - Dias sem vagas ficam cinza/desabilitados
  - Dias com vagas ficam em destaque (cor da modalidade)
  - Lógica: dia habilitado = existe ao menos 1 slot naquela data
    com vagas disponíveis (capacidade - bookings confirmados > 0)
        ↓
[TELA 4] Escolha do Horário
  - Lista de slots disponíveis na data escolhida
  - Cada slot mostra:
    → Horário: ex. "07:00 – 08:00"
    → Professor: ex. "João Victor"
    → Vagas restantes: ex. "3 vagas disponíveis"
    → Badge de cor conforme modalidade
  - Slots lotados são exibidos mas desabilitados ("Turma cheia")
  - Slots cancelados não aparecem
        ↓
[TELA 5] Dados Pessoais
  - Nome completo *
  - CPF * (com validação)
  - Email *
  - WhatsApp * (com máscara)
  - Como conheceu a academia (select) ← usa crm_config categoria='como_conheceu'
  - Checkbox: aceite dos termos
        ↓
[TELA 6] Anamnese (Ficha de Saúde)
  - Questionário de saúde pré-treino
  - Ex: Tem alguma limitação física? Faz uso de medicamentos? Pratica outra atividade?
  - Perguntas configuráveis pela academia
  - No NextFit: era formulário externo (Google Forms/Typeform)
  - No gofit: será integrado nativo ← ponto de melhoria
        ↓
[TELA 7] Confirmação
  - Resumo do agendamento:
    → Modalidade escolhida
    → Data e horário
    → Nome do lead
  - "Seu agendamento foi confirmado!"
  - Instruções de como chegar / o que trazer
  - Botão: "Adicionar ao Google Calendar" (opcional)
        ↓
[BACKEND] Sistema executa:
  1. Busca ou cria registro de Lead
  2. Cria Booking (reserva) no slot escolhido
  3. Envia email de confirmação para o lead
  4. Envia notificação para a academia (WhatsApp/email)
  5. Lead aparece na agenda do dia como "Aula Experimental"
  6. Aparece no CRM como nova oportunidade
```

---

## 3. ESTRUTURA DO BANCO DE DADOS (já existe no gofit)

### 3.1 Tabela `modalidades`
```
id, contractor_id, descricao, utiliza_agenda, dias_semana[], cor, icone, ativo
```
- `utiliza_agenda = true` → modalidade aparece no agendamento público
- `permite_leads` → não existe ainda (precisa adicionar)

### 3.2 Tabela `schedule_grids` (Grade/Template de aulas)
```
id, contractor_id, modalidade_id, modalidade_nome, staff_id, staff_nome,
nome, dias_semana[], hora_inicio, hora_fim, capacidade_maxima, cor, ativo,
permite_leads, permite_clientes_especiais, fila_espera_ativa,
antecedencia_checkin_min, encerramento_checkin_min
```
- Define o TEMPLATE recorrente de uma aula (ex: "Musculação — Seg/Qua/Sex 07:00–08:00, cap: 15")
- `permite_leads = true` → leads podem se inscrever nessa grade
- `fila_espera_ativa` → habilita lista de espera quando lota
- `antecedencia_checkin_min` → quantos minutos antes o check-in abre
- `encerramento_checkin_min` → quantos minutos antes o check-in fecha

### 3.3 Tabela `schedule_slots` (Instâncias reais de aulas)
```
id, contractor_id, grid_id, modalidade_id, modalidade_nome, staff_id, staff_nome,
data, hora_inicio, hora_fim, capacidade_maxima, cor, status, observacoes
```
- Cada slot = uma aula em uma data específica
- São gerados automaticamente a partir das grades (schedule_grids)
- Ex: Grid "Musculação Seg/Qua/Sex 07h" gera um slot para cada segunda, quarta e sexta
- `status`: `agendado` | `em_andamento` | `concluido` | `cancelado`

### 3.4 Tabela `bookings` (Reservas)
```
id, contractor_id, slot_id, student_id, student_nome, tipo, lead_id,
lead_nome, status, reservado_em, checkin_em, observacoes
```
- `tipo`: `student` | `lead` | `experimental`
- `status`: `reservado` | `confirmado` | `presente` | `ausente` | `cancelado`
- Relaciona: qual pessoa → qual slot

---

## 4. LÓGICA DE VAGAS DISPONÍVEIS

```
vagas_disponiveis(slot_id) =
  slot.capacidade_maxima
  - COUNT(bookings WHERE slot_id = slot.id AND status NOT IN ('cancelado', 'ausente'))
```

Para exibir os dias disponíveis no calendário:
```
dias_com_vaga = schedule_slots
  WHERE contractor_id = {id}
  AND modalidade_id = {modalidade_selecionada}
  AND data >= HOJE
  AND data <= HOJE + 30 dias
  AND status NOT IN ('cancelado')
  AND vagas_disponiveis > 0
  GROUP BY data
```

Para exibir os horários disponíveis em um dia:
```
slots_do_dia = schedule_slots
  WHERE contractor_id = {id}
  AND modalidade_id = {modalidade_selecionada}
  AND data = {data_selecionada}
  AND status NOT IN ('cancelado')
  ORDER BY hora_inicio
  + calcular vagas_disponiveis para cada um
```

---

## 5. CHAMADAS DE API (inferidas)

A página pública usa a **chave anônima (anon key) do Supabase** com RLS configurado
para leitura pública de dados específicos. As chamadas são:

### 5.1 Ao carregar a página
```
GET supabase/contractors?id=eq.{contractor_id}&select=nome_fantasia,logotipo,cidade,uf,fone
```

### 5.2 Ao escolher modalidade
```
GET supabase/modalidades
  ?contractor_id=eq.{contractor_id}
  &utiliza_agenda=eq.true
  &permite_leads=eq.true
  &ativo=eq.true
  &select=id,descricao,cor,icone
```

### 5.3 Ao selecionar modalidade → buscar dias disponíveis
```
GET supabase/schedule_slots
  ?contractor_id=eq.{contractor_id}
  &modalidade_id=eq.{modalidade_id}
  &data=gte.{hoje}
  &data=lte.{hoje+30dias}
  &status=neq.cancelado
  &select=id,data,hora_inicio,hora_fim,capacidade_maxima,staff_nome

+ COUNT bookings por slot para calcular vagas
```

### 5.4 Ao selecionar dia → buscar horários
```
GET supabase/schedule_slots
  ?contractor_id=eq.{contractor_id}
  &modalidade_id=eq.{modalidade_id}
  &data=eq.{data_selecionada}
  &status=neq.cancelado
  &select=id,hora_inicio,hora_fim,capacidade_maxima,staff_nome,cor

GET supabase/bookings
  ?slot_id=in.({ids_dos_slots})
  &status=neq.cancelado
  &select=slot_id
  → agrupa por slot_id para calcular ocupação
```

### 5.5 Ao confirmar agendamento
```
POST supabase/leads → cria ou encontra o lead pelo CPF/email
  { contractor_id, nome, cpf, email, telefone, origem: 'agendamento_online' }

POST supabase/bookings → cria a reserva
  { contractor_id, slot_id, lead_id, lead_nome, tipo: 'experimental',
    status: 'reservado', reservado_em: now() }

POST supabase/student_anamneses → salva a anamnese (se respondeu)
  { contractor_id, lead_id, respostas: {...} }
```

---

## 6. SEGURANÇA (RLS no Supabase)

Para a página pública funcionar SEM login, é necessário configurar RLS:

```sql
-- Leitura pública de contractors (apenas campos públicos)
CREATE POLICY "public_read_contractor" ON contractors
  FOR SELECT USING (true);  -- ou filtrado por campos específicos

-- Leitura pública de slots futuros e ativos
CREATE POLICY "public_read_slots" ON schedule_slots
  FOR SELECT USING (status != 'cancelado' AND data >= CURRENT_DATE);

-- Leitura pública de bookings (só contagem, não dados pessoais)
CREATE POLICY "public_read_bookings_count" ON bookings
  FOR SELECT USING (true);  -- Cuidado: restringir campos via SELECT limitado

-- Inserção pública de leads e bookings
CREATE POLICY "public_insert_lead" ON leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_booking" ON bookings
  FOR INSERT WITH CHECK (tipo = 'experimental');
```

---

## 7. O QUE EXISTE NO GOFIT vs. O QUE FALTA

### ✅ JÁ EXISTE
- Tabela `schedule_grids` com toda estrutura de grades
- Tabela `schedule_slots` com instâncias de aulas
- Tabela `bookings` com reservas
- Tabela `modalidades` com `utiliza_agenda`
- `AgendaPage.tsx` — visão semanal interna da academia
- `GradesPage.tsx` — cadastro de grades recorrentes
- `OcupacaoPage.tsx` — controle de ocupação
- `SessoesPage.tsx` — controle de sessões/turmas
- Geração de slots a partir de grids (já implementado)

### ❌ FALTA CONSTRUIR (página pública)
1. **Página pública `/booking/{contractor_id}`** — rota sem autenticação
2. **Campo `permite_leads` na tabela `modalidades`** (já existe em `schedule_grids`, precisa sincronizar)
3. **RLS para leitura pública** de contractors, slots, modalidades
4. **Lógica de cálculo de vagas em tempo real** na página pública
5. **Formulário de dados pessoais** do lead (nome, CPF, email, WhatsApp)
6. **Formulário de anamnese integrado** (ponto de MELHORIA vs NextFit)
7. **Criação automática de lead + booking** no submit
8. **Email de confirmação** automático para o lead
9. **Notificação para a academia** (WhatsApp/email) quando agendamento ocorre
10. **Link configurável** gerado automaticamente por academia nas Configurações

---

## 8. DIFERENCIAIS DO GOFIT vs. NEXTFIT

| Recurso | NextFit | GoFit (planejado) |
|---------|---------|-------------------|
| Anamnese | Formulário externo (Google Forms) | **Nativa integrada** no fluxo |
| Identificação por CPF | Sim | Sim |
| Notificação academia | Email | **WhatsApp + Email** |
| Personalização da página | Limitada | Logo, cores, texto boas-vindas |
| Fila de espera | Sim | Sim (campo já existe) |
| Múltiplos funis | Não | **Sim** (integra com crm_funis) |
| Criação automática de Oportunidade | Parcial | **Sim** (cria lead + oportunidade no CRM) |

---

## 9. PRÓXIMOS PASSOS (quando for implementar)

1. Criar rota pública `/booking/:contractorId` no React (sem AppGuard)
2. Configurar Supabase RLS para leitura pública controlada
3. Adicionar campo `permite_agendamento_publico` na tabela `modalidades`
4. Criar página pública em 7 etapas (conforme seção 2)
5. Implementar anamnese nativa integrada ao fluxo
6. Criar Edge Function no Supabase para envio de email de confirmação
7. Integrar com WhatsApp API para notificação da academia
8. Adicionar na página de Configurações da academia:
   - Toggle "Habilitar agendamento público"
   - Botão "Copiar link de agendamento"
   - Preview da página pública

---

## 10. OBSERVAÇÃO IMPORTANTE

O link de agendamento da FitCore no NextFit é:
```
https://agendamento.nextfit.com.br/5ddae543-2f36-4745-bf87-f4668849c1dd
```

No gofit, o link será do formato:
```
https://www.fitcoresys.com.br/booking/5ddae543-2f36-4745-bf87-f4668849c1dd
```
ou
```
https://agenda.fitcoresys.com.br/5ddae543-2f36-4745-bf87-f4668849c1dd
```

O UUID é o `contractor_id` da FitCore no Supabase, que pode ser obtido com:
```sql
SELECT id FROM contractors WHERE email = 'fitcorestudioo@gmail.com';
```

---

*Documento criado em: 02/06/2026*
*Autor: Análise automática via Claude*
*Status: Aguardando implementação — NÃO URGENTE*
