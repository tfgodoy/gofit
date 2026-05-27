import { useState } from "react";
import { X } from "lucide-react";
import {
  Users, Dumbbell, Zap, DollarSign, Calendar, BarChart2, Filter,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import type { ComponentType } from "react";

/* ── Report card data ────────────────────────────────── */
interface ReportCard {
  label:       string;
  Icon:        ComponentType<{ className?: string }>;
  iconColor:   string;
  iconBg:      string;
  textColor:   string;
  borderColor: string;
  modalKey?:   string;
}

const REPORTS: ReportCard[] = [
  {
    label: "Clientes",       modalKey: "clientes",
    Icon: Users,      iconColor: "text-blue-300",   iconBg: "bg-blue-50",
    textColor: "text-blue-500",   borderColor: "border-blue-400",
  },
  {
    label: "Treinos",
    Icon: Dumbbell,   iconColor: "text-red-300",    iconBg: "bg-red-50",
    textColor: "text-red-500",    borderColor: "border-red-400",
  },
  {
    label: "Cross training",
    Icon: Zap,        iconColor: "text-gray-300",   iconBg: "bg-gray-50",
    textColor: "text-gray-500",   borderColor: "border-gray-300",
  },
  {
    label: "Financeiro",
    Icon: DollarSign, iconColor: "text-green-300",  iconBg: "bg-green-50",
    textColor: "text-green-500",  borderColor: "border-green-400",
  },
  {
    label: "Agenda",
    Icon: Calendar,   iconColor: "text-purple-300", iconBg: "bg-purple-50",
    textColor: "text-purple-500", borderColor: "border-purple-400",
  },
  {
    label: "Geral",
    Icon: BarChart2,  iconColor: "text-slate-300",  iconBg: "bg-slate-50",
    textColor: "text-slate-400",  borderColor: "border-slate-300",
  },
  {
    label: "CRM",
    Icon: Filter,     iconColor: "text-orange-300", iconBg: "bg-orange-50",
    textColor: "text-orange-500", borderColor: "border-orange-400",
  },
];

/* ── Clientes modal data ─────────────────────────────── */
interface ReportItem { label: string }
interface ReportSection { title: string; items: ReportItem[] }

const CLIENTES_SECTIONS: [ReportSection, ReportSection][] = [
  [
    {
      title: "Geral",
      items: [
        { label: "Aniversariantes" },
        { label: "Cadastros online" },
        { label: "Clientes" },
        { label: "Evasão de clientes" },
        { label: "Histórico de clientes ativos" },
        { label: "Perfil de cliente" },
        { label: "Risco de abandono" },
      ],
    },
    {
      title: "Acessos/Presenças",
      items: [
        { label: "Acessos" },
        { label: "Faltantes" },
        { label: "Frequência dos clientes" },
        { label: "Clientes mais frequentes" },
        { label: "Presenças" },
      ],
    },
  ],
  [
    {
      title: "Contratos",
      items: [
        { label: "Análise de contratos e modalidades" },
        { label: "Contratos a vencer" },
        { label: "Contratos agendados" },
        { label: "Contratos com aulas restantes" },
        { label: "Clientes por contrato" },
        { label: "Clientes por assinatura do contrato" },
        { label: "Estatísticas dos contratos" },
        { label: "Novos clientes" },
      ],
    },
    {
      title: "Avaliações",
      items: [
        { label: "Avaliações físicas realizadas" },
        { label: "Avaliações físicas vencidas" },
        { label: "Clientes sem avaliações físicas" },
      ],
    },
  ],
];

/* ── Sub-components ──────────────────────────────────── */
function SectionBlock({ section }: { section: ReportSection }) {
  return (
    <div className="mb-5">
      <div className="bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-t-lg">
        {section.title}
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
        {section.items.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < section.items.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="text-sm text-gray-700">{item.label}</span>
            <button className="text-xs font-bold text-blue-500 hover:underline flex-shrink-0 ml-4">
              VISUALIZAR
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">Relatórios de clientes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {CLIENTES_SECTIONS.map((pair, pi) => (
            <div key={pi} className="grid grid-cols-2 gap-5">
              <SectionBlock section={pair[0]} />
              <SectionBlock section={pair[1]} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-bold text-blue-500 hover:underline"
          >
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
                    onClick={() => card.modalKey ? setOpenModal(card.modalKey) : undefined}
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

      {openModal === "clientes" && (
        <ClientesModal onClose={() => setOpenModal(null)} />
      )}
    </AppLayout>
  );
}
