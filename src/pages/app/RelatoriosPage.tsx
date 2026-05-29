import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, Download } from "lucide-react";
import { Users, Dumbbell, Zap, DollarSign, Calendar, BarChart2, Filter } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ComponentType } from "react";

/* ── Types ───────────────────────────────────────────── */
interface ModalItem {
  label:  string;
  link?:  string;
  export?: "clientes" | "inadimplentes" | "receita";
}

interface ModalSection {
  title:    string;
  headerBg: string;
  items:    ModalItem[];
}

interface ModalConfig {
  title:    string;
  columns:  1 | 2;
  sections: ModalSection[];
}

interface ReportCard {
  label:       string;
  modalKey:    string;
  Icon:        ComponentType<{ className?: string }>;
  iconColor:   string;
  iconBg:      string;
  textColor:   string;
  borderColor: string;
}

/* ── Report cards ────────────────────────────────────── */
const REPORTS: ReportCard[] = [
  { label: "Clientes",       modalKey: "clientes",      Icon: Users,      iconColor: "text-blue-300",   iconBg: "bg-blue-50",   textColor: "text-blue-500",   borderColor: "border-blue-400"   },
  { label: "Treinos",        modalKey: "treinos",       Icon: Dumbbell,   iconColor: "text-red-300",    iconBg: "bg-red-50",    textColor: "text-red-500",    borderColor: "border-red-400"    },
  { label: "Cross training", modalKey: "crosstraining", Icon: Zap,        iconColor: "text-gray-300",   iconBg: "bg-gray-50",   textColor: "text-gray-500",   borderColor: "border-gray-300"   },
  { label: "Financeiro",     modalKey: "financeiro",    Icon: DollarSign, iconColor: "text-green-300",  iconBg: "bg-green-50",  textColor: "text-green-500",  borderColor: "border-green-400"  },
  { label: "Agenda",         modalKey: "agenda",        Icon: Calendar,   iconColor: "text-purple-300", iconBg: "bg-purple-50", textColor: "text-purple-500", borderColor: "border-purple-400" },
  { label: "Geral",          modalKey: "geral",         Icon: BarChart2,  iconColor: "text-slate-300",  iconBg: "bg-slate-50",  textColor: "text-slate-400",  borderColor: "border-slate-300"  },
  { label: "CRM",            modalKey: "crm",           Icon: Filter,     iconColor: "text-orange-300", iconBg: "bg-orange-50", textColor: "text-orange-500", borderColor: "border-orange-400" },
];

/* ── Modal data ──────────────────────────────────────── */
const MODALS: Record<string, ModalConfig> = {
  clientes: {
    title: "Relatórios de clientes", columns: 2,
    sections: [
      { title: "Geral",             headerBg: "bg-blue-500",
        items: [
          { label: "Clientes",                     link: "/app/clientes", export: "clientes" },
          { label: "Aniversariantes",              link: "/app/clientes" },
          { label: "Evasão de clientes",           link: "/app/clientes" },
          { label: "Histórico de clientes ativos", link: "/app/clientes" },
          { label: "Cadastros online",             link: "/app/clientes" },
          { label: "Perfil de cliente",            link: "/app/clientes" },
          { label: "Risco de abandono",            link: "/app/clientes" },
        ],
      },
      { title: "Acessos/Presenças", headerBg: "bg-blue-500",
        items: [
          { label: "Acessos"                  },
          { label: "Faltantes"                },
          { label: "Frequência dos clientes"  },
          { label: "Clientes mais frequentes" },
          { label: "Presenças"                },
        ],
      },
      { title: "Contratos",         headerBg: "bg-blue-500",
        items: [
          { label: "Análise de contratos e modalidades", link: "/app/administrativo/contratos" },
          { label: "Contratos a vencer",                 link: "/app/administrativo/contratos" },
          { label: "Contratos agendados" },
          { label: "Contratos com aulas restantes" },
          { label: "Clientes por contrato",              link: "/app/clientes" },
          { label: "Clientes por assinatura do contrato", link: "/app/clientes" },
          { label: "Estatísticas dos contratos",         link: "/app/dashboards/clientes" },
          { label: "Novos clientes",                     link: "/app/clientes" },
        ],
      },
      { title: "Avaliações",        headerBg: "bg-blue-500",
        items: [
          { label: "Avaliações físicas realizadas",          link: "/app/clientes" },
          { label: "Avaliações físicas vencidas",            link: "/app/clientes" },
          { label: "Clientes sem avaliações físicas",        link: "/app/clientes" },
        ],
      },
    ],
  },
  treinos: {
    title: "Relatórios de treinos", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-red-500",
        items: [
          { label: "Clientes sem treinos", link: "/app/clientes"          },
          { label: "Próximos vencimentos"                                  },
          { label: "Treinos",              link: "/app/treinos/treinos"   },
          { label: "Treinos vencidos"                                      },
        ],
      },
    ],
  },
  crosstraining: {
    title: "Relatórios do Cross training", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-gray-900",
        items: [
          { label: "Recordes pessoais", link: "/app/wod" },
        ],
      },
    ],
  },
  financeiro: {
    title: "Relatórios financeiros", columns: 2,
    sections: [
      { title: "Geral",   headerBg: "bg-green-500",
        items: [
          { label: "Contas a pagar",                         link: "/app/financeiro/contas-a-pagar",   export: "inadimplentes" },
          { label: "Contas a receber",                       link: "/app/financeiro/contas-a-receber", export: "inadimplentes" },
          { label: "Contas a receber em atraso",             link: "/app/financeiro/contas-a-receber", export: "inadimplentes" },
          { label: "DRE Gerencial",                          link: "/app/financeiro/dre"              },
          { label: "Emissão de notas fiscais de serviços",   link: "/app/financeiro/nfs-e"            },
          { label: "Extrato de check-ins Wellhub"                                                     },
          { label: "Extrato de validações TotalPass"                                                  },
          { label: "Recorrências negadas"                                                              },
        ],
      },
      { title: "Caixa",   headerBg: "bg-green-500",
        items: [
          { label: "Fluxo de caixa",         link: "/app/financeiro/caixa" },
          { label: "Movimentações do caixa", link: "/app/financeiro/caixa" },
        ],
      },
      { title: "Receita", headerBg: "bg-green-500",
        items: [
          { label: "Receita",          link: "/app/financeiro/dre", export: "receita" },
          { label: "Receita detalhada",link: "/app/financeiro/dre"                    },
        ],
      },
      { title: "Vendas",  headerBg: "bg-green-500",
        items: [
          { label: "Vendas",           link: "/app/financeiro/vendas" },
          { label: "Vendas agendadas", link: "/app/financeiro/vendas" },
          { label: "Venda detalhada",  link: "/app/financeiro/vendas" },
        ],
      },
    ],
  },
  agenda: {
    title: "Relatórios de agenda", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-purple-600",
        items: [
          { label: "Check-in pelo app"          },
          { label: "Faltantes check-in"         },
          { label: "Locações"                   },
          { label: "Matrículas",                 link: "/app/clientes" },
          { label: "Presenças por contrato"     },
          { label: "Presenças por serviço"      },
          { label: "Top check-ins"              },
          { label: "Reagendamentos"             },
        ],
      },
    ],
  },
  geral: {
    title: "Relatórios gerais", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-gray-500",
        items: [
          { label: "Acessos de usuários pela catraca" },
          { label: "Acessos de usuários no sistema"  },
        ],
      },
    ],
  },
  crm: {
    title: "Relatórios do CRM", columns: 1,
    sections: [
      { title: "Oportunidades",       headerBg: "bg-orange-500",
        items: [
          { label: "Conversões de oportunidade", link: "/app/crm/oportunidades" },
          { label: "Origem das oportunidades",   link: "/app/crm/leads"         },
        ],
      },
      { title: "Funis e etapas",      headerBg: "bg-orange-500",
        items: [
          { label: "Desempenho por funil", link: "/app/dashboards/crm" },
        ],
      },
      { title: "Clube de recompensas", headerBg: "bg-orange-500",
        items: [
          { label: "Volume de pontos distribuídos por gatilho", link: "/app/crm/clube" },
        ],
      },
    ],
  },
};

/* ── CSV Exports ─────────────────────────────────────── */
function useExports() {
  const { user } = useAuth();

  async function exportClientes() {
    if (!user?.contractorId) return;
    const { data, error } = await supabase
      .from("students")
      .select("nome, cpf, email, telefone, status, created_at")
      .eq("contractor_id", user.contractorId)
      .order("nome");
    if (error || !data) { toast.error("Erro ao exportar."); return; }
    const rows = [["Nome", "CPF", "Email", "Telefone", "Status", "Cadastrado em"]];
    for (const r of data as any[]) {
      rows.push([
        r.nome ?? "",
        r.cpf ?? "",
        r.email ?? "",
        r.telefone ?? "",
        r.status ?? "",
        r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "",
      ]);
    }
    downloadCSV(rows, "clientes.csv");
  }

  async function exportInadimplentes() {
    if (!user?.contractorId) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("receivables")
      .select("student_nome, descricao, valor, vencimento, status")
      .eq("contractor_id", user.contractorId)
      .eq("status", "pendente")
      .lt("vencimento", today)
      .order("vencimento");
    if (error || !data) { toast.error("Erro ao exportar."); return; }
    const rows = [["Aluno", "Descrição", "Valor", "Vencimento"]];
    for (const r of data as any[]) {
      rows.push([
        r.student_nome ?? "",
        r.descricao ?? "",
        `R$ ${Number(r.valor).toFixed(2).replace(".", ",")}`,
        r.vencimento ? new Date(r.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "",
      ]);
    }
    downloadCSV(rows, "inadimplentes.csv");
  }

  async function exportReceita() {
    if (!user?.contractorId) return;
    const { data, error } = await supabase
      .from("transactions")
      .select("data, descricao, categoria, valor, student_nome")
      .eq("contractor_id", user.contractorId)
      .eq("tipo", "entrada")
      .order("data", { ascending: false });
    if (error || !data) { toast.error("Erro ao exportar."); return; }
    const rows = [["Data", "Descrição", "Categoria", "Aluno", "Valor"]];
    for (const r of data as any[]) {
      rows.push([
        r.data ? new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR") : "",
        r.descricao ?? "",
        r.categoria ?? "",
        r.student_nome ?? "",
        `R$ ${Number(r.valor).toFixed(2).replace(".", ",")}`,
      ]);
    }
    downloadCSV(rows, "receita.csv");
  }

  function downloadCSV(rows: string[][], filename: string) {
    const bom = "﻿";
    const csv = bom + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída.");
  }

  return { exportClientes, exportInadimplentes, exportReceita };
}

/* ── Section block ───────────────────────────────────── */
function SectionBlock({
  section,
  onNavigate,
  onExport,
}: {
  section:    ModalSection;
  onNavigate: (link: string) => void;
  onExport:   (key: string) => void;
}) {
  return (
    <div className="mb-5">
      <div className={`${section.headerBg} text-white text-sm font-semibold px-4 py-2 rounded-t-lg`}>
        {section.title}
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
        {section.items.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < section.items.length - 1 ? "border-b border-gray-100" : ""
            } ${item.link ? "hover:bg-gray-50" : ""}`}
          >
            <span className="text-sm text-gray-700">{item.label}</span>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {item.export && (
                <button
                  onClick={() => onExport(item.export!)}
                  title="Exportar CSV"
                  className="text-gray-400 hover:text-green-600 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              {item.link ? (
                <button
                  onClick={() => onNavigate(item.link!)}
                  className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                >
                  VISUALIZAR <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-xs font-bold text-gray-300 cursor-not-allowed">EM BREVE</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Generic report modal ────────────────────────────── */
function ReportModal({
  config,
  onClose,
  onNavigate,
  onExport,
}: {
  config:     ModalConfig;
  onClose:    () => void;
  onNavigate: (link: string) => void;
  onExport:   (key: string) => void;
}) {
  const maxW = config.columns === 2 ? "max-w-3xl" : "max-w-lg";

  const pairs: [ModalSection, ModalSection | null][] = [];
  if (config.columns === 2) {
    for (let i = 0; i < config.sections.length; i += 2) {
      pairs.push([config.sections[i], config.sections[i + 1] ?? null]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxW} max-h-[90vh] flex flex-col`}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">{config.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {config.columns === 2 ? (
            pairs.map(([left, right], i) => (
              <div key={i} className={right ? "grid grid-cols-2 gap-5" : ""}>
                <SectionBlock section={left} onNavigate={onNavigate} onExport={onExport} />
                {right && <SectionBlock section={right} onNavigate={onNavigate} onExport={onExport} />}
              </div>
            ))
          ) : (
            config.sections.map((section, i) => (
              <SectionBlock key={i} section={section} onNavigate={onNavigate} onExport={onExport} />
            ))
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-bold text-blue-500 hover:underline">
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function RelatoriosPage() {
  const [openModal, setOpenModal] = useState<string | null>(null);
  const navigate = useNavigate();
  const { exportClientes, exportInadimplentes, exportReceita } = useExports();

  function handleNavigate(link: string) {
    setOpenModal(null);
    navigate(link);
  }

  function handleExport(key: string) {
    if (key === "clientes")      exportClientes();
    if (key === "inadimplentes") exportInadimplentes();
    if (key === "receita")       exportReceita();
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 px-8 py-6">
        <h1 className="text-lg font-bold text-gray-800 mb-6 text-center">Relatórios</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {REPORTS.map(card => {
            const Icon = card.Icon;
            return (
              <div
                key={card.label}
                className={`bg-white rounded-xl border border-gray-100 border-b-4 ${card.borderColor} overflow-hidden flex flex-col`}
              >
                <div className={`${card.iconBg} flex items-center justify-center py-12`}>
                  <Icon className={`w-20 h-20 ${card.iconColor}`} />
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{card.label}</span>
                  <button
                    onClick={() => setOpenModal(card.modalKey)}
                    className={`text-xs font-bold uppercase tracking-widest ${card.textColor} hover:underline`}
                  >
                    Visualizar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openModal && MODALS[openModal] && (
        <ReportModal
          config={MODALS[openModal]}
          onClose={() => setOpenModal(null)}
          onNavigate={handleNavigate}
          onExport={handleExport}
        />
      )}
    </AppLayout>
  );
}
