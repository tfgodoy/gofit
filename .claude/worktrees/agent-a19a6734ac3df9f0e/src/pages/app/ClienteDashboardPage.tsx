import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ExternalLink, MoreHorizontal,
  Plus, Folder, Download, Pencil, CheckCircle2,
  Loader2, MessageCircle, ClipboardList,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type StudentStatus = "lead" | "ativo" | "inativo" | "cancelado";

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

const TABS = [
  "Resumo", "Comunicação", "Vendas", "Contratos",
  "Financeiro", "Treinos", "Avaliações Físicas", "Evoluções", "Serviços", "Anamnese",
] as const;
type Tab = typeof TABS[number];

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

/* ── card header helper ──────────────────────────────── */
function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
      <span className="text-sm font-semibold text-gray-700">{title}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ── empty state helper ──────────────────────────────── */
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

/* ── coming soon placeholder ─────────────────────────── */
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

          {/* Back link */}
          <Link
            to="/app/clientes"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Clientes
          </Link>

          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {student.foto_url ? (
                <img
                  src={student.foto_url}
                  alt={student.nome_completo}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-2xl border-2 border-gray-100">
                  {getInitials(student.nome_completo)}
                </div>
              )}
            </div>

            {/* Name + info */}
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

              {/* Action buttons */}
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

            {/* External link top-right */}
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
          {activeTab !== "Resumo" ? (
            <ComingSoon tab={activeTab} />
          ) : (
            <div className="space-y-5">

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "Em atraso",       value: "R$ 0,00",   iconBg: "bg-red-50",     iconColor: "text-red-500",   icon: "R$" },
                  { label: "Saldo devedor",    value: "R$ 0,00",   iconBg: "bg-teal-50",    iconColor: "text-teal-500",  icon: "R$" },
                  { label: "Créditos",         value: "R$ 0,00",   iconBg: "bg-teal-50",    iconColor: "text-teal-500",  icon: "R$" },
                  { label: "Saldo FitCoins",   value: "0 FC",      iconBg: "bg-yellow-50",  iconColor: "text-yellow-500",icon: "FC" },
                  { label: "Próx. vencimento", value: "—",         iconBg: "bg-teal-50",    iconColor: "text-teal-500",  icon: "📅" },
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

                {/* LEFT column */}
                <div className="space-y-5">

                  {/* Contratos */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Contratos">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors">
                        <Folder className="w-4 h-4" />
                      </button>
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhum contrato encontrado" />
                  </div>

                  {/* Documentos */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Documentos">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhum resultado encontrado" />
                  </div>
                </div>

                {/* RIGHT column */}
                <div className="space-y-5">

                  {/* Clube de recompensas */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Clube de recompensas">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhuma recompensa registrada" />
                  </div>

                  {/* Exames */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Exames">
                      <button className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <EmptyCard message="Nenhum resultado encontrado" />
                  </div>

                  {/* Observações */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <CardHeader title="Observações">
                      <Link
                        to={`/app/clientes/${student.id}/cadastro`}
                        className="p-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
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
