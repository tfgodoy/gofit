import { useState, useEffect } from "react";
import {
  FileText, Save, Loader2, Info, CheckCircle2,
  XCircle, Clock, AlertTriangle, Plus, Eye,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface NfseEmission {
  id:            string;
  numero_rps:    number | null;
  numero_nfse:   string | null;
  student_nome:  string | null;
  valor_servico: number | null;
  valor_iss:     number | null;
  status:        string;
  data_emissao:  string | null;
  mensagem_erro: string | null;
  pdf_url:       string | null;
  created_at:    string;
}

/* ── constants ──────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  pendente:  { label: "Pendente",  icon: <Clock className="w-3.5 h-3.5" />,         bg: "bg-yellow-100", text: "text-yellow-700" },
  emitida:   { label: "Emitida",   icon: <CheckCircle2 className="w-3.5 h-3.5" />,   bg: "bg-green-100",  text: "text-green-700"  },
  cancelada: { label: "Cancelada", icon: <XCircle className="w-3.5 h-3.5" />,        bg: "bg-gray-100",   text: "text-gray-500"   },
  erro:      { label: "Erro",      icon: <AlertTriangle className="w-3.5 h-3.5" />,   bg: "bg-red-100",    text: "text-red-700"    },
};

const REGIMES = [
  { value: "simples_nacional",         label: "Simples Nacional"          },
  { value: "lucro_presumido",          label: "Lucro Presumido"           },
  { value: "lucro_real",               label: "Lucro Real"                },
  { value: "microempreendedor_individual", label: "MEI"                   },
];

const AMBIENTES = [
  { value: "homologacao", label: "Homologação (testes)" },
  { value: "producao",    label: "Produção"              },
];

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

/* ── page ────────────────────────────────────────────────────── */

export default function NfsePage() {
  const { user } = useAuth();
  const [tab,      setTab]      = useState<"config" | "emissoes">("config");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  /* Config fields */
  const [municipioCod,   setMunicipioCod]   = useState("");
  const [municipioNome,  setMunicipioNome]  = useState("");
  const [inscMunicipal,  setInscMunicipal]  = useState("");
  const [serie,          setSerie]          = useState("1");
  const [numeroRps,      setNumeroRps]      = useState("1");
  const [regime,         setRegime]         = useState("simples_nacional");
  const [aliquota,       setAliquota]       = useState("2.00");
  const [codTrib,        setCodTrib]        = useState("");
  const [descServico,    setDescServico]    = useState("Serviços de academia e atividade física");
  const [ambiente,       setAmbiente]       = useState("homologacao");
  const [nfseAtivo,      setNfseAtivo]      = useState(false);

  /* Emissions */
  const [emissions,    setEmissions]    = useState<NfseEmission[]>([]);
  const [loadingEmiss, setLoadingEmiss] = useState(false);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase
      .from("nfse_config")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setConfigId(d.id);
          setMunicipioCod(d.municipio_codigo ?? "");
          setMunicipioNome(d.municipio_nome ?? "");
          setInscMunicipal(d.inscricao_municipal ?? "");
          setSerie(d.serie_rps ?? "1");
          setNumeroRps(String(d.numero_rps_atual ?? 1));
          setRegime(d.regime_tributario ?? "simples_nacional");
          setAliquota(String(d.aliquota_iss ?? 2.00));
          setCodTrib(d.codigo_tributacao ?? "");
          setDescServico(d.descricao_servico ?? "Serviços de academia e atividade física");
          setAmbiente(d.ambiente ?? "homologacao");
          setNfseAtivo(d.ativo ?? false);
        }
        setLoading(false);
      });
  }, [user]);

  async function loadEmissions() {
    if (!user?.contractorId) return;
    setLoadingEmiss(true);
    const { data } = await supabase
      .from("nfse_emissions")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .order("created_at", { ascending: false })
      .limit(50);
    setEmissions((data ?? []) as NfseEmission[]);
    setLoadingEmiss(false);
  }

  useEffect(() => {
    if (tab === "emissoes") loadEmissions();
  }, [tab, user]);

  async function handleSave() {
    if (!user?.contractorId) return;
    const payload = {
      contractor_id:       user.contractorId!,
      municipio_codigo:    municipioCod || null,
      municipio_nome:      municipioNome || null,
      inscricao_municipal: inscMunicipal || null,
      serie_rps:           serie || "1",
      numero_rps_atual:    parseInt(numeroRps) || 1,
      regime_tributario:   regime,
      aliquota_iss:        parseFloat(aliquota.replace(",", ".")) || 2.00,
      codigo_tributacao:   codTrib || null,
      descricao_servico:   descServico || null,
      ambiente,
      ativo:               nfseAtivo,
      updated_at:          new Date().toISOString(),
    };
    setSaving(true);
    if (configId) {
      await supabase.from("nfse_config").update(payload).eq("id", configId);
    } else {
      const { data } = await supabase.from("nfse_config").insert(payload).select("id").single();
      if (data) setConfigId((data as any).id);
    }
    setSaving(false);
    toast.success("Configuração de NFS-e salva!");
  }

  async function createPendingEmission() {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("nfse_emissions")
      .insert({
        contractor_id: user.contractorId!,
        status: "pendente",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (data) {
      toast.success("Emissão criada com status pendente. Integre com o provedor para processar.");
      loadEmissions();
    }
  }

  const totalEmitidas = emissions.filter(e => e.status === "emitida").length;
  const totalValor    = emissions.filter(e => e.status === "emitida").reduce((s, e) => s + (e.valor_servico ?? 0), 0);

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">NFS-e</h1>
              <p className="text-sm text-gray-400 mt-0.5">Nota Fiscal de Serviços Eletrônica</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
            nfseAtivo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            <div className={`w-2 h-2 rounded-full ${nfseAtivo ? "bg-green-500" : "bg-gray-400"}`} />
            {nfseAtivo ? "NFS-e ativa" : "NFS-e inativa"}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-8">
          <div className="flex gap-0">
            {(["config", "emissoes"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t === "config" ? "Configuração" : `Emissões${totalEmitidas > 0 ? ` (${totalEmitidas})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 py-6 max-w-3xl">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : tab === "config" ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Configure os dados fiscais da academia para emissão de NFS-e.
                  A integração com a prefeitura requer um provedor homologado (ex: eNotas, NFe.io, NFSe.cloud).
                </p>
              </div>

              {/* Ambiente */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">Ambiente e Status</h3>
                  <button
                    onClick={() => setNfseAtivo(v => !v)}
                    className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${nfseAtivo ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${nfseAtivo ? "translate-x-6" : ""}`} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Ambiente</label>
                    <select value={ambiente} onChange={e => setAmbiente(e.target.value)} className={inputClass}>
                      {AMBIENTES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Regime tributário</label>
                    <select value={regime} onChange={e => setRegime(e.target.value)} className={inputClass}>
                      {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                {ambiente === "producao" && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                    <p className="text-xs text-orange-700">Modo produção: notas fiscais reais serão emitidas.</p>
                  </div>
                )}
              </div>

              {/* Dados do município */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Dados do Município</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Código IBGE do município</label>
                    <input value={municipioCod} onChange={e => setMunicipioCod(e.target.value)} placeholder="Ex: 3550308" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nome do município</label>
                    <input value={municipioNome} onChange={e => setMunicipioNome(e.target.value)} placeholder="Ex: São Paulo" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Inscrição Municipal</label>
                    <input value={inscMunicipal} onChange={e => setInscMunicipal(e.target.value)} placeholder="Número de inscrição" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Alíquota ISS (%)</label>
                    <div className="relative">
                      <input type="number" step="0.01" min="0" max="5" value={aliquota} onChange={e => setAliquota(e.target.value)} className={inputClass} />
                      <span className="absolute right-3 top-2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuração RPS */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700">Configuração de RPS</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Série RPS</label>
                    <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="1" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Próximo número RPS</label>
                    <input type="number" value={numeroRps} onChange={e => setNumeroRps(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Código de tributação</label>
                    <input value={codTrib} onChange={e => setCodTrib(e.target.value)} placeholder="Ex: 0105" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição do serviço (padrão)</label>
                  <textarea
                    value={descServico}
                    onChange={e => setDescServico(e.target.value)}
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              <div className="flex justify-end pb-8">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  SALVAR CONFIGURAÇÃO
                </button>
              </div>
            </div>

          ) : (
            /* Emissões tab */
            <div className="space-y-4">
              {/* Stats */}
              {totalEmitidas > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-extrabold text-gray-900">{emissions.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Total de emissões</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-extrabold text-green-700">{totalEmitidas}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Emitidas</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-xl font-extrabold text-gray-700">{fmtMoney(totalValor)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Valor total emitido</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={createPendingEmission}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> NOVA EMISSÃO
                </button>
              </div>

              {/* Emissions list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                {loadingEmiss ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : emissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <FileText className="w-10 h-10 text-gray-200" />
                    <p className="text-sm text-gray-400">Nenhuma NFS-e emitida ainda</p>
                    {!nfseAtivo && (
                      <p className="text-xs text-orange-600">Ative a NFS-e na aba Configuração primeiro</p>
                    )}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">RPS / NFS-e</th>
                        <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">Cliente</th>
                        <th className="text-right text-xs font-semibold text-gray-400 px-5 py-3">Valor</th>
                        <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">Data</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-5 py-3">Status</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {emissions.map(e => {
                        const sc = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.pendente;
                        return (
                          <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <p className="text-sm font-mono text-gray-700">
                                {e.numero_nfse ? `#${e.numero_nfse}` : e.numero_rps ? `RPS ${e.numero_rps}` : "—"}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-600">{e.student_nome ?? "—"}</td>
                            <td className="px-5 py-3 text-sm font-semibold text-right text-gray-800">
                              {fmtMoney(e.valor_servico)}
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-500">{fmtDate(e.data_emissao ?? e.created_at)}</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                                {sc.icon} {sc.label}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              {e.pdf_url && (
                                <a href={e.pdf_url} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 rounded hover:bg-gray-100 inline-flex" title="Ver PDF">
                                  <Eye className="w-4 h-4 text-gray-400" />
                                </a>
                              )}
                              {e.status === "erro" && e.mensagem_erro && (
                                <p className="text-xs text-red-600 mt-0.5">{e.mensagem_erro}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
