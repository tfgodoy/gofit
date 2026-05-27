import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Bell, UserPlus, Lightbulb, ShoppingCart, Loader2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function KpiCard({
  label,
  value,
  loading,
  icon,
  iconBg,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">{label}</p>
      <div className="flex items-end justify-between">
        <span className="text-4xl font-extrabold text-gray-900 leading-none">
          {loading ? <Loader2 className="w-7 h-7 animate-spin text-gray-300" /> : value}
        </span>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ContractorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.split(" ")[0] ?? "Gestor";

  const [activeCount, setActiveCount] = useState(0);
  const [newCount, setNewCount]       = useState(0);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!user?.contractorId) return;
    const firstOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString();

    Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", user.contractorId!)
        .eq("status", "ativo"),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", user.contractorId!)
        .gte("created_at", firstOfMonth),
    ]).then(([active, newStudents]) => {
      setActiveCount(active.count ?? 0);
      setNewCount(newStudents.count ?? 0);
      setLoading(false);
    });
  }, [user]);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-50">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            {greeting()}, {firstName}.
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/app/crm/oportunidades")}
              className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" /> NOVA OPORTUNIDADE
            </button>
            <Link
              to="/app/clientes/novo"
              className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> NOVO CLIENTE
            </Link>
            <button
              onClick={() => navigate("/app/financeiro/vendas")}
              className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> NOVA VENDA
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-5 p-6 flex-1 min-h-0">

          {/* Left: KPI cards */}
          <div className="w-60 flex-shrink-0 space-y-4">
            <KpiCard
              label="Clientes ativos"
              value={activeCount}
              loading={loading}
              iconBg="bg-primary/10"
              icon={<Users className="w-6 h-6 text-primary/70" />}
            />
            <KpiCard
              label="Novos clientes"
              value={newCount}
              loading={loading}
              iconBg="bg-green-50"
              icon={<UserPlus className="w-6 h-6 text-green-500/70" />}
            />
          </div>

          {/* Right: Notifications */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Notificações
              </span>
              <button className="text-xs text-primary font-semibold hover:underline">
                Ver tudo
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                <Bell className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-xs text-gray-400 font-medium">Nenhuma notificação no momento</p>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
