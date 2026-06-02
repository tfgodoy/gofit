import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ChevronLeft, ChevronRight, CheckCircle2,
  MapPin, Phone, Calendar, Clock, Users, ClipboardList,
  Dumbbell, ArrowRight, AlertCircle,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

type Step = "welcome" | "modalidade" | "data" | "horario" | "dados" | "confirmacao";

interface Contractor {
  nome_fantasia: string;
  razao_social: string;
  cidade: string;
  uf: string;
  fone: string;
  logradouro: string;
  numero: string;
  bairro: string;
}

interface Modalidade {
  id: string;
  descricao: string;
  cor: string;
  icone: string;
}

interface Slot {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  capacidade_maxima: number;
  staff_nome: string | null;
  cor: string;
  vagas: number;
}

interface BookingForm {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  comoConheceu: string;
}

/* ── Helpers ────────────────────────────────────────────── */

const STEP_ORDER: Step[] = ["welcome", "modalidade", "data", "horario", "dados", "confirmacao"];

function stepIndex(s: Step) { return STEP_ORDER.indexOf(s); }

function fmtPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function fmtCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function validateCPF(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +d[10];
}

function fmtHora(h: string) {
  return h.slice(0, 5);
}

function fmtDataLong(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function getDiaSemana(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase();
}

function getDia(iso: string) {
  return new Date(iso + "T12:00:00").getDate();
}

function getMesAno(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

/* ── Progress Bar ───────────────────────────────────────── */

function ProgressBar({ step, cor }: { step: Step; cor: string }) {
  const idx = stepIndex(step);
  const total = STEP_ORDER.length - 1; // exclude confirmacao from progress
  const pct = Math.min((idx / (total - 1)) * 100, 100);
  if (step === "welcome") return null;
  return (
    <div className="h-1 w-full bg-gray-100">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: cor || "#7c3aed" }}
      />
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function BookingPage() {
  const { contractorId } = useParams<{ contractorId: string }>();

  const [step,      setStep]      = useState<Step>("welcome");
  const [loading,   setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const [contractor,     setContractor]     = useState<Contractor | null>(null);
  const [modalidades,    setModalidades]    = useState<Modalidade[]>([]);
  const [selectedMod,    setSelectedMod]    = useState<Modalidade | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);
  const [slots,          setSlots]          = useState<Slot[]>([]);
  const [selectedSlot,   setSelectedSlot]   = useState<Slot | null>(null);
  const [origens,        setOrigens]        = useState<string[]>([]);
  const [anamneseModelId, setAnamneseModelId] = useState<string | null>(null);
  const [anamneseLink,   setAnamneseLink]   = useState<string | null>(null);
  const [loadingDates,   setLoadingDates]   = useState(false);
  const [loadingSlots,   setLoadingSlots]   = useState(false);

  const [form, setForm] = useState<BookingForm>({
    nome: "", cpf: "", email: "", telefone: "", comoConheceu: "",
  });

  const cor = selectedMod?.cor || "#7c3aed";

  /* ── Load contractor + anamnese model ── */
  useEffect(() => {
    if (!contractorId) return;
    async function init() {
      setLoading(true);
      const [{ data: cData }, { data: mData }, { data: origData }] = await Promise.all([
        supabase.from("contractors")
          .select("nome_fantasia,razao_social,cidade,uf,fone,logradouro,numero,bairro")
          .eq("id", contractorId!).single(),
        supabase.from("anamnese_modelos")
          .select("id")
          .eq("contractor_id", contractorId!)
          .eq("para_aula_experimental", true)
          .maybeSingle(),
        supabase.from("crm_config")
          .select("nome")
          .eq("contractor_id", contractorId!)
          .eq("categoria", "como_conheceu")
          .eq("ativo", true)
          .order("ordem"),
      ]);
      setContractor(cData as Contractor | null);
      setAnamneseModelId(mData?.id ?? null);
      setOrigens((origData ?? []).map((o: { nome: string }) => o.nome));
      setLoading(false);
    }
    init();
  }, [contractorId]);

  /* ── Load modalidades ── */
  useEffect(() => {
    if (step !== "modalidade" || !contractorId) return;
    supabase.from("modalidades")
      .select("id,descricao,cor,icone")
      .eq("contractor_id", contractorId)
      .eq("permite_agendamento_publico", true)
      .eq("ativo", true)
      .then(({ data }) => setModalidades((data ?? []) as Modalidade[]));
  }, [step, contractorId]);

  /* ── Load available dates ── */
  useEffect(() => {
    if (!selectedMod || !contractorId) return;
    setLoadingDates(true);
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    async function fetchDates() {
      const { data: slotsData } = await supabase
        .from("schedule_slots")
        .select("id,data,capacidade_maxima")
        .eq("contractor_id", contractorId!)
        .eq("modalidade_id", selectedMod!.id)
        .neq("status", "cancelado")
        .gte("data", today)
        .lte("data", future)
        .order("data");

      if (!slotsData?.length) { setAvailableDates([]); setLoadingDates(false); return; }

      const ids = slotsData.map(s => s.id);
      const { data: occData } = await supabase
        .from("public_slot_occupancy")
        .select("slot_id,total_reservas")
        .in("slot_id", ids);

      const occMap: Record<string, number> = {};
      for (const o of (occData ?? []) as { slot_id: string; total_reservas: number }[]) {
        occMap[o.slot_id] = o.total_reservas;
      }

      const datesWithVaga = new Set<string>();
      for (const s of slotsData) {
        const ocupado = occMap[s.id] ?? 0;
        if (ocupado < s.capacidade_maxima) datesWithVaga.add(s.data);
      }
      setAvailableDates([...datesWithVaga].sort());
      setLoadingDates(false);
    }
    fetchDates();
  }, [selectedMod, contractorId]);

  /* ── Load slots for selected date ── */
  useEffect(() => {
    if (!selectedDate || !selectedMod || !contractorId) return;
    setLoadingSlots(true);

    async function fetchSlots() {
      const { data: slotsData } = await supabase
        .from("schedule_slots")
        .select("id,data,hora_inicio,hora_fim,capacidade_maxima,staff_nome,cor")
        .eq("contractor_id", contractorId!)
        .eq("modalidade_id", selectedMod!.id)
        .eq("data", selectedDate!)
        .neq("status", "cancelado")
        .order("hora_inicio");

      if (!slotsData?.length) { setSlots([]); setLoadingSlots(false); return; }

      const ids = slotsData.map(s => s.id);
      const { data: occData } = await supabase
        .from("public_slot_occupancy")
        .select("slot_id,total_reservas")
        .in("slot_id", ids);

      const occMap: Record<string, number> = {};
      for (const o of (occData ?? []) as { slot_id: string; total_reservas: number }[]) {
        occMap[o.slot_id] = o.total_reservas;
      }

      const slotsFull: Slot[] = slotsData.map(s => ({
        id:               s.id,
        data:             s.data,
        hora_inicio:      s.hora_inicio,
        hora_fim:         s.hora_fim,
        capacidade_maxima: s.capacidade_maxima,
        staff_nome:       s.staff_nome,
        cor:              s.cor || cor,
        vagas:            s.capacidade_maxima - (occMap[s.id] ?? 0),
      }));
      setSlots(slotsFull);
      setLoadingSlots(false);
    }
    fetchSlots();
  }, [selectedDate, selectedMod, contractorId]);

  /* ── Submit ── */
  async function handleSubmit() {
    if (!form.nome.trim())              { setError("Informe seu nome completo."); return; }
    if (!validateCPF(form.cpf))         { setError("CPF inválido. Verifique e tente novamente."); return; }
    if (!form.telefone || form.telefone.replace(/\D/g,"").length < 10) {
      setError("Informe um WhatsApp válido."); return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const cleanCPF   = form.cpf.replace(/\D/g, "");
      const cleanFone  = form.telefone.replace(/\D/g, "");

      /* 1 — Find or create student (lead) */
      const { data: existing } = await supabase
        .from("students")
        .select("id")
        .eq("contractor_id", contractorId!)
        .eq("cpf", cleanCPF)
        .maybeSingle();

      let studentId: string;
      if (existing) {
        studentId = existing.id;
        await supabase.from("students")
          .update({ nome_completo: form.nome.trim(), email: form.email.trim() || null, telefone: cleanFone || null })
          .eq("id", studentId);
      } else {
        const { data: newS, error: sErr } = await supabase
          .from("students")
          .insert({
            contractor_id: contractorId!,
            nome_completo: form.nome.trim(),
            cpf:           cleanCPF,
            email:         form.email.trim() || null,
            telefone:      cleanFone || null,
            status:        "lead",
          })
          .select("id").single();
        if (sErr) throw new Error("Erro ao criar cadastro.");
        studentId = newS.id;
      }

      /* 2 — Create opportunity */
      await supabase.from("opportunities").insert({
        contractor_id: contractorId!,
        student_id:    studentId,
        nome:          form.nome.trim(),
        email:         form.email.trim() || null,
        telefone:      cleanFone || null,
        etapa:         "Aula Experimental",
        origem:        form.comoConheceu || null,
        data_entrada:  new Date().toISOString().split("T")[0],
      });

      /* 3 — Create booking */
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert({
          contractor_id: contractorId!,
          slot_id:       selectedSlot!.id,
          lead_id:       studentId,
          lead_nome:     form.nome.trim(),
          tipo:          "experimental",
          status:        "reservado",
          reservado_em:  new Date().toISOString(),
        })
        .select("id").single();
      if (bErr) throw new Error("Erro ao confirmar o agendamento.");

      /* 4 — Create anamnese record */
      const token = crypto.randomUUID();
      const { data: anamRec, error: aErr } = await supabase
        .from("anamnese_respostas")
        .insert({
          contractor_id:       contractorId!,
          modelo_id:           anamneseModelId,
          student_id:          studentId,
          token,
          status:              "pendente",
          respondente_nome:    form.nome.trim(),
          respondente_email:   form.email.trim() || null,
          respondente_telefone: cleanFone || null,
        })
        .select("id").single();
      if (aErr) throw new Error("Erro ao criar ficha de saúde.");

      /* 5 — Link anamnese → booking */
      await supabase.from("bookings")
        .update({ anamnese_resposta_id: anamRec.id })
        .eq("id", booking.id);

      setAnamneseLink(`${window.location.origin}/anamnese/${token}`);
      setStep("confirmacao");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Render helpers ── */

  function Btn({ label, onClick, disabled, secondary }: {
    label: string; onClick: () => void; disabled?: boolean; secondary?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-4 rounded-2xl text-sm font-bold tracking-wide transition-all disabled:opacity-40 ${
          secondary
            ? "bg-white border-2 text-gray-700"
            : "text-white shadow-lg active:scale-95"
        }`}
        style={secondary ? { borderColor: cor, color: cor } : { backgroundColor: cor }}
      >
        {label}
      </button>
    );
  }

  /* ── Loading / error ── */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-gray-50">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600 text-center font-semibold">Academia não encontrada.<br/>Verifique o link recebido.</p>
      </div>
    );
  }

  const nome = contractor.nome_fantasia || contractor.razao_social;
  const endereco = [contractor.logradouro, contractor.numero, contractor.bairro, contractor.cidade, contractor.uf]
    .filter(Boolean).join(", ");

  /* ════════════════════════════════════════════════════════
     WELCOME
  ════════════════════════════════════════════════════════ */
  if (step === "welcome") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(160deg, ${cor}15 0%, #fff 60%)` }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
          {/* Logo placeholder */}
          <div className="w-24 h-24 rounded-3xl shadow-xl flex items-center justify-center text-white text-3xl font-black"
               style={{ backgroundColor: cor }}>
            {nome.slice(0, 2).toUpperCase()}
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black text-gray-900 mb-1">{nome}</h1>
            <div className="flex items-center justify-center gap-1 text-sm text-gray-400 mt-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{endereco}</span>
            </div>
            {contractor.fone && (
              <div className="flex items-center justify-center gap-1 text-sm text-gray-400 mt-1">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>{contractor.fone}</span>
              </div>
            )}
          </div>

          <div className="w-full max-w-sm space-y-3 text-center">
            <div className="rounded-2xl p-4 text-sm text-gray-600 space-y-1"
                 style={{ backgroundColor: `${cor}12` }}>
              <p className="font-bold text-gray-800">🏋️ Agende sua Aula Experimental</p>
              <p>Escolha a modalidade, data e horário. Leva menos de 2 minutos!</p>
            </div>

            <button
              onClick={() => setStep("modalidade")}
              className="w-full py-4 rounded-2xl text-white text-sm font-black tracking-wide shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ backgroundColor: cor }}
            >
              AGENDAR MINHA AULA
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="py-4 text-center text-xs text-gray-300">
          Powered by FitCoreSys
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     WRAPPER com header e progress
  ════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col bg-white max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {step !== "confirmacao" && (
          <button
            onClick={() => {
              const idx = stepIndex(step);
              if (idx > 0) setStep(STEP_ORDER[idx - 1]);
            }}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 truncate">{nome}</p>
          <p className="text-sm font-bold text-gray-800">Aula Experimental</p>
        </div>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black"
             style={{ backgroundColor: cor }}>
          {nome.slice(0, 2).toUpperCase()}
        </div>
      </div>
      <ProgressBar step={step} cor={cor} />

      <div className="flex-1 overflow-y-auto px-5 py-6">

        {/* ── STEP: MODALIDADE ── */}
        {step === "modalidade" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-gray-900">Escolha a modalidade</h2>
              <p className="text-sm text-gray-400 mt-1">Qual atividade você quer experimentar?</p>
            </div>
            {modalidades.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Dumbbell className="w-12 h-12 text-gray-200" />
                <p className="text-sm text-gray-400 font-semibold">Nenhuma modalidade disponível para agendamento no momento.</p>
                <p className="text-xs text-gray-300">Entre em contato com a academia para mais informações.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {modalidades.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMod(m); setSelectedDate(null); setSelectedSlot(null); setStep("data"); }}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all active:scale-95"
                    style={{ borderColor: m.cor || "#e5e7eb", backgroundColor: `${m.cor || "#7c3aed"}10` }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl"
                         style={{ backgroundColor: m.cor || "#7c3aed" }}>
                      {m.icone || <Dumbbell className="w-6 h-6" />}
                    </div>
                    <span className="text-sm font-bold text-gray-800 text-center leading-tight">{m.descricao}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: DATA ── */}
        {step === "data" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-gray-900">Escolha a data</h2>
              <p className="text-sm text-gray-400 mt-1">Próximos 30 dias com vagas disponíveis</p>
            </div>
            {loadingDates ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: cor }} />
              </div>
            ) : availableDates.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Calendar className="w-12 h-12 text-gray-200" />
                <p className="text-sm text-gray-400 font-semibold">Sem datas disponíveis nos próximos 30 dias.</p>
                <p className="text-xs text-gray-300">Entre em contato com a academia para agendar diretamente.</p>
                <div className="flex items-center gap-1 text-sm font-semibold mt-2" style={{ color: cor }}>
                  <Phone className="w-4 h-4" />
                  <span>{contractor.fone}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availableDates.map(date => (
                  <button
                    key={date}
                    onClick={() => { setSelectedDate(date); setSelectedSlot(null); setStep("horario"); }}
                    className="flex flex-col items-center py-3 px-1 rounded-2xl border-2 transition-all active:scale-95"
                    style={{ borderColor: cor, backgroundColor: `${cor}10` }}
                  >
                    <span className="text-[10px] font-bold text-gray-400">{getDiaSemana(date)}</span>
                    <span className="text-2xl font-black" style={{ color: cor }}>{getDia(date)}</span>
                    <span className="text-[10px] text-gray-400">{getMesAno(date)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: HORARIO ── */}
        {step === "horario" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-gray-900">Escolha o horário</h2>
              {selectedDate && (
                <p className="text-sm mt-1 font-semibold capitalize" style={{ color: cor }}>
                  {fmtDataLong(selectedDate)}
                </p>
              )}
            </div>
            {loadingSlots ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: cor }} />
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Clock className="w-12 h-12 text-gray-200" />
                <p className="text-sm text-gray-400 font-semibold">Sem horários disponíveis nesta data.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map(slot => {
                  const lotado = slot.vagas <= 0;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => !lotado && (setSelectedSlot(slot), setStep("dados"))}
                      disabled={lotado}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        lotado ? "opacity-40 cursor-not-allowed border-gray-100 bg-gray-50" : "active:scale-95"
                      }`}
                      style={!lotado ? { borderColor: cor, backgroundColor: `${cor}08` } : undefined}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                           style={{ backgroundColor: lotado ? "#9ca3af" : cor }}>
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900">
                          {fmtHora(slot.hora_inicio)} — {fmtHora(slot.hora_fim)}
                        </p>
                        {slot.staff_nome && (
                          <p className="text-xs text-gray-400 truncate">Prof. {slot.staff_nome}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {lotado ? (
                          <span className="text-xs font-bold text-gray-400">Turma cheia</span>
                        ) : (
                          <>
                            <p className="text-lg font-black" style={{ color: cor }}>{slot.vagas}</p>
                            <p className="text-[10px] text-gray-400">vagas</p>
                          </>
                        )}
                      </div>
                      {!lotado && <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: DADOS ── */}
        {step === "dados" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-gray-900">Seus dados</h2>
              <p className="text-sm text-gray-400 mt-1">Preencha para confirmar o agendamento</p>
            </div>

            {/* Resumo do agendamento */}
            <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: `${cor}10` }}>
              <div className="flex items-center gap-2 text-sm">
                <Dumbbell className="w-4 h-4" style={{ color: cor }} />
                <span className="font-bold text-gray-800">{selectedMod?.descricao}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" style={{ color: cor }} />
                <span className="text-gray-600 capitalize">{selectedDate && fmtDataLong(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" style={{ color: cor }} />
                <span className="text-gray-600">
                  {selectedSlot && `${fmtHora(selectedSlot.hora_inicio)} — ${fmtHora(selectedSlot.hora_fim)}`}
                  {selectedSlot?.staff_nome && ` · Prof. ${selectedSlot.staff_nome}`}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
              {[
                { label: "Nome completo *", key: "nome", type: "text", placeholder: "Seu nome completo" },
                { label: "CPF *", key: "cpf", type: "text", placeholder: "000.000.000-00" },
                { label: "WhatsApp *", key: "telefone", type: "tel", placeholder: "(00) 00000-0000" },
                { label: "E-mail", key: "email", type: "email", placeholder: "seu@email.com" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    inputMode={f.key === "cpf" || f.key === "telefone" ? "numeric" : undefined}
                    value={form[f.key as keyof BookingForm]}
                    onChange={e => {
                      const raw = e.target.value;
                      const val = f.key === "cpf" ? fmtCPF(raw)
                                : f.key === "telefone" ? fmtPhone(raw) : raw;
                      setForm(prev => ({ ...prev, [f.key]: val }));
                    }}
                    placeholder={f.placeholder}
                    className="w-full text-sm border-2 border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:border-current transition-colors"
                    style={{ "--focus-border": cor } as React.CSSProperties}
                    onFocus={e => e.target.style.borderColor = cor}
                    onBlur={e => e.target.style.borderColor = "#f3f4f6"}
                  />
                </div>
              ))}

              {origens.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Como conheceu a academia?</label>
                  <select
                    value={form.comoConheceu}
                    onChange={e => setForm(prev => ({ ...prev, comoConheceu: e.target.value }))}
                    className="w-full text-sm border-2 border-gray-100 rounded-xl px-4 py-3 focus:outline-none bg-white"
                    onFocus={e => e.target.style.borderColor = cor}
                    onBlur={e => e.target.style.borderColor = "#f3f4f6"}
                  >
                    <option value="">Selecione...</option>
                    {origens.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-2xl text-white text-sm font-black tracking-wide shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              style={{ backgroundColor: cor }}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> CONFIRMANDO...</>
                : <><CheckCircle2 className="w-4 h-4" /> CONFIRMAR AGENDAMENTO</>
              }
            </button>

            <p className="text-xs text-gray-400 text-center">
              Ao confirmar, você receberá um link para preencher sua ficha de saúde.
            </p>
          </div>
        )}

        {/* ── STEP: CONFIRMACAO ── */}
        {step === "confirmacao" && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: `${cor}20` }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: cor }} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-gray-900">Agendamento confirmado!</h2>
              <p className="text-sm text-gray-400 mt-1">Te esperamos, {form.nome.split(" ")[0]}!</p>
            </div>

            {/* Resumo */}
            <div className="w-full rounded-2xl p-5 space-y-3 text-left border-2" style={{ borderColor: `${cor}30` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                     style={{ backgroundColor: cor }}>
                  <Dumbbell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Modalidade</p>
                  <p className="text-sm font-bold text-gray-800">{selectedMod?.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                     style={{ backgroundColor: cor }}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Data</p>
                  <p className="text-sm font-bold text-gray-800 capitalize">
                    {selectedDate && fmtDataLong(selectedDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                     style={{ backgroundColor: cor }}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Horário</p>
                  <p className="text-sm font-bold text-gray-800">
                    {selectedSlot && `${fmtHora(selectedSlot.hora_inicio)} — ${fmtHora(selectedSlot.hora_fim)}`}
                    {selectedSlot?.staff_nome && ` · Prof. ${selectedSlot.staff_nome}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Anamnese CTA — destaque máximo */}
            <div className="w-full rounded-2xl p-5 space-y-4 bg-red-50 border-2 border-red-200">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-black text-red-700 text-sm">Preencha sua Ficha de Saúde</p>
                  <p className="text-xs text-red-500 mt-1">
                    <strong>Obrigatório antes da aula.</strong> Você NÃO poderá participar sem preencher a ficha de saúde.
                    O professor precisa dessas informações antes de te atender.
                  </p>
                </div>
              </div>
              {anamneseLink && (
                <a
                  href={anamneseLink}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-red-500 text-white text-sm font-black tracking-wide active:scale-95 transition-transform"
                >
                  <ClipboardList className="w-4 h-4" />
                  PREENCHER FICHA DE SAÚDE AGORA
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="text-xs text-gray-400 space-y-1">
              <p>O link da ficha de saúde também ficou salvo no seu cadastro.</p>
              <p>Qualquer dúvida, entre em contato: <strong>{contractor?.fone}</strong></p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
