import { useNavigate } from "react-router-dom";
import {
  Users, Dumbbell, Zap, DollarSign, Calendar, BarChart2, Filter,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import type { ComponentType } from "react";

interface ReportCard {
  label:       string;
  accent:      string;
  Icon:        ComponentType<{ className?: string }>;
  iconColor:   string;
  iconBg:      string;
  textColor:   string;
  borderColor: string;
  to:          string;
}

const REPORTS: ReportCard[] = [
  {
    label: "Clientes",       accent: "blue",
    Icon: Users,     iconColor: "text-blue-300",   iconBg: "bg-blue-50",
    textColor: "text-blue-500",   borderColor: "border-blue-400",
    to: "/app/relatorios/clientes",
  },
  {
    label: "Treinos",        accent: "red",
    Icon: Dumbbell,  iconColor: "text-red-300",    iconBg: "bg-red-50",
    textColor: "text-red-500",    borderColor: "border-red-400",
    to: "/app/relatorios/treinos",
  },
  {
    label: "Cross training", accent: "gray",
    Icon: Zap,       iconColor: "text-gray-300",   iconBg: "bg-gray-50",
    textColor: "text-gray-500",   borderColor: "border-gray-300",
    to: "/app/relatorios/crosstraining",
  },
  {
    label: "Financeiro",     accent: "green",
    Icon: DollarSign,iconColor: "text-green-300",  iconBg: "bg-green-50",
    textColor: "text-green-500",  borderColor: "border-green-400",
    to: "/app/relatorios/financeiro",
  },
  {
    label: "Agenda",         accent: "purple",
    Icon: Calendar,  iconColor: "text-purple-300", iconBg: "bg-purple-50",
    textColor: "text-purple-500", borderColor: "border-purple-400",
    to: "/app/relatorios/agenda",
  },
  {
    label: "Geral",          accent: "slate",
    Icon: BarChart2, iconColor: "text-slate-300",  iconBg: "bg-slate-50",
    textColor: "text-slate-400",  borderColor: "border-slate-300",
    to: "/app/relatorios/geral",
  },
  {
    label: "CRM",            accent: "orange",
    Icon: Filter,    iconColor: "text-orange-300", iconBg: "bg-orange-50",
    textColor: "text-orange-500", borderColor: "border-orange-400",
    to: "/app/relatorios/crm",
  },
];

export default function RelatoriosPage() {
  const navigate = useNavigate();

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
                {/* Illustration area */}
                <div className={`${card.iconBg} flex items-center justify-center py-12`}>
                  <Icon className={`w-20 h-20 ${card.iconColor}`} />
                </div>

                {/* Footer */}
                <div className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{card.label}</span>
                  <button
                    onClick={() => navigate(card.to)}
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
    </AppLayout>
  );
}
