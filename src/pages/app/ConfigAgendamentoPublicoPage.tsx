import { useState, useEffect } from "react";
import {
  Globe, Copy, ExternalLink, CheckCircle2, Loader2,
  Dumbbell, ClipboardList, CalendarCheck, AlertCircle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Modalidade {
  id: string;
  descricao: string;
  cor: string;
  icone: string;
  utiliza_agenda: boolean;
  permite_agendamento_publico: boolean;
  ativo: boolean;
}

export default function ConfigAgendamentoPublicoPage() {
  const { user } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState(false);
  const [stats, setStats]             = useState({ agendamentos: 0, fichasPendentes: 0 });

  const contractorId = user?.contractorId ?? "";
  const bookingUrl   = contractorId
    ? `${window.location.origin}/booking/${contractorId}`
    : "";
  const qrUrl = bookingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(bookingUrl)}&bgcolor=ffffff&color=7c3aed&margin=12`
    : "";

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);

    const [{ data: mods }, { count: agendC }, { count: pendC }] = await Promise.all([
      supabase.from("modalidades")
        .select("id, descricao, cor, icone, utiliza_agenda, permite_agendamento_publico, ativo")
        .eq("contractor_id", user.contractorId)
        .eq("ativo", true)
        .order("descricao"),

      supabase.from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", user.contractorId)
        .eq("tipo", "experimental"),

      supabase.from("anamnese_respostas")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", user.contractorId)
        .eq("status", "pendente"),
    ]);

    setModalidades((mods ?? []) as Modalidade[]);
    setStats({ agendamentos: agendC ?? 0, fichasPendentes: pendC ?? 0 });
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2500);
  }

  async function toggleModalidade(m: Modalidade) {
    const novo = !m.permite_agendamento_publico;
    const { error } = await supabase.from("modalidades")
      .update({ permite_agendamento_publico: novo })
      .eq("id", m.id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success(novo ? `${m.descricao}: agendamento habilitado.` : `${m.descricao}: agendamento desabilitado.`);
    setModalidades(prev => prev.map(x => x.id === m.id ? { ...x, permite_agendamento_publico: novo } : x));
  }

  const habilitadas = modalidades.filter(m => m.permite_agendamento_publico).length;
  const alguma      = habilitadas > 0;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Agendamento Público</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Link para leads agendarem aulas experimentais sem precisar de recepcionista.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 max-w-3xl space-y-6">

          {/* Status banner */}
          {!loading && (
            <div className={`flex items-start gap-3 rounded-xl px-5 py-4 border ${
              alguma
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              {alguma
                ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                : <AlertCircle  className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`text-sm font-bold ${alguma ? "text-green-800" : "text-amber-800"}`}>
                  {alguma
                    ? `${habilitadas} modalidade${habilitadas > 1 ? "s" : ""} com agendamento público ativo`
                    : "Nenhuma modalidade com agendamento público habilitado"
                  }
                </p>
                <p className={`text-xs mt-0.5 ${alguma ? "text-green-600" : "text-amber-600"}`}>
                  {alguma
                    ? "Leads já podem acessar o link e agendar uma aula experimental."
                    : "Habilite ao menos uma modalidade abaixo para o link funcionar."}
                </p>
              </div>
            </div>
          )}

          {/* Link card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Link de agendamento
            </h2>

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                {/* URL box */}
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <Globe className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-mono truncate flex-1">{bookingUrl}</span>
                </div>
                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={copyLink}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      copied
                        ? "bg-green-100 text-green-700"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado!" : "Copiar link"}
                  </button>
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview
                  </a>
                </div>
              </div>

              {/* QR Code */}
              {qrUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="w-28 h-28 rounded-xl border border-gray-100"
                  />
                  <p className="text-xs text-gray-400 text-center mt-1">QR Code</p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Compartilhe via WhatsApp, bio do Instagram, QR Code na recepção ou em campanhas automáticas.
            </p>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-gray-900">{stats.agendamentos}</p>
                  <p className="text-xs text-gray-400 font-semibold">Aulas agendadas</p>
                </div>
              </div>
              <div className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${
                stats.fichasPendentes > 0 ? "border-red-200 bg-red-50/30" : "border-gray-100"
              }`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  stats.fichasPendentes > 0 ? "bg-red-100" : "bg-gray-100"
                }`}>
                  <ClipboardList className={`w-5 h-5 ${stats.fichasPendentes > 0 ? "text-red-500" : "text-gray-400"}`} />
                </div>
                <div>
                  <p className={`text-2xl font-extrabold ${stats.fichasPendentes > 0 ? "text-red-600" : "text-gray-900"}`}>
                    {stats.fichasPendentes}
                  </p>
                  <p className="text-xs text-gray-400 font-semibold">Fichas pendentes</p>
                </div>
              </div>
            </div>
          )}

          {/* Modalidades toggle */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Modalidades disponíveis para agendamento
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Apenas modalidades com agenda ativa podem ser habilitadas.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : modalidades.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <Dumbbell className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-400">Nenhuma modalidade ativa cadastrada.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {modalidades.map(m => {
                  const podeHabilitar = m.utiliza_agenda;
                  return (
                    <div key={m.id} className={`flex items-center gap-4 px-6 py-4 ${!podeHabilitar ? "opacity-50" : ""}`}>
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${m.cor}22` }}
                      >
                        <Dumbbell className="w-4 h-4" style={{ color: m.cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{m.descricao}</p>
                        {!podeHabilitar && (
                          <p className="text-xs text-gray-400">Agenda não habilitada nesta modalidade</p>
                        )}
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => podeHabilitar && toggleModalidade(m)}
                        disabled={!podeHabilitar}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                          m.permite_agendamento_publico ? "bg-purple-600" : "bg-gray-200"
                        } disabled:cursor-not-allowed`}
                        title={podeHabilitar ? "" : "Habilite a agenda primeiro nas configurações da modalidade"}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          m.permite_agendamento_publico ? "translate-x-5" : "translate-x-0"
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Como usar</h2>
            <ol className="space-y-2 text-sm text-gray-600">
              {[
                "Habilite as modalidades que aceitem leads para aula experimental.",
                "Crie slots na Agenda para as datas e horários disponíveis.",
                "Compartilhe o link ou QR Code com seus leads via WhatsApp, Instagram ou site.",
                "O lead escolhe modalidade, data, horário e preenche os dados — em menos de 2 min.",
                "Você recebe uma notificação imediata no painel. O lead aparece no CRM → Aula Experimental.",
                "Antes da aula, o professor verifica se a ficha de saúde foi preenchida na Agenda.",
              ].map((txt, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{txt}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
