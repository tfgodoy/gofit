import { useState } from "react";
import { X } from "lucide-react";
import { Users, Dumbbell, Zap, DollarSign, Calendar, BarChart2, Filter } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import type { ComponentType } from "react";

/* ── Types ───────────────────────────────────────────── */
interface ModalSection {
  title:    string;
  headerBg: string;
  items:    string[];
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
        items: ["Aniversariantes","Cadastros online","Clientes","Evasão de clientes","Histórico de clientes ativos","Perfil de cliente","Risco de abandono"] },
      { title: "Acessos/Presenças", headerBg: "bg-blue-500",
        items: ["Acessos","Faltantes","Frequência dos clientes","Clientes mais frequentes","Presenças"] },
      { title: "Contratos",         headerBg: "bg-blue-500",
        items: ["Análise de contratos e modalidades","Contratos a vencer","Contratos agendados","Contratos com aulas restantes","Clientes por contrato","Clientes por assinatura do contrato","Estatísticas dos contratos","Novos clientes"] },
      { title: "Avaliações",        headerBg: "bg-blue-500",
        items: ["Avaliações físicas realizadas","Avaliações físicas vencidas","Clientes sem avaliações físicas"] },
    ],
  },
  treinos: {
    title: "Relatórios de treinos", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-red-500",
        items: ["Clientes sem treinos","Próximos vencimentos","Treinos","Treinos vencidos"] },
    ],
  },
  crosstraining: {
    title: "Relatórios do Cross training", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-gray-900",
        items: ["Recordes pessoais"] },
    ],
  },
  financeiro: {
    title: "Relatórios financeiros", columns: 2,
    sections: [
      { title: "Geral",   headerBg: "bg-green-500",
        items: ["Contas a pagar","Contas a receber","Contas a receber em atraso","DRE Gerencial","Emissão de notas fiscais de serviços","Extrato de check-ins Wellhub","Extrato de validações TotalPass","Recorrências negadas"] },
      { title: "Caixa",   headerBg: "bg-green-500",
        items: ["Fluxo de caixa","Movimentações do caixa"] },
      { title: "Receita", headerBg: "bg-green-500",
        items: ["Receita","Receita detalhada"] },
      { title: "Vendas",  headerBg: "bg-green-500",
        items: ["Vendas","Vendas agendadas","Venda detalhada"] },
    ],
  },
  agenda: {
    title: "Relatórios de agenda", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-purple-600",
        items: ["Check-in pelo app","Faltantes check-in","Locações","Matrículas","Presenças por contrato","Presenças por serviço","Top check-ins","Reagendamentos"] },
    ],
  },
  geral: {
    title: "Relatórios gerais", columns: 1,
    sections: [
      { title: "Descrição", headerBg: "bg-gray-500",
        items: ["Acessos de usuários pela catraca","Acessos de usuários no sistema"] },
    ],
  },
  crm: {
    title: "Relatórios do CRM", columns: 1,
    sections: [
      { title: "Oportunidades",       headerBg: "bg-orange-500",
        items: ["Conversões de oportunidade","Origem das oportunidades"] },
      { title: "Funis e etapas",      headerBg: "bg-orange-500",
        items: ["Desempenho por funil"] },
      { title: "Clube de recompensas",headerBg: "bg-orange-500",
        items: ["Volume de pontos distribuídos por gatilho"] },
    ],
  },
};

/* ── Section block ───────────────────────────────────── */
function SectionBlock({ section }: { section: ModalSection }) {
  return (
    <div className="mb-5">
      <div className={`${section.headerBg} text-white text-sm font-semibold px-4 py-2 rounded-t-lg`}>
        {section.title}
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
        {section.items.map((item, i) => (
          <div
            key={item}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < section.items.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="text-sm text-gray-700">{item}</span>
            <button className="text-xs font-bold text-blue-500 hover:underline flex-shrink-0 ml-4">
              VISUALIZAR
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Generic report modal ────────────────────────────── */
function ReportModal({ config, onClose }: { config: ModalConfig; onClose: () => void }) {
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">{config.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {config.columns === 2 ? (
            pairs.map(([left, right], i) => (
              <div key={i} className={right ? "grid grid-cols-2 gap-5" : ""}>
                <SectionBlock section={left} />
                {right && <SectionBlock section={right} />}
              </div>
            ))
          ) : (
            config.sections.map((section, i) => (
              <SectionBlock key={i} section={section} />
            ))
          )}
        </div>

        {/* Footer */}
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
        <ReportModal config={MODALS[openModal]} onClose={() => setOpenModal(null)} />
      )}
    </AppLayout>
  );
}
