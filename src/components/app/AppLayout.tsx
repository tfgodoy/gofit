import { NavLink, useNavigate } from "react-router-dom";
import {
  Dumbbell, BarChart2, Users, Calendar, UserPlus,
  Settings, LogOut, CreditCard, ClipboardList, Activity
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

const navItems = [
  { icon: BarChart2,     label: "Dashboard",    to: "/app/dashboard" },
  { icon: Users,         label: "Alunos",        to: "/app/alunos" },
  { icon: Calendar,      label: "Agendamentos",  to: "/app/agenda" },
  { icon: ClipboardList, label: "Avaliações",    to: "/app/avaliacoes" },
  { icon: Activity,      label: "Treinos",       to: "/app/treinos" },
  { icon: CreditCard,    label: "Financeiro",    to: "/app/financeiro" },
  { icon: UserPlus,      label: "Equipe",        to: "/app/equipe" },
  { icon: Settings,      label: "Minha Empresa", to: "/app/empresa" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              Fit<span className="text-primary">Core</span>Sys
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2 truncate font-medium">
            {user?.contractorName ?? user?.name}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
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

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
    </div>
  );
}
