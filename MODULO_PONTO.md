# Módulo de Ponto — Planejamento

**Status:** Aguardando implementação  
**Decisão tomada em:** 08/06/2026  
**Prioridade:** Média — implementar após estabilização dos módulos financeiros e de equipe

---

## Modelo escolhido

**Opção 2 — Check-in/Check-out manual na aba Ponto**

Colaborador abre o sistema → acessa a aba "Ponto" → clica **Check-in** ao chegar → clica **Check-out** ao sair. O sistema registra o horário atual automaticamente em cada ação.

### Por que essa opção

- É o padrão do mercado (iFood, academias, clínicas)
- Simples e preciso — o colaborador tem consciência do ato
- Não depende de GPS, não consome bateria, funciona em qualquer dispositivo
- Check-in automático foi descartado pois colaborador pode logar fora do horário e distorcer o tempo trabalhado

---

## Funcionalidades planejadas

### Para o colaborador
- [ ] Aba "Ponto" visível no menu lateral
- [ ] Botão **REGISTRAR ENTRADA** (check-in) — registra timestamp atual
- [ ] Botão **REGISTRAR SAÍDA** (check-out) — registra timestamp atual
- [ ] Visualização dos registros do mês atual (data, entrada, saída, total de horas)
- [ ] Aviso visual se check-in não foi feito no dia (dentro do horário de trabalho cadastrado)

### Para o administrador
- [ ] Painel de ponto por colaborador — visão diária/semanal/mensal
- [ ] Totalizador de horas trabalhadas no período
- [ ] Indicadores: horas extras, horas faltantes, dias sem registro
- [ ] Ajuste manual de qualquer ponto com campo de justificativa obrigatória
- [ ] Log de ajustes manuais (quem alterou, quando, motivo)
- [ ] Exportação do espelho de ponto (PDF/Excel)

### Mecanismos anti-esquecimento
- [ ] **Banner ao logar:** se está dentro do horário de trabalho e não fez check-in → popup "Você ainda não registrou seu ponto. Registrar agora?"
- [ ] **Check-out automático por horário:** se o colaborador não fez check-out até X minutos após o fim do turno cadastrado, registra automaticamente com flag "automático" para revisão do admin
- [ ] **Notificação push no navegador:** no horário de entrada cadastrado dispara lembrete (requer permissão do browser)

### Geolocalização (opcional, não obrigatório)
- [ ] Salvar coordenadas GPS junto ao check-in/out como evidência
- [ ] Exibir no painel admin: "Registrado a X metros da academia"
- [ ] Não bloqueia o registro — apenas registra para auditoria

---

## Banco de dados (tabelas a criar)

```sql
-- Registros de ponto
CREATE TABLE ponto_registros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   uuid REFERENCES contractors(id) ON DELETE CASCADE,
  staff_id        uuid REFERENCES staff(id) ON DELETE CASCADE,
  data            date NOT NULL,
  entrada         timestamptz,
  saida           timestamptz,
  horas_trabalhadas integer, -- em segundos
  entrada_lat     numeric(10,7),
  entrada_lng     numeric(10,7),
  saida_lat       numeric(10,7),
  saida_lng       numeric(10,7),
  entrada_automatica boolean DEFAULT false,
  saida_automatica   boolean DEFAULT false,
  ajustado_por    uuid REFERENCES staff(id),
  ajuste_motivo   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Horários de trabalho por colaborador (referência para os alertas)
-- Já existe parcialmente em staff — verificar e expandir se necessário
```

---

## Telas a criar

| Tela | Rota | Quem acessa |
|---|---|---|
| Ponto do colaborador | `/app/ponto` | Colaborador |
| Gestão de ponto | `/app/administrativo/ponto` | Admin |
| Espelho de ponto (PDF) | Gerado on demand | Admin |

---

## Dependências antes de implementar

- [ ] Módulo de horário de trabalho do colaborador deve estar completo (tab Profissional → campo de escala/horário)
- [ ] Definir regra de horas extras (começa a contar após quantos minutos excedentes?)
- [ ] Definir regra de tolerância de atraso (diferente do módulo de Ocorrências?)

---

## Estimativa de complexidade

**Média** — 2 a 3 sessões de desenvolvimento  
Banco + UI colaborador + UI admin + ajuste manual + exportação PDF

---

## Notas adicionais

- O módulo de **Ocorrências** (já implantado) registra faltas e atrasos de forma manual pelo admin
- O módulo de **Ponto** será o registro bruto automático de entrada/saída
- Os dois módulos se complementam: Ponto gera os dados → Ocorrências registra as justificativas/penalidades
