import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ExternalLink, MoreHorizontal,
  Plus, Folder, Download, Pencil, CheckCircle2,
  Loader2, MessageCircle, ClipboardList, Dumbbell,
  MoreVertical, X, Sparkles, Users, BookOpen, Wand2,
  Trash2, Copy, Eye, Mail, Link2, Printer,
  DollarSign, Coins, CalendarDays, ScrollText, Gift, FlaskConical, FileText, MessageSquare,
  UploadCloud,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

/* ── Types ────────────────────────────────────────────────── */

type StudentStatus = "lead" | "ativo" | "inativo" | "cancelado";
type WorkoutStatus = "rascunho" | "ativo" | "finalizado";

interface StudentDetail {
  id: string;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  sexo: "masculino" | "feminino" | "outro" | null;
  status: StudentStatus;
  telefone: string | null;
  email: string | null;
  foto_url: string | null;
  observacoes: string | null;
  objetivo: string | null;
  cidade: string | null;
  uf: string | null;
  created_at: string;
}

interface StudentWorkout {
  id: string;
  nome: string;
  responsavel_nome: string | null;
  tipo_treino: string;
  nivel: string | null;
  status: WorkoutStatus;
  treinos_realizados: number;
  quantidade: number | null;
  session_count: number;
  created_at: string;
}

interface LibraryWorkout {
  id: string;
  nome: string;
  tipo_treino: string;
  nivel: string | null;
  session_count: number;
}

/* ── Constants ────────────────────────────────────────────── */

const STATUS_STYLE: Record<StudentStatus, string> = {
  ativo:     "bg-green-100 text-green-700",
  lead:      "bg-blue-100 text-blue-700",
  inativo:   "bg-gray-100 text-gray-500",
  cancelado: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<StudentStatus, string> = {
  ativo: "Ativo", lead: "Lead", inativo: "Inativo", cancelado: "Cancelado",
};
const SEX_LABEL: Record<string, string> = {
  masculino: "Masculino", feminino: "Feminino", outro: "Outro",
};
const TIPO_LABEL: Record<string, string> = {
  musculacao: "Musculação", funcional: "Funcional", aerobico: "Aeróbico",
  hiit: "HIIT", yoga: "Yoga", pilates: "Pilates",
  emagrecimento: "Emagrecimento", outro: "Outro",
};
const NIVEL_LABEL: Record<string, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

const WORKOUT_STATUS_STYLE: Record<WorkoutStatus, string> = {
  rascunho:   "bg-gray-100 text-gray-500",
  ativo:      "bg-green-100 text-green-700",
  finalizado: "bg-purple-100 text-purple-700",
};
const WORKOUT_STATUS_LABEL: Record<WorkoutStatus, string> = {
  rascunho: "Rascunho", ativo: "Ativo", finalizado: "Finalizado",
};

const TABS = [
  "Resumo", "Comunicação", "Vendas", "Contratos",
  "Financeiro", "Treinos", "Avaliações Físicas", "Evoluções", "Serviços", "Anamnese",
] as const;
type Tab = typeof TABS[number];

/* ── Helpers ──────────────────────────────────────────────── */

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const M = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`;
}

/* ── UI helpers ───────────────────────────────────────────── */

function CardHeader({ title, icon, iconBg, children }: {
  title: string;
  icon?: React.ReactNode;
  iconBg?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-2">
        {icon && (
          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${iconBg ?? "bg-primary/10"}`}>
            {icon}
          </div>
        )}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
      <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center">
        <ClipboardList className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-xs text-gray-400 mt-1">{message}</p>
    </div>
  );
}

function ComingSoon({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-300">
      <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
        <ClipboardList className="w-7 h-7 text-primary/30" />
      </div>
      <p className="text-sm font-semibold text-gray-400">{tab}</p>
      <p className="text-xs text-gray-400">Funcionalidade em desenvolvimento</p>
    </div>
  );
}

/* ── Duplicate workout from library for a student ─────────── */

async function duplicateWorkoutForStudent(
  sourceId: string,
  studentId: string,
  contractorId: string
): Promise<string | null> {
  const { data: src } = await supabase
    .from("workouts").select("*").eq("id", sourceId).single();
  if (!src) return null;

  const { data: nw } = await supabase
    .from("workouts")
    .insert({
      contractor_id:            contractorId,
      student_id:               studentId,
      nome:                     (src as any).nome,
      responsavel_nome:         (src as any).responsavel_nome,
      tipo_treino:              (src as any).tipo_treino,
      nivel:                    (src as any).nivel,
      sexo:                     (src as any).sexo,
      frequencia_semanal:       (src as any).frequencia_semanal,
      idade_minima:             (src as any).idade_minima,
      idade_maxima:             (src as any).idade_maxima,
      imprimir_automaticamente: (src as any).imprimir_automaticamente,
      controla_treino:          (src as any).controla_treino,
      tipo_controle:            (src as any).tipo_controle,
      quantidade:               (src as any).quantidade,
      observacoes:              (src as any).observacoes,
      status:                   "ativo",
    })
    .select("id").single();
  if (!nw) return null;

  const { data: sessions } = await supabase
    .from("workout_sessions").select("*")
    .eq("workout_id", sourceId).order("ordem");

  for (const s of sessions ?? []) {
    const { data: ns } = await supabase
      .from("workout_sessions")
      .insert({ workout_id: (nw as any).id, nome: s.nome, ordem: s.ordem })
      .select("id").single();
    if (!ns) continue;

    const { data: exs } = await supabase
      .from("workout_session_exercises").select("*")
      .eq("session_id", s.id).order("ordem");

    for (const ex of exs ?? []) {
      const { data: nex } = await supabase
        .from("workout_session_exercises")
        .insert({
          session_id:    (ns as any).id,
          exercise_id:   ex.exercise_id,
          exercise_nome: ex.exercise_nome,
          ordem:         ex.ordem,
          series:        ex.series,
          tipo_metrica:  ex.tipo_metrica,
          intervalo_seg: ex.intervalo_seg,
          observacao:    ex.observacao,
          bi_set_grupo:  ex.bi_set_grupo,
        })
        .select("id").single();
      if (!nex) continue;

      const { data: series } = await supabase
        .from("workout_session_exercise_series").select("*")
        .eq("exercise_sessao_id", ex.id).order("numero_serie");

      if (series?.length) {
        await supabase.from("workout_session_exercise_series").insert(
          series.map((sr: any) => ({
            exercise_sessao_id: (nex as any).id,
            numero_serie:       sr.numero_serie,
            valor:              sr.valor,
            carga_kg:           sr.carga_kg,
          }))
        );
      }
    }
  }

  return (nw as any).id;
}

/* ── Novo Treino Modal ────────────────────────────────────── */

type NovoOption = "biblioteca" | "outro-cliente" | "novo" | "ia" | null;

function NovoTreinoModal({ studentName, onClose, onSelect }: {
  studentName: string;
  onClose: () => void;
  onSelect: (opt: Exclude<NovoOption, null>) => void;
}) {
  const [selected, setSelected] = useState<NovoOption>(null);

  const opts: { key: Exclude<NovoOption, null>; icon: React.ReactNode; label: string; badge?: React.ReactNode }[] = [
    {
      key: "biblioteca",
      icon: <BookOpen className="w-7 h-7 text-gray-500" />,
      label: "Selecionar um treino da biblioteca de treinos.",
    },
    {
      key: "outro-cliente",
      icon: <Users className="w-7 h-7 text-gray-500" />,
      label: "Utilizar o treino de outro cliente",
    },
    {
      key: "novo",
      icon: <Sparkles className="w-7 h-7 text-gray-500" />,
      label: "Criar um treino totalmente novo",
    },
    {
      key: "ia",
      icon: <Wand2 className="w-7 h-7 text-gray-500" />,
      label: "Criar um treino com a Inteligência de treinos",
      badge: (
        <span className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
          IA integrada
        </span>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Criando um novo treino para</p>
            <p className="text-base font-bold text-gray-800">{studentName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3">
          {opts.map(({ key, icon, label, badge }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-center transition-all ${
                selected === key
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {badge}
              {icon}
              <span className="text-xs text-gray-600 leading-snug">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            CANCELAR
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
            className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            CONTINUAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Biblioteca Modal ─────────────────────────────────────── */

function BibliotecaModal({ contractorId, onClose, onImport }: {
  contractorId: string;
  onClose: () => void;
  onImport: (workoutId: string) => void;
}) {
  const [library,     setLibrary]     = useState<LibraryWorkout[]>([]);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [importing,   setImporting]   = useState(false);

  useEffect(() => {
    supabase
      .from("workouts")
      .select("id, nome, tipo_treino, nivel, workout_sessions(id)")
      .eq("contractor_id", contractorId)
      .is("student_id", null)
      .order("nome")
      .then(({ data }) => {
        setLibrary(((data ?? []) as any[]).map(w => ({
          id:            w.id,
          nome:          w.nome,
          tipo_treino:   w.tipo_treino,
          nivel:         w.nivel,
          session_count: (w.workout_sessions ?? []).length,
        })));
        setLoading(false);
      });
  }, [contractorId]);

  async function handleChoose() {
    if (!selected) return;
    setImporting(true);
    onImport(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">Copiar de qual treino?</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[auto_1fr_160px] items-center px-6 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="w-6" />
          <span className="text-xs font-semibold text-gray-500">Descrição</span>
          <span className="text-xs font-semibold text-gray-500">Tipo do treino</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : library.length === 0 ? (
            <p className="text-center py-12 text-sm text-gray-400">
              Nenhum treino na biblioteca
            </p>
          ) : (
            library.map(w => (
              <div
                key={w.id}
                onClick={() => setSelected(w.id)}
                className={`grid grid-cols-[auto_1fr_160px] items-center px-6 py-3.5 cursor-pointer transition-colors ${
                  selected === w.id ? "bg-gray-50" : "hover:bg-gray-50"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 transition-colors ${
                  selected === w.id ? "border-primary" : "border-gray-300"
                }`}>
                  {selected === w.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{w.nome}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {w.nivel && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {NIVEL_LABEL[w.nivel] ?? w.nivel}
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {w.session_count} sessão{w.session_count !== 1 ? "ões" : ""}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {TIPO_LABEL[w.tipo_treino] ?? w.tipo_treino}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-4 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700">
            CANCELAR
          </button>
          <button
            onClick={handleChoose}
            disabled={!selected || importing}
            className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {importing ? "Importando..." : "ESCOLHER"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Workout Card ─────────────────────────────────────────── */

function WorkoutCard({ w, onStatusChange, onDelete, onEdit }: {
  w: StudentWorkout;
  onStatusChange: (id: string, s: WorkoutStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleStatus() {
    const next: WorkoutStatus = w.status === "ativo" ? "finalizado" : "ativo";
    onStatusChange(w.id, next);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-800 mb-1">{w.nome}</p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">Responsável:</span> {w.responsavel_nome || "—"}
          </p>
          <p className="text-sm text-gray-500 mb-3">
            <span className="font-medium">Criado em:</span> {fmtDate(w.created_at)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
              Treinos realizados {w.treinos_realizados}/{w.quantidade ?? "∞"}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
              {w.session_count} sessão{w.session_count !== 1 ? "ões" : ""}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${WORKOUT_STATUS_STYLE[w.status]}`}>
              {WORKOUT_STATUS_LABEL[w.status]}
            </span>

            {w.status !== "rascunho" && (
              <button
                onClick={toggleStatus}
                className="text-xs font-bold text-green-600 hover:underline ml-2"
              >
                {w.status === "ativo" ? "FINALIZAR" : "ATIVAR"}
              </button>
            )}
            {w.status === "rascunho" && (
              <button
                onClick={() => onStatusChange(w.id, "ativo")}
                className="text-xs font-bold text-green-600 hover:underline ml-2"
              >
                ATIVAR
              </button>
            )}
          </div>
        </div>

        <div className="relative flex-shrink-0 ml-4">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[160px] py-1">
              <button
                onClick={() => { setMenuOpen(false); onEdit(w.id); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicar
              </button>
              <div className="border-t border-gray-100 my-0.5" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(w.id); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── PAR-Q ────────────────────────────────────────────────── */

const PARQ_PERGUNTAS = [
  "Algum médico já disse que você possui algum problema cardíaco e que deve realizar atividade física somente com supervisão?",
  "Você sente dor no peito quando realiza atividade física?",
  "No último mês, você teve dor no peito quando não estava realizando atividade física?",
  "Você perde o equilíbrio por causa de tontura ou perde a consciência?",
  "Você tem algum problema ósseo ou muscular que poderia ser agravado pela atividade física?",
  "Algum médico está receitando atualmente medicamentos para pressão arterial ou condição cardíaca?",
  "Você tem alguma outra razão pela qual não deve praticar atividade física?",
];

/* ── Anamnese Tab ─────────────────────────────────────────── */

function AnamneseTab({ studentId, contractorId, studentEmail, studentTelefone, studentName }: {
  studentId:        string;
  contractorId:     string;
  studentEmail?:    string | null;
  studentTelefone?: string | null;
  studentName?:     string;
}) {
  const [respostas,         setRespostas]         = useState<any[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [selecionarModal,   setSelecionarModal]   = useState(false);
  const [modalStep,         setModalStep]         = useState<"selecting" | "sending">("selecting");
  const [createdToken,      setCreatedToken]      = useState("");
  const [verModal,          setVerModal]          = useState<any | null>(null);
  const [modelos,           setModelos]           = useState<{ id: string; descricao: string; respondido_pelo_cliente: boolean }[]>([]);
  const [createdRespondidoPeloCliente, setCreatedRespondidoPeloCliente] = useState(true);
  const [modeloSelecionado, setModeloSelecionado] = useState<string | null>(null);
  const [enviando,          setEnviando]          = useState(false);
  const [itens,             setItens]             = useState<any[]>([]);
  const [loadingItens,      setLoadingItens]      = useState(false);
  const [deleteConfirmId,   setDeleteConfirmId]   = useState<string | null>(null);

  useEffect(() => { load(); }, [studentId, contractorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("anamnese_respostas")
      .select("id, token, status, created_at, respondido_at, aceite, parq, anamnese_modelos(descricao, respondido_pelo_cliente)")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setRespostas((data ?? []) as any[]);
    setLoading(false);
  }

  async function openSelecionarModal() {
    const { data } = await supabase
      .from("anamnese_modelos")
      .select("id, descricao, respondido_pelo_cliente")
      .eq("contractor_id", contractorId)
      .order("descricao");
    setModelos((data ?? []) as { id: string; descricao: string; respondido_pelo_cliente: boolean }[]);
    setModeloSelecionado(null);
    setModalStep("selecting");
    setSelecionarModal(true);
  }

  function closeModal() {
    setSelecionarModal(false);
    setModalStep("selecting");
    setCreatedToken("");
  }

  function handleEditAnamnese(r: any) {
    const respondidoPeloCliente = (r.anamnese_modelos as any)?.respondido_pelo_cliente ?? true;
    setCreatedToken(r.token ?? "");
    setCreatedRespondidoPeloCliente(respondidoPeloCliente);
    setModalStep("sending");
    setSelecionarModal(true);
  }

  async function handleDeleteAnamnese(id: string) {
    // Busca as questões desta anamnese antes de deletar (a FK vai cascadear os itens)
    const { data: itens } = await supabase
      .from("anamnese_resposta_itens")
      .select("questao_id")
      .eq("resposta_id", id);

    const questaoIds = [...new Set((itens ?? []).map((i: any) => i.questao_id).filter(Boolean))];

    const { error } = await supabase
      .from("anamnese_respostas")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Erro ao excluir anamnese."); return; }

    // Verifica quais questões não têm mais respostas em nenhuma outra anamnese
    if (questaoIds.length > 0) {
      const { data: restantes } = await supabase
        .from("anamnese_resposta_itens")
        .select("questao_id")
        .in("questao_id", questaoIds);

      const aindaTemRespostas = new Set((restantes ?? []).map((i: any) => i.questao_id));
      const liberar = questaoIds.filter(qid => !aindaTemRespostas.has(qid));

      if (liberar.length > 0) {
        await supabase
          .from("anamnese_questoes")
          .update({ tem_respostas: false })
          .in("id", liberar);
      }
    }

    toast.success("Anamnese excluída.");
    setDeleteConfirmId(null);
    load();
  }

  function anamneseUrl(token: string) {
    return `${window.location.origin}/anamnese/${token}`;
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(anamneseUrl(token));
    toast.success("Link copiado!");
  }

  function sendEmail(token: string) {
    if (!studentEmail) { toast.error("Aluno sem e-mail cadastrado."); return; }
    const name = studentName ?? "você";
    window.open(`mailto:${studentEmail}?subject=Anamnese&body=Olá ${name}! Acesse o link para preencher a anamnese: ${anamneseUrl(token)}`);
  }

  function sendWhatsApp(token: string) {
    const raw = (studentTelefone ?? "").replace(/\D/g, "");
    if (!raw) { toast.error("Aluno sem telefone cadastrado."); return; }
    const name = studentName ?? "você";
    window.open(`https://wa.me/55${raw}?text=Olá ${name}! Acesse o link para preencher a anamnese: ${anamneseUrl(token)}`);
  }

  async function handleEnviar() {
    if (!modeloSelecionado) return;
    setEnviando(true);
    const { data: created, error } = await supabase
      .from("anamnese_respostas")
      .insert({
        contractor_id: contractorId,
        student_id:    studentId,
        modelo_id:     modeloSelecionado,
        status:        "pendente",
      })
      .select("token")
      .single();
    if (error) { toast.error("Erro ao criar anamnese."); setEnviando(false); return; }
    toast.success("Anamnese criada com sucesso!");
    const selecionado = modelos.find(m => m.id === modeloSelecionado);
    setEnviando(false);
    setModeloSelecionado(null);
    setCreatedToken((created as any).token ?? "");
    setCreatedRespondidoPeloCliente(selecionado?.respondido_pelo_cliente ?? true);
    setModalStep("sending");
    load();
  }

  async function handleVerRespostas(resposta: any) {
    setVerModal(resposta);
    setLoadingItens(true);
    const { data } = await supabase
      .from("anamnese_resposta_itens")
      .select("questao_id, valor, anamnese_questoes(pergunta, tipo)")
      .eq("resposta_id", resposta.id);
    setItens((data ?? []) as any[]);
    setLoadingItens(false);
  }

  function fmtBR(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function handlePrint(resposta: any, respostaItens: any[]) {
    const parqData  = (resposta.parq as Record<string, string>) ?? {};
    const nomeModelo = (resposta.anamnese_modelos as any)?.descricao ?? "Anamnese";
    const dataResp   = resposta.respondido_at ? new Date(resposta.respondido_at).toLocaleDateString("pt-BR") : "—";

    const questoesHtml = respostaItens.map((item, i) => {
      const pergunta = (item.anamnese_questoes as any)?.pergunta ?? "—";
      const tipo     = (item.anamnese_questoes as any)?.tipo     ?? "";
      let display: string;
      if (tipo === "checkbox" && Array.isArray(item.valor)) display = item.valor.join(", ");
      else if (item.valor !== null && item.valor !== undefined) display = String(item.valor);
      else display = "—";
      return `<div class="q"><p class="ql">${i + 1}. ${pergunta}</p><p class="qr">${display}</p></div>`;
    }).join("");

    const parqHtml = PARQ_PERGUNTAS.map((p, i) => {
      const resp  = parqData[String(i)];
      const isSim = resp === "Sim";
      return `<div class="q ${isSim ? "alert" : ""}">
        <p class="ql ${isSim ? "alabel" : ""}">${i + 1}. ${p}</p>
        <p class="qr ${isSim ? "aval" : ""}">${isSim ? "⚠ Sim" : (resp ?? "—")}</p>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>${nomeModelo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111;padding:32px;max-width:820px;margin:0 auto}
h1{font-size:20px;font-weight:700;margin-bottom:4px}
.sub{font-size:12px;color:#666;margin-bottom:24px}
h2{font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #ddd;padding-bottom:5px;margin:24px 0 10px}
.q{background:#f8f8f8;border-radius:8px;padding:10px 14px;margin-bottom:7px}
.q.alert{background:#fff0f0;border:1px solid #fca5a5}
.ql{font-size:11px;color:#777;margin-bottom:3px}
.alabel{color:#dc2626;font-weight:600}
.qr{font-size:13px;font-weight:600;color:#111}
.aval{color:#b91c1c}
.footer{margin-top:28px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
@media print{body{padding:16px}}
</style></head><body>
<h1>${nomeModelo}</h1>
<p class="sub">${studentName ? `Aluno: <strong>${studentName}</strong> &nbsp;·&nbsp; ` : ""}Respondida em: ${dataResp} &nbsp;·&nbsp; Aceite: ${resposta.aceite ? "Sim" : "Não"}</p>
${respostaItens.length > 0 ? `<h2>Perguntas</h2>${questoesHtml}` : ""}
<h2>PAR-Q — Prontidão para Atividade Física</h2>
${parqHtml}
<div class="footer">FitCoreSys &nbsp;·&nbsp; Documento gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex justify-center">
        <button
          onClick={openSelecionarModal}
          className="inline-flex items-center gap-2 bg-green-500 text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-green-600 transition-colors"
        >
          ENVIAR ANAMNESE
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : respostas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ClipboardList className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">Nenhuma anamnese enviada para este aluno</p>
        </div>
      ) : (
        <div className="space-y-3">
          {respostas.map(r => {
            const nomeModelo = (r.anamnese_modelos as any)?.descricao ?? "Sem modelo";
            const respondida = r.status === "respondido";
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 mb-1">{nomeModelo}</p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                      respondida ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {respondida ? "Respondido" : "Pendente"}
                    </span>
                    <span>Enviada em: {fmtBR(r.created_at)}</span>
                    <span>Respondida em: {r.respondido_at ? fmtBR(r.respondido_at) : "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {respondida ? (
                    <button
                      onClick={() => handleVerRespostas(r)}
                      title="Ver respostas"
                      className="p-1.5 rounded hover:bg-gray-100"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => copyLink(r.token)}
                        title="Copiar link"
                        className="p-1.5 rounded hover:bg-gray-100"
                      >
                        <Link2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleEditAnamnese(r)}
                        title="Opções de envio"
                        className="p-1.5 rounded hover:bg-gray-100"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setDeleteConfirmId(r.id)}
                    title="Excluir anamnese"
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal — seleção de modelo / envio */}
      {selecionarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                {modalStep === "selecting" ? "Selecionar modelo de anamnese" : "Anamnese criada"}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Etapa 1 — escolher modelo */}
            {modalStep === "selecting" && (
              <>
                <div className="p-6 max-h-72 overflow-y-auto space-y-2">
                  {modelos.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Nenhum modelo cadastrado. Crie um modelo em Configurações → Anamnese.
                    </p>
                  ) : (
                    modelos.map(m => (
                      <div
                        key={m.id}
                        onClick={() => setModeloSelecionado(m.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                          modeloSelecionado === m.id
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          modeloSelecionado === m.id ? "border-primary" : "border-gray-300"
                        }`}>
                          {modeloSelecionado === m.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm text-gray-800">{m.descricao}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button
                    onClick={closeModal}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2"
                  >
                    CANCELAR
                  </button>
                  <button
                    disabled={!modeloSelecionado || enviando}
                    onClick={handleEnviar}
                    className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  >
                    {enviando ? "Enviando..." : "ENVIAR"}
                  </button>
                </div>
              </>
            )}

            {/* Etapa 2 — opções de envio */}
            {modalStep === "sending" && (
              <div className="p-6 space-y-4">
                {createdRespondidoPeloCliente ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm text-gray-700">
                      Esta anamnese foi configurada para ser respondida diretamente <strong>pelo cliente</strong>.
                    </p>
                    <p className="text-sm text-gray-600">Envie para o cliente clicando em uma das opções abaixo:</p>
                    <div className="flex items-center gap-5 pt-2">
                      <button
                        onClick={() => sendEmail(createdToken)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
                      >
                        <Mail className="w-4 h-4" /> E-MAIL
                      </button>
                      <button
                        onClick={() => sendWhatsApp(createdToken)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:underline"
                      >
                        <MessageCircle className="w-4 h-4" /> WHATSAPP
                      </button>
                      <button
                        onClick={() => copyLink(createdToken)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:underline"
                      >
                        <Link2 className="w-4 h-4" /> COPIAR LINK
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-gray-700">
                      Esta anamnese será respondida pelo <strong>profissional</strong> durante o atendimento, com a presença do cliente.
                    </p>
                    <p className="text-sm text-gray-600">Clique abaixo para abrir o formulário:</p>
                    <button
                      onClick={() => window.open(anamneseUrl(createdToken), "_blank")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> ABRIR FORMULÁRIO
                    </button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={closeModal} className="text-xs text-gray-400 hover:underline">
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal — ver respostas */}
      {verModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-semibold text-gray-800">
                Anamnese — {(verModal.anamnese_modelos as any)?.descricao ?? "Sem modelo"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(verModal, itens)}
                  title="Imprimir / Salvar PDF"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
                </button>
                <button onClick={() => setVerModal(null)} className="p-1.5 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingItens ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* Respostas */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Respostas</h3>
                    {itens.length === 0 ? (
                      <p className="text-sm text-gray-400">Nenhuma resposta registrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {itens.map((item, i) => {
                          const pergunta = (item.anamnese_questoes as any)?.pergunta ?? "—";
                          const tipo     = (item.anamnese_questoes as any)?.tipo ?? "";
                          let display: string;
                          if (tipo === "checkbox" && Array.isArray(item.valor)) {
                            display = item.valor.join(", ");
                          } else if (item.valor !== null && item.valor !== undefined) {
                            display = String(item.valor);
                          } else {
                            display = "—";
                          }
                          return (
                            <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                              <p className="text-xs text-gray-500 mb-1">{pergunta}</p>
                              <p className="text-sm font-medium text-gray-800">{display}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* PAR-Q */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">PAR-Q</h3>
                    <div className="space-y-2">
                      {PARQ_PERGUNTAS.map((p, i) => {
                        const parqData = (verModal.parq as Record<string, string>) ?? {};
                        const resp = parqData[String(i)];
                        const isSim = resp === "Sim";
                        return (
                          <div key={i} className={`rounded-xl px-4 py-3 ${isSim ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                            <p className={`text-xs mb-1 ${isSim ? "text-red-500 font-semibold" : "text-gray-500"}`}>{p}</p>
                            <p className={`text-sm font-bold ${isSim ? "text-red-700" : "text-gray-800"}`}>
                              {isSim ? "⚠ Sim" : (resp ?? "—")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 rounded-b-2xl bg-gray-50">
              <p className="text-sm text-gray-600">
                Aceite do cliente:{" "}
                <span className="font-semibold">{verModal.aceite ? "Sim" : "Não"}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal — confirmar exclusão */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir anamnese</h3>
            <p className="text-sm text-gray-500 mb-5">
              Tem certeza que deseja excluir esta anamnese? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-sm font-bold text-gray-500 hover:underline"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteAnamnese(deleteConfirmId)}
                className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Treinos Tab ──────────────────────────────────────────── */

function TreinosTab({ studentId, studentName, contractorId }: {
  studentId:    string;
  studentName:  string;
  contractorId: string;
}) {
  const navigate = useNavigate();
  const [workouts,       setWorkouts]       = useState<StudentWorkout[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [novoModal,      setNovoModal]      = useState(false);
  const [bibModal,       setBibModal]       = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    const { data: wData } = await supabase
      .from("workouts")
      .select("id, nome, responsavel_nome, tipo_treino, nivel, status, treinos_realizados, quantidade, created_at")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    const rows = (wData ?? []) as any[];
    if (rows.length === 0) { setWorkouts([]); setLoading(false); return; }

    const ids = rows.map(r => r.id);
    const { data: sData } = await supabase
      .from("workout_sessions")
      .select("workout_id")
      .in("workout_id", ids);

    const cntMap: Record<string, number> = {};
    (sData ?? []).forEach((s: any) => {
      cntMap[s.workout_id] = (cntMap[s.workout_id] ?? 0) + 1;
    });

    setWorkouts(rows.map(r => ({ ...r, session_count: cntMap[r.id] ?? 0 })));
    setLoading(false);
  }, [studentId, contractorId]);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  async function handleStatusChange(id: string, status: WorkoutStatus) {
    await supabase.from("workouts").update({ status }).eq("id", id);
    setWorkouts(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  }

  async function handleDelete(id: string) {
    await supabase.from("workouts").delete().eq("id", id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
    setDeleteConfirm(null);
  }

  async function handleImportFromLibrary(sourceId: string) {
    setImporting(true);
    setBibModal(false);
    setNovoModal(false);
    const newId = await duplicateWorkoutForStudent(sourceId, studentId, contractorId);
    setImporting(false);
    if (newId) {
      await loadWorkouts();
    }
  }

  function handleNovoOption(opt: Exclude<NovoOption, null>) {
    setNovoModal(false);
    if (opt === "biblioteca") {
      setBibModal(true);
    } else if (opt === "novo") {
      navigate(
        `/app/treinos/treinos/novo?student_id=${studentId}&back=/app/clientes/${studentId}/dashboard`
      );
    } else {
      alert("Funcionalidade em desenvolvimento");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-center">
        <button
          onClick={() => setNovoModal(true)}
          className="inline-flex items-center gap-2 bg-green-500 text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-green-600 transition-colors"
        >
          NOVO TREINO
        </button>
      </div>

      {/* List */}
      {loading || importing ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Dumbbell className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">Nenhum treino cadastrado para este aluno</p>
          <button
            onClick={() => setNovoModal(true)}
            className="text-sm text-primary font-semibold hover:underline"
          >
            + Criar primeiro treino
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map(w => (
            <WorkoutCard
              key={w.id}
              w={w}
              onStatusChange={handleStatusChange}
              onDelete={(id) => setDeleteConfirm(id)}
              onEdit={(id) => navigate(`/app/treinos/treinos/${id}?back=/app/clientes/${studentId}/dashboard`)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {novoModal && (
        <NovoTreinoModal
          studentName={studentName}
          onClose={() => setNovoModal(false)}
          onSelect={handleNovoOption}
        />
      )}

      {bibModal && (
        <BibliotecaModal
          contractorId={contractorId}
          onClose={() => setBibModal(false)}
          onImport={handleImportFromLibrary}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir treino</h3>
            <p className="text-sm text-gray-500 mb-5">
              Tem certeza que deseja excluir este treino? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="text-sm font-bold text-gray-500 hover:underline">
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Validade options ─────────────────────────────────────── */

const VALIDADE_OPTS: { label: string; meses: number | null }[] = [
  { label: "Sem validade", meses: null },
  { label: "1 mês",        meses: 1   },
  { label: "3 meses",      meses: 3   },
  { label: "6 meses",      meses: 6   },
  { label: "12 meses",     meses: 12  },
  { label: "24 meses",     meses: 24  },
];

/* ── Documento Modal ──────────────────────────────────────── */

function DocumentoModal({ studentId, contractorId, initialData, onClose, onSaved }: {
  studentId:    string;
  contractorId: string;
  initialData?: any;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const isEdit = !!initialData?.id;
  const [titulo,    setTitulo]    = useState(initialData?.titulo    ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [file,      setFile]      = useState<File | null>(null);
  const [saving,    setSaving]    = useState(false);

  async function handleSave() {
    if (!titulo.trim()) return;
    setSaving(true);

    let arquivo_url:  string | null = initialData?.arquivo_url  ?? null;
    let arquivo_nome: string | null = initialData?.arquivo_nome ?? null;

    if (file) {
      const ext  = file.name.split(".").pop() ?? "bin";
      const path = `documents/${contractorId}/${studentId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("student-files").upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("student-files").getPublicUrl(path);
        arquivo_url  = urlData.publicUrl;
        arquivo_nome = file.name;
      }
    }

    const payload = {
      titulo:      titulo.trim(),
      descricao:   descricao.trim() || null,
      arquivo_url,
      arquivo_nome,
    };

    const { error } = isEdit
      ? await supabase.from("student_documents").update(payload).eq("id", initialData.id)
      : await supabase.from("student_documents").insert({ contractor_id: contractorId, student_id: studentId, ...payload });

    setSaving(false);
    if (error) { toast.error("Erro ao salvar documento."); return; }
    toast.success(isEdit ? "Documento atualizado!" : "Documento salvo!");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{isEdit ? "Editar documento" : "Cadastrar documento"}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Nome do documento"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              placeholder="Descrição opcional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Arquivo</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center space-y-2">
              {file ? (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-left">
                  <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                  <button onClick={() => setFile(null)} className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : initialData?.arquivo_nome ? (
                <p className="text-xs text-gray-500 truncate">Arquivo atual: <span className="font-medium">{initialData.arquivo_nome}</span></p>
              ) : (
                <p className="text-xs text-gray-400">Nenhum documento adicionado</p>
              )}
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-primary border border-primary rounded-lg px-4 py-1.5 hover:bg-primary/5 transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                {isEdit ? "SUBSTITUIR ARQUIVO" : "ADICIONAR DOCUMENTO"}
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">
            CANCELAR
          </button>
          <button
            disabled={!titulo.trim() || saving}
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? "Salvando..." : "SALVAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Exame Modal ──────────────────────────────────────────── */

function ExameModal({ studentId, contractorId, initialData, onClose, onSaved }: {
  studentId:    string;
  contractorId: string;
  initialData?: any;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const isEdit = !!initialData?.id;
  const [dataExame,     setDataExame]     = useState(initialData?.data_exame     ?? "");
  const [validadeMeses, setValidadeMeses] = useState<number | null>(initialData?.validade_meses ?? null);
  const [dataValidade,  setDataValidade]  = useState(initialData?.data_validade  ?? "");
  const [medicoNome,    setMedicoNome]    = useState(initialData?.medico_nome    ?? "");
  const [crm,           setCrm]           = useState(initialData?.crm            ?? "");
  const [file,          setFile]          = useState<File | null>(null);
  const [saving,        setSaving]        = useState(false);
  const autoCalc = useCallback((exam: string, meses: number | null) => {
    if (!exam || meses === null) return;
    const d = new Date(exam);
    d.setMonth(d.getMonth() + meses);
    setDataValidade(d.toISOString().split("T")[0]);
  }, []);

  useEffect(() => { autoCalc(dataExame, validadeMeses); }, [dataExame, validadeMeses, autoCalc]);

  async function handleSave() {
    setSaving(true);

    let arquivo_url:  string | null = initialData?.arquivo_url  ?? null;
    let arquivo_nome: string | null = initialData?.arquivo_nome ?? null;

    if (file) {
      const ext  = file.name.split(".").pop() ?? "bin";
      const path = `exams/${contractorId}/${studentId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("student-files").upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("student-files").getPublicUrl(path);
        arquivo_url  = urlData.publicUrl;
        arquivo_nome = file.name;
      }
    }

    const payload = {
      data_exame:    dataExame    || null,
      validade_meses: validadeMeses,
      data_validade: dataValidade || null,
      medico_nome:   medicoNome.trim() || null,
      crm:           crm.trim()        || null,
      arquivo_url,
      arquivo_nome,
    };

    const { error } = isEdit
      ? await supabase.from("student_exams").update(payload).eq("id", initialData.id)
      : await supabase.from("student_exams").insert({ contractor_id: contractorId, student_id: studentId, ...payload });

    setSaving(false);
    if (error) { toast.error("Erro ao salvar exame."); return; }
    toast.success(isEdit ? "Exame atualizado!" : "Exame salvo!");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{isEdit ? "Editar exame" : "Adicionar exame"}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Data do exame</label>
              <input
                type="date"
                value={dataExame}
                onChange={e => setDataExame(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Validade</label>
              <select
                value={validadeMeses ?? ""}
                onChange={e => setValidadeMeses(e.target.value === "" ? null : Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              >
                {VALIDADE_OPTS.map(o => (
                  <option key={String(o.meses)} value={o.meses ?? ""}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Data de validade</label>
            <input
              type="date"
              value={dataValidade}
              onChange={e => setDataValidade(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome do médico</label>
              <input
                type="text"
                value={medicoNome}
                onChange={e => setMedicoNome(e.target.value)}
                placeholder="Dr. Nome"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">CRM</label>
              <input
                type="text"
                value={crm}
                onChange={e => setCrm(e.target.value)}
                placeholder="000000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Arquivo</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center space-y-2">
              {file ? (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-left">
                  <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                  <button onClick={() => setFile(null)} className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : initialData?.arquivo_nome ? (
                <p className="text-xs text-gray-500 truncate">Arquivo atual: <span className="font-medium">{initialData.arquivo_nome}</span></p>
              ) : (
                <p className="text-xs text-gray-400">Nenhum exame adicionado</p>
              )}
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-primary border border-primary rounded-lg px-4 py-1.5 hover:bg-primary/5 transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                {isEdit ? "SUBSTITUIR ARQUIVO" : "ADICIONAR EXAME"}
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">
            CANCELAR
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? "Salvando..." : "SALVAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/* ── Avaliações Físicas Tab ────────────────────────────────── */

type Aval = {
  id: string;
  data_avaliacao: string;
  peso_kg: number | null;
  altura_cm: number | null;
  imc: number | null;
  percentual_gordura: number | null;
  massa_magra_kg: number | null;
  massa_gorda_kg: number | null;
  avaliador_nome: string | null;
};

function AvaliacoesTab({ studentId, contractorId }: { studentId: string; contractorId: string }) {
  const navigate = useNavigate();
  const [avais, setAvais]       = useState<Aval[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("physical_evaluations")
      .select("id, data_avaliacao, peso_kg, altura_cm, imc, percentual_gordura, massa_magra_kg, massa_gorda_kg, avaliador_nome")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("data_avaliacao", { ascending: false });
    setAvais((data ?? []) as Aval[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [studentId, contractorId]);

  async function handleDelete(id: string) {
    await supabase.from("physical_evaluations").delete().eq("id", id);
    toast.success("Avaliação excluída.");
    setDeleteId(null);
    load();
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">Avaliações Físicas</h2>
        <button
          onClick={() => navigate(`/app/clientes/${studentId}/avaliacao-fisica/nova`)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          NOVA AVALIAÇÃO
        </button>
      </div>

      {avais.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-primary/30" />
          </div>
          <p className="text-sm text-gray-400 font-semibold">Nenhuma avaliação registrada</p>
          <p className="text-xs text-gray-400">Clique em "NOVA AVALIAÇÃO" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {avais.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-gray-800">
                    {new Date(a.data_avaliacao + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  {a.avaliador_nome && (
                    <span className="text-xs text-gray-400">Avaliador: {a.avaliador_nome}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4">
                  {a.peso_kg != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Peso</p>
                      <p className="text-sm font-bold text-gray-700">{a.peso_kg} kg</p>
                    </div>
                  )}
                  {a.altura_cm != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Altura</p>
                      <p className="text-sm font-bold text-gray-700">{a.altura_cm} cm</p>
                    </div>
                  )}
                  {a.imc != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">IMC</p>
                      <p className="text-sm font-bold text-gray-700">{a.imc}</p>
                    </div>
                  )}
                  {a.percentual_gordura != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">% Gordura</p>
                      <p className="text-sm font-bold text-gray-700">{a.percentual_gordura}%</p>
                    </div>
                  )}
                  {a.massa_magra_kg != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Massa Magra</p>
                      <p className="text-sm font-bold text-gray-700">{a.massa_magra_kg} kg</p>
                    </div>
                  )}
                  {a.massa_gorda_kg != null && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Massa Gorda</p>
                      <p className="text-sm font-bold text-gray-700">{a.massa_gorda_kg} kg</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => navigate(`/app/clientes/${studentId}/avaliacao-fisica/${a.id}`)}
                  className="p-1.5 rounded hover:bg-gray-100"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => setDeleteId(a.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir avaliação</h3>
            <p className="text-sm text-gray-500 mb-5">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Evoluções Tab ─────────────────────────────────────────── */

const PURPLE = "hsl(270 60% 50%)";
const ORANGE = "#f97316";
const GREEN  = "#22c55e";
const BLUE   = "#3b82f6";

function EvolucoesTab({ studentId, contractorId }: { studentId: string; contractorId: string }) {
  const [avais, setAvais]     = useState<Aval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("physical_evaluations")
      .select("id, data_avaliacao, peso_kg, imc, percentual_gordura, massa_magra_kg, massa_gorda_kg, altura_cm")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("data_avaliacao", { ascending: true })
      .then(({ data }) => {
        setAvais((data ?? []) as Aval[]);
        setLoading(false);
      });
  }, [studentId, contractorId]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  if (avais.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
          <ClipboardList className="w-7 h-7 text-primary/30" />
        </div>
        <p className="text-sm text-gray-400 font-semibold">Evoluções indisponíveis</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          São necessárias pelo menos 2 avaliações físicas para exibir os gráficos de evolução.
        </p>
      </div>
    );
  }

  const chartData = avais.map(a => ({
    data:     fmtDateShort(a.data_avaliacao),
    peso:     a.peso_kg,
    imc:      a.imc,
    gordura:  a.percentual_gordura,
    magra:    a.massa_magra_kg,
  }));

  function Chart({ title, dataKey, color, unit }: {
    title: string; dataKey: string; color: string; unit: string;
  }) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v: unknown) => [`${v} ${unit}`, title]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-bold text-gray-800 mb-4">Evolução Física</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Chart title="Peso (kg)"         dataKey="peso"    color={PURPLE} unit="kg" />
        <Chart title="IMC"               dataKey="imc"     color={BLUE}   unit="" />
        <Chart title="% Gordura"         dataKey="gordura" color={ORANGE} unit="%" />
        <Chart title="Massa Magra (kg)"  dataKey="magra"   color={GREEN}  unit="kg" />
      </div>
    </div>
  );
}

/* ── Vendas Tab ─────────────────────────────────────────────── */

function VendasTab({ studentId, contractorId }: {
  studentId: string; contractorId: string;
}) {
  const navigate = useNavigate();
  const [vendas, setVendas]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("student_contracts")
      .select(`
        id, created_at, data_inicio, data_fim, status,
        valor_mensalidade, forma_pagamento,
        contratos!contrato_id(descricao, duracao, tipo_duracao, valor_total)
      `)
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setVendas((data ?? []) as any[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [studentId, contractorId]);

  const STATUS_VENDA: Record<string, { label: string; bg: string; text: string }> = {
    ativo:     { label: "Ativo",     bg: "bg-green-100",  text: "text-green-700"  },
    cancelado: { label: "Cancelado", bg: "bg-red-100",    text: "text-red-700"    },
    suspenso:  { label: "Suspenso",  bg: "bg-yellow-100", text: "text-yellow-700" },
    congelado: { label: "Congelado", bg: "bg-blue-100",   text: "text-blue-700"   },
    encerrado: { label: "Encerrado", bg: "bg-gray-100",   text: "text-gray-500"   },
  };

  const FORMA_VENDA: Record<string, string> = {
    dinheiro: "Dinheiro", pix: "Pix", cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito", boleto: "Boleto", transferencia: "Transferência",
  };

  function fmtDur(duracao: number, tipo: string) {
    if (tipo === "meses") return `${duracao} ${duracao === 1 ? "mês" : "meses"}`;
    if (tipo === "dias")  return `${duracao} dia${duracao !== 1 ? "s" : ""}`;
    if (tipo === "anos")  return `${duracao} ano${duracao !== 1 ? "s" : ""}`;
    return `${duracao} ${tipo}`;
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">Vendas</h2>
        <button
          onClick={() => navigate(`/app/clientes/${studentId}/venda`)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> NOVA VENDA
        </button>
      </div>

      {vendas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-gray-100">
          <DollarSign className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400 font-semibold">Nenhuma venda registrada</p>
          <p className="text-xs text-gray-400">Clique em "NOVA VENDA" para vincular este aluno a um plano.</p>
          <button
            onClick={() => navigate(`/app/clientes/${studentId}/venda`)}
            className="mt-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            + NOVA VENDA
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Data</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Plano</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Duração</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Valor mensal</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Pagamento</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v: any, i: number) => {
                const contrato = v.contratos as any;
                const st = STATUS_VENDA[v.status] ?? { label: v.status, bg: "bg-gray-100", text: "text-gray-500" };
                return (
                  <tr
                    key={v.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}
                  >
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">
                        {contrato?.descricao ?? "—"}
                      </p>
                      {v.data_inicio && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(v.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                          {v.data_fim ? ` → ${new Date(v.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                      {contrato ? fmtDur(contrato.duracao, contrato.tipo_duracao) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-800 whitespace-nowrap">
                      {v.valor_mensalidade
                        ? v.valor_mensalidade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                      {FORMA_VENDA[v.forma_pagamento] ?? v.forma_pagamento ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Modal Detalhes do Contrato ─────────────────────────────── */

const STATUS_SC_SHARED: Record<string, { label: string; bg: string; text: string }> = {
  ativo:      { label: "Ativo",      bg: "bg-green-100",  text: "text-green-700"  },
  cancelado:  { label: "Cancelado",  bg: "bg-red-100",    text: "text-red-700"    },
  suspenso:   { label: "Suspenso",   bg: "bg-yellow-100", text: "text-yellow-700" },
  congelado:  { label: "Congelado",  bg: "bg-blue-100",   text: "text-blue-700"   },
  encerrado:  { label: "Encerrado",  bg: "bg-gray-100",   text: "text-gray-500"   },
};

const DIAS_SEMANA: Record<string, string> = {
  "0": "Domingo", "1": "Segunda-feira", "2": "Terça-feira", "3": "Quarta-feira",
  "4": "Quinta-feira", "5": "Sexta-feira", "6": "Sábado",
  segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira",
  quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado", domingo: "Domingo",
};

function ContratoDetalheModal({ sc, contractorId, studentId, studentNome, onClose, onEncerrar }: {
  sc: any; contractorId: string; studentId: string; studentNome: string;
  onClose: () => void; onEncerrar: () => void;
}) {
  const [activeTab, setActiveTab] = useState("dados");
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [events, setEvents]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: enrData }, { data: evtData }] = await Promise.all([
      supabase.from("fixed_enrollments")
        .select("id, dia_semana, grid_id, schedule_grids!grid_id(modalidade_nome, hora_inicio, hora_fim, nome)")
        .eq("student_id", studentId)
        .eq("contractor_id", contractorId)
        .eq("ativo", true),
      supabase.from("contract_events")
        .select("id, descricao, usuario_nome, created_at")
        .eq("student_contract_id", sc.id)
        .order("created_at", { ascending: false }),
    ]);
    setEnrollments((enrData ?? []) as any[]);
    setEvents((evtData ?? []) as any[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [sc.id]);

  const contrato = sc.contratos as any;
  const status   = STATUS_SC_SHARED[sc.status] ?? STATUS_SC_SHARED.encerrado;

  // Agrupar matrículas por modalidade
  const byModalidade: Record<string, any[]> = {};
  enrollments.forEach(e => {
    const grid = e.schedule_grids as any;
    const key  = grid?.modalidade_nome ?? "Geral";
    if (!byModalidade[key]) byModalidade[key] = [];
    byModalidade[key].push(e);
  });

  const tabs = [
    { key: "dados",     label: "DADOS PRINCIPAIS" },
    ...Object.keys(byModalidade).map(m => ({ key: `mod_${m}`, label: m.toUpperCase() })),
    { key: "historico", label: "HISTÓRICO GERAL" },
  ];

  async function handleRemoverEnrollment(id: string) {
    await supabase.from("fixed_enrollments").update({ ativo: false }).eq("id", id);
    load();
    toast.success("Matrícula removida.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h3 className="text-base font-bold text-gray-900">Detalhes do contrato</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 mt-4 border-b border-gray-200 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : activeTab === "dados" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Descrição</p>
                  <p className="text-lg font-bold text-gray-800 leading-tight">{contrato?.descricao ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Situação</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Data de início</p>
                  <p className="text-base font-semibold text-gray-800">
                    {new Date(sc.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Data de validade</p>
                  <p className="text-base font-semibold text-gray-800">
                    {sc.data_fim ? new Date(sc.data_fim + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Duração</p>
                  <p className="text-base font-semibold text-gray-800">
                    {contrato?.duracao
                      ? `${contrato.duracao} ${contrato.tipo_duracao === "meses" ? (contrato.duracao === 1 ? "Mês" : "Meses") : contrato.tipo_duracao}`
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Valor</p>
                <p className="text-2xl font-extrabold text-green-600">
                  {Number(sc.valor_mensalidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {sc.renovacao_automatica && (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                    Renova automaticamente
                  </span>
                )}
                {sc.tipo_venda === "com_recorrencia" && (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    GoFit Pay
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Assinatura eletrônica</p>
                <p className="text-sm font-semibold text-gray-700">Não assinado</p>
              </div>
            </div>
          ) : activeTab === "historico" ? (
            <div>
              {events.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4 mb-3">Nenhum evento adicional registrado.</p>
              )}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 py-2">Descrição</th>
                    <th className="text-left text-xs font-semibold text-gray-500 py-2">Usuário</th>
                    <th className="text-left text-xs font-semibold text-gray-500 py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-3 text-sm text-gray-700">Contrato criado.</td>
                    <td className="py-3 text-sm text-gray-500">{studentNome}</td>
                    <td className="py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(sc.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} {new Date(sc.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                  {events.map(ev => (
                    <tr key={ev.id} className="border-b border-gray-50">
                      <td className="py-3 text-sm text-gray-700">{ev.descricao}</td>
                      <td className="py-3 text-sm text-gray-500">{ev.usuario_nome ?? "—"}</td>
                      <td className="py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} {new Date(ev.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Aba de modalidade */
            (() => {
              const modKey = activeTab.replace("mod_", "");
              const items  = byModalidade[modKey] ?? [];
              return (
                <div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-400">Modalidade</p>
                    <p className="text-base font-bold text-gray-800">{modKey}</p>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Nenhuma matrícula nesta modalidade.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((e: any) => {
                        const grid     = e.schedule_grids as any;
                        const diaLabel = DIAS_SEMANA[e.dia_semana] ?? e.dia_semana;
                        const horario  = grid ? `${String(grid.hora_inicio).slice(0,5)} às ${String(grid.hora_fim).slice(0,5)}` : "";
                        return (
                          <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-sm text-gray-700">
                              {grid?.modalidade_nome ?? modKey} — {diaLabel} — {horario}
                            </p>
                            <button onClick={() => handleRemoverEnrollment(e.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors" title="Remover matrícula">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onEncerrar}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors">
            ENCERRAR
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:underline">
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal Suspensão ─────────────────────────────────────────── */

function SuspensaoModal({ sc, contractorId, onClose, onSaved }: {
  sc: any; contractorId: string; onClose: () => void; onSaved: () => void;
}) {
  const [suspensoes, setSuspensoes] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);

  const [tipo, setTipo]           = useState<"determinado" | "indeterminado">("determinado");
  const [motivo, setMotivo]       = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim]     = useState("");

  const qtdDias = tipo === "determinado" && dataInicio && dataFim
    ? Math.max(0, Math.round((new Date(dataFim + "T00:00:00").getTime() - new Date(dataInicio + "T00:00:00").getTime()) / 86400000))
    : null;

  async function load() {
    const { data } = await supabase.from("contract_suspensions")
      .select("*").eq("student_contract_id", sc.id)
      .order("data_inicio", { ascending: false });
    setSuspensoes((data ?? []) as any[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [sc.id]);

  async function handleSalvar() {
    if (!motivo.trim()) { toast.error("Informe o motivo."); return; }
    if (tipo === "determinado" && (!dataInicio || !dataFim)) { toast.error("Informe as datas."); return; }
    setSaving(true);
    const { error } = await supabase.from("contract_suspensions").insert({
      contractor_id: contractorId,
      student_contract_id: sc.id,
      tipo, motivo: motivo.trim(),
      data_inicio: dataInicio,
      data_fim: tipo === "determinado" ? dataFim : null,
      quantidade_dias: qtdDias,
      status: "ativa",
    });
    if (error) { toast.error("Erro ao criar suspensão."); setSaving(false); return; }
    await supabase.from("student_contracts")
      .update({ status: "suspenso", updated_at: new Date().toISOString() }).eq("id", sc.id);
    toast.success("Suspensão criada.");
    setSaving(false); setShowForm(false);
    setMotivo(""); setDataFim(""); setTipo("determinado");
    load(); onSaved();
  }

  async function handleEncerrarSuspensao(suspId: string) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("contract_suspensions")
      .update({ status: "encerrada", data_fim: today, updated_at: new Date().toISOString() }).eq("id", suspId);
    const { data: ativas } = await supabase.from("contract_suspensions")
      .select("id").eq("student_contract_id", sc.id).eq("status", "ativa").neq("id", suspId);
    if (!ativas?.length) {
      await supabase.from("student_contracts")
        .update({ status: "ativo", updated_at: new Date().toISOString() }).eq("id", sc.id);
    }
    toast.success("Suspensão encerrada.");
    load(); onSaved();
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Suspensões — {(sc.contratos as any)?.descricao}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : suspensoes.length > 0 ? (
            <div className="space-y-2 mb-4">
              {suspensoes.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.motivo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(s.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                      {s.data_fim ? ` → ${new Date(s.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}` : " (indeterminado)"}
                      {s.quantidade_dias ? ` · ${s.quantidade_dias} dias` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status === "ativa" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.status === "ativa" ? "Ativa" : "Encerrada"}
                    </span>
                    {s.status === "ativa" && (
                      <button onClick={() => handleEncerrarSuspensao(s.id)}
                        className="text-xs text-red-500 hover:underline font-semibold">
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !showForm ? (
            <p className="text-sm text-gray-400 text-center py-3 mb-4">Nenhuma suspensão registrada.</p>
          ) : null}

          {showForm ? (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-800">Nova suspensão</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tempo *</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as any)} className={inputCls}>
                  <option value="determinado">Determinado</option>
                  <option value="indeterminado">Indeterminado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Motivo *</label>
                <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Motivo da suspensão" className={inputCls} />
              </div>
              <div className={`grid gap-3 ${tipo === "determinado" ? "grid-cols-3" : "grid-cols-1"}`}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data inicial *</label>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
                </div>
                {tipo === "determinado" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Data final *</label>
                      <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Quantidade de dias</label>
                      <input type="text" value={qtdDias ?? ""} readOnly
                        className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setShowForm(false)} className="text-sm font-semibold text-gray-500 hover:underline">
                  Cancelar
                </button>
                <button onClick={handleSalvar} disabled={saving}
                  className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? "Salvando..." : "SALVAR"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-primary hover:text-primary transition-colors">
              <Plus className="w-4 h-4" /> SUSPENSÃO
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Modal Encerrar Contrato ─────────────────────────────────── */

const MOTIVOS_ENCERRAMENTO_DEFAULT = [
  "Mudança de endereço", "Perda de renda", "Mudou de contrato/plano",
  "Sem Retorno Whatsapp", "Atendimento do Professor", "Trabalho",
  "Incompatibilidade de Horários", "Outros Motivos",
];

function EncerrarModal({ sc, contractorId, studentId, onClose, onSaved }: {
  sc: any; contractorId: string; studentId: string; onClose: () => void; onSaved: () => void;
}) {
  const [step, setStep]           = useState<"escolha" | "agora" | "programar">("escolha");
  const [motivo, setMotivo]       = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataEnc, setDataEnc]     = useState("");
  const [opcaoContas, setOpcaoContas] = useState<"cancelar" | "manter" | null>(null);
  const [totalAberto, setTotalAberto] = useState<number>(0);
  const [motivos, setMotivos]     = useState<string[]>(MOTIVOS_ENCERRAMENTO_DEFAULT);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    async function load() {
      // Carregar motivos cadastrados + contas em aberto em paralelo
      const [{ data: motivosData }, { data: contasData }] = await Promise.all([
        supabase.from("crm_config")
          .select("nome").eq("contractor_id", contractorId)
          .eq("categoria", "motivo_encerramento").eq("ativo", true)
          .order("ordem").order("nome"),
        supabase.from("receivables")
          .select("valor").eq("student_contract_id", sc.id)
          .in("status", ["pendente", "aguardando"]),
      ]);
      if (motivosData && motivosData.length > 0) {
        setMotivos(motivosData.map(m => m.nome));
      }
      const total = (contasData ?? []).reduce((sum, r) => sum + Number(r.valor), 0);
      setTotalAberto(total);
    }
    load();
  }, [sc.id, contractorId]);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  async function handleEncerrar() {
    if (!motivo) { toast.error("Selecione o motivo de encerramento."); return; }
    if (totalAberto > 0 && !opcaoContas) { toast.error("Escolha o que fazer com as contas em aberto."); return; }
    setSaving(true);

    // Atualizar contrato
    const { error } = await supabase.from("student_contracts").update({
      status: "encerrado",
      motivo_encerramento: motivo,
      descricao_encerramento: descricao.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", sc.id);
    if (error) { toast.error("Erro ao encerrar contrato."); setSaving(false); return; }

    // Tratar contas em aberto
    if (totalAberto > 0 && opcaoContas === "cancelar") {
      await supabase.from("receivables")
        .delete()
        .eq("student_contract_id", sc.id)
        .in("status", ["pendente", "aguardando"]);
    }

    // Registrar evento no histórico
    await supabase.from("contract_events").insert({
      contractor_id: contractorId,
      student_contract_id: sc.id,
      descricao: `Contrato encerrado. Motivo: ${motivo}${descricao.trim() ? ` — ${descricao.trim()}` : ""}`,
    });

    toast.success("Contrato encerrado.");
    setSaving(false);
    onSaved();
  }

  async function handleProgramar() {
    if (!motivo) { toast.error("Selecione o motivo de encerramento."); return; }
    if (!dataEnc) { toast.error("Informe a data de encerramento."); return; }
    setSaving(true);

    const { error } = await supabase.from("student_contracts").update({
      data_encerramento_prog: dataEnc,
      motivo_encerramento: motivo,
      descricao_encerramento: descricao.trim() || null,
      cancelar_contas_encerrar: opcaoContas === "cancelar",
      updated_at: new Date().toISOString(),
    }).eq("id", sc.id);
    if (error) { toast.error("Erro ao programar encerramento."); setSaving(false); return; }

    await supabase.from("contract_events").insert({
      contractor_id: contractorId,
      student_contract_id: sc.id,
      descricao: `Encerramento programado para ${new Date(dataEnc + "T00:00:00").toLocaleDateString("pt-BR")}. Motivo: ${motivo}`,
    });

    toast.success(`Encerramento programado para ${new Date(dataEnc + "T00:00:00").toLocaleDateString("pt-BR")}.`);
    setSaving(false);
    onSaved();
  }

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        {/* ── Passo 1: escolha ── */}
        {step === "escolha" && (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center">
              <span className="text-3xl text-gray-300 font-light">?</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Confirmação</h3>
              <p className="text-sm text-gray-500">Deseja encerrar agora ou programar o encerramento do contrato?</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              <button onClick={() => setStep("agora")}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm">
                Encerrar agora
              </button>
              <button onClick={() => setStep("programar")}
                className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors text-sm">
                Programar
              </button>
            </div>
          </div>
        )}

        {/* ── Passo 2a: Encerrar agora ── */}
        {step === "agora" && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Encerrar contrato</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls}>
                  <option value="">Motivo de encerramento *</option>
                  {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Descrição (opcional)" className={inputCls} />
              </div>
              {totalAberto > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Este contrato possui contas a receber em aberto no valor de{" "}
                    <span className="font-bold text-green-600">{fmtBRL(totalAberto)}</span>.
                  </p>
                  <p className="text-xs font-semibold text-gray-500">O que deseja fazer?</p>
                  {["cancelar", "manter"].map(op => (
                    <label key={op} className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" name="opcao_agora" value={op}
                        checked={opcaoContas === op}
                        onChange={() => setOpcaoContas(op as any)}
                        className="mt-0.5 accent-primary" />
                      <span className="text-sm text-gray-700">
                        {op === "cancelar"
                          ? "Encerrar contrato e cancelar as contas a receber em aberto"
                          : "Encerrar apenas o contrato (manter as contas a receber em aberto)"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:underline">FECHAR</button>
              <button onClick={handleEncerrar} disabled={saving}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-60 transition-colors">
                {saving ? "Encerrando..." : "ENCERRAR"}
              </button>
            </div>
          </>
        )}

        {/* ── Passo 2b: Programar ── */}
        {step === "programar" && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Programar encerramento do contrato</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls}>
                  <option value="">Motivo de encerramento *</option>
                  {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Descrição (opcional)" className={inputCls} />
              </div>
              <div>
                <input type="date" value={dataEnc} onChange={e => setDataEnc(e.target.value)}
                  placeholder="Data encerramento *" className={inputCls} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500">O que deseja fazer caso o contrato possua contas em aberto no momento do encerramento?</p>
                {["cancelar", "manter"].map(op => (
                  <label key={op} className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="opcao_prog" value={op}
                      checked={opcaoContas === op}
                      onChange={() => setOpcaoContas(op as any)}
                      className="mt-0.5 accent-primary" />
                    <span className="text-sm text-gray-700">
                      {op === "cancelar"
                        ? "Encerrar contrato e cancelar as contas a receber em aberto"
                        : "Encerrar apenas o contrato (manter as contas a receber em aberto)"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:underline">FECHAR</button>
              <button onClick={handleProgramar} disabled={saving}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-60 transition-colors">
                {saving ? "Salvando..." : "PROGRAMAR"}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

/* ── Contratos Tab ─────────────────────────────────────────── */

const STATUS_SC: Record<string, { label: string; bg: string; text: string }> = {
  ativo:      { label: "Ativo",      bg: "bg-green-100",  text: "text-green-700"  },
  cancelado:  { label: "Cancelado",  bg: "bg-red-100",    text: "text-red-700"    },
  suspenso:   { label: "Suspenso",   bg: "bg-yellow-100", text: "text-yellow-700" },
  congelado:  { label: "Congelado",  bg: "bg-blue-100",   text: "text-blue-700"   },
  encerrado:  { label: "Encerrado",  bg: "bg-gray-100",   text: "text-gray-500"   },
};

type ContratoAction = { type: "cancelar" | "cancelar_venda" | "suspender" | "reativar"; id: string; plano_id?: string } | null;

function ContratosTab({ studentId, contractorId, student }: {
  studentId: string; contractorId: string; student: StudentDetail | null;
}) {
  const navigate = useNavigate();
  const [scs, setScs]         = useState<any[]>([]);
  const [autDocs, setAutDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction]   = useState<ContratoAction>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  /* novos modais */
  const [detalheOpen,   setDetalheOpen]   = useState<any | null>(null); // sc object
  const [suspensaoOpen, setSuspensaoOpen] = useState<any | null>(null); // sc object
  const [encerrarOpen,  setEncerrarOpen]  = useState<any | null>(null); // sc object

  const [saving, setSaving] = useState(false);

  /* assinatura eletrônica state */
  const [autTarget, setAutTarget]   = useState<{ scId: string; contratoDesc: string } | null>(null);
  const [autEmail,  setAutEmail]    = useState(student?.email ?? "");
  const [autSaving, setAutSaving]   = useState(false);

  async function load() {
    setLoading(true);
    const [{ data }, { data: autData }] = await Promise.all([
      supabase.from("student_contracts")
        .select(`
          id, data_inicio, data_fim, status, valor_mensalidade,
          dia_vencimento, forma_pagamento, bloqueado, observacoes, created_at,
          data_congelamento_inicio, data_congelamento_fim, motivo_congelamento,
          contratos!contrato_id(descricao, tipo, duracao, tipo_duracao)
        `)
        .eq("contractor_id", contractorId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase.from("autentique_documents")
        .select("id, student_contract_id, status, link_assinatura, assinado_em, created_at")
        .eq("contractor_id", contractorId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
    ]);
    setScs((data ?? []) as any[]);
    setAutDocs((autData ?? []) as any[]);
    setLoading(false);
  }

  async function handleSolicitarAssinatura() {
    if (!autTarget || !autEmail.trim()) { toast.error("Informe o e-mail do aluno."); return; }
    const sc = scs.find(s => s.id === autTarget.scId);
    if (!sc) return;
    setAutSaving(true);
    try {
      const resp = await supabase.functions.invoke("solicitar-assinatura", {
        body: {
          contractor_id: contractorId,
          student_contract_id: autTarget.scId,
          student_id: studentId,
          student_nome: student?.nome_completo,
          student_email: autEmail.trim(),
          contrato_descricao: autTarget.contratoDesc,
          valor_mensalidade: sc.valor_mensalidade,
          data_inicio: sc.data_inicio,
          data_fim: sc.data_fim,
        },
      });
      if (resp.error || resp.data?.error) {
        toast.error(resp.data?.error ?? "Erro ao solicitar assinatura. Verifique se a API key do Autentique está configurada.");
      } else {
        toast.success("Documento enviado para assinatura!");
        const link = resp.data?.link_assinatura;
        if (link) {
          await navigator.clipboard.writeText(link).catch(() => {});
          toast.info("Link copiado para a área de transferência.");
        }
        load();
      }
    } catch {
      toast.error("Erro ao solicitar assinatura.");
    }
    setAutSaving(false);
    setAutTarget(null);
  }

  useEffect(() => { load(); }, [studentId, contractorId]);

  async function handleAction() {
    if (!action) return;
    setSaving(true);
    const now = new Date().toISOString();
    let update: Record<string, unknown> = { updated_at: now };

    // Deleta receivables pelo student_contract_id (dados novos) e também pelo
    // contrato_id legado (dados gerados antes da migration student_contract_id)
    async function deleteReceivables(scId: string, planoId?: string) {
      await supabase.from("receivables")
        .delete()
        .eq("student_contract_id", scId)
        .in("status", ["pendente", "aguardando", "cancelado"]);
      if (planoId) {
        await supabase.from("receivables")
          .delete()
          .eq("contrato_id", planoId)
          .is("student_contract_id", null)
          .in("status", ["pendente", "aguardando", "cancelado"]);
      }
    }

    if (action.type === "cancelar") {
      update.status = "cancelado";
      const { error } = await supabase.from("student_contracts").update(update as any).eq("id", action.id);
      if (error) { toast.error("Erro ao cancelar contrato."); setSaving(false); return; }
      await deleteReceivables(action.id, action.plano_id);
      toast.success("Matrícula cancelada e cobranças não pagas removidas.");
      setAction(null);
      setSaving(false);
      load();
      return;
    } else if (action.type === "cancelar_venda") {
      await deleteReceivables(action.id, action.plano_id);
      // Excluir student_contract
      const { error } = await supabase.from("student_contracts").delete().eq("id", action.id);
      if (error) { toast.error("Erro ao cancelar venda."); setSaving(false); return; }
      toast.success("Venda cancelada e cobranças removidas.");
      setAction(null);
      setSaving(false);
      load();
      return;
    } else if (action.type === "suspender") {
      update.status = "suspenso";
    } else if (action.type === "reativar") {
      update.status = "ativo";
      update.data_congelamento_inicio = null;
      update.data_congelamento_fim    = null;
      update.motivo_congelamento      = null;
    }

    const { error } = await supabase.from("student_contracts").update(update as any).eq("id", action.id);
    if (error) { toast.error("Erro ao atualizar contrato."); setSaving(false); return; }

    const labels: Record<string, string> = {
      cancelar: "Matrícula cancelada.", suspender: "Contrato suspenso.",
      reativar: "Contrato reativado.",
    };
    toast.success(labels[action.type]);
    setAction(null);
    setSaving(false);
    load();
  }

  const FORMA_LABEL: Record<string, string> = {
    dinheiro: "Dinheiro", pix: "Pix", cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito", boleto: "Boleto", transferencia: "Transferência",
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">Contratos e Matrículas</h2>
      </div>

      {scs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-gray-100">
          <ScrollText className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400 font-semibold">Nenhuma matrícula registrada</p>
          <p className="text-xs text-gray-400">Acesse a aba "Vendas" para iniciar uma nova venda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scs.map((sc: any) => {
            const contrato = sc.contratos as any;
            const sStyle = STATUS_SC[sc.status] ?? STATUS_SC.encerrado;
            const isActive    = sc.status === "ativo";
            const isFrozen    = false; // congelamento removido — use suspensão
            const isSuspended = sc.status === "suspenso";
            const canReactivate = isFrozen || isSuspended;
            return (
              <div key={sc.id} className={`bg-white rounded-xl border shadow-sm px-6 py-4 ${sc.bloqueado ? "border-red-300" : isFrozen ? "border-blue-200" : isSuspended ? "border-yellow-200" : "border-gray-100"}`}>
                {sc.bloqueado && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm text-red-700">
                    ⚠ Aluno bloqueado por inadimplência
                  </div>
                )}
                {isFrozen && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-sm text-blue-700">
                    ❄ Contrato congelado
                    {sc.data_congelamento_inicio && sc.data_congelamento_fim && (
                      <span className="ml-1">
                        · {new Date(sc.data_congelamento_inicio + "T00:00:00").toLocaleDateString("pt-BR")} até {new Date(sc.data_congelamento_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {sc.motivo_congelamento && <span className="ml-1">· {sc.motivo_congelamento}</span>}
                  </div>
                )}
                {isSuspended && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3 text-sm text-yellow-700">
                    ⏸ Contrato suspenso
                  </div>
                )}
                {sc.data_encerramento_prog && sc.status === "ativo" && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 text-sm text-orange-700">
                    🕐 Encerramento programado para {new Date(sc.data_encerramento_prog + "T00:00:00").toLocaleDateString("pt-BR")}
                    {sc.motivo_encerramento && <span className="ml-1">· {sc.motivo_encerramento}</span>}
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="text-sm font-bold text-gray-800">{contrato?.descricao ?? "Plano"}</p>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${sStyle.bg} ${sStyle.text}`}>
                        {sStyle.label}
                      </span>
                      {sc.tipo_venda === "com_recorrencia" && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          GoFit Pay
                        </span>
                      )}
                      {sc.renovacao_automatica && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Renova automaticamente
                        </span>
                      )}
                    </div>
                    {sc.data_fim && (
                      <p className="text-xs text-gray-400 mb-2">
                        {contrato?.duracao ? `${contrato.duracao} ${contrato.tipo_duracao === "meses" ? "Meses" : contrato.tipo_duracao}` : ""} · Válido até{" "}
                        <strong className="text-gray-600">{new Date(sc.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}</strong>
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-500">
                      <div>
                        <p className="text-gray-400">Início</p>
                        <p className="font-semibold text-gray-700">
                          {new Date(sc.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Mensalidade</p>
                        <p className="font-extrabold text-gray-800">
                          {Number(sc.valor_mensalidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Vencimento</p>
                        <p className="font-semibold text-gray-700">Dia {sc.dia_vencimento}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Pagamento</p>
                        <p className="font-semibold text-gray-700">{FORMA_LABEL[sc.forma_pagamento] ?? sc.forma_pagamento ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                  {/* 3-dot menu */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === sc.id ? null : sc.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5"  r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpenId === sc.id && (
                      <div className="absolute right-0 top-9 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-52">
                        {/* Detalhes */}
                        <button onClick={() => { setDetalheOpen(sc); setMenuOpenId(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium">
                          Detalhes
                        </button>
                        {/* Suspensão */}
                        {(isActive || isSuspended) && (
                          <button onClick={() => { setSuspensaoOpen(sc); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            Suspensão
                          </button>
                        )}
                        {/* Reativar */}
                        {canReactivate && (
                          <button onClick={() => { setAction({ type: "reativar", id: sc.id }); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50">
                            Reativar
                          </button>
                        )}
                        {/* Imprimir contrato */}
                        <button onClick={() => { toast.info("Impressão de contrato em breve."); setMenuOpenId(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <Printer className="w-3.5 h-3.5 text-gray-400" /> Imprimir contrato
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        {/* Encerrar */}
                        <button onClick={() => { setEncerrarOpen(sc); setMenuOpenId(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          Encerrar
                        </button>
                        {/* Cancelar venda */}
                        <button onClick={() => { setAction({ type: "cancelar_venda", id: sc.id, plano_id: sc.contrato_id }); setMenuOpenId(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                          Cancelar venda
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assinatura eletrônica */}
                {(() => {
                  const autDoc = autDocs.find(d => d.student_contract_id === sc.id);
                  if (autDoc) {
                    const STATUS_AUT: Record<string, { label: string; cls: string }> = {
                      aguardando_assinatura: { label: "Aguardando assinatura", cls: "bg-yellow-100 text-yellow-700" },
                      assinado:              { label: "Assinado",              cls: "bg-green-100 text-green-700"  },
                      recusado:              { label: "Recusado",              cls: "bg-red-100 text-red-600"      },
                    };
                    const s = STATUS_AUT[autDoc.status] ?? { label: autDoc.status, cls: "bg-gray-100 text-gray-500" };
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Assinatura eletrônica:</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                        </div>
                        {autDoc.link_assinatura && (
                          <div className="flex items-center gap-2">
                            <a href={autDoc.link_assinatura} target="_blank" rel="noreferrer"
                               className="text-xs font-semibold text-primary hover:underline">
                              Ver no Autentique
                            </a>
                            <button
                              onClick={() => { navigator.clipboard.writeText(autDoc.link_assinatura); toast.success("Link copiado!"); }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                              title="Copiar link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (sc.status === "ativo" || sc.status === "congelado") ? (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setAutTarget({ scId: sc.id, contratoDesc: (sc.contratos as any)?.descricao ?? "Plano" });
                          setAutEmail(student?.email ?? "");
                        }}
                        className="text-xs font-semibold text-gray-500 hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Solicitar assinatura eletrônica
                      </button>
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Backdrop para fechar menu 3-pontos */}
      {menuOpenId && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpenId(null)} />
      )}

      {/* Modal Detalhes */}
      {detalheOpen && (
        <ContratoDetalheModal
          sc={detalheOpen}
          contractorId={contractorId}
          studentId={studentId}
          studentNome={student?.nome_completo ?? ""}
          onClose={() => setDetalheOpen(null)}
          onEncerrar={() => {
            setEncerrarOpen(detalheOpen);
            setDetalheOpen(null);
          }}
        />
      )}

      {/* Modal Suspensão */}
      {suspensaoOpen && (
        <SuspensaoModal
          sc={suspensaoOpen}
          contractorId={contractorId}
          onClose={() => setSuspensaoOpen(null)}
          onSaved={() => { setSuspensaoOpen(null); load(); }}
        />
      )}

      {/* Modal Encerrar */}
      {encerrarOpen && (
        <EncerrarModal
          sc={encerrarOpen}
          contractorId={contractorId}
          studentId={studentId}
          onClose={() => setEncerrarOpen(null)}
          onSaved={() => { setEncerrarOpen(null); load(); }}
        />
      )}

      {/* Modal assinatura */}
      {autTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAutTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">Solicitar assinatura eletrônica</h3>
            <p className="text-sm text-gray-400 mb-4">Um link de assinatura será gerado via Autentique e enviado para o aluno.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail do aluno *</label>
              <input
                type="email"
                value={autEmail}
                onChange={e => setAutEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Contrato: <strong>{autTarget.contratoDesc}</strong></p>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setAutTarget(null)} className="text-sm font-bold text-gray-500 hover:underline" disabled={autSaving}>
                Cancelar
              </button>
              <button
                onClick={handleSolicitarAssinatura}
                disabled={autSaving}
                className="bg-primary text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {autSaving ? "Enviando..." : "Solicitar assinatura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de ação */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              {{
                cancelar: "Cancelar matrícula",
                cancelar_venda: "Cancelar venda",
                suspender: "Suspender contrato",
                reativar: "Reativar contrato",
              }[action.type]}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {{
                cancelar: "O contrato será marcado como cancelado e todas as cobranças pendentes serão canceladas.",
                cancelar_venda: "Atenção: o contrato e todas as cobranças não recebidas serão excluídos permanentemente. Esta ação não pode ser desfeita.",
                suspender: "O contrato será suspenso temporariamente. Você pode reativar a qualquer momento.",
                reativar: "O contrato voltará ao status ativo.",
              }[action.type]}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAction(null)} className="text-sm font-bold text-gray-500 hover:underline" disabled={saving}>
                Voltar
              </button>
              <button
                onClick={handleAction}
                disabled={saving}
                className={`text-white text-sm font-bold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors ${
                  action.type === "cancelar" || action.type === "cancelar_venda" ? "bg-red-600 hover:bg-red-700" :
                  action.type === "suspender" ? "bg-yellow-600 hover:bg-yellow-700" :
                  "bg-green-600 hover:bg-green-700"
                }`}
              >
                {saving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Financeiro Tab ─────────────────────────────────────────── */

const STATUS_REC: Record<string, { label: string; bg: string; text: string }> = {
  pendente:  { label: "Pendente",  bg: "bg-yellow-100", text: "text-yellow-700" },
  pago:      { label: "Pago",      bg: "bg-green-100",  text: "text-green-700"  },
  atrasado:  { label: "Atrasado",  bg: "bg-red-100",    text: "text-red-700"    },
  cancelado: { label: "Cancelado", bg: "bg-gray-100",   text: "text-gray-500"   },
};

function FinanceiroTab({ studentId, contractorId }: { studentId: string; contractorId: string }) {
  const [recs, setRecs]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [payModal, setPayModal] = useState<any | null>(null);
  const [payVal,   setPayVal]   = useState("");
  const [payForm,  setPayForm]  = useState("pix");
  const [paying,   setPaying]   = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("receivables")
      .select("id, descricao, valor, vencimento, status, tipo, forma_pagamento, valor_pago, pago_em")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("vencimento", { ascending: false });
    const today = new Date().toISOString().split("T")[0];
    const list = ((data ?? []) as any[]).map(r => ({
      ...r,
      status: r.status === "pendente" && r.vencimento < today ? "atrasado" : r.status,
    }));
    setRecs(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, [studentId, contractorId]);

  const pendente  = recs.filter(r => r.status === "pendente").reduce((s, r) => s + r.valor, 0);
  const atrasado  = recs.filter(r => r.status === "atrasado").reduce((s, r) => s + r.valor, 0);
  const pago      = recs.filter(r => r.status === "pago").reduce((s, r) => s + (r.valor_pago ?? r.valor), 0);
  const proxVenc  = recs.filter(r => ["pendente","atrasado"].includes(r.status)).sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[0];

  async function handlePay() {
    if (!payModal) return;
    setPaying(true);
    const valor_pago = parseFloat(payVal.replace(",", ".")) || payModal.valor;
    await supabase.from("receivables").update({
      status: "pago", forma_pagamento: payForm,
      valor_pago, pago_em: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    }).eq("id", payModal.id);
    await supabase.from("transactions").insert({
      contractor_id: contractorId,
      tipo: "entrada",
      categoria: "Mensalidade",
      descricao: payModal.descricao,
      valor: valor_pago,
      data: new Date().toISOString().split("T")[0],
      forma_pagamento: payForm,
      receivable_id: payModal.id,
      student_id: studentId,
    });
    toast.success("Pagamento registrado!");
    setPaying(false);
    setPayModal(null);
    load();
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="text-base font-bold text-gray-800 mb-4">Financeiro</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Em atraso",      value: fmt(atrasado), color: atrasado > 0 ? "text-red-600" : "text-gray-800" },
          { label: "Pendente",       value: fmt(pendente), color: "text-yellow-700"  },
          { label: "Total pago",     value: fmt(pago),     color: "text-green-700"   },
          { label: "Próx. vencimento", value: proxVenc ? new Date(proxVenc.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—", color: "text-gray-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-base font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Cobranças */}
      {recs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 bg-white rounded-2xl border border-gray-100">
          <DollarSign className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-400">Nenhuma cobrança encontrada</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">DESCRIÇÃO</th>
                <th className="text-right text-xs font-semibold text-gray-400 px-5 py-3">VALOR</th>
                <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">VENCIMENTO</th>
                <th className="text-center text-xs font-semibold text-gray-400 px-5 py-3">STATUS</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {recs.map((r: any) => {
                const s = STATUS_REC[r.status] ?? STATUS_REC.pendente;
                return (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-700">{r.descricao}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-right text-gray-800">{fmt(r.valor)}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {new Date(r.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {["pendente","atrasado"].includes(r.status) && (
                        <button
                          onClick={() => { setPayModal(r); setPayVal(String(r.valor)); setPayForm(r.forma_pagamento ?? "pix"); }}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Receber
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pay modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPayModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900">Registrar pagamento</h3>
            <p className="text-sm text-gray-500">{payModal.descricao}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor recebido</label>
              <input
                type="number"
                step="0.01"
                value={payVal}
                onChange={e => setPayVal(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento</label>
              <select
                value={payForm}
                onChange={e => setPayForm(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {["pix","dinheiro","cartao_credito","cartao_debito","boleto"].map(f => (
                  <option key={f} value={f}>{{ pix:"Pix", dinheiro:"Dinheiro", cartao_credito:"Cartão crédito", cartao_debito:"Cartão débito", boleto:"Boleto" }[f] ?? f}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setPayModal(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function ClienteDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [student,    setStudent]    = useState<StudentDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<Tab>("Resumo");
  const [docModalData,        setDocModalData]        = useState<any | null>(null);
  const [exameModalData,      setExameModalData]      = useState<any | null>(null);
  const [deleteDocConfirm,    setDeleteDocConfirm]    = useState<string | null>(null);
  const [deleteExameConfirm,  setDeleteExameConfirm]  = useState<string | null>(null);
  const [documentos,          setDocumentos]          = useState<any[]>([]);
  const [exames,              setExames]              = useState<any[]>([]);
  const [kpiAtrasado,         setKpiAtrasado]         = useState(0);
  const [kpiPendente,         setKpiPendente]         = useState(0);
  const [kpiProxVenc,         setKpiProxVenc]         = useState<string | null>(null);
  const [bloqueado,           setBloqueado]           = useState(false);

  useEffect(() => {
    if (!id || !user?.contractorId) return;
    async function load() {
      const { data } = await supabase
        .from("students")
        .select("id, nome_completo, cpf, data_nascimento, sexo, status, telefone, email, foto_url, observacoes, objetivo, cidade, uf, created_at")
        .eq("id", id!)
        .eq("contractor_id", user!.contractorId!)
        .maybeSingle();
      setStudent(data as StudentDetail | null);
      setLoading(false);
    }
    load();
  }, [id, user]);

  const loadResumo = useCallback(async () => {
    if (!id || !user?.contractorId) return;
    const today = new Date().toISOString().split("T")[0];
    const [{ data: docs }, { data: exms }, { data: recs }, { data: scs }] = await Promise.all([
      supabase.from("student_documents").select("*").eq("student_id", id).eq("contractor_id", user.contractorId).order("created_at", { ascending: false }),
      supabase.from("student_exams").select("*").eq("student_id", id).eq("contractor_id", user.contractorId).order("created_at", { ascending: false }),
      supabase.from("receivables").select("valor, vencimento, status").eq("student_id", id).eq("contractor_id", user.contractorId).in("status", ["pendente","atrasado"]),
      supabase.from("student_contracts").select("bloqueado").eq("student_id", id).eq("contractor_id", user.contractorId).eq("status", "ativo"),
    ]);
    setDocumentos(docs ?? []);
    setExames(exms ?? []);
    const recsArr = (recs ?? []) as any[];
    const atrasados = recsArr.filter(r => r.status === "atrasado" || r.vencimento < today);
    const pendentes = recsArr.filter(r => r.status === "pendente" && r.vencimento >= today);
    setKpiAtrasado(atrasados.reduce((s: number, r: any) => s + r.valor, 0));
    setKpiPendente(pendentes.reduce((s: number, r: any) => s + r.valor, 0));
    const proxima = recsArr.filter(r => r.vencimento >= today).sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento))[0];
    setKpiProxVenc(proxima?.vencimento ?? null);
    setBloqueado(((scs ?? []) as any[]).some(sc => sc.bloqueado));
  }, [id, user]);

  useEffect(() => {
    if (activeTab === "Resumo") loadResumo();
  }, [activeTab, loadResumo]);

  async function handleDeleteDoc(docId: string) {
    await supabase.from("student_documents").delete().eq("id", docId);
    setDeleteDocConfirm(null);
    toast.success("Documento excluído.");
    loadResumo();
  }

  async function handleDeleteExame(exameId: string) {
    await supabase.from("student_exams").delete().eq("id", exameId);
    setDeleteExameConfirm(null);
    toast.success("Exame excluído.");
    loadResumo();
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-80">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!student) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">Cliente não encontrado.</p>
          <Link to="/app/clientes" className="text-xs text-primary hover:underline mt-2 inline-block">
            ← Voltar para clientes
          </Link>
        </div>
      </AppLayout>
    );
  }

  const age = calcAge(student.data_nascimento);
  const phone = student.telefone?.replace(/\D/g, "") ?? "";

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* ── Profile header ── */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <Link
            to="/app/clientes"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Clientes
          </Link>

          <div className="flex items-start gap-5">
            <div className="relative flex-shrink-0">
              {student.foto_url ? (
                <img src={student.foto_url} alt={student.nome_completo}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-100" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-2xl border-2 border-gray-100">
                  {getInitials(student.nome_completo)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-extrabold text-gray-900">{student.nome_completo}</h1>
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[student.status]}`}>
                  {STATUS_LABEL[student.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                {age !== null ? `${age} anos` : ""}
                {age !== null && student.sexo ? ", " : ""}
                {student.sexo ? SEX_LABEL[student.sexo] : ""}
                {!age && !student.sexo && "—"}
              </p>
              {student.objetivo && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary mb-3">
                  🎯 {student.objetivo}
                </span>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/app/clientes/${student.id}/cadastro`}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> CADASTRO
                </Link>
                {phone ? (
                  <button
                    onClick={() => window.open(`https://wa.me/55${phone}`, "_blank")}
                    className="inline-flex items-center gap-2 border border-green-500 text-green-600 text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WHATSAPP
                  </button>
                ) : (
                  <button disabled className="inline-flex items-center gap-2 border border-gray-200 text-gray-400 text-sm font-semibold px-5 py-2 rounded-lg cursor-not-allowed">
                    <MessageCircle className="w-3.5 h-3.5" /> WHATSAPP
                  </button>
                )}
                <button className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-semibold px-5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" /> MAIS AÇÕES
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-white border-b border-gray-200 px-8">
          <div className="flex items-center gap-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-6">
          {activeTab === "Treinos" ? (
            <TreinosTab
              studentId={student.id}
              studentName={student.nome_completo}
              contractorId={user!.contractorId!}
            />
          ) : activeTab === "Anamnese" ? (
            <AnamneseTab
              studentId={student.id}
              contractorId={user!.contractorId!}
              studentEmail={student.email}
              studentTelefone={student.telefone}
              studentName={student.nome_completo}
            />
          ) : activeTab === "Avaliações Físicas" ? (
            <AvaliacoesTab
              studentId={student.id}
              contractorId={user!.contractorId!}
            />
          ) : activeTab === "Evoluções" ? (
            <EvolucoesTab
              studentId={student.id}
              contractorId={user!.contractorId!}
            />
          ) : activeTab === "Vendas" ? (
            <VendasTab
              studentId={student.id}
              contractorId={user!.contractorId!}
            />
          ) : activeTab === "Contratos" ? (
            <ContratosTab
              studentId={student.id}
              contractorId={user!.contractorId!}
              student={student}
            />
          ) : activeTab === "Financeiro" ? (
            <FinanceiroTab
              studentId={student.id}
              contractorId={user!.contractorId!}
            />
          ) : activeTab !== "Resumo" ? (
            <ComingSoon tab={activeTab} />
          ) : (
            <div className="space-y-4">

              {/* Banner bloqueio */}
              {bloqueado && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-5 py-3.5">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-bold text-red-700">Aluno bloqueado por inadimplência</p>
                    <p className="text-xs text-red-600">Há cobranças em atraso. Regularize o pagamento para reativar o acesso.</p>
                  </div>
                </div>
              )}

              {/* KPI row — dados reais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {([
                  {
                    label: "Em atraso",
                    value: kpiAtrasado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                    bg: kpiAtrasado > 0 ? "bg-red-500" : "bg-gray-300",
                    icon: <DollarSign className="w-4 h-4 text-white" />,
                  },
                  {
                    label: "Pendente",
                    value: kpiPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                    bg: "bg-yellow-400",
                    icon: <DollarSign className="w-4 h-4 text-white" />,
                  },
                  { label: "Créditos",         value: "R$ 0,00", bg: "bg-emerald-500", icon: <DollarSign className="w-4 h-4 text-white" /> },
                  { label: "Saldo FitCoins",   value: "0 FC",    bg: "bg-amber-400",   icon: <Coins className="w-4 h-4 text-white" /> },
                  {
                    label: "Próx. vencimento",
                    value: kpiProxVenc ? new Date(kpiProxVenc + "T00:00:00").toLocaleDateString("pt-BR") : "—",
                    bg: "bg-emerald-500",
                    icon: <CalendarDays className="w-4 h-4 text-white" />,
                  },
                ] as { label: string; value: string; bg: string; icon: React.ReactNode }[]).map(({ label, value, bg, icon }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 leading-tight truncate">{label}</p>
                      <p className="text-sm font-extrabold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top grid — 3 colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Contratos */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <CardHeader
                    title="Contratos"
                    icon={<ScrollText className="w-3.5 h-3.5 text-blue-500" />}
                    iconBg="bg-blue-50"
                  >
                    <button className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </CardHeader>
                  <EmptyCard message="Nenhum contrato encontrado" />
                </div>

                {/* Clube de recompensas */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <CardHeader
                    title="Clube de recompensas"
                    icon={<Gift className="w-3.5 h-3.5 text-amber-500" />}
                    iconBg="bg-amber-50"
                  >
                    <button className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </CardHeader>
                  <EmptyCard message="Nenhuma recompensa registrada" />
                </div>

                {/* Exames */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <CardHeader
                    title="Exames"
                    icon={<FlaskConical className="w-3.5 h-3.5 text-purple-500" />}
                    iconBg="bg-purple-50"
                  >
                    <button
                      onClick={() => setExameModalData({})}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </CardHeader>
                  {exames.length === 0 ? (
                    <EmptyCard message="Nenhum resultado encontrado" />
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {exames.map((ex: any) => (
                        <div key={ex.id} className="px-4 py-3 flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <FlaskConical className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {ex.medico_nome ? `Dr. ${ex.medico_nome}` : "Exame"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {ex.data_exame ? new Date(ex.data_exame).toLocaleDateString("pt-BR") : "—"}
                              {ex.data_validade ? ` · Val: ${new Date(ex.data_validade).toLocaleDateString("pt-BR")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {ex.arquivo_url && (
                              <a href={ex.arquivo_url} target="_blank" rel="noreferrer" className="p-1 rounded text-gray-400 hover:text-primary hover:bg-gray-50 transition-colors" title="Baixar arquivo">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => setExameModalData(ex)} className="p-1 rounded text-gray-400 hover:text-primary hover:bg-gray-50 transition-colors" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteExameConfirm(ex.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modals — Documento */}
              {docModalData !== null && (
                <DocumentoModal
                  studentId={student.id}
                  contractorId={user!.contractorId!}
                  initialData={docModalData.id ? docModalData : undefined}
                  onClose={() => setDocModalData(null)}
                  onSaved={loadResumo}
                />
              )}
              {/* Modals — Exame */}
              {exameModalData !== null && (
                <ExameModal
                  studentId={student.id}
                  contractorId={user!.contractorId!}
                  initialData={exameModalData.id ? exameModalData : undefined}
                  onClose={() => setExameModalData(null)}
                  onSaved={loadResumo}
                />
              )}
              {/* Confirmar exclusão — Documento */}
              {deleteDocConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteDocConfirm(null)} />
                  <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-2">Excluir documento</h3>
                    <p className="text-sm text-gray-500 mb-5">Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setDeleteDocConfirm(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
                      <button onClick={() => handleDeleteDoc(deleteDocConfirm)} className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700">Excluir</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Confirmar exclusão — Exame */}
              {deleteExameConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteExameConfirm(null)} />
                  <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-2">Excluir exame</h3>
                    <p className="text-sm text-gray-500 mb-5">Tem certeza que deseja excluir este exame? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setDeleteExameConfirm(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
                      <button onClick={() => handleDeleteExame(deleteExameConfirm)} className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700">Excluir</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom grid — 2 colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Documentos */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <CardHeader
                    title="Documentos"
                    icon={<FileText className="w-3.5 h-3.5 text-blue-500" />}
                    iconBg="bg-blue-50"
                  >
                    <button
                      onClick={() => setDocModalData({})}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </CardHeader>
                  {documentos.length === 0 ? (
                    <EmptyCard message="Nenhum resultado encontrado" />
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {documentos.map((doc: any) => (
                        <div key={doc.id} className="px-4 py-3 flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{doc.titulo}</p>
                            {doc.descricao && (
                              <p className="text-xs text-gray-400 truncate">{doc.descricao}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {doc.arquivo_url && (
                              <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="p-1 rounded text-gray-400 hover:text-primary hover:bg-gray-50 transition-colors" title="Baixar arquivo">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => setDocModalData(doc)} className="p-1 rounded text-gray-400 hover:text-primary hover:bg-gray-50 transition-colors" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteDocConfirm(doc.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <CardHeader
                    title="Observações"
                    icon={<MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                    iconBg="bg-blue-50"
                  >
                    <Link
                      to={`/app/clientes/${student.id}/cadastro`}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                  </CardHeader>
                  <div className="px-5 py-4">
                    {student.observacoes ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{student.observacoes}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Sem observação informada</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
