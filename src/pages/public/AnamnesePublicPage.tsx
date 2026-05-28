import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── PAR-Q ───────────────────────────────────────────────────────────────────

const PARQ_PERGUNTAS = [
  "Algum médico já disse que você possui algum problema cardíaco e que deve realizar atividade física somente com supervisão?",
  "Você sente dor no peito quando realiza atividade física?",
  "No último mês, você teve dor no peito quando não estava realizando atividade física?",
  "Você perde o equilíbrio por causa de tontura ou perde a consciência?",
  "Você tem algum problema ósseo ou muscular que poderia ser agravado pela atividade física?",
  "Algum médico está receitando atualmente medicamentos para pressão arterial ou condição cardíaca?",
  "Você tem alguma outra razão pela qual não deve praticar atividade física?",
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Questao {
  id: string;
  pergunta: string;
  tipo: string;
  opcoes: string[];
  permite_outro: boolean;
  obrigatoria: boolean;
}

interface Modelo {
  descricao: string;
  respondido_pelo_cliente: boolean;
  exigir_aceite: boolean;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function AnamnesePublicPage() {
  const { token } = useParams<{ token: string }>();

  type PageState = "loading" | "not-found" | "already-done" | "form" | "success";
  const [pageState, setPageState] = useState<PageState>("loading");
  const [respostaId, setRespostaId] = useState("");
  const [modelo, setModelo]         = useState<Modelo | null>(null);
  const [questoes, setQuestoes]     = useState<Questao[]>([]);

  const [answers,      setAnswers]      = useState<Record<string, any>>({});
  const [simNaoQual,   setSimNaoQual]   = useState<Record<string, string>>({});
  const [outroTexto,   setOutroTexto]   = useState<Record<string, string>>({});
  const [parq,         setParq]         = useState<Record<string, string>>({});
  const [aceite,       setAceite]       = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [errors,       setErrors]       = useState<string[]>([]);

  useEffect(() => {
    if (!token) { setPageState("not-found"); return; }
    load();
  }, [token]);

  async function load() {
    const { data: r } = await supabase
      .from("anamnese_respostas")
      .select("id, status, modelo_id, anamnese_modelos(descricao, respondido_pelo_cliente, exigir_aceite)")
      .eq("token", token!)
      .maybeSingle();

    if (!r) { setPageState("not-found"); return; }
    if ((r as any).status === "respondido") { setPageState("already-done"); return; }

    setRespostaId((r as any).id);
    setModelo((r as any).anamnese_modelos as Modelo);

    const { data: mq } = await supabase
      .from("anamnese_modelo_questoes")
      .select("ordem, obrigatoria, anamnese_questoes(id, pergunta, tipo, opcoes, permite_outro)")
      .eq("modelo_id", (r as any).modelo_id)
      .order("ordem");

    const qs: Questao[] = ((mq ?? []) as any[]).map(row => ({
      id:           row.anamnese_questoes?.id ?? "",
      pergunta:     row.anamnese_questoes?.pergunta ?? "",
      tipo:         row.anamnese_questoes?.tipo ?? "texto",
      opcoes:       (row.anamnese_questoes?.opcoes ?? []) as string[],
      permite_outro: row.anamnese_questoes?.permite_outro ?? false,
      obrigatoria:  row.obrigatoria ?? false,
    })).filter(q => q.id);

    setQuestoes(qs);
    setPageState("form");
  }

  function setAnswer(id: string, value: any) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  function toggleCheckbox(id: string, option: string) {
    setAnswers(prev => {
      const current: string[] = prev[id] ?? [];
      return current.includes(option)
        ? { ...prev, [id]: current.filter(o => o !== option) }
        : { ...prev, [id]: [...current, option] };
    });
  }

  function validate(): boolean {
    const errs: string[] = [];

    for (const q of questoes) {
      if (!q.obrigatoria) continue;
      const val = answers[q.id];
      const empty = val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
      if (empty) errs.push(`"${q.pergunta.slice(0, 60)}${q.pergunta.length > 60 ? "..." : ""}" é obrigatória.`);
    }

    for (let i = 0; i < PARQ_PERGUNTAS.length; i++) {
      if (!parq[String(i)]) errs.push(`PAR-Q pergunta ${i + 1} é obrigatória.`);
    }

    if (modelo?.exigir_aceite && !aceite) errs.push("Confirme o aceite para enviar.");

    setErrors(errs);
    return errs.length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);

    const finalAnswers: Record<string, any> = {};
    for (const q of questoes) {
      const val = answers[q.id];
      if (val === undefined || val === null || val === "") continue;
      if (q.tipo === "sim_nao_qual") {
        finalAnswers[q.id] = val === "Sim" ? `Sim — ${simNaoQual[q.id] ?? ""}` : val;
      } else if ((q.tipo === "radio" || q.tipo === "select") && val === "Outro") {
        finalAnswers[q.id] = `Outro: ${outroTexto[q.id] ?? ""}`;
      } else if (q.tipo === "checkbox") {
        const arr: string[] = val ?? [];
        finalAnswers[q.id] = arr.map(v => v === "Outro" ? `Outro: ${outroTexto[q.id] ?? ""}` : v);
      } else {
        finalAnswers[q.id] = val;
      }
    }

    const itens = Object.entries(finalAnswers).map(([questao_id, valor]) => ({
      resposta_id: respostaId,
      questao_id,
      valor,
    }));

    if (itens.length > 0) {
      await supabase.from("anamnese_resposta_itens").insert(itens);

      const questaoIds = [...new Set(itens.map(i => i.questao_id))];
      await supabase
        .from("anamnese_questoes")
        .update({ tem_respostas: true })
        .in("id", questaoIds);
    }

    await supabase
      .from("anamnese_respostas")
      .update({ status: "respondido", respondido_at: new Date().toISOString(), parq, aceite })
      .eq("id", respostaId);

    setSubmitting(false);
    setPageState("success");
  }

  // ── renderização de cada tipo de pergunta ──────────────────────────────────

  function renderQuestion(q: Questao) {
    const val = answers[q.id];
    const baseRadio = "flex items-center gap-2 px-5 py-2.5 border-2 rounded-xl cursor-pointer transition-all text-sm font-medium select-none";
    const baseCheck = "flex items-center gap-3 px-4 py-2.5 border-2 rounded-xl cursor-pointer transition-all text-sm select-none";
    const active    = "border-primary bg-primary/5";
    const inactive  = "border-gray-200 hover:border-gray-300";

    switch (q.tipo) {
      case "sim_nao":
        return (
          <div className="flex gap-3 mt-2">
            {["Sim", "Não"].map(opt => (
              <label key={opt} className={`${baseRadio} ${val === opt ? active : inactive}`}>
                <input type="radio" name={q.id} value={opt} checked={val === opt}
                  onChange={() => setAnswer(q.id, opt)} className="accent-primary" />
                {opt}
              </label>
            ))}
          </div>
        );

      case "sim_nao_qual":
        return (
          <div className="mt-2 space-y-3">
            <div className="flex gap-3">
              {["Sim", "Não"].map(opt => (
                <label key={opt} className={`${baseRadio} ${val === opt ? active : inactive}`}>
                  <input type="radio" name={q.id} value={opt} checked={val === opt}
                    onChange={() => setAnswer(q.id, opt)} className="accent-primary" />
                  {opt}
                </label>
              ))}
            </div>
            {val === "Sim" && (
              <input type="text" placeholder="Qual?" value={simNaoQual[q.id] ?? ""}
                onChange={e => setSimNaoQual(prev => ({ ...prev, [q.id]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            )}
          </div>
        );

      case "texto":
        return (
          <textarea rows={3} placeholder="Escreva sua resposta..." value={val ?? ""}
            onChange={e => setAnswer(q.id, e.target.value)}
            className="w-full mt-2 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none" />
        );

      case "numero":
        return (
          <input type="number" value={val ?? ""} onChange={e => setAnswer(q.id, e.target.value)}
            className="mt-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary w-40" />
        );

      case "data":
        return (
          <input type="date" value={val ?? ""} onChange={e => setAnswer(q.id, e.target.value)}
            className="mt-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
        );

      case "radio": {
        const opts = [...q.opcoes, ...(q.permite_outro ? ["Outro"] : [])];
        return (
          <div className="mt-2 space-y-2">
            {opts.map(opt => (
              <label key={opt} className={`${baseCheck} ${val === opt ? active : inactive}`}>
                <input type="radio" name={q.id} value={opt} checked={val === opt}
                  onChange={() => setAnswer(q.id, opt)} className="accent-primary" />
                {opt}
              </label>
            ))}
            {val === "Outro" && q.permite_outro && (
              <input type="text" placeholder="Especifique..." value={outroTexto[q.id] ?? ""}
                onChange={e => setOutroTexto(prev => ({ ...prev, [q.id]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            )}
          </div>
        );
      }

      case "checkbox": {
        const opts = [...q.opcoes, ...(q.permite_outro ? ["Outro"] : [])];
        const checked = (val ?? []) as string[];
        return (
          <div className="mt-2 space-y-2">
            {opts.map(opt => (
              <label key={opt} className={`${baseCheck} ${checked.includes(opt) ? active : inactive}`}>
                <input type="checkbox" checked={checked.includes(opt)}
                  onChange={() => toggleCheckbox(q.id, opt)} className="accent-primary w-4 h-4 flex-shrink-0" />
                {opt}
              </label>
            ))}
            {checked.includes("Outro") && q.permite_outro && (
              <input type="text" placeholder="Especifique..." value={outroTexto[q.id] ?? ""}
                onChange={e => setOutroTexto(prev => ({ ...prev, [q.id]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            )}
          </div>
        );
      }

      case "select":
        return (
          <select value={val ?? ""} onChange={e => setAnswer(q.id, e.target.value)}
            className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
            <option value="">Selecione...</option>
            {[...q.opcoes, ...(q.permite_outro ? ["Outro"] : [])].map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      default:
        return null;
    }
  }

  // ── estados de página ─────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (pageState === "not-found") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-lg font-bold text-gray-700">Link inválido</p>
        <p className="text-sm text-gray-400">Esta anamnese não foi encontrada ou o link expirou.</p>
      </div>
    );
  }

  if (pageState === "already-done") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-400" />
        <p className="text-lg font-bold text-gray-700">Anamnese já respondida</p>
        <p className="text-sm text-gray-400">Esta anamnese já foi preenchida anteriormente. Obrigado!</p>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Anamnese enviada!</h1>
        <p className="text-sm text-gray-500 max-w-xs">
          Suas respostas foram registradas com sucesso. Obrigado!
        </p>
      </div>
    );
  }

  // ── formulário ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Cabeçalho */}
        <div className="bg-primary rounded-2xl px-6 py-5">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Anamnese</p>
          <h1 className="text-xl font-bold text-white">{modelo?.descricao}</h1>
        </div>

        {/* Erros de validação */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 space-y-1">
            <p className="text-sm font-semibold text-red-700 mb-2">Corrija os seguintes erros antes de enviar:</p>
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-red-600">• {err}</p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Perguntas do modelo */}
          {questoes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-bold text-gray-700 pb-3 border-b border-gray-100">Perguntas</h2>
              {questoes.map((q, i) => (
                <div key={q.id}>
                  <p className="text-sm font-medium text-gray-800">
                    {i + 1}. {q.pergunta}
                    {q.obrigatoria && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  {renderQuestion(q)}
                </div>
              ))}
            </div>
          )}

          {/* PAR-Q */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="pb-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">PAR-Q — Prontidão para Atividade Física</h2>
              <p className="text-xs text-gray-400 mt-0.5">Todas as perguntas são obrigatórias</p>
            </div>
            {PARQ_PERGUNTAS.map((p, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-gray-800 mb-2">
                  {i + 1}. {p} <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-3">
                  {["Sim", "Não"].map(opt => (
                    <label key={opt}
                      className={`flex items-center gap-2 px-5 py-2.5 border-2 rounded-xl cursor-pointer transition-all text-sm font-medium select-none ${
                        parq[String(i)] === opt ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input type="radio" name={`parq_${i}`} value={opt}
                        checked={parq[String(i)] === opt}
                        onChange={() => setParq(prev => ({ ...prev, [String(i)]: opt }))}
                        className="accent-primary" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Aceite */}
          {modelo?.exigir_aceite && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)}
                  className="accent-primary mt-0.5 w-4 h-4 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  Declaro que as informações fornecidas são verdadeiras e autorizo o uso dos dados para avaliação física e acompanhamento de saúde.
                  <span className="text-red-500 ml-1">*</span>
                </span>
              </label>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-3.5 text-sm font-bold bg-primary text-white rounded-2xl hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</span>
              : "ENVIAR ANAMNESE"
            }
          </button>

          <p className="text-xs text-center text-gray-400 pb-4">
            Campos com <span className="text-red-500">*</span> são obrigatórios
          </p>
        </form>
      </div>
    </div>
  );
}
