import { useState, useEffect } from "react";
import {
  CreditCard, Save, Loader2, Info, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Copy, Zap, Lock,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── gateway catalog ─────────────────────────────────────────── */

const GATEWAYS = [
  { key: "fitcore_pay",  label: "GoFit Pay",    badge: "Em breve", badgeBg: "bg-primary/10 text-primary"             },
  { key: "asaas",        label: "Asaas",        badge: null,       badgeBg: ""                                        },
  { key: "pagseguro",    label: "PagSeguro",    badge: null,       badgeBg: ""                                        },
  { key: "mercadopago",  label: "Mercado Pago", badge: null,       badgeBg: ""                                        },
  { key: "stripe",       label: "Stripe",       badge: null,       badgeBg: ""                                        },
];

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── page ────────────────────────────────────────────────────── */

export default function FitcorePayPage() {
  const { user } = useAuth();
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [configId,    setConfigId]    = useState<string | null>(null);
  const [showPriv,    setShowPriv]    = useState(false);

  /* form state */
  const [gateway,      setGateway]      = useState("fitcore_pay");
  const [ativo,        setAtivo]        = useState(false);
  const [apiKeyPub,    setApiKeyPub]    = useState("");
  const [apiKeyPriv,   setApiKeyPriv]   = useState("");
  const [splitPercent, setSplitPercent] = useState("1.50");

  /* stats */
  const [recTotal, setRecTotal] = useState(0);
  const [recPaid,  setRecPaid]  = useState(0);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    Promise.all([
      supabase.from("payment_gateway_config").select("*").eq("contractor_id", cid).maybeSingle(),
      supabase.from("receivables").select("status", { count: "exact", head: false }).eq("contractor_id", cid),
    ]).then(([{ data }, { data: recs }]) => {
      if (data) {
        const d = data as any;
        setConfigId(d.id);
        setGateway(d.gateway ?? "fitcore_pay");
        setAtivo(d.ativo ?? false);
        setApiKeyPub(d.api_key_pub ?? "");
        setApiKeyPriv(d.api_key_priv ?? "");
        setSplitPercent(String(d.split_percent ?? 1.50));
      }
      const recsArr = (recs ?? []) as any[];
      setRecTotal(recsArr.length);
      setRecPaid(recsArr.filter((r: any) => r.status === "pago").length);
      setLoading(false);
    });
  }, [user]);

  const webhookUrl = `${window.location.origin}/api/webhooks/payment/${user?.contractorId}`;

  async function handleSave() {
    if (!user?.contractorId) return;
    setSaving(true);
    const payload = {
      contractor_id:  user.contractorId!,
      gateway,
      ativo,
      api_key_pub:    apiKeyPub  || null,
      api_key_priv:   apiKeyPriv || null,
      webhook_url:    webhookUrl,
      split_percent:  parseFloat(splitPercent) || 1.50,
      updated_at:     new Date().toISOString(),
    };
    if (configId) {
      await supabase.from("payment_gateway_config").update(payload).eq("id", configId);
    } else {
      const { data } = await supabase.from("payment_gateway_config").insert(payload).select("id").single();
      if (data) setConfigId((data as any).id);
    }
    setSaving(false);
    toast.success("Configuração de pagamento salva!");
  }

  const conversionRate = recTotal > 0 ? Math.round((recPaid / recTotal) * 100) : 0;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">GoFit Pay</h1>
              <p className="text-sm text-gray-400 mt-0.5">Gateway de pagamento e cobranças recorrentes</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
            ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            <div className={`w-2 h-2 rounded-full ${ativo ? "bg-green-500" : "bg-gray-400"}`} />
            {ativo ? "Ativo" : "Inativo"}
          </div>
        </div>

        <div className="px-8 py-6 max-w-3xl space-y-5">

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* KPIs from receivables */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Total cobranças</p>
                  <p className="text-2xl font-extrabold text-gray-900">{recTotal}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Recebidas</p>
                  <p className="text-2xl font-extrabold text-green-700">{recPaid}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Taxa de recebimento</p>
                  <p className={`text-2xl font-extrabold ${conversionRate >= 80 ? "text-green-700" : conversionRate >= 50 ? "text-yellow-700" : "text-red-600"}`}>
                    {conversionRate}%
                  </p>
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 space-y-1">
                  <p>Configure um gateway de pagamento para cobranças recorrentes por cartão de crédito/débito.</p>
                  <p className="text-xs">O GoFit Pay estará disponível em breve. Por enquanto, use um gateway de mercado como Asaas ou PagSeguro.</p>
                </div>
              </div>

              {/* Gateway selection */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">Gateway de pagamento</h3>
                  <button
                    onClick={() => setAtivo(v => !v)}
                    className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${ativo ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-6" : ""}`} />
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {GATEWAYS.map(gw => (
                    <button
                      key={gw.key}
                      onClick={() => setGateway(gw.key)}
                      className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        gateway === gw.key
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {gw.badge && (
                        <span className={`absolute -top-2 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${gw.badgeBg}`}>
                          {gw.badge}
                        </span>
                      )}
                      <span className={`text-xs font-semibold ${gateway === gw.key ? "text-primary" : "text-gray-600"}`}>
                        {gw.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Credentials */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" /> Credenciais da API
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">API Key pública (publishable key)</label>
                  <input
                    value={apiKeyPub}
                    onChange={e => setApiKeyPub(e.target.value)}
                    placeholder="pk_live_xxxx... ou pk_test_xxxx..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">API Key privada (secret key)</label>
                  <div className="relative">
                    <input
                      type={showPriv ? "text" : "password"}
                      value={apiKeyPriv}
                      onChange={e => setApiKeyPriv(e.target.value)}
                      placeholder="sk_live_xxxx... ou sk_test_xxxx..."
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPriv(v => !v)}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                    >
                      {showPriv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Nunca compartilhe sua secret key.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Taxa da plataforma (%)</label>
                  <div className="relative w-40">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={splitPercent}
                      onChange={e => setSplitPercent(e.target.value)}
                      className={inputClass}
                    />
                    <span className="absolute right-3 top-2 text-sm text-gray-400">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Percentual retido pela plataforma GoFit a cada transação.
                  </p>
                </div>
              </div>

              {/* Webhook */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-400" /> URL de Webhook
                </h3>
                <p className="text-xs text-gray-500">Configure esta URL no dashboard do seu gateway para receber confirmações de pagamento em tempo real.</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={webhookUrl} className={`${inputClass} bg-gray-50 text-gray-500 text-xs flex-1`} />
                  <button
                    onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada!"); }}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0"
                    title="Copiar"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Features coming */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Funcionalidades do GoFit Pay</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Cobranças recorrentes via cartão", available: false },
                    { label: "Link de pagamento por WhatsApp",   available: false },
                    { label: "Split automático de comissões",    available: false },
                    { label: "Antecipação de recebíveis",        available: false },
                    { label: "Dashboard financeiro unificado",   available: true  },
                    { label: "Histórico de transações",          available: true  },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-2">
                      {f.available
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      }
                      <span className={`text-xs ${f.available ? "text-gray-700" : "text-gray-400"}`}>
                        {f.label}
                        {!f.available && " (em breve)"}
                      </span>
                    </div>
                  ))}
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
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
