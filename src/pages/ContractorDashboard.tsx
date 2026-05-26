import { Link } from "react-router-dom";
import { Users, Calendar, BarChart2, UserPlus, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/app/AppLayout";

export default function ContractorDashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "Gestor";

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">Olá, {firstName}!</h1>
          <p className="text-sm text-gray-400 mt-0.5">Bem-vindo ao seu painel de gestão.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Alunos ativos",       icon: Users,    color: "text-primary bg-primary/10" },
            { label: "Agendamentos hoje",   icon: Calendar, color: "text-green-600 bg-green-50" },
            { label: "Receita do mês",      icon: BarChart2,color: "text-blue-600 bg-blue-50" },
            { label: "Membros da equipe",   icon: UserPlus, color: "text-purple-600 bg-purple-50" },
          ].map(({ label, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900">—</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Alunos recentes</h2>
              <Link to="/app/alunos" className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                Ver todos <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-sm text-gray-400 text-center py-6">Nenhum aluno cadastrado ainda.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Próximos agendamentos</h2>
              <button className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                Ver agenda <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 text-center py-6">Nenhum agendamento para hoje.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
