# PLANO DE ACAO — SESSOES E CONTRATOS GOFIT
## Para execucao por agente de IA no Visual Studio Code
**Repositorio:** `E:\\Projetos Sistemas\\gofit`
**Referencia:** Next Fit Personal — analise realizada em 04/06/2026
**Status atual:** ~65% implementado. Este plano completa os 35% restantes.

---

## CONTEXTO TECNICO ATUAL

### O que JA existe no projeto (nao mexer):
- `src/components/app/ModalidadeContratoModal.tsx` — modal 2 etapas com tipos padrão/sessoes_semana/pacote_aulas/gonutri ✅
- `src/components/app/ContratoFormPage.tsx` — pagina de formulario de contrato ✅
- `src/components/app/SlotDetailModal.tsx` — modal de detalhes da aula com logica de credito de reposicao ✅
- `supabase/migrations/20260603_013_replacement_credits.sql` — tabela schedule_replacement_credits ✅
- `supabase/migrations/20260603_014_session_usage.sql` — tabela schedule_session_usage ✅
- `supabase/migrations/20260603_012_booking_origin_history.sql` — historico de reservas ✅

### Estrutura atual das tabelas relevantes:
```
contratos: id, contractor_id, descricao, tipo, duracao, tipo_duracao,
           valor_total, valor_por_mes, permite_renovar, renova_automaticamente,
           permite_parcelado, formas_pagamento, template_contrato,
           assinatura_eletronica, ativo, limita_periodo_venda, ...
           !! FALTA: contabilizar_conjunto (boolean)

contrato_modalidades: ja existe (usada em ContratoFormPage.tsx)
           !! VERIFICAR campos: tipo_acesso, sessoes_por_semana, total_aulas,
              acessos_maximos, tipo_duracao_acessos, limitando_acessos,
              limitando_horarios, periodos_horario
           !! FALTA CONFIRMAR: se contabilizar_conjunto esta aqui ou em contratos
           !! FALTA: permite_reposicao, max_reposicoes, limite_reposicoes_periodo
           !! FALTA: matricula_obrigatoria_na_venda (boolean)

schedule_session_usage: id, contractor_id, booking_id, slot_id, student_id,
           contrato_id, student_contract_id, modalidade_id, modalidade_nome,
           agendamento, status_reserva, tipo_consumo, qty, razao, estornado ✅

schedule_replacement_credits: id, contractor_id, student_id, contract_id,
           student_contract_id, original_slot_id, original_booking_id,
           used_slot_id, used_booking_id, status, razao, validade ✅
```

---

## FASE 1 — BANCO DE DADOS (MIGRATIONS SUPABASE)
**Diretorio:** `supabase/migrations/`
**Executar primeiro — base para tudo o mais**

---

### TAREFA 1.1 — Verificar e corrigir tabela contrato_modalidades

**Arquivo a criar:** `supabase/migrations/20260604_016_contrato_modalidades_sessoes.sql`

**O que fazer:**
1. Verificar se a tabela `contrato_modalidades` ja tem os campos abaixo
2. Se nao tiver, adicionar via ALTER TABLE
3. Os campos necessarios sao:

```sql
-- Verificar/adicionar campos em contrato_modalidades
ALTER TABLE public.contrato_modalidades
  ADD COLUMN IF NOT EXISTS tipo_acesso text NOT NULL DEFAULT 'padrao'
    CHECK (tipo_acesso IN ('padrao', 'sessoes_semana', 'pacote_aulas', 'gonutri')),
  ADD COLUMN IF NOT EXISTS sessoes_por_semana integer,
  ADD COLUMN IF NOT EXISTS total_aulas integer,
  ADD COLUMN IF NOT EXISTS contabilizar_conjunto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acessos_maximos integer,
  ADD COLUMN IF NOT EXISTS tipo_duracao_acessos text DEFAULT 'semana'
    CHECK (tipo_duracao_acessos IN ('semana', 'mes', 'dia', 'hora', 'vigencia')),
  ADD COLUMN IF NOT EXISTS limitando_acessos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limitando_horarios boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS periodos_horario jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS permite_reposicao boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_reposicoes integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS limite_reposicoes_periodo text DEFAULT 'semana'
    CHECK (limite_reposicoes_periodo IN ('semana', 'mes', 'contrato')),
  ADD COLUMN IF NOT EXISTS matricula_obrigatoria_na_venda boolean NOT NULL DEFAULT false;
```

**IMPORTANTE:** O campo `contabilizar_conjunto` fica em `contrato_modalidades` (nao em `contratos`),
pois e por modalidade que se define se ela entra no pool conjunto ou nao.
Mas deve haver tambem um flag no contrato pai para ativar o modo conjunto global.

```sql
-- Adicionar flag global no contrato
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS contabilizar_sessoes_conjunto boolean NOT NULL DEFAULT false;
```

**Atualizar types.ts** depois de rodar a migration:
- Adicionar os novos campos em `contratos` Row/Insert/Update
- Adicionar os novos campos em `contrato_modalidades` Row/Insert/Update

---

### TAREFA 1.2 — Funcao SQL de verificacao de sessoes (engine)

**Arquivo a criar:** `supabase/migrations/20260604_017_fn_verificar_sessoes.sql`

**O que fazer:** Criar funcao PostgreSQL que verifica se aluno pode fazer mais uma aula

```sql
CREATE OR REPLACE FUNCTION public.verificar_sessoes_aluno(
  p_contractor_id uuid,
  p_student_id uuid,
  p_student_contract_id uuid,
  p_modalidade_id uuid,
  p_data_aula date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_contrato record;
  v_modalidade record;
  v_sessoes_usadas integer;
  v_limite integer;
  v_data_inicio_semana date;
  v_data_fim_semana date;
  v_resultado jsonb;
BEGIN
  -- Buscar contrato do aluno
  SELECT sc.*, c.contabilizar_sessoes_conjunto
  INTO v_contrato
  FROM student_contracts sc
  JOIN contratos c ON c.id = sc.contrato_id
  WHERE sc.id = p_student_contract_id
    AND sc.contractor_id = p_contractor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'Contrato nao encontrado', 'sessoes_usadas', 0, 'sessoes_limite', 0);
  END IF;

  -- Buscar configuracao da modalidade no contrato
  SELECT * INTO v_modalidade
  FROM contrato_modalidades
  WHERE contrato_id = v_contrato.contrato_id
    AND modalidade_id = p_modalidade_id;

  IF NOT FOUND OR v_modalidade.tipo_acesso = 'padrao' THEN
    -- Tipo padrao = acesso livre, sem verificacao de sessoes
    RETURN jsonb_build_object('permitido', true, 'motivo', 'Acesso padrao livre', 'sessoes_usadas', 0, 'sessoes_limite', 0);
  END IF;

  -- Calcular inicio e fim da semana atual (segunda a domingo)
  v_data_inicio_semana := date_trunc('week', p_data_aula)::date;
  v_data_fim_semana := v_data_inicio_semana + interval '6 days';

  IF v_contrato.contabilizar_sessoes_conjunto THEN
    -- Modo conjunto: contar TODAS as sessoes da semana em QUALQUER modalidade deste contrato
    SELECT COALESCE(SUM(qty), 0) INTO v_sessoes_usadas
    FROM schedule_session_usage
    WHERE contractor_id = p_contractor_id
      AND student_id = p_student_id
      AND student_contract_id = p_student_contract_id
      AND estornado = false
      AND created_at::date BETWEEN v_data_inicio_semana AND v_data_fim_semana;

    -- Limite = sessoes_por_semana da modalidade principal (ou max de qualquer modalidade)
    SELECT COALESCE(MAX(sessoes_por_semana), 0) INTO v_limite
    FROM contrato_modalidades
    WHERE contrato_id = v_contrato.contrato_id
      AND sessoes_por_semana IS NOT NULL;
  ELSE
    -- Modo independente: contar apenas sessoes DESTA modalidade
    SELECT COALESCE(SUM(qty), 0) INTO v_sessoes_usadas
    FROM schedule_session_usage
    WHERE contractor_id = p_contractor_id
      AND student_id = p_student_id
      AND student_contract_id = p_student_contract_id
      AND modalidade_id = p_modalidade_id
      AND estornado = false
      AND created_at::date BETWEEN v_data_inicio_semana AND v_data_fim_semana;

    v_limite := COALESCE(v_modalidade.sessoes_por_semana, 0);
  END IF;

  IF v_limite = 0 THEN
    RETURN jsonb_build_object('permitido', true, 'motivo', 'Sem limite configurado', 'sessoes_usadas', v_sessoes_usadas, 'sessoes_limite', 0);
  END IF;

  IF v_sessoes_usadas < v_limite THEN
    RETURN jsonb_build_object(
      'permitido', true,
      'motivo', 'Dentro do limite',
      'sessoes_usadas', v_sessoes_usadas,
      'sessoes_limite', v_limite,
      'sessoes_restantes', v_limite - v_sessoes_usadas
    );
  ELSE
    RETURN jsonb_build_object(
      'permitido', false,
      'motivo', 'Limite de sessoes atingido para esta semana',
      'sessoes_usadas', v_sessoes_usadas,
      'sessoes_limite', v_limite,
      'sessoes_restantes', 0
    );
  END IF;
END;
$$;
```

---

## FASE 2 — TIPOS TYPESCRIPT
**Arquivo:** `src/integrations/supabase/types.ts`

### TAREFA 2.1 — Atualizar types.ts

Adicionar os novos campos nas interfaces correspondentes:

```typescript
// Na secao "contratos" > Row, adicionar:
contabilizar_sessoes_conjunto: boolean;

// Na secao "contratos" > Insert e Update, adicionar:
contabilizar_sessoes_conjunto?: boolean;

// Criar nova entrada para "contrato_modalidades" (se ainda nao existir completa):
contrato_modalidades: {
  Row: {
    id: string;
    contractor_id: string;
    contrato_id: string;
    modalidade_id: string | null;
    modalidade_nome: string;
    modalidade_cor: string;
    categoria_icone: string;
    tipo_acesso: 'padrao' | 'sessoes_semana' | 'pacote_aulas' | 'gonutri';
    sessoes_por_semana: number | null;
    total_aulas: number | null;
    contabilizar_conjunto: boolean;
    acessos_maximos: number | null;
    tipo_duracao_acessos: string | null;
    limitando_acessos: boolean;
    limitando_horarios: boolean;
    periodos_horario: Json;
    permite_reposicao: boolean;
    max_reposicoes: number | null;
    limite_reposicoes_periodo: string | null;
    matricula_obrigatoria_na_venda: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: { /* mesmos campos com ? exceto contrato_id, contractor_id */ };
  Update: { /* todos opcionais */ };
}
```

---

## FASE 3 — BACKEND: SALVAR/CARREGAR DADOS
**Arquivo principal:** `src/pages/app/ContratoFormPage.tsx`
**Arquivo secundario:** `src/components/app/ModalidadeContratoModal.tsx`

### TAREFA 3.1 — Salvar contabilizar_sessoes_conjunto no contrato

Em `ContratoFormPage.tsx`:

1. Adicionar ao estado `EMPTY_FORM`:
```typescript
contabilizar_sessoes_conjunto: false,
```

2. No `useEffect` de load (edicao), adicionar:
```typescript
contabilizar_sessoes_conjunto: c.contabilizar_sessoes_conjunto ?? false,
```

3. No `handleSave`, incluir no objeto enviado ao Supabase:
```typescript
contabilizar_sessoes_conjunto: form.contabilizar_sessoes_conjunto,
```

4. Adicionar o toggle na secao "Modalidades do contrato" (abaixo da lista):
```tsx
// Adicionar ANTES do botao "+ MODALIDADE", apos a lista de modalidades
<div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl mt-3">
  <div className="flex-1">
    <span className="text-sm font-medium text-gray-800">
      Contabilizar sessoes de forma conjunta
    </span>
    <p className="text-xs text-gray-500 mt-0.5">
      Ao ativar, todas as aulas realizadas contam no mesmo saldo,
      independente da modalidade.
    </p>
  </div>
  <Toggle
    label=""
    checked={form.contabilizar_sessoes_conjunto}
    onChange={v => setForm(f => ({ ...f, contabilizar_sessoes_conjunto: v }))}
  />
</div>
```

---

### TAREFA 3.2 — Salvar campos de sessoes na modalidade do contrato

Em `ContratoFormPage.tsx`, na funcao `handleSaveModalidade` (onde salva no Supabase):

```typescript
// Ao fazer upsert em contrato_modalidades, incluir os novos campos:
const modalidadePayload = {
  contrato_id: contratoId,
  contractor_id: user.contractorId,
  modalidade_id: m.modalidade_id,
  modalidade_nome: m.modalidade_nome,
  modalidade_cor: m.modalidade_cor,
  categoria_icone: m.categoria_icone,
  tipo_acesso: m.tipo_acesso,
  sessoes_por_semana: m.tipo_acesso === 'sessoes_semana' ? parseInt(m.acessos_maximos) || null : null,
  total_aulas: m.tipo_acesso === 'pacote_aulas' ? parseInt(m.acessos_maximos) || null : null,
  acessos_maximos: parseInt(m.acessos_maximos) || null,
  tipo_duracao_acessos: m.tipo_duracao_acessos || 'semana',
  limitando_acessos: m.limitando_acessos,
  limitando_horarios: m.limitando_horarios,
  periodos_horario: m.periodos_horario,
  contabilizar_conjunto: false, // individual por padrao
  permite_reposicao: true,       // padrao habilitado
  max_reposicoes: 10,
  limite_reposicoes_periodo: 'semana',
  matricula_obrigatoria_na_venda: false,
};
```

---

### TAREFA 3.3 — Adicionar campo matricula_obrigatoria_na_venda no modal

Em `src/components/app/ModalidadeContratoModal.tsx`:

1. Adicionar ao tipo `ModalidadeContrato`:
```typescript
matricula_obrigatoria_na_venda: boolean;
```

2. Adicionar campo na secao "Configuracoes avancadas" (ao lado do "Limitar dias e horarios"):
```tsx
<Toggle
  label={
    <span className="flex items-center space-x-1">
      Matricula obrigatoria no ato da venda
      <Tooltip texto="Ao habilitar, sera solicitado ao vendedor que escolha a turma do aluno no momento da venda deste contrato." />
    </span>
  }
  checked={form.matricula_obrigatoria_na_venda}
  onChange={v => setForm(f => ({ ...f, matricula_obrigatoria_na_venda: v }))}
/>
```

---

### TAREFA 3.4 — Adicionar controles de reposicao no modal de modalidade

Em `src/components/app/ModalidadeContratoModal.tsx`, na secao "Configuracoes":

```tsx
{/* Apos o toggle "Permite antecipacoes", adicionar: */}
<Toggle
  label={
    <span className="flex items-center space-x-1">
      Permite reposicoes
      <Tooltip texto="Quando o aluno cancelar uma aula, o sistema gera um credito de reposicao para uso posterior." />
    </span>
  }
  checked={form.permite_reposicao}
  onChange={v => setForm(f => ({ ...f, permite_reposicao: v }))}
/>

{form.permite_reposicao && (
  <div className="ml-6 grid grid-cols-2 gap-4 mt-2">
    <div>
      <label className={LBL}>Quantidade maxima</label>
      <input
        type="number"
        min={1}
        value={form.max_reposicoes}
        onChange={e => setForm(f => ({ ...f, max_reposicoes: e.target.value }))}
        className={INP}
        placeholder="Ex: 10"
      />
    </div>
    <div>
      <label className={LBL}>Limite por</label>
      <div className="relative">
        <select
          value={form.limite_reposicoes_periodo}
          onChange={e => setForm(f => ({ ...f, limite_reposicoes_periodo: e.target.value }))}
          className={SEL}>
          <option value="semana">Semana</option>
          <option value="mes">Mes</option>
          <option value="contrato">Contrato (total)</option>
        </select>
        <ChevronDown className="absolute right-0 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  </div>
)}
```

---

## FASE 4 — ENGINE DE VERIFICACAO (frontend)
**Arquivo a criar:** `src/hooks/useVerificarSessoes.ts`

### TAREFA 4.1 — Hook de verificacao de sessoes

```typescript
// src/hooks/useVerificarSessoes.ts
import { supabase } from '@/integrations/supabase/cliente';

export interface ResultadoVerificacao {
  permitido: boolean;
  motivo: string;
  sessoes_usadas: number;
  sessoes_limite: number;
  sessoes_restantes?: number;
}

export async function verificarSessoesAluno(
  contractorId: string,
  studentId: string,
  studentContractId: string,
  modalidadeId: string,
  dataAula: string // YYYY-MM-DD
): Promise<ResultadoVerificacao> {
  const { data, error } = await supabase.rpc('verificar_sessoes_aluno', {
    p_contractor_id: contractorId,
    p_student_id: studentId,
    p_student_contract_id: studentContractId,
    p_modalidade_id: modalidadeId,
    p_data_aula: dataAula,
  });

  if (error) {
    console.error('Erro ao verificar sessoes:', error);
    return { permitido: true, motivo: 'Erro na verificacao', sessoes_usadas: 0, sessoes_limite: 0 };
  }

  return data as ResultadoVerificacao;
}
```

---

### TAREFA 4.2 — Integrar verificacao no SlotDetailModal

**Arquivo:** `src/components/app/SlotDetailModal.tsx`

Na funcao de adicionar aluno ao slot (onde verifica `modalidade_ok`), adicionar chamada ao hook:

```typescript
// Antes de confirmar a reserva, chamar:
import { verificarSessoesAluno } from '@/hooks/useVerificarSessoes';

// Dentro da funcao de adicionar aluno:
const resultado = await verificarSessoesAluno(
  user.contractorId,
  studentId,
  studentContractId,
  slot.modalidade_id!,
  slot.data
);

if (!resultado.permitido) {
  // Mostrar aviso mas permitir que recepcionista force a entrada
  const confirmar = window.confirm(
    `Atencao: ${resultado.motivo}\n` +
    `Sessoes usadas: ${resultado.sessoes_usadas}/${resultado.sessoes_limite}\n` +
    `Deseja incluir mesmo assim?`
  );
  if (!confirmar) return;
}
```

**NOTA:** Use `toast.warning` em vez de `window.confirm` para uma UX melhor,
com botoes de "Incluir mesmo assim" e "Cancelar" no proprio modal.

---

## FASE 5 — INDICADOR VISUAL DE SESSOES
**Arquivo principal:** `src/components/app/SlotDetailModal.tsx`
**Arquivo secundario:** `src/pages/app/AlunoFormPage.tsx` (ficha do aluno)

### TAREFA 5.1 — Badge de sessoes na lista de alunos do slot

Em `SlotDetailModal.tsx`, na linha de cada aluno reservado, adicionar badge:

```tsx
// Criar componente SessoesBadge:
function SessoesBadge({ 
  usadas, 
  limite, 
  conjunto 
}: { 
  usadas: number; 
  limite: number; 
  conjunto: boolean 
}) {
  if (limite === 0) return null;
  
  const percentual = (usadas / limite) * 100;
  const cor = percentual >= 100 
    ? 'bg-red-100 text-red-700 border-red-200'
    : percentual >= 75 
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-green-100 text-green-700 border-green-200';

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cor}`}>
      {conjunto ? '⚡' : '📅'} {usadas}/{limite} sessoes
    </span>
  );
}

// Buscar dados de sessoes ao carregar reservas:
// Para cada reserva com student_contract_id, chamar verificarSessoesAluno
// e armazenar no estado usageMap (ja existente no componente)
```

---

### TAREFA 5.2 — Painel de sessoes na ficha do aluno

**Arquivo:** `src/pages/app/AlunoFormPage.tsx` (aba ou secao de contratos ativos)

Adicionar secao "Sessoes desta semana" abaixo dos contratos ativos:

```tsx
// Componente PainelSessoesSemana
// Props: studentId, contractorId, studentContractId, contratoDescricao

function PainelSessoesSemana({ studentContractId, ...props }) {
  const [sessoes, setSessoes] = useState<ResultadoVerificacao | null>(null);
  
  useEffect(() => {
    // Buscar sessoes da semana atual
    const hoje = new Date().toISOString().split('T')[0];
    verificarSessoesAluno(props.contractorId, props.studentId, 
      studentContractId, '', hoje) // modalidade vazia = busca geral
      .then(setSessoes);
  }, [studentContractId]);

  if (!sessoes || sessoes.sessoes_limite === 0) return null;

  const pct = Math.min((sessoes.sessoes_usadas / sessoes.sessoes_limite) * 100, 100);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
        Sessoes esta semana
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
          {sessoes.sessoes_usadas} / {sessoes.sessoes_limite}
        </span>
      </div>
      {pct >= 100 && (
        <p className="text-xs text-red-600 mt-1">Limite semanal atingido</p>
      )}
    </div>
  );
}
```

---

## FASE 6 — MATRICULA OBRIGATORIA NA VENDA

**Arquivo:** `src/pages/app/MatriculaPage.tsx`

### TAREFA 6.1 — Verificar obrigatoriedade de escolha de turma

Ao selecionar um contrato para venda, verificar se alguma modalidade tem
`matricula_obrigatoria_na_venda = true`. Se sim, exibir seletor de turma.

```typescript
// Ao carregar contrato selecionado:
const { data: modalidades } = await supabase
  .from('contrato_modalidades')
  .select('*, modalidades(descricao)')
  .eq('contrato_id', contratoId)
  .eq('matricula_obrigatoria_na_venda', true);

if (modalidades && modalidades.length > 0) {
  // Exibir step adicional: "Escolha a turma do aluno"
  // Para cada modalidade com matricula obrigatoria, buscar grades disponiveis
  setModalidadesObrigatorias(modalidades);
  setStep('escolher_turma'); // adicionar este step ao fluxo de matricula
}
```

---

## FASE 7 — CONTROLE DE LIMITE DE REPOSICOES

**Arquivo:** `src/components/app/SlotDetailModal.tsx`

### TAREFA 7.1 — Verificar limite antes de gerar credito de reposicao

Na funcao `handleCancelarReserva`, antes de gerar o credito de reposicao,
verificar se o aluno ja atingiu o limite configurado no contrato:

```typescript
// Buscar configuracao de reposicao da modalidade no contrato
const { data: modConfig } = await supabase
  .from('contrato_modalidades')
  .select('permite_reposicao, max_reposicoes, limite_reposicoes_periodo')
  .eq('contrato_id', booking.contrato_id)
  .eq('modalidade_id', slot.modalidade_id)
  .single();

if (!modConfig?.permite_reposicao) {
  // Nao gerar credito
  setGerarReposicao(false);
  return;
}

// Contar reposicoes usadas no periodo
const periodoInicio = getPeriodoInicio(modConfig.limite_reposicoes_periodo);
const { count } = await supabase
  .from('schedule_replacement_credits')
  .select('id', { count: 'exact' })
  .eq('contractor_id', user.contractorId)
  .eq('student_id', booking.student_id)
  .eq('student_contract_id', booking.student_contract_id)
  .gte('gerado_em', periodoInicio)
  .neq('status', 'cancelado');

if ((count ?? 0) >= (modConfig.max_reposicoes ?? 10)) {
  toast.warning(`Limite de reposicoes atingido (${modConfig.max_reposicoes} por ${modConfig.limite_reposicoes_periodo})`);
  setGerarReposicao(false);
}

// Funcao auxiliar:
function getPeriodoInicio(periodo: string): string {
  const agora = new Date();
  if (periodo === 'semana') {
    const segunda = new Date(agora);
    segunda.setDate(agora.getDate() - agora.getDay() + 1);
    segunda.setHours(0, 0, 0, 0);
    return segunda.toISOString();
  } else if (periodo === 'mes') {
    return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  }
  return new Date(0).toISOString(); // contrato = desde sempre
}
```

---

## ORDEM DE EXECUCAO RECOMENDADA

```
1. FASE 1 — Migrations SQL (banco de dados)
   1.1 → 20260604_016_contrato_modalidades_sessoes.sql
   1.2 → 20260604_017_fn_verificar_sessoes.sql
   
2. FASE 2 — types.ts atualizado
   
3. FASE 3 — Backend salvar/carregar
   3.1 → ContratoFormPage.tsx (toggle + campo no save)
   3.2 → ContratoFormPage.tsx (handleSaveModalidade)
   3.3 → ModalidadeContratoModal.tsx (matricula obrigatoria)
   3.4 → ModalidadeContratoModal.tsx (controles de reposicao)
   
4. FASE 4 — Engine de verificacao
   4.1 → Criar src/hooks/useVerificarSessoes.ts
   4.2 → Integrar em SlotDetailModal.tsx
   
5. FASE 5 — Indicadores visuais
   5.1 → SessoesBadge em SlotDetailModal.tsx
   5.2 → PainelSessoesSemana em AlunoFormPage.tsx
   
6. FASE 6 — Matricula obrigatoria na venda
   6.1 → MatriculaPage.tsx
   
7. FASE 7 — Limite de reposicoes
   7.1 → SlotDetailModal.tsx
```

---

## TESTES A REALIZAR APOS IMPLEMENTACAO

- [ ] Criar contrato com modalidade tipo "sessoes_semana" = 3x/semana
- [ ] Matricular aluno nesse contrato
- [ ] Adicionar aluno em 3 aulas diferentes na semana e confirmar presenca
- [ ] Tentar adicionar 4a aula → sistema deve alertar
- [ ] Cancelar uma aula → verificar se credito de reposicao e gerado
- [ ] Usar credito de reposicao em outra aula
- [ ] Testar contrato com 4 modalidades + contabilizacao conjunta
- [ ] Verificar badge de sessoes no SlotDetailModal
- [ ] Verificar barra de progresso na ficha do aluno
- [ ] Testar matricula com "obrigatoria_na_venda = true"

---

## NOTAS IMPORTANTES PARA O AGENTE

1. **NAO remover** logica existente de `schedule_replacement_credits` e
   `schedule_session_usage` — apenas extender
2. **NAO alterar** o modal de 2 etapas do `ModalidadeContratoModal.tsx` —
   apenas adicionar campos nas secoes existentes
3. **Manter padrao** de componentes `Toggle` e `Tooltip` ja existentes no arquivo
4. **Usar `toast`** do pacote `sonner` ja importado nos arquivos
5. **Indices do Supabase** ja estao corretos nas migrations existentes
6. O campo `student_contract_id` e a chave de rastreio — sempre usar ele
   para buscar sessoes, nunca apenas `student_id` ou `contrato_id`
7. Em todas as queries Supabase, sempre filtrar por `contractor_id`

