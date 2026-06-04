import { useState, useEffect, useRef } from "react";
import { X, Search, CheckCircle2, XCircle, UserPlus, Users, ClipboardCheck, ClipboardX, ExternalLink, MapPin, Zap, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { verificarSessoesAluno } from "@/hooks/useVerificarSessoes";

export interface SlotInfo {
  id:                         string;
  grid_id:                    string | null;
  modalidade_id?:             string | null;
  modalidade_nome:            string | null;
  staff_id?:                  string | null;
  staff_nome:                 string | null;
  unit_id?:                   string | null;
  unit_nome?:                 string | null;
  duracao_minutos?:           number | null;
  data:                       string;
  hora_inicio:                string;
  hora_fim:                   string;
  capacidade_maxima:          number;
  cor:                        string;
  status:                     string;
  observacoes?:               string | null;
  link_online?:               string | null;
}

interface GridPerms {
  permite_leads:              boolean;
  permite_clientes_especiais: boolean;
  fila_espera_ativa:          boolean;
  max_leads?:                 number | null;
  max_clientes_especiais?:    number | null;
  restricao_genero?:          string | null;
  agenda_livre?:              boolean;
}

interface GridComissao {
  comissionar_instrutor:       boolean;
  tipo_comissao:               string | null;
  valor_comissao_centavos:     number | null;
  staff_nome:                  string | null;
}

interface Booking {
  id:                   string;
  student_id:           string | null;
  student_nome:         string | null;
  lead_id:              string | null;
  lead_nome:            string | null;
  tipo:                 string;
  pessoa_tipo:          string | null;
  origem_agendamento:   string | null;
  consome_credito:      boolean | null;
  contrato_id:          string | null;
  student_contract_id:  string | null;
  credito_reposicao_id: string | null;
  status:               string;
  checkin_em:           string | null;
  cancelado_em:         string | null;
  cancelado_por:        string | null;
  cancelado_motivo:     string | null;
  anamnese_resposta_id: string | null;
}

interface AnamneseInfo {
  id:           string;
  status:       string;
  respondido_at: string | null;
  token:        string;
}

interface Student { id: string; nome_completo: string }
interface Lead    { id: string; nome: string; telefone: string | null }
interface ModalidadeOption { id: string; descricao: string; cor: string }
interface StaffOption { id: string; name: string }
interface UnitOption { id: string; nome: string }
interface ContractStudent {
  student_id:          string;
  student_nome:        string;
  contrato_id:         string;
  contrato_nome:       string;
  student_contract_id: string;
  data_fim:            string | null;
  modalidade_ok:       boolean;
  motivo_bloqueio:     string | null;
}

interface SlotHistory {
  id:                 string;
  evento:             string;
  descricao:          string;
  origem_agendamento: string | null;
  pessoa_tipo:        string | null;
  criado_por:         string | null;
  created_at:         string;
}

interface SessionUsage {
  id:             string;
  booking_id:     string;
  status_booking: string;
  quantidade:     number;
}

type ActiveTab = "ativos" | "cancelados" | "fila" | "historico";
interface SlotEditForm {
  modalidade_id: string;
  modalidade_nome: string;
  staff_id: string;
  staff_nome: string;
  unit_id: string;
  unit_nome: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: string;
  capacidade_maxima: string;
  cor: string;
  observacoes: string;
  link_online: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  reservado:    { label: "Reservado",        cls: "bg-blue-100 text-blue-700"   },
  presente:     { label: "Presente",         cls: "bg-green-100 text-green-700" },
  faltou:       { label: "Faltou",           cls: "bg-red-100 text-red-600"     },
  cancelado:    { label: "Cancelado",        cls: "bg-gray-100 text-gray-500"   },
  concluido:    { label: "Concluída",        cls: "bg-green-100 text-green-700" },
  lista_espera: { label: "Fila de espera",   cls: "bg-yellow-100 text-yellow-700" },
};

const ORIGEM_LABEL: Record<string, string> = {
  matricula: "Matrícula",
  app_aluno: "App aluno",
  contrato: "Contrato",
  reposicao: "Reposição",
  lead: "Lead",
  cliente_especial: "Cliente especial",
  aula_brinde: "Aula brinde",
  manual: "Manual",
};

function fmtDataLong(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

function diffMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function addMinutesToTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function createSlotEditForm(slot: SlotInfo): SlotEditForm {
  const horaInicio = normalizeTime(slot.hora_inicio);
  const horaFim = normalizeTime(slot.hora_fim);
  const duration = slot.duracao_minutos ?? diffMinutes(horaInicio, horaFim) ?? 50;

  return {
    modalidade_id: slot.modalidade_id ?? "",
    modalidade_nome: slot.modalidade_nome ?? "",
    staff_id: slot.staff_id ?? "",
    staff_nome: slot.staff_nome ?? "",
    unit_id: slot.unit_id ?? "",
    unit_nome: slot.unit_nome ?? "",
    data: slot.data,
    hora_inicio: horaInicio,
    duracao_minutos: String(duration),
    capacidade_maxima: String(slot.capacidade_maxima),
    cor: slot.cor,
    observacoes: slot.observacoes ?? "",
    link_online: slot.link_online ?? "",
  };
}

interface Props {
  slot:      SlotInfo;
  onClose:   () => void;
  onChanged: () => void;
}

type AddMode = "contrato" | "especial" | "lead" | null;

export default function SlotDetailModal({ slot, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [history,  setHistory]        = useState<SlotHistory[]>([]);
  const [usageMap, setUsageMap]       = useState<Record<string, SessionUsage>>({});
  const [anamneseMap, setAnamneseMap] = useState<Record<string, AnamneseInfo>>({});
  const [loading, setLoading]         = useState(true);
  const [students, setStudents]       = useState<Student[]>([]);
  const [contractStudents, setContractStudents] = useState<ContractStudent[]>([]);
  const [leads,    setLeads]          = useState<Lead[]>([]);
  const [modalidades, setModalidades] = useState<ModalidadeOption[]>([]);
  const [staffList, setStaffList]     = useState<StaffOption[]>([]);
  const [unitList, setUnitList]       = useState<UnitOption[]>([]);
  const [perms,    setPerms]          = useState<GridPerms | null>(null);
  const [gridComissao, setGridComissao] = useState<GridComissao | null>(null);
  const [addMode,  setAddMode]        = useState<AddMode>(null);
  const [search,   setSearch]         = useState("");
  const [dropOpen, setDropOpen]       = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedContractStudent, setSelectedContractStudent] = useState<ContractStudent | null>(null);
  const [selectedLead,    setSelectedLead]    = useState<Lead    | null>(null);
  const [adding,          setAdding]          = useState(false);
  const [creatingLead,    setCreatingLead]    = useState(false);
  const [newLead,         setNewLead]         = useState({ nome: "", telefone: "", email: "", origem: "" });
  const [cancelingSlot,   setCancelingSlot]   = useState(false);
  const [cancelTarget,    setCancelTarget]    = useState<Booking | null>(null);
  const [cancelMotivo,    setCancelMotivo]    = useState("");
  const [gerarReposicao,  setGerarReposicao]  = useState(true);
  const [cancelingBooking, setCancelingBooking] = useState(false);
  const [finalizando,     setFinalizando]     = useState(false);
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
  const [activeTab,       setActiveTab]       = useState<ActiveTab>("ativos");
  const [editingSlot,     setEditingSlot]     = useState(false);
  const [savingSlot,      setSavingSlot]      = useState(false);
  const [confirmCriticalEdit, setConfirmCriticalEdit] = useState(false);
  const [slotEditForm,    setSlotEditForm]    = useState<SlotEditForm>(() => createSlotEditForm(slot));
  const searchRef = useRef<HTMLDivElement>(null);

  async function loadBookings() {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id, student_id, student_nome, lead_id, lead_nome, tipo, pessoa_tipo, origem_agendamento, consome_credito, contrato_id, student_contract_id, credito_reposicao_id, status, checkin_em, cancelado_em, cancelado_por, cancelado_motivo, anamnese_resposta_id")
      .eq("slot_id", slot.id).order("created_at");
    const bks = (data ?? []) as Booking[];
    setBookings(bks);
    await loadSessionUsages(bks);

    // Carrega status das anamneses vinculadas aos bookings experimentais
    const anamIds = bks
      .filter(b => b.tipo === "experimental" && b.anamnese_resposta_id)
      .map(b => b.anamnese_resposta_id!);
    if (anamIds.length > 0) {
      const { data: aData } = await supabase
        .from("anamnese_respostas")
        .select("id, status, respondido_at, token")
        .in("id", anamIds);
      const map: Record<string, AnamneseInfo> = {};
      for (const a of (aData ?? []) as AnamneseInfo[]) map[a.id] = a;
      setAnamneseMap(map);
    } else {
      setAnamneseMap({});
    }

    setLoading(false);
  }

  async function loadSessionUsages(bks = bookings) {
    const bookingIds = bks.map(b => b.id);
    if (bookingIds.length === 0) {
      setUsageMap({});
      return;
    }

    const { data } = await supabase
      .from("schedule_session_usage")
      .select("id, booking_id, status_booking, quantidade")
      .in("booking_id", bookingIds)
      .eq("estornado", false);

    const map: Record<string, SessionUsage> = {};
    for (const usage of (data ?? []) as SessionUsage[]) map[usage.booking_id] = usage;
    setUsageMap(map);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("schedule_slot_history")
      .select("id, evento, descricao, origem_agendamento, pessoa_tipo, criado_por, created_at")
      .eq("slot_id", slot.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory((data ?? []) as SlotHistory[]);
  }

  useEffect(() => {
    setSlotEditForm(createSlotEditForm(slot));
    setEditingSlot(false);
    setConfirmCriticalEdit(false);
    loadBookings();
    loadHistory();
  }, [slot.id]);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("students").select("id, nome_completo")
      .eq("contractor_id", user.contractorId).order("nome_completo")
      .then(({ data }) => setStudents((data ?? []) as Student[]));

    Promise.all([
      supabase.from("modalidades").select("id, descricao, cor").eq("contractor_id", user.contractorId).eq("ativo", true).order("descricao"),
      supabase.from("staff").select("id, name").eq("contractor_id", user.contractorId).eq("active", true).order("name"),
      supabase.from("units").select("id, nome").eq("contractor_id", user.contractorId).eq("ativo", true).order("nome"),
    ]).then(([modalidadeRes, staffRes, unitRes]) => {
      setModalidades((modalidadeRes.data ?? []) as ModalidadeOption[]);
      setStaffList((staffRes.data ?? []) as StaffOption[]);
      setUnitList((unitRes.data ?? []) as UnitOption[]);
    });

    if (slot.grid_id) {
      supabase.from("schedule_grids")
        .select("permite_leads, permite_clientes_especiais, fila_espera_ativa, max_leads, max_clientes_especiais, comissionar_instrutor, tipo_comissao, valor_comissao_centavos, staff_nome, restricao_genero, agenda_livre")
        .eq("id", slot.grid_id).single()
        .then(({ data }) => {
          setPerms(data as GridPerms | null);
          setGridComissao(data as GridComissao | null);
        });
    }
  }, [user, slot.grid_id]);

  useEffect(() => {
    if (!user?.contractorId || addMode !== "lead") return;
    supabase.from("opportunities").select("id, nome, telefone")
      .eq("contractor_id", user.contractorId).not("etapa", "eq", "perdido").order("nome")
      .then(({ data }) => setLeads((data ?? []) as Lead[]));
  }, [user, addMode]);

  useEffect(() => {
    if (!user?.contractorId || addMode !== "contrato") return;

    async function loadContractStudents() {
      const { data: scData } = await supabase
        .from("student_contracts")
        .select("id, student_id, contrato_id, data_inicio, data_fim, status, bloqueado, motivo_bloqueio")
        .eq("contractor_id", user!.contractorId!)
        .eq("status", "ativo")
        .lte("data_inicio", slot.data)
        .or(`data_fim.is.null,data_fim.gte.${slot.data}`);

      const contracts = (scData ?? []) as {
        id: string;
        student_id: string;
        contrato_id: string;
        data_fim: string | null;
        bloqueado: boolean | null;
        motivo_bloqueio: string | null;
      }[];

      if (contracts.length === 0) {
        setContractStudents([]);
        return;
      }

      const studentIds = [...new Set(contracts.map(c => c.student_id))];
      const contratoIds = [...new Set(contracts.map(c => c.contrato_id))];

      const [{ data: studentData }, { data: contratoData }, { data: modalidadeData }] = await Promise.all([
        supabase.from("students").select("id, nome_completo").in("id", studentIds),
        supabase.from("contratos").select("id, descricao").in("id", contratoIds),
        supabase.from("contrato_modalidades").select("contrato_id, modalidade_id, nome").in("contrato_id", contratoIds),
      ]);

      const studentMap = new Map(((studentData ?? []) as Student[]).map(s => [s.id, s.nome_completo]));
      const contratoMap = new Map(((contratoData ?? []) as { id: string; descricao: string }[]).map(c => [c.id, c.descricao]));
      const modalidadesByContrato = new Map<string, { modalidade_id: string | null; nome: string | null }[]>();

      for (const mod of (modalidadeData ?? []) as { contrato_id: string; modalidade_id: string | null; nome: string | null }[]) {
        const arr = modalidadesByContrato.get(mod.contrato_id) ?? [];
        arr.push({ modalidade_id: mod.modalidade_id, nome: mod.nome });
        modalidadesByContrato.set(mod.contrato_id, arr);
      }

      const eligible = contracts.map(sc => {
        const mods = modalidadesByContrato.get(sc.contrato_id) ?? [];
        const hasModalidadeRules = mods.length > 0;
        const modalidadeOk = !hasModalidadeRules || mods.some(mod => {
          if (slot.modalidade_id && mod.modalidade_id === slot.modalidade_id) return true;
          if (!slot.modalidade_nome || !mod.nome) return false;
          return mod.nome.trim().toLowerCase() === slot.modalidade_nome.trim().toLowerCase();
        });

        return {
          student_id: sc.student_id,
          student_nome: studentMap.get(sc.student_id) ?? "Aluno sem nome",
          contrato_id: sc.contrato_id,
          contrato_nome: contratoMap.get(sc.contrato_id) ?? "Contrato",
          student_contract_id: sc.id,
          data_fim: sc.data_fim,
          modalidade_ok: modalidadeOk,
          motivo_bloqueio: sc.bloqueado ? (sc.motivo_bloqueio ?? "Contrato bloqueado") : null,
        };
      }).sort((a, b) => a.student_nome.localeCompare(b.student_nome, "pt-BR"));

      setContractStudents(eligible);
    }

    loadContractStudents();
  }, [user, addMode, slot.data, slot.modalidade_id, slot.modalidade_nome]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function resetAdd() {
    setAddMode(null); setSearch(""); setDropOpen(false);
    setSelectedStudent(null); setSelectedContractStudent(null); setSelectedLead(null);
    setCreatingLead(false);
    setNewLead({ nome: "", telefone: "", email: "", origem: "" });
  }

  function openSlotEdit() {
    setSlotEditForm(createSlotEditForm(slot));
    setConfirmCriticalEdit(false);
    setEditingSlot(true);
  }

  function setSlotEditField<K extends keyof SlotEditForm>(key: K, value: SlotEditForm[K]) {
    setConfirmCriticalEdit(false);
    setSlotEditForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveSlotEdit(forceCritical = false) {
    if (!user?.contractorId) return;

    const duracao = parseInt(slotEditForm.duracao_minutos, 10);
    const capacidade = parseInt(slotEditForm.capacidade_maxima, 10);
    const horaInicio = normalizeTime(slotEditForm.hora_inicio);

    if (!slotEditForm.data || !horaInicio) {
      toast.error("Informe data e horário de início.");
      return;
    }
    if (!Number.isFinite(duracao) || duracao <= 0) {
      toast.error("Informe uma duração válida.");
      return;
    }
    if (!Number.isFinite(capacidade) || capacidade <= 0) {
      toast.error("Informe uma capacidade válida.");
      return;
    }
    if (capacidade < activeBookings.length) {
      toast.error(`A capacidade não pode ficar abaixo de ${activeBookings.length} reserva(s) ativa(s).`);
      return;
    }

    const horaFim = addMinutesToTime(horaInicio, duracao);
    const payload = {
      modalidade_id: slotEditForm.modalidade_id || null,
      modalidade_nome: slotEditForm.modalidade_nome.trim() || null,
      staff_id: slotEditForm.staff_id || null,
      staff_nome: slotEditForm.staff_nome.trim() || null,
      unit_id: slotEditForm.unit_id || null,
      unit_nome: slotEditForm.unit_nome.trim() || null,
      data: slotEditForm.data,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      capacidade_maxima: capacidade,
      cor: isHexColor(slotEditForm.cor) ? slotEditForm.cor : "#22c55e",
      observacoes: slotEditForm.observacoes.trim() || null,
      link_online: slotEditForm.link_online.trim() || null,
    };

    const changes: Record<string, { label: string; de: string | number | null; para: string | number | null }> = {};
    const addChange = (field: string, label: string, de: string | number | null | undefined, para: string | number | null | undefined) => {
      const before = de ?? null;
      const after = para ?? null;
      if (before !== after) changes[field] = { label, de: before, para: after };
    };

    addChange("modalidade_id", "modalidade", slot.modalidade_id ?? null, payload.modalidade_id);
    addChange("modalidade_nome", "nome da modalidade", slot.modalidade_nome ?? null, payload.modalidade_nome);
    addChange("staff_id", "professor", slot.staff_id ?? null, payload.staff_id);
    addChange("staff_nome", "nome do professor", slot.staff_nome ?? null, payload.staff_nome);
    addChange("unit_id", "local/sala", slot.unit_id ?? null, payload.unit_id);
    addChange("unit_nome", "nome do local/sala", slot.unit_nome ?? null, payload.unit_nome);
    addChange("data", "data", slot.data, payload.data);
    addChange("hora_inicio", "horário de início", normalizeTime(slot.hora_inicio), payload.hora_inicio);
    addChange("hora_fim", "horário de término", normalizeTime(slot.hora_fim), payload.hora_fim);
    addChange("capacidade_maxima", "capacidade", slot.capacidade_maxima, payload.capacidade_maxima);
    addChange("cor", "cor", slot.cor, payload.cor);
    addChange("observacoes", "descrição", slot.observacoes ?? null, payload.observacoes);
    addChange("link_online", "link online", slot.link_online ?? null, payload.link_online);

    if (Object.keys(changes).length === 0) {
      toast.success("Nenhuma alteração para salvar.");
      setEditingSlot(false);
      return;
    }

    const criticalFields = ["modalidade_id", "staff_id", "unit_id", "data", "hora_inicio", "hora_fim", "capacidade_maxima"];
    const hasCriticalChange = criticalFields.some(field => changes[field]);
    if (activeBookings.length > 0 && hasCriticalChange && !forceCritical) {
      setConfirmCriticalEdit(true);
      return;
    }

    setSavingSlot(true);
    const { error } = await supabase
      .from("schedule_slots")
      .update(payload)
      .eq("id", slot.id);

    if (error) {
      setSavingSlot(false);
      toast.error("Erro ao alterar a aula.");
      return;
    }

    await logHistory({
      evento: "aula_alterada",
      descricao: "Aula alterada somente neste horário.",
      dados: {
        alteracao_pontual: true,
        grid_id: slot.grid_id,
        campos: Object.values(changes).map(change => change.label),
        alteracoes: changes,
      },
    });

    setSavingSlot(false);
    setEditingSlot(false);
    setConfirmCriticalEdit(false);
    toast.success("Aula atualizada somente neste horário.");
    onChanged();
    onClose();
  }

  async function handleCreateLead() {
    if (!user?.contractorId) return;
    if (!newLead.nome.trim()) {
      toast.error("Informe o nome do lead.");
      return;
    }

    setCreatingLead(true);
    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        contractor_id: user.contractorId,
        nome: newLead.nome.trim(),
        telefone: newLead.telefone.trim() || null,
        email: newLead.email.trim() || null,
        origem: newLead.origem.trim() || "Agenda",
        etapa: "Visita agendada",
        modalidade_id: slot.modalidade_id ?? null,
        data_entrada: new Date().toISOString().split("T")[0],
        data_prevista: slot.data,
        observacoes: `Lead cadastrado pela agenda para ${slot.modalidade_nome ?? "aula"} às ${slot.hora_inicio.slice(0, 5)}.`,
      })
      .select("id, nome, telefone")
      .single();

    setCreatingLead(false);
    if (error || !data) {
      toast.error("Erro ao criar lead.");
      return;
    }

    const created = data as Lead;
    setLeads(prev => [created, ...prev]);
    setSelectedLead(created);
    setSearch("");
    setDropOpen(false);
    setNewLead({ nome: "", telefone: "", email: "", origem: "" });
    toast.success("Lead criado. Clique em Adicionar para colocá-lo na aula.");
  }

  async function logHistory(params: {
    booking?: Booking | null;
    bookingId?: string | null;
    evento: string;
    descricao: string;
    origem_agendamento?: string | null;
    pessoa_tipo?: string | null;
    student_id?: string | null;
    lead_id?: string | null;
    dados?: Record<string, unknown>;
  }) {
    if (!user?.contractorId) return;
    await supabase.from("schedule_slot_history").insert({
      contractor_id:      user.contractorId,
      slot_id:            slot.id,
      booking_id:         params.bookingId ?? params.booking?.id ?? null,
      student_id:         params.student_id ?? params.booking?.student_id ?? null,
      lead_id:            params.lead_id ?? params.booking?.lead_id ?? null,
      evento:             params.evento,
      descricao:          params.descricao,
      origem_agendamento: params.origem_agendamento ?? params.booking?.origem_agendamento ?? null,
      pessoa_tipo:        params.pessoa_tipo ?? params.booking?.pessoa_tipo ?? null,
      dados:              params.dados ?? {},
      criado_por:         user.email ?? user.name ?? "sistema",
    } as any);
  }

  async function handleMarkStatus(bookingId: string, status: "presente" | "faltou") {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const update = status === "presente"
      ? { status, checkin_em: new Date().toISOString() }
      : { status };
    const { error } = await supabase.from("bookings").update(update).eq("id", bookingId);
    if (error) { toast.error("Erro ao atualizar."); return; }

    const usageOk = await recordSessionUsage(booking, status);
    if (!usageOk) {
      await supabase
        .from("bookings")
        .update({ status: booking.status, checkin_em: booking.checkin_em })
        .eq("id", bookingId);
      toast.error("A presenca/falta nao foi salva porque o consumo da sessao falhou.");
      loadBookings(); loadHistory(); onChanged();
      return;
    }

    await logHistory({
      booking,
      evento: status === "presente" ? "presenca_marcada" : "falta_marcada",
      descricao: `${booking?.student_nome ?? booking?.lead_nome ?? "Pessoa"} marcado como ${status === "presente" ? "presente" : "falta"}.`,
      dados: { status_anterior: booking?.status ?? null, status_novo: status },
    });
    toast.success(status === "presente" ? "Presença confirmada." : "Falta registrada.");
    loadBookings(); loadHistory(); onChanged();
  }

  async function handleUndoStatus(bookingId: string) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const reversed = await reverseSessionUsage(booking);
    if (!reversed) {
      toast.error("Nao foi possivel estornar a sessao consumida.");
      return;
    }

    await supabase.from("bookings").update({ status: "reservado", checkin_em: null }).eq("id", bookingId);
    await logHistory({
      booking,
      evento: "status_desfeito",
      descricao: `${booking?.student_nome ?? booking?.lead_nome ?? "Pessoa"} voltou para reservado.`,
      dados: { status_anterior: booking?.status ?? null, status_novo: "reservado" },
    });
    loadBookings(); loadHistory(); onChanged();
  }

  function shouldConsumeSession(booking: Booking) {
    return !!(
      booking.student_id &&
      booking.student_contract_id &&
      booking.consome_credito !== false &&
      booking.pessoa_tipo !== "lead" &&
      booking.pessoa_tipo !== "cliente_especial" &&
      booking.origem_agendamento !== "lead" &&
      booking.origem_agendamento !== "cliente_especial"
    );
  }

  async function recordSessionUsage(booking: Booking, status: "presente" | "faltou") {
    if (!user?.contractorId || !shouldConsumeSession(booking)) return true;

    const operator = user.email ?? user.name ?? "sistema";
    const existing = usageMap[booking.id];
    const tipoConsumo = booking.origem_agendamento === "reposicao" ? "reposicao" : "aula";
    const payload = {
      status_booking: status,
      tipo_consumo: tipoConsumo,
      quantidade: 1,
      motivo: status === "presente" ? "Presenca marcada na agenda" : "Falta marcada na agenda",
      criado_por: operator,
    };

    if (existing) {
      const { error } = await supabase
        .from("schedule_session_usage")
        .update(payload)
        .eq("id", existing.id);
      return !error;
    }

    const { error } = await supabase.from("schedule_session_usage").insert({
      contractor_id: user.contractorId,
      booking_id: booking.id,
      slot_id: slot.id,
      student_id: booking.student_id!,
      student_nome: booking.student_nome,
      contrato_id: booking.contrato_id,
      student_contract_id: booking.student_contract_id,
      modalidade_id: slot.modalidade_id ?? null,
      modalidade_nome: slot.modalidade_nome ?? null,
      origem_agendamento: booking.origem_agendamento,
      ...payload,
    });

    return !error;
  }

  async function reverseSessionUsage(booking: Booking) {
    if (!user?.contractorId || !shouldConsumeSession(booking)) return true;

    const activeUsage = usageMap[booking.id];
    if (!activeUsage) return true;

    const { error } = await supabase
      .from("schedule_session_usage")
      .update({
        estornado: true,
        estornado_em: new Date().toISOString(),
        estornado_por: user.email ?? user.name ?? "sistema",
        motivo_estorno: "Status da agenda desfeito",
      })
      .eq("id", activeUsage.id);

    return !error;
  }

  function openCancelBooking(booking: Booking) {
    setCancelTarget(booking);
    setCancelMotivo("");
    setGerarReposicao(canGenerateReplacement(booking));
  }

  function canGenerateReplacement(booking: Booking) {
    return !!(
      booking.student_id &&
      booking.student_contract_id &&
      booking.consome_credito !== false &&
      booking.origem_agendamento === "contrato" &&
      booking.status === "reservado" &&
      !booking.credito_reposicao_id
    );
  }

  async function handleCancelBooking() {
    if (!user?.contractorId || !cancelTarget) return;

    setCancelingBooking(true);
    const now = new Date().toISOString();
    const operator = user.email ?? user.name ?? "sistema";
    const motivo = cancelMotivo.trim() || "Cancelamento manual pela agenda";
    let replacementId: string | null = null;

    if (gerarReposicao && canGenerateReplacement(cancelTarget)) {
      const validade = new Date(slot.data + "T12:00:00");
      validade.setDate(validade.getDate() + 30);

      const { data: credit, error: creditError } = await supabase
        .from("schedule_replacement_credits")
        .insert({
          contractor_id: user.contractorId,
          student_id: cancelTarget.student_id!,
          student_nome: cancelTarget.student_nome,
          contrato_id: cancelTarget.contrato_id,
          student_contract_id: cancelTarget.student_contract_id,
          original_slot_id: slot.id,
          original_booking_id: cancelTarget.id,
          modalidade_id: slot.modalidade_id ?? null,
          modalidade_nome: slot.modalidade_nome ?? null,
          status: "disponivel",
          motivo,
          gerado_por: operator,
          validade: validade.toISOString().split("T")[0],
          observacoes: `Gerado pelo cancelamento da aula de ${slot.data} às ${slot.hora_inicio.slice(0, 5)}.`,
        })
        .select("id")
        .single();

      if (creditError || !credit) {
        setCancelingBooking(false);
        toast.error("Erro ao gerar crédito de reposição.");
        return;
      }

      replacementId = credit.id;
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelado",
        cancelado_em: now,
        cancelado_por: operator,
        cancelado_motivo: motivo,
        credito_reposicao_id: replacementId,
      })
      .eq("id", cancelTarget.id);

    setCancelingBooking(false);
    if (error) {
      if (replacementId) {
        await supabase
          .from("schedule_replacement_credits")
          .update({ status: "cancelado", observacoes: "Cancelado automaticamente porque o booking nao foi atualizado." })
          .eq("id", replacementId);
      }
      toast.error("Erro ao cancelar participação.");
      return;
    }

    await logHistory({
      booking: cancelTarget,
      evento: replacementId ? "pessoa_cancelada_com_reposicao" : "pessoa_cancelada",
      descricao: `${cancelTarget.student_nome ?? cancelTarget.lead_nome ?? "Pessoa"} cancelado/desistente na aula.`,
      dados: {
        motivo,
        status_anterior: cancelTarget.status,
        status_novo: "cancelado",
        credito_reposicao_id: replacementId,
      },
    });

    toast.success(replacementId ? "Cancelado e crédito de reposição gerado." : "Participação cancelada.");
    setCancelTarget(null);
    setCancelMotivo("");
    loadBookings();
    loadHistory();
    onChanged();
  }

  async function handlePromoteFromWaitlist(booking: Booking) {
    if (!user?.contractorId) return;

    const currentActive = bookings.filter(b => b.status !== "cancelado" && b.status !== "lista_espera").length;
    if (currentActive >= slot.capacidade_maxima) {
      toast.error("A aula ainda está lotada. Libere uma vaga antes de mover da fila.");
      return;
    }

    const isLeadBooking = booking.tipo === "lead" || booking.tipo === "experimental";
    if (isLeadBooking && perms?.max_leads) {
      const activeLeads = bookings.filter(b =>
        b.id !== booking.id &&
        b.status !== "cancelado" &&
        b.status !== "lista_espera" &&
        (b.tipo === "lead" || b.tipo === "experimental")
      ).length;
      if (activeLeads >= perms.max_leads) {
        toast.error(`Limite atingido: máximo de ${perms.max_leads} leads nesta aula.`);
        return;
      }
    }

    if (booking.tipo === "especial" && perms?.max_clientes_especiais) {
      const activeSpecials = bookings.filter(b =>
        b.id !== booking.id &&
        b.status !== "cancelado" &&
        b.status !== "lista_espera" &&
        b.tipo === "especial"
      ).length;
      if (activeSpecials >= perms.max_clientes_especiais) {
        toast.error(`Limite atingido: máximo de ${perms.max_clientes_especiais} clientes especiais.`);
        return;
      }
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "reservado" })
      .eq("id", booking.id);

    if (error) {
      toast.error("Erro ao mover da fila.");
      return;
    }

    await logHistory({
      booking,
      evento: "fila_movida_para_aula",
      descricao: `${booking.student_nome ?? booking.lead_nome ?? "Pessoa"} saiu da fila de espera e entrou na aula.`,
      dados: { status_anterior: "lista_espera", status_novo: "reservado" },
    });

    toast.success("Movido da fila para a aula.");
    setActiveTab("ativos");
    loadBookings();
    loadHistory();
    onChanged();
  }

  async function handleAddBooking() {
    if (!user?.contractorId) return;
    const activeCount = bookings.filter(b => b.status !== "lista_espera" && b.status !== "cancelado").length;
    const useFila = perms?.fila_espera_ativa && activeCount >= slot.capacidade_maxima;
    const status = useFila ? "lista_espera" : "reservado";

    setAdding(true);
    let insertPayload: Record<string, unknown>;

    if (addMode === "contrato" && selectedContractStudent) {
      if (selectedContractStudent.motivo_bloqueio) {
        toast.error(selectedContractStudent.motivo_bloqueio);
        setAdding(false);
        return;
      }

      if (!selectedContractStudent.modalidade_ok) {
        toast.error("O contrato deste aluno não libera esta modalidade.");
        setAdding(false);
        return;
      }

      // Verificar limite de sessões
      const resultado = await verificarSessoesAluno(
        user.contractorId,
        selectedContractStudent.student_id,
        selectedContractStudent.student_contract_id,
        slot.modalidade_id ?? undefined,
        slot.data
      );

      if (!resultado.permitido) {
        // Mostrar aviso mas permitir que recepcionista force a entrada
        const forcaInclusao = await new Promise<boolean>(resolve => {
          toast.error(
            <div className="flex flex-col gap-2">
              <p>{resultado.motivo}</p>
              <p className="text-xs text-gray-200">Sessões usadas: {resultado.sessoes_usadas}/{resultado.sessoes_limite}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { resolve(true); toast.dismiss(); }}
                  className="text-xs font-semibold px-2 py-1 rounded bg-primary text-white"
                >
                  Incluir mesmo assim
                </button>
                <button
                  onClick={() => { resolve(false); toast.dismiss(); }}
                  className="text-xs font-semibold px-2 py-1 rounded bg-gray-600 text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>,
            { duration: 10000 }
          );
        });

        if (!forcaInclusao) {
          setAdding(false);
          return;
        }
      }

      if (perms?.restricao_genero) {
        const { data: studentData } = await supabase
          .from("students")
          .select("sexo")
          .eq("id", selectedContractStudent.student_id)
          .single();

        const sexoAluno = studentData?.sexo;

        if (sexoAluno && sexoAluno !== perms.restricao_genero) {
          const label = perms.restricao_genero === "feminino" ? "feminino" : "masculino";
          toast.error(`Esta grade é restrita ao público ${label}.`);
          setAdding(false);
          return;
        }
      }

      insertPayload = {
        contractor_id: user.contractorId!,
        slot_id:       slot.id,
        student_id:    selectedContractStudent.student_id,
        student_nome:  selectedContractStudent.student_nome,
        tipo:          "aluno",
        pessoa_tipo:   "cliente",
        origem_agendamento: "contrato",
        consome_credito: !(perms?.agenda_livre ?? false),
        contrato_id: selectedContractStudent.contrato_id,
        student_contract_id: selectedContractStudent.student_contract_id,
        status,
        descontou_contrato: !(perms?.agenda_livre ?? false),
        criado_por: user.email ?? user.name ?? "sistema",
      };
    } else if (addMode === "especial" && selectedStudent) {
      if (perms?.max_clientes_especiais) {
        const countEspeciais = bookings.filter(b => b.tipo === "especial" && b.status !== "cancelado").length;
        if (countEspeciais >= perms.max_clientes_especiais) {
          toast.error(`Limite atingido: máximo de ${perms.max_clientes_especiais} clientes especiais.`);
          setAdding(false);
          return;
        }
      }

      if (perms?.restricao_genero) {
        const { data: studentData } = await supabase
          .from("students")
          .select("sexo")
          .eq("id", selectedStudent.id)
          .single();

        const sexoAluno = studentData?.sexo;

        if (sexoAluno && sexoAluno !== perms.restricao_genero) {
          const label = perms.restricao_genero === "feminino" ? "feminino" : "masculino";
          toast.error(`Esta grade é restrita ao público ${label}.`);
          setAdding(false);
          return;
        }
      }

      insertPayload = {
        contractor_id: user.contractorId!,
        slot_id:       slot.id,
        student_id:    selectedStudent.id,
        student_nome:  selectedStudent.nome_completo,
        tipo:          "especial",
        pessoa_tipo:   "cliente_especial",
        origem_agendamento: "cliente_especial",
        consome_credito: false,
        status,
        descontou_contrato: false,
        criado_por: user.email ?? user.name ?? "sistema",
      };
    } else if (addMode === "lead" && selectedLead) {
      if (perms?.max_leads) {
        const countLeads = bookings.filter(b => b.tipo === "lead" && b.status !== "cancelado").length;
        if (countLeads >= perms.max_leads) {
          toast.error(`Limite atingido: máximo de ${perms.max_leads} leads nesta aula.`);
          setAdding(false);
          return;
        }
      }

      insertPayload = {
        contractor_id: user.contractorId!,
        slot_id:       slot.id,
        lead_id:       selectedLead.id,
        lead_nome:     selectedLead.nome,
        tipo:          "lead",
        pessoa_tipo:   "lead",
        origem_agendamento: "lead",
        consome_credito: false,
        status,
        descontou_contrato: false,
        criado_por: user.email ?? user.name ?? "sistema",
      };
    } else {
      toast.error("Selecione uma pessoa para adicionar."); setAdding(false); return;
    }

    const { data: inserted, error } = await supabase.from("bookings").insert(insertPayload as any).select("id").single();
    setAdding(false);
    if (error) {
      if (error.code === "23505") toast.error("Já está nesta aula.");
      else toast.error("Erro ao adicionar.");
      return;
    }
    await logHistory({
      bookingId: inserted?.id ?? null,
      evento: "pessoa_adicionada",
      descricao: `${addMode === "lead" ? selectedLead?.nome : addMode === "contrato" ? selectedContractStudent?.student_nome : selectedStudent?.nome_completo} adicionado à aula${addMode === "especial" ? " como cliente especial" : ""}${status === "lista_espera" ? " na fila de espera" : ""}.`,
      origem_agendamento: (insertPayload.origem_agendamento as string) ?? null,
      pessoa_tipo: (insertPayload.pessoa_tipo as string) ?? null,
      student_id: (insertPayload.student_id as string) ?? null,
      lead_id: (insertPayload.lead_id as string) ?? null,
      dados: {
        status,
        tipo: insertPayload.tipo,
        consome_credito: insertPayload.consome_credito,
        contrato_id: insertPayload.contrato_id ?? null,
        student_contract_id: insertPayload.student_contract_id ?? null,
      },
    });
    toast.success(status === "lista_espera" ? "Adicionado na fila de espera." : "Adicionado com sucesso.");
    resetAdd(); loadBookings(); loadHistory(); onChanged();
  }

  async function handleCancelSlot() {
    await supabase.from("schedule_slots").update({ status: "cancelado" }).eq("id", slot.id);
    await logHistory({
      evento: "aula_cancelada",
      descricao: "Aula cancelada.",
      dados: { status_anterior: slot.status, status_novo: "cancelado" },
    });
    loadHistory();
    toast.success("Aula cancelada.");
    setCancelingSlot(false); onClose(); onChanged();
  }

  async function handleFinalizarAula() {
    setFinalizando(true);
    try {
      const { error: errSlot } = await supabase
        .from("schedule_slots")
        .update({ status: "concluido" })
        .eq("id", slot.id);

      if (errSlot) {
        toast.error("Erro ao finalizar aula.");
        return;
      }

      await logHistory({
        evento: "aula_concluida",
        descricao: "Aula concluída.",
        dados: { status_anterior: slot.status, status_novo: "concluido" },
      });
      loadHistory();

      const { data: result, error: errComissao } = await supabase
        .rpc("calcular_comissao_aula", { p_slot_id: slot.id });

      if (errComissao) {
        toast.success("Aula finalizada.");
        toast.error("Erro ao calcular comissão: " + errComissao.message);
      } else if (result && typeof result === "object" && "gerou" in result && result.gerou) {
        const valor = typeof result.valor === "number"
          ? result.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "R$ 0,00";
        const instrutor = typeof result.staff_nome === "string" ? result.staff_nome : "instrutor";
        toast.success(`Aula finalizada! Comissão de ${valor} gerada para ${instrutor}.`);
      } else {
        const motivo = result && typeof result === "object" && "motivo" in result && typeof result.motivo === "string"
          ? result.motivo
          : null;
        toast.success(motivo ? `Aula finalizada. ${motivo}.` : "Aula finalizada.");
      }

      setConfirmarFinalizar(false);
      onClose();
      onChanged();
    } finally {
      setFinalizando(false);
    }
  }

  const filteredStudents = search
    ? students.filter(s => s.nome_completo.toLowerCase().includes(search.toLowerCase()))
    : students;
  const filteredContractStudents = search
    ? contractStudents.filter(s =>
        `${s.student_nome} ${s.contrato_nome}`.toLowerCase().includes(search.toLowerCase())
      )
    : contractStudents;
  const filteredLeads = search
    ? leads.filter(l => l.nome.toLowerCase().includes(search.toLowerCase()))
    : leads;

  const activeBookings = bookings.filter(b => b.status !== "cancelado" && b.status !== "lista_espera");
  const canceledBookings = bookings.filter(b => b.status === "cancelado");
  const waitlistBookings = bookings.filter(b => b.status === "lista_espera");
  const presentCount = activeBookings.filter(b => b.status === "presente").length;
  const isCanceled   = slot.status === "cancelado";
  const isConcluido  = slot.status === "concluido";
  const duration      = slot.duracao_minutos ?? diffMinutes(slot.hora_inicio, slot.hora_fim);
  const leadCount     = activeBookings.filter(b => b.tipo === "lead" || b.tipo === "experimental").length;
  const podeFinalizarAula = slot.status === "agendado" || slot.status === "em_andamento";

  function initials(name: string | null) {
    return (name ?? "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  const canAddLeads = perms?.permite_leads ?? false;

  function fmtDateTime(value: string) {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderBookingRow(b: Booking, mode: "ativos" | "cancelados" | "fila") {
    const nome = b.tipo === "lead" || b.tipo === "experimental"
      ? (b.lead_nome ?? "Lead")
      : (b.student_nome ?? "—");
    const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.reservado;
    const canMark = mode === "ativos" && !isCanceled && b.status === "reservado";
    const hasMark = mode === "ativos" && !isCanceled && (b.status === "presente" || b.status === "faltou");
    const isLeadLike = b.tipo === "lead" || b.tipo === "experimental";
    const isSpecial = b.tipo === "especial" || b.pessoa_tipo === "cliente_especial";
    const usage = usageMap[b.id];
    const anam = b.tipo === "experimental" && b.anamnese_resposta_id ? anamneseMap[b.anamnese_resposta_id] : null;
    const preenchida = !!anam?.respondido_at;
    const anamLink = anam ? `${window.location.origin}/anamnese/${anam.token}` : null;

    return (
      <div key={b.id} className={`flex items-center gap-3 px-6 py-3 ${b.tipo === "experimental" && !preenchida ? "bg-red-50/40" : ""}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isLeadLike ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"}`}>
          {initials(nome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
          <p className={`text-xs ${isLeadLike ? "text-orange-500" : "text-gray-400"}`}>
            {isSpecial ? "Cliente especial" : b.tipo === "experimental" ? "Aula experimental" : ORIGEM_LABEL[b.origem_agendamento ?? ""] ?? (isLeadLike ? "Lead" : "Manual")}
            {b.origem_agendamento === "contrato" && b.student_contract_id && <span> · contrato vinculado</span>}
            {b.credito_reposicao_id && <span className="text-blue-600"> · reposição gerada</span>}
            {b.consome_credito === false && <span className="text-emerald-600"> · não consome crédito</span>}
            {usage && <span className="text-indigo-600"> · sessão consumida</span>}
          </p>
          {mode === "cancelados" && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {b.cancelado_em ? fmtDateTime(b.cancelado_em) : "Cancelado"}
              {b.cancelado_por && <span> · {b.cancelado_por}</span>}
              {b.cancelado_motivo && <span> · {b.cancelado_motivo}</span>}
            </p>
          )}
        </div>
        {b.tipo === "experimental" && (
          anam ? (
            preenchida ? (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
                <ClipboardCheck className="w-3 h-3" /> Ficha OK
              </span>
            ) : anamLink ? (
              <a href={anamLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0 hover:bg-red-200 transition-colors"
                title="Abrir ficha de saúde">
                <ClipboardX className="w-3 h-3" /> Ficha pendente <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <ClipboardX className="w-3 h-3" /> Ficha pendente
              </span>
            )
          ) : (
            <span className="text-xs text-gray-400 flex-shrink-0">Sem ficha</span>
          )
        )}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
        {!isCanceled && mode !== "cancelados" && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {mode === "fila" && (
              <button onClick={() => handlePromoteFromWaitlist(b)}
                className="text-xs font-semibold text-primary hover:underline px-1">
                mover
              </button>
            )}
            {canMark && (
              <>
                <button onClick={() => handleMarkStatus(b.id, "presente")} title="Marcar presente"
                  className="p-1 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleMarkStatus(b.id, "faltou")} title="Marcar falta"
                  className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            {hasMark && (
              <button onClick={() => handleUndoStatus(b.id)}
                className="text-xs text-gray-400 hover:text-primary hover:underline px-1">
                desfazer
              </button>
            )}
            {b.status !== "presente" && b.status !== "faltou" && (
              <button onClick={() => openCancelBooking(b)} title="Cancelar participação"
                className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: slot.cor }} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{slot.modalidade_nome ?? "Aula"}</p>
            {perms?.agenda_livre && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 mt-1">
                <Zap className="w-3 h-3" /> Agenda livre
              </span>
            )}
            <p className="text-sm text-gray-500">
              {fmtDataLong(slot.data)} · {slot.hora_inicio.slice(0, 5)}–{slot.hora_fim.slice(0, 5)}
              {duration && <span className="text-gray-400 ml-1">({duration} min)</span>}
            </p>
            {slot.unit_nome && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {slot.unit_nome}
              </p>
            )}
            {slot.staff_nome && <p className="text-xs text-gray-400 mt-0.5">{slot.staff_nome}</p>}
            {slot.link_online && (
              <a
                href={slot.link_online}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary font-semibold inline-flex items-center gap-1 mt-1 hover:underline"
              >
                Link online <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isCanceled && !isConcluido && (
              <button
                onClick={openSlotEdit}
                title="Alterar somente esta aula"
                className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-5 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-sm flex-shrink-0">
          <span className="text-gray-600">
            <span className="font-bold text-gray-900">{activeBookings.length}</span>
            <span className="text-gray-400">/{slot.capacidade_maxima}</span>
            {" "}reservados
          </span>
          <span className="text-gray-600">
            <span className="font-bold text-green-600">{presentCount}</span> presentes
          </span>
          {waitlistBookings.length > 0 && (
            <span className="text-yellow-600 font-medium text-xs">
              {waitlistBookings.length} na fila
            </span>
          )}
          {perms?.max_leads && (
            <span className="text-orange-600 font-medium text-xs">
              {leadCount}/{perms.max_leads} leads
            </span>
          )}
          {isCanceled && (
            <span className="ml-auto text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Cancelada</span>
          )}
          {isConcluido && (
            <span className="ml-auto text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Concluída</span>
          )}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 border-b border-gray-100 flex-shrink-0">
          {[
            { key: "ativos" as const, label: "Clientes / Leads", count: activeBookings.length },
            { key: "cancelados" as const, label: "Cancelados", count: canceledBookings.length },
            { key: "fila" as const, label: "Fila", count: waitlistBookings.length },
            { key: "historico" as const, label: "Histórico", count: history.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2 py-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="truncate block">{tab.label}</span>
              <span className="text-[11px] font-semibold opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Booking list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === "ativos" && activeBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-sm text-gray-400">Nenhum aluno reservado ainda.</p>
            </div>
          ) : activeTab === "ativos" ? (
            activeBookings.map(b => renderBookingRow(b, "ativos"))
          ) : activeTab === "cancelados" && canceledBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-sm text-gray-400">Nenhum cancelado ou desistente nesta aula.</p>
            </div>
          ) : activeTab === "cancelados" ? (
            canceledBookings.map(b => renderBookingRow(b, "cancelados"))
          ) : activeTab === "fila" && waitlistBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-sm text-gray-400">Não há clientes na fila de espera.</p>
            </div>
          ) : activeTab === "fila" ? (
            <>
              <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-100">
                <p className="text-xs font-medium text-yellow-800">
                  Mova uma pessoa da fila para a aula somente quando houver vaga disponível.
                </p>
              </div>
              {waitlistBookings.map(b => renderBookingRow(b, "fila"))}
            </>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-sm text-gray-400">Nenhum histórico registrado ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map(item => (
                <div key={item.id} className="px-6 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmtDateTime(item.created_at)}
                        {item.criado_por && <span> · {item.criado_por}</span>}
                        {item.origem_agendamento && <span> · {ORIGEM_LABEL[item.origem_agendamento] ?? item.origem_agendamento}</span>}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                      {item.evento.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add panel */}
        {!isCanceled && !isConcluido && (activeTab === "ativos" || activeTab === "fila") && (
          <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
            {addMode ? (
              <div ref={searchRef} className="relative space-y-3">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input autoFocus type="text"
                    placeholder={addMode === "lead" ? "Buscar lead..." : addMode === "contrato" ? "Buscar cliente com contrato..." : "Buscar cliente especial..."}
                    value={(addMode === "lead" ? selectedLead?.nome : addMode === "contrato" ? selectedContractStudent?.student_nome : selectedStudent?.nome_completo) ?? search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setSelectedStudent(null); setSelectedContractStudent(null); setSelectedLead(null);
                      setDropOpen(true);
                    }}
                    onClick={() => setDropOpen(true)}
                    className="flex-1 text-sm text-gray-900 outline-none bg-transparent"
                  />
                  {(selectedStudent || selectedContractStudent || selectedLead) && (
                    <button onClick={() => { setSelectedStudent(null); setSelectedContractStudent(null); setSelectedLead(null); setSearch(""); }}
                      className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  )}
                </div>

                {addMode === "lead" && (
                  <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs font-bold text-orange-700">Cadastrar lead na hora</p>
                      <span className="text-[11px] text-orange-500">Etapa: Visita agendada</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={newLead.nome}
                        onChange={e => setNewLead(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Nome do lead *"
                        className="text-sm border border-orange-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <input
                        value={newLead.telefone}
                        onChange={e => setNewLead(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="Telefone"
                        className="text-sm border border-orange-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <input
                        type="email"
                        value={newLead.email}
                        onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="E-mail"
                        className="text-sm border border-orange-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <input
                        value={newLead.origem}
                        onChange={e => setNewLead(prev => ({ ...prev, origem: e.target.value }))}
                        placeholder="Origem"
                        className="text-sm border border-orange-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleCreateLead}
                        disabled={creatingLead || !newLead.nome.trim()}
                        className="text-xs font-bold bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                      >
                        {creatingLead ? "Criando..." : "+ Criar e selecionar lead"}
                      </button>
                    </div>
                  </div>
                )}

                {addMode === "especial" && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">
                      Cliente especial entra na ocupação da aula, mas não consome crédito/aula do contrato.
                    </p>
                  </div>
                )}

                {dropOpen && !selectedStudent && !selectedContractStudent && !selectedLead && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                    {addMode === "contrato" && (
                      filteredContractStudents.length === 0
                        ? <p className="px-3 py-2 text-sm text-gray-400">Nenhum cliente com contrato ativo encontrado</p>
                        : filteredContractStudents.slice(0, 30).map(s => {
                          const disabled = !s.modalidade_ok || !!s.motivo_bloqueio;
                          return (
                            <button key={s.student_contract_id}
                              disabled={disabled}
                              onClick={() => { setSelectedContractStudent(s); setSearch(""); setDropOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}>
                              <span className="block font-medium text-gray-800">{s.student_nome}</span>
                              <span className="block text-xs text-gray-400">
                                {s.contrato_nome}
                                {s.data_fim && <span> · até {new Date(s.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                                {!s.modalidade_ok && <span className="text-red-500"> · modalidade não liberada</span>}
                                {s.motivo_bloqueio && <span className="text-red-500"> · bloqueado</span>}
                              </span>
                            </button>
                          );
                        })
                    )}
                    {addMode === "especial" && (
                      filteredStudents.length === 0
                        ? <p className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado</p>
                        : filteredStudents.slice(0, 20).map(s => (
                          <button key={s.id} onClick={() => { setSelectedStudent(s); setSearch(""); setDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                            {s.nome_completo}
                          </button>
                        ))
                    )}
                    {addMode === "lead" && (
                      filteredLeads.length === 0
                        ? <p className="px-3 py-2 text-sm text-gray-400">Nenhum lead encontrado</p>
                        : filteredLeads.slice(0, 20).map(l => (
                          <button key={l.id} onClick={() => { setSelectedLead(l); setSearch(""); setDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                            <span>{l.nome}</span>
                            {l.telefone && <span className="ml-2 text-xs text-gray-400">{l.telefone}</span>}
                          </button>
                        ))
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <button onClick={resetAdd} className="text-primary text-sm font-semibold hover:underline">Cancelar</button>
                  <button onClick={handleAddBooking} disabled={(!selectedStudent && !selectedContractStudent && !selectedLead) || adding}
                    className="ml-auto bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {adding ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setAddMode("contrato")}
                    className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                    <UserPlus className="w-4 h-4" /> Cliente com contrato
                  </button>
                  {perms?.permite_clientes_especiais && (
                    <button onClick={() => setAddMode("especial")}
                      className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline">
                      <UserPlus className="w-4 h-4" /> Cliente especial
                    </button>
                  )}
                  {canAddLeads && (
                    <button onClick={() => setAddMode("lead")}
                      className="flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:underline">
                      <Users className="w-4 h-4" /> Adicionar lead
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {podeFinalizarAula && !confirmarFinalizar && (
                    <button
                      onClick={() => setConfirmarFinalizar(true)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Finalizar aula
                    </button>
                  )}
                  {!confirmarFinalizar && (
                    <button onClick={() => setCancelingSlot(true)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Cancelar aula
                    </button>
                  )}
                </div>
              </div>
            )}
            {confirmarFinalizar && (
              <div className="flex flex-wrap items-center justify-end gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 mt-3">
                <span className="text-sm text-green-800 font-medium mr-auto">Confirmar finalização?</span>
                {gridComissao?.comissionar_instrutor && (
                  <span className="text-xs text-green-700">
                    {gridComissao.tipo_comissao === "por_cliente" ? "Comissão por aluno" : "Comissão por aula"}
                  </span>
                )}
                <button
                  onClick={handleFinalizarAula}
                  disabled={finalizando}
                  className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg disabled:opacity-50"
                >
                  {finalizando ? "..." : "Sim"}
                </button>
                <button
                  onClick={() => setConfirmarFinalizar(false)}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-800 px-2 py-1"
                >
                  Não
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editingSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">Alterar somente esta aula</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {fmtDataLong(slot.data)} · {normalizeTime(slot.hora_inicio)}
                </p>
              </div>
              <button
                onClick={() => { setEditingSlot(false); setConfirmCriticalEdit(false); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Modalidade</label>
                  <select
                    value={slotEditForm.modalidade_id}
                    onChange={e => {
                      const selected = modalidades.find(m => m.id === e.target.value);
                      setConfirmCriticalEdit(false);
                      setSlotEditForm(prev => ({
                        ...prev,
                        modalidade_id: selected?.id ?? "",
                        modalidade_nome: selected?.descricao ?? "",
                        cor: selected?.cor ?? prev.cor,
                      }));
                    }}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Sem modalidade</option>
                    {slotEditForm.modalidade_id && !modalidades.some(m => m.id === slotEditForm.modalidade_id) && (
                      <option value={slotEditForm.modalidade_id}>{slotEditForm.modalidade_nome || "Modalidade atual"}</option>
                    )}
                    {modalidades.map(m => (
                      <option key={m.id} value={m.id}>{m.descricao}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Professor</label>
                  <select
                    value={slotEditForm.staff_id}
                    onChange={e => {
                      const selected = staffList.find(s => s.id === e.target.value);
                      setConfirmCriticalEdit(false);
                      setSlotEditForm(prev => ({
                        ...prev,
                        staff_id: selected?.id ?? "",
                        staff_nome: selected?.name ?? "",
                      }));
                    }}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Sem professor</option>
                    {slotEditForm.staff_id && !staffList.some(s => s.id === slotEditForm.staff_id) && (
                      <option value={slotEditForm.staff_id}>{slotEditForm.staff_nome || "Professor atual"}</option>
                    )}
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Local / sala</label>
                  <select
                    value={slotEditForm.unit_id}
                    onChange={e => {
                      const selected = unitList.find(u => u.id === e.target.value);
                      setConfirmCriticalEdit(false);
                      setSlotEditForm(prev => ({
                        ...prev,
                        unit_id: selected?.id ?? "",
                        unit_nome: selected?.nome ?? "",
                      }));
                    }}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Sem local</option>
                    {slotEditForm.unit_id && !unitList.some(u => u.id === slotEditForm.unit_id) && (
                      <option value={slotEditForm.unit_id}>{slotEditForm.unit_nome || "Local atual"}</option>
                    )}
                    {unitList.map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Cor</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={isHexColor(slotEditForm.cor) ? slotEditForm.cor : "#22c55e"}
                      onChange={e => setSlotEditField("cor", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 bg-white p-1"
                    />
                    <input
                      value={slotEditForm.cor}
                      onChange={e => setSlotEditField("cor", e.target.value)}
                      className="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data</label>
                  <input
                    type="date"
                    value={slotEditForm.data}
                    onChange={e => setSlotEditField("data", e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Horário de início</label>
                  <input
                    type="time"
                    value={slotEditForm.hora_inicio}
                    onChange={e => setSlotEditField("hora_inicio", e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duração em minutos</label>
                  <input
                    type="number"
                    min={1}
                    value={slotEditForm.duracao_minutos}
                    onChange={e => setSlotEditField("duracao_minutos", e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Término: {addMinutesToTime(slotEditForm.hora_inicio || "00:00", parseInt(slotEditForm.duracao_minutos, 10) || 0)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Capacidade</label>
                  <input
                    type="number"
                    min={1}
                    value={slotEditForm.capacidade_maxima}
                    onChange={e => setSlotEditField("capacidade_maxima", e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={slotEditForm.observacoes}
                  onChange={e => setSlotEditField("observacoes", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Link online</label>
                <input
                  type="url"
                  value={slotEditForm.link_online}
                  onChange={e => setSlotEditField("link_online", e.target.value)}
                  placeholder="https://"
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {confirmCriticalEdit && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-amber-900">Confirmar alteração com reservas?</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Esta aula possui {activeBookings.length} reserva(s) ativa(s). A alteração será aplicada somente a esta aula e ficará registrada no histórico.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => {
                  if (confirmCriticalEdit) setConfirmCriticalEdit(false);
                  else setEditingSlot(false);
                }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                {confirmCriticalEdit ? "VOLTAR" : "CANCELAR"}
              </button>
              <button
                onClick={() => handleSaveSlotEdit(confirmCriticalEdit)}
                disabled={savingSlot}
                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingSlot ? "Salvando..." : confirmCriticalEdit ? "Confirmar e salvar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelingSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar esta aula?</h3>
            <p className="text-sm text-gray-500 mb-6">As reservas serão mantidas no histórico mas a aula ficará marcada como cancelada.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelingSlot(false)} className="text-primary font-semibold text-sm hover:underline px-2">VOLTAR</button>
              <button onClick={handleCancelSlot} className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors">
                CANCELAR AULA
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar participação?</h3>
            <p className="text-sm text-gray-500 mb-4">
              {cancelTarget.student_nome ?? cancelTarget.lead_nome ?? "Pessoa"} será movido para Cancelados / Desistentes.
            </p>

            <label className="block text-xs font-semibold text-gray-500 mb-1">Motivo</label>
            <textarea
              value={cancelMotivo}
              onChange={e => setCancelMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: aluno avisou que não poderá comparecer"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
            />

            {canGenerateReplacement(cancelTarget) ? (
              <label className="flex items-start gap-2 mt-4 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gerarReposicao}
                  onChange={e => setGerarReposicao(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs text-blue-800">
                  Gerar crédito de reposição para este contrato. Validade inicial: 30 dias.
                </span>
              </label>
            ) : (
              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-500">
                  Este registro não gera reposição automática porque não é uma reserva de contrato com crédito consumível.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setCancelTarget(null); setCancelMotivo(""); }}
                className="text-primary font-semibold text-sm hover:underline px-2"
              >
                VOLTAR
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelingBooking}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {cancelingBooking ? "CANCELANDO..." : "CANCELAR PARTICIPAÇÃO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
