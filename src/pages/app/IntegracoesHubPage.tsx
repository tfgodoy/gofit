import { useState, useEffect } from "react";
import {
  Plug, CheckCircle2, X, Loader2,
  ExternalLink, RefreshCw, Copy, Eye, EyeOff, AlertTriangle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── partner catalog ─────────────────────────────────────────── */

interface PartnerDef {
  key:         string;
  name:        string;
  description: string;
  logoText:    string;
  logoBg:      string;
  logoColor:   string;
  website:     string;
  category:    "fitness" | "fiscal" | "payment";
  fields:      { key: string; label: string; placeholder: string; type?: string }[];
  instructions: string;
}

const PARTNERS: PartnerDef[] = [
  {
    key: "wellhub", name: "Wellhub", logoText: "W",
    logoBg: "bg-blue-600", logoColor: "text-white",
    description: "Anteriormente Gympass. Plataforma de benefício corporativo de saúde.",
    website: "https://wellhub.com",
    category: "fitness",
    fields: [
      { key: "api_key",      label: "API Key",      placeholder: "wh_live_xxxx..." },
      { key: "contract_id",  label: "Contract ID",  placeholder: "ID do contrato Wellhub" },
      { key: "webhook_secret", label: "Webhook Secret", placeholder: "whsec_..." },
    ],
    instructions: "1. Acesse o portal Wellhub para parceiros\n2. Gere as credenciais de API\n3. Configure a URL de webhook: use o endpoint fornecido abaixo",
  },
  {
    key: "gympass", name: "Gympass", logoText: "GP",
    logoBg: "bg-green-700", logoColor: "text-white",
    description: "Rede global de academias e estúdios. Integração via API REST.",
    website: "https://gympass.com",
    category: "fitness",
    fields: [
      { key: "api_key",     label: "API Key",     placeholder: "gp_prod_xxxx..." },
      { key: "contract_id", label: "Gym ID",      placeholder: "ID da academia no Gympass" },
    ],
    instructions: "1. Acesse o portal de parceiros do Gympass\n2. Vá em Configurações > API\n3. Copie sua API Key e Gym ID",
  },
  {
    key: "totalpass", name: "TotalPass", logoText: "TP",
    logoBg: "bg-orange-500", logoColor: "text-white",
    description: "Benefício de bem-estar corporativo com rede de academias no Brasil.",
    website: "https://totalpass.com",
    category: "fitness",
    fields: [
      { key: "api_key",     label: "Token de integração", placeholder: "tp_xxxx..." },
      { key: "contract_id", label: "Código da academia",  placeholder: "Código fornecido pelo TotalPass" },
    ],
    instructions: "1. Solicite acesso ao portal de parceiros TotalPass\n2. Obtenha seu Token e Código da Academia\n3. Ative a integração e configure o webhook",
  },
  {
    key: "classpass", name: "ClassPass", logoText: "CP",
    logoBg: "bg-purple-600", logoColor: "text-white",
    description: "Plataforma global de reservas de aulas e academias.",
    website: "https://classpass.com",
    category: "fitness",
    fields: [
      { key: "api_key",    label: "API Key",   placeholder: "cp_live_xxxx..." },
      { key: "api_secret", label: "API Secret", placeholder: "Segredo da API ClassPass" },
    ],
    instructions: "1. Cadastre sua academia no ClassPass for Business\n2. Acesse as configurações de integração\n3. Gere suas credenciais de API",
  },
];

const CATEGORY_LABEL: Record<string, string> = {
  fitness: "Parceiros Fitness",
  fiscal:  "Fiscal",
  payment: "Pagamento",
};

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── types ──────────────────────────────────────────────────── */

interface PartnerIntegration {
  id: string;
  partner: string;
  ativo: boolean;
  api_key: string | null;
  api_secret: string | null;
  webhook_secret: string | null;
  contract_id: string | null;
  observacoes: string | null;
  ultimo_sync: string | null;
  updated_at: string;
}

interface CheckinSummary { partner: string; total: number; repasse: number }

/* ── modal ──────────────────────────────────────────────────── */

function ConfigModal({
  partner,
  existing,
  contractorId,
  onSave,
  onClose,
}: {
  partner: PartnerDef;
  existing: PartnerIntegration | null;
  contractorId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [ativo,   setAtivo]   = useState(existing?.ativo ?? false);
  const [fields,  setFields]  = useState<Record<string, string>>({
    api_key:        existing?.api_key        ?? "",
    api_secret:     existing?.api_secret     ?? "",
    webhook_secret: existing?.webhook_secret ?? "",
    contract_id:    existing?.contract_id    ?? "",
  });
  const [obs,     setObs]     = useState(existing?.observacoes ?? "");
  const [saving,  setSaving]  = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const webhookUrl = `${window.location.origin}/api/webhooks/${partner.key}/${contractorId}`;

  function setField(k: string, v: string) {
    setFields(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      contractor_id:  contractorId,
      partner:        partner.key,
      ativo,
      api_key:        fields.api_key        || null,
      api_secret:     fields.api_secret     || null,
      webhook_secret: fields.webhook_secret || null,
      contract_id:    fields.contract_id    || null,
      observacoes:    obs || null,
      updated_at:     new Date().toISOString(),
    };
    if (existing) {
      await supabase.from("partner_integrations").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("partner_integrations").insert(payload);
    }
    toast.success("Configuração salva!");
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl ${partner.logoBg} flex items-center justify-center`}>
              <span className={`text-xs font-extrabold ${partner.logoColor}`}>{partner.logoText}</span>
            </div>
            <h2 className="font-semibold text-gray-800">{partner.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Integração ativa</p>
              <p className="text-xs text-gray-400">
                {ativo ? "Recebendo check-ins e dados do parceiro" : "Integração desativada"}
              </p>
            </div>
            <button
              onClick={() => setAtivo(v => !v)}
              className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${ativo ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-6" : ""}`} />
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {partner.fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
                <div className="relative">
                  <input
                    type={showKey[f.key] ? "text" : (f.key.includes("secret") || f.key.includes("key") ? "password" : "text")}
                    value={fields[f.key] ?? ""}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={inputClass}
                  />
                  {(f.key.includes("secret") || f.key.includes("key")) && (
                    <button
                      type="button"
                      onClick={() => setShowKey(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                    >
                      {showKey[f.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">URL de Webhook (configure no portal do parceiro)</label>
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

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-blue-700 mb-2">Como configurar</p>
            <pre className="text-xs text-blue-600 whitespace-pre-wrap font-sans leading-relaxed">
              {partner.instructions}
            </pre>
            <a
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline mt-2"
            >
              <ExternalLink className="w-3 h-3" /> Abrir portal do parceiro
            </a>
          </div>

          {/* Obs */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={2}
              placeholder="Anotações internas sobre esta integração..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">CANCELAR</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── partner card ────────────────────────────────────────────── */

function PartnerCard({
  partner,
  integration,
  checkins,
  onConfigure,
}: {
  partner: PartnerDef;
  integration: PartnerIntegration | null;
  checkins: CheckinSummary | null;
  onConfigure: () => void;
}) {
  const isActive = integration?.ativo ?? false;
  const configured = !!integration?.api_key;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${partner.logoBg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-sm font-extrabold ${partner.logoColor}`}>{partner.logoText}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">{partner.name}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isActive
                ? "bg-green-100 text-green-700"
                : configured
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {isActive ? "Ativo" : configured ? "Configurado" : "Não configurado"}
            </span>
          </div>
        </div>
        {isActive && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{partner.description}</p>

      {/* Stats */}
      {checkins && checkins.total > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
            <p className="text-lg font-extrabold text-gray-800">{checkins.total}</p>
            <p className="text-xs text-gray-400">check-ins</p>
          </div>
          <div className="bg-green-50 rounded-xl px-3 py-2.5 text-center">
            <p className="text-sm font-extrabold text-green-700">
              {checkins.repasse.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs text-gray-400">repasse</p>
          </div>
        </div>
      )}

      {integration?.ultimo_sync && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          Último sync: {new Date(integration.ultimo_sync).toLocaleString("pt-BR")}
        </p>
      )}

      <button
        onClick={onConfigure}
        className="w-full text-sm font-semibold py-2 rounded-xl border-2 border-primary text-primary hover:bg-primary/5 transition-colors mt-auto"
      >
        {configured ? "Editar configuração" : "Configurar"}
      </button>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────── */

export default function IntegracoesHubPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Record<string, PartnerIntegration>>({});
  const [checkinSums,  setCheckinSums]  = useState<Record<string, CheckinSummary>>({});
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<PartnerDef | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;

    const [{ data: ints }, { data: chks }] = await Promise.all([
      supabase.from("partner_integrations").select("*").eq("contractor_id", cid),
      supabase.from("partner_checkins").select("partner, valor_repasse").eq("contractor_id", cid),
    ]);

    const intMap: Record<string, PartnerIntegration> = {};
    for (const i of (ints ?? []) as any[]) intMap[i.partner] = i;
    setIntegrations(intMap);

    const sumMap: Record<string, CheckinSummary> = {};
    for (const c of (chks ?? []) as any[]) {
      if (!sumMap[c.partner]) sumMap[c.partner] = { partner: c.partner, total: 0, repasse: 0 };
      sumMap[c.partner].total++;
      sumMap[c.partner].repasse += c.valor_repasse ?? 0;
    }
    setCheckinSums(sumMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const grouped = PARTNERS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, PartnerDef[]>);

  const activeCount = Object.values(integrations).filter(i => i.ativo).length;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plug className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Integrações</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {activeCount > 0
                  ? `${activeCount} integração${activeCount !== 1 ? "ões" : ""} ativa${activeCount !== 1 ? "s" : ""}`
                  : "Conecte sua academia a plataformas externas"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* Alert */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              As integrações requerem contrato ativo com cada plataforma parceira.
              Os check-ins são registrados automaticamente via webhook após a configuração.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            Object.entries(grouped).map(([cat, partners]) => (
              <div key={cat}>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {partners.map(p => (
                    <PartnerCard
                      key={p.key}
                      partner={p}
                      integration={integrations[p.key] ?? null}
                      checkins={checkinSums[p.key] ?? null}
                      onConfigure={() => setModal(p)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Links rápidos para NFS-e e GoFit Pay */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Outros módulos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: "NFS-e",
                  desc: "Emissão de Nota Fiscal de Serviços Eletrônica integrada ao sistema.",
                  href: "/app/financeiro/nfs-e",
                  icon: "NF",
                  bg: "bg-blue-600",
                },
                {
                  title: "GoFit Pay",
                  desc: "Gateway de pagamento para cobranças recorrentes por cartão.",
                  href: "/app/financeiro/pay",
                  icon: "GP",
                  bg: "bg-primary",
                },
              ].map(item => (
                <a
                  key={item.title}
                  href={item.href}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:border-primary/20 hover:shadow-md transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-xs font-extrabold text-white">{item.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800 group-hover:text-primary transition-colors">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <ConfigModal
          partner={modal}
          existing={integrations[modal.key] ?? null}
          contractorId={user?.contractorId ?? ""}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </AppLayout>
  );
}
