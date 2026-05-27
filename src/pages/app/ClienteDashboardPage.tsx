import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ExternalLink, MoreHorizontal,
  Plus, Folder, Download, Pencil, CheckCircle2,
  Loader2, MessageCircle, ClipboardList, Dumbbell,
  MoreVertical, X, Sparkles, Users, BookOpen, Wand2,
  Trash2, Copy, Eye, Mail, Link2,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
      <span className="text-sm font-semibold text-gray-700">{title}</span>
      <div className="flex items-center gap-2">{children}</div>
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
  const [modelos,           setModelos]           = useState<{ id: string; descricao: string }[]>([]);
  const [modeloSelecionado, setModeloSelecionado] = useState<string | null>(null);
  const [enviando,          setEnviando]          = useState(false);
  const [itens,             setItens]             = useState<any[]>([]);
  const [loadingItens,      setLoadingItens]      = useState(false);

  useEffect(() => { load(); }, [studentId, contractorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("anamnese_respostas")
      .select("id, token, status, created_at, respondido_at, aceite, parq, anamnese_modelos(descricao)")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setRespostas((data ?? []) as any[]);
    setLoading(false);
  }

  async function openSelecionarModal() {
    const { data } = await supabase
      .from("anamnese_modelos")
      .select("id, descricao")
      .eq("contractor_id", contractorId)
      .order("descricao");
    setModelos((data ?? []) as { id: string; descricao: string }[]);
    setModeloSelecionado(null);
    setModalStep("selecting");
    setSelecionarModal(true);
  }

  function closeModal() {
    setSelecionarModal(false);
    setModalStep("selecting");
    setCreatedToken("");
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
    setEnviando(false);
    setModeloSelecionado(null);
    setCreatedToken((created as any).token ?? "");
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
                  {!respondida && r.token && (
                    <button
                      onClick={() => copyLink(r.token)}
                      title="Copiar link"
                      className="p-1.5 rounded hover:bg-gray-100"
                    >
                      <Link2 className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  <button
                    onClick={() => respondida && handleVerRespostas(r)}
                    title="Ver respostas"
                    className={`p-1.5 rounded hover:bg-gray-100 ${!respondida ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
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
              <button onClick={() => setVerModal(null)} className="p-1.5 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
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
                        return (
                          <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                            <p className="text-xs text-gray-500 mb-1">{p}</p>
                            <p className="text-sm font-medium text-gray-800">{resp ?? "—"}</p>
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

/* ── Main Page ────────────────────────────────────────────── */

export default function ClienteDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Resumo");

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

            <Link
              to={`/app/clientes/${student.id}/cadastro`}
              className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors flex-shrink-0"
              title="Editar cadastro"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
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
          ) : activeTab !== "Resumo" ? (
            <ComingSoon tab={activeTab} />
          ) : (
            <div className="space-y-5">

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "Em atraso",       value: "R$ 0,00",   iconBg: "bg-red-50",     iconColor: "text-red-500",    icon: "R$" },
                  { label: "Saldo devedor",    value: "R$ 0,00",   iconBg: "bg-teal-50",    iconColor: "text-teal-500",   icon: "R$" },
                  { label: "Créditos",         value: "R$ 0,00",   iconBg: "bg-teal-50",    iconColor: "text-teal-500",   icon: "R$" },
                  { label: "Saldo FitCoins",   value: "0 FC",      iconBg: "bg-yellow-50",  iconColor: "text-yellow-500", icon: "FC" },
                  { label: "Próx. vencimento", value: "—",         iconBg: "bg-teal-50",    iconColor: "text-teal-500",   icon: "📅" },
                ].map(({ label, value, iconBg, iconColor, icon }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-xs font-bold ${iconColor}`}>{icon}</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 leading-tight">{label}</p>
                      <p className="text-sm font-extrabold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-5">
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Contratos">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5">
                        <Folder className="w-4 h-4" />
                      </button>
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5">
                        <Plus className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhum contrato encontrado" />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Documentos">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5">
                        <Plus className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhum resultado encontrado" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Clube de recompensas">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhuma recompensa registrada" />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Exames">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5">
                        <Plus className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhum resultado encontrado" />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Observações">
                      <Link
                        to={`/app/clientes/${student.id}/cadastro`}
                        className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5"
                      >
                        <Pencil className="w-4 h-4" />
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
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
