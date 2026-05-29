import { useState, useEffect } from "react";
import { DollarSign, Save, Loader2, Info } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── constants ──────────────────────────────────────────────── */

const FORMAS_DISPONIVEIS: { key: string; label: string }[] = [
  { key: "dinheiro",       label: "Dinheiro"        },
  { key: "cartao_debito",  label: "Cartão de débito" },
  { key: "cartao_credito", label: "Cartão de crédito"},
  { key: "pix",            label: "Pix"             },
  { key: "boleto",         label: "Boleto bancário"  },
  { key: "transferencia",  label: "Transferência"    },
  { key: "cheque",         label: "Cheque"          },
];

const DEFAULTS = {
  juros_mensal:           1.00,
  multa_atraso:           2.00,
  dias_tolerancia:        3,
  dias_notificacao_antes: 5,
  formas_pagamento:       ["dinheiro","cartao_debito","cartao_credito","pix"],
};

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── helpers ─────────────────────────────────────────────────── */

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────── */

export default function ParametrosFinanceirosPage() {
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [juros,       setJuros]       = useState(String(DEFAULTS.juros_mensal));
  const [multa,       setMulta]       = useState(String(DEFAULTS.multa_atraso));
  const [tolerancia,  setTolerancia]  = useState(String(DEFAULTS.dias_tolerancia));
  const [notificacao, setNotificacao] = useState(String(DEFAULTS.dias_notificacao_antes));
  const [formas,      setFormas]      = useState<string[]>(DEFAULTS.formas_pagamento);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase
      .from("financial_settings")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setExistingId(d.id);
          setJuros(String(d.juros_mensal ?? DEFAULTS.juros_mensal));
          setMulta(String(d.multa_atraso ?? DEFAULTS.multa_atraso));
          setTolerancia(String(d.dias_tolerancia ?? DEFAULTS.dias_tolerancia));
          setNotificacao(String(d.dias_notificacao_antes ?? DEFAULTS.dias_notificacao_antes));
          setFormas(d.formas_pagamento ?? DEFAULTS.formas_pagamento);
        }
        setLoading(false);
      });
  }, [user]);

  function toggleForma(key: string) {
    setFormas(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    const jv = parseFloat(juros.replace(",", "."));
    const mv = parseFloat(multa.replace(",", "."));
    const tv = parseInt(tolerancia);
    const nv = parseInt(notificacao);

    if (isNaN(jv) || jv < 0) { toast.error("Taxa de juros inválida"); return; }
    if (isNaN(mv) || mv < 0) { toast.error("Multa inválida"); return; }
    if (isNaN(tv) || tv < 0) { toast.error("Dias de tolerância inválidos"); return; }
    if (formas.length === 0) { toast.error("Selecione ao menos uma forma de pagamento"); return; }

    setSaving(true);
    const payload = {
      contractor_id:          user.contractorId!,
      juros_mensal:           jv,
      multa_atraso:           mv,
      dias_tolerancia:        tv,
      dias_notificacao_antes: nv,
      formas_pagamento:       formas,
      updated_at:             new Date().toISOString(),
    };

    let error: unknown;
    if (existingId) {
      ({ error } = await supabase.from("financial_settings").update(payload).eq("id", existingId));
    } else {
      const { data, error: e } = await supabase.from("financial_settings").insert(payload).select("id").single();
      if (data) setExistingId((data as any).id);
      error = e;
    }

    setSaving(false);
    if (error) { toast.error("Erro ao salvar parâmetros"); return; }
    toast.success("Parâmetros salvos!");
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
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Parâmetros Financeiros</h1>
              <p className="text-sm text-gray-400 mt-0.5">Juros, multas e configurações de cobrança</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            SALVAR
          </button>
        </div>

        <div className="px-8 py-6 max-w-3xl space-y-5">

          {/* Info */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Esses parâmetros são aplicados automaticamente nas cobranças recorrentes,
              boletos e controles de inadimplência da academia.
            </p>
          </div>

          {/* Juros e Multa */}
          <Section
            title="Juros e Multa por Atraso"
            description="Aplicados automaticamente em cobranças vencidas"
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Taxa de juros ao mês (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={juros}
                    onChange={e => setJuros(e.target.value)}
                    className={inputClass}
                  />
                  <span className="absolute right-3 top-2 text-sm text-gray-400 font-semibold">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Ex: 1% = R$ 10,00 para cada R$ 1.000,00/mês de atraso
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Multa por atraso (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={multa}
                    onChange={e => setMulta(e.target.value)}
                    className={inputClass}
                  />
                  <span className="absolute right-3 top-2 text-sm text-gray-400 font-semibold">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Aplicada uma única vez no vencimento (máx. legal: 2%)
                </p>
              </div>
            </div>
          </Section>

          {/* Tolerância e Notificação */}
          <Section
            title="Tolerância e Notificações"
            description="Controle quando os alertas e cobranças são acionados"
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Dias de tolerância após vencimento
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={tolerancia}
                    onChange={e => setTolerancia(e.target.value)}
                    className={inputClass}
                  />
                  <span className="absolute right-3 top-2 text-sm text-gray-400 font-semibold">dias</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Cobranças não ficam em atraso dentro desse período
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Notificar aluno antes do vencimento
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={notificacao}
                    onChange={e => setNotificacao(e.target.value)}
                    className={inputClass}
                  />
                  <span className="absolute right-3 top-2 text-sm text-gray-400 font-semibold">dias</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Dias antes do vencimento para enviar lembrete
                </p>
              </div>
            </div>
          </Section>

          {/* Formas de pagamento */}
          <Section
            title="Formas de Pagamento Aceitas"
            description="Marque as formas de pagamento que sua academia aceita"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FORMAS_DISPONIVEIS.map(forma => {
                const checked = formas.includes(forma.key);
                return (
                  <button
                    key={forma.key}
                    onClick={() => toggleForma(forma.key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked ? "border-primary bg-primary" : "border-gray-300"
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${checked ? "text-primary" : "text-gray-700"}`}>
                      {forma.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Preview */}
          <Section
            title="Resumo das Configurações"
            description="Como essas configurações serão aplicadas"
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Juros ao mês",          value: `${juros}%` },
                { label: "Multa por atraso",       value: `${multa}%` },
                { label: "Tolerância",             value: `${tolerancia} dia${Number(tolerancia) !== 1 ? "s" : ""}` },
                { label: "Notificação prévia",     value: `${notificacao} dia${Number(notificacao) !== 1 ? "s" : ""}` },
                { label: "Formas aceitas",         value: formas.map(f => FORMAS_DISPONIVEIS.find(fd => fd.key === f)?.label).filter(Boolean).join(", ") || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="flex justify-end pb-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              SALVAR PARÂMETROS
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
