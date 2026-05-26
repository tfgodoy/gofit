import { useNavigate } from "react-router-dom";
import { Dumbbell, Users, Calendar, BarChart2, Settings, LogOut, UserPlus, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ContractorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              Fit<span className="text-primary">Core</span>Sys
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2 truncate">{user?.contractorName ?? user?.name}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { icon: BarChart2, label: "Dashboard", active: true },
            { icon: Users, label: "Alunos" },
            { icon: Calendar, label: "Agendamentos" },
            { icon: UserPlus, label: "Equipe" },
            { icon: Settings, label: "Minha Empresa" },
          ].map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">
            Olá, {user?.name?.split(" ")[0]}!
          </h1>
          <p className="text-gray-500 text-sm mt-1">Bem-vindo ao seu painel de gestão.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Alunos ativos", value: "—", icon: Users, color: "text-primary bg-primary/10" },
            { label: "Agendamentos hoje", value: "—", icon: Calendar, color: "text-green-600 bg-green-50" },
            { label: "Receita do mês", value: "—", icon: BarChart2, color: "text-blue-600 bg-blue-50" },
            { label: "Membros da equipe", value: "—", icon: UserPlus, color: "text-purple-600 bg-purple-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Alunos recentes</h2>
              <button className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                Ver todos <ChevronRight className="w-3.5 h-3.5" />
              </button>
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
      </main>
    </div>
  );
}
