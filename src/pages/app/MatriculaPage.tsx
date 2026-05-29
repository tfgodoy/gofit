import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save, ScrollText } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────── */

interface Contrato {
  id: string;
  descricao: string;
  tipo: string;
  duracao: number;
  tipo_duracao: string;
  valor_total: number;
  valor_por_mes: number | null;
  formas_pagamento: string[];
}

interface Student {
  id: string;
  nome_completo: string;
  status: string;
}

const FORMA_LABEL: Record<string, string> = {
  dinheiro:       "Dinheiro",
  pix:            "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito:  "Cartão de débito",
  boleto:         "Boleto",
  transferencia:  "Transferência",
};

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/* ── page ────────────────────────────────────────────────── */

export default function MatriculaPage() {
  const { id: studentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student,    setStudent]    = useState<Student | null>(null);
  const [contratos,  setContratos]  = useState<Contrato[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  /* form */
  const [contratoId,    setContratoId]    = useState("");
  const [dataInicio,    setDataInicio]    = useState(new Date().toISOString().split("T")[0]);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [formaPgto,     setFormaPgto]     = useState("pix");
  const [observacoes,   setObservacoes]   = useState("");

  /* derived */
  const contrato = contratos.find(c => c.id === contratoId);
  const valorMensalidade = contrato?.valor_por_mes ?? contrato?.valor_total ?? 0;
  const dataFim = contrato
    ? contrato.tipo_duracao === "meses"
      ? addMonths(dataInicio, contrato.duracao)
      : contrato.tipo_duracao === "dias"
      ? addDays(dataInicio, contrato.duracao)
      : null
    : null;

  useEffect(() => {
    if (!user?.contractorId || !studentId) return;
    Promise.all([
      supabase.from("students").select("id, nome_completo, status")
        .eq("id", studentId).eq("contractor_id", user.contractorId!).maybeSingle(),
      supabase.from("contratos").select("id, descricao, tipo, duracao, tipo_duracao, valor_total, valor_por_mes, formas_pagamento")
        .eq("contractor_id", user.contractorId!).eq("ativo", true).order("descricao"),
    ]).then(([{ data: s }, { data: c }]) => {
      setStudent(s as Student | null);
      const cs = (c ?? []) as Contrato[];
      setContratos(cs);
      if (cs.length > 0) {
        setContratoId(cs[0].id);
        const formas = cs[0].formas_pagamento ?? [];
        if (formas.length > 0) setFormaPgto(formas[0]);
      }
      setLoading(false);
    });
  }, [user, studentId]);

  /* update forma_pagamento when contrato changes */
  useEffect(() => {
    if (contrato?.formas_pagamento?.length) {
      setFormaPgto(contrato.formas_pagamento[0]);
    }
  }, [contratoId]);

  async function handleSave() {
    if (!user?.contractorId || !studentId || !contratoId) return;
    if (!dataInicio) { toast.error("Informe a data de início"); return; }

    setSaving(true);
    try {
      /* 1. Criar student_contract */
      const { data: sc, error: scErr } = await supabase
        .from("student_contracts")
        .insert({
          contractor_id:     user.contractorId!,
          student_id:        studentId,
          contrato_id:       contratoId,
          data_inicio:       dataInicio,
          data_fim:          dataFim,
          status:            "ativo",
          valor_mensalidade: valorMensalidade,
          dia_vencimento:    diaVencimento,
          forma_pagamento:   formaPgto,
          observacoes:       observacoes.trim() || null,
        })
        .select("id")
        .single();

      if (scErr || !sc) { toast.error("Erro ao criar matrícula"); return; }

      /* 2. Gerar 1ª cobrança automaticamente */
      const d = new Date(dataInicio + "T00:00:00");
      const vencimento = new Date(d.getFullYear(), d.getMonth(), diaVencimento);
      if (vencimento < d) vencimento.setMonth(vencimento.getMonth() + 1);
      const vencStr = vencimento.toISOString().split("T")[0];

      await supabase.from("receivables").insert({
        contractor_id: user.contractorId!,
        student_id:    studentId,
        student_nome:  student?.nome_completo ?? null,
        descricao:     `Mensalidade ${contrato?.descricao ?? ""} — ${vencimento.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        valor:         valorMensalidade,
        vencimento:    vencStr,
        status:        "pendente",
        tipo:          "mensalidade",
        contrato_id:   contratoId,
        forma_pagamento: formaPgto,
      });

      /* 3. Atualizar status do aluno para "ativo" */
      if (student?.status !== "ativo") {
        await supabase.from("students")
          .update({ status: "ativo", updated_at: new Date().toISOString() })
          .eq("id", studentId);
      }

      toast.success("Matrícula realizada! 1ª mensalidade gerada.");
      navigate(`/app/clientes/${studentId}/dashboard`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={`/app/clientes/${studentId}/dashboard`}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nova Matrícula</h1>
            {student && <p className="text-sm text-gray-500 mt-0.5">{student.nome_completo}</p>}
          </div>
        </div>

        {contratos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
            <ScrollText className="w-10 h-10 text-gray-200 mx-auto" />
            <p className="text-sm font-semibold text-gray-500">Nenhum plano/contrato ativo cadastrado</p>
            <p className="text-xs text-gray-400">Crie um plano em Administrativo → Contratos antes de matricular.</p>
            <Link
              to="/app/administrativo/contratos/novo"
              className="inline-flex items-center gap-2 mt-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl"
            >
              Criar plano
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Plano */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Plano / Contrato</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Plano *</label>
                <select
                  value={contratoId}
                  onChange={e => setContratoId(e.target.value)}
                  className={inputClass}
                >
                  {contratos.map(c => (
                    <option key={c.id} value={c.id}>{c.descricao}</option>
                  ))}
                </select>
              </div>

              {contrato && (
                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Valor mensal</p>
                    <p className="text-base font-extrabold text-gray-800">
                      {valorMensalidade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Duração</p>
                    <p className="text-sm font-bold text-gray-700">
                      {contrato.duracao} {contrato.tipo_duracao}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Data fim</p>
                    <p className="text-sm font-bold text-gray-700">
                      {dataFim
                        ? new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")
                        : "Sem prazo"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Datas e pagamento */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Início e Cobrança</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data de início *</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Dia de vencimento</label>
                  <select
                    value={diaVencimento}
                    onChange={e => setDiaVencimento(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[1,5,10,15,20,25,28].map(d => (
                      <option key={d} value={d}>Todo dia {d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento</label>
                  <select
                    value={formaPgto}
                    onChange={e => setFormaPgto(e.target.value)}
                    className={inputClass}
                  >
                    {(contrato?.formas_pagamento ?? ["pix","dinheiro","cartao_credito"]).map(f => (
                      <option key={f} value={f}>{FORMA_LABEL[f] ?? f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                1ª mensalidade de{" "}
                <strong>
                  {valorMensalidade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>{" "}
                será gerada com vencimento em{" "}
                <strong>
                  {dataInicio
                    ? (() => {
                        const d = new Date(dataInicio + "T00:00:00");
                        const v = new Date(d.getFullYear(), d.getMonth(), diaVencimento);
                        if (v < d) v.setMonth(v.getMonth() + 1);
                        return v.toLocaleDateString("pt-BR");
                      })()
                    : "—"}
                </strong>.
              </div>
            </div>

            {/* Observações */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Observações sobre a matrícula..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pb-8">
              <Link
                to={`/app/clientes/${studentId}/dashboard`}
                className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                CANCELAR
              </Link>
              <button
                onClick={handleSave}
                disabled={saving || !contratoId || !dataInicio}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                MATRICULAR
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
