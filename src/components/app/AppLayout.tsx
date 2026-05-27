import { NavLink, useNavigate } from "react-router-dom";
import {
  Dumbbell, Users, Calendar, DollarSign, Package, FileText,
  Settings, LogOut, Home, Filter, SlidersHorizontal,
  ShoppingCart, HelpCircle, ChevronDown, Zap, TrendingUp,
  Building2, BarChart2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  iconColor: string;
  hasDropdown?: boolean;
  end?: boolean;
}

const mainNav: NavItem[] = [
  { icon: Home,         label: "Início",             to: "/app/dashboard",    iconColor: "text-orange-400",  end: true },
  { icon: TrendingUp,   label: "Dashboards",         to: "/app/dashboards",   iconColor: "text-teal-500",    hasDropdown: true },
  { icon: Users,        label: "Clientes",            to: "/app/clientes",     iconColor: "text-blue-500" },
  { icon: Filter,       label: "CRM",                 to: "/app/crm",          iconColor: "text-orange-500",  hasDropdown: true },
  { icon: Calendar,     label: "Agenda",              to: "/app/agenda",       iconColor: "text-teal-400",    hasDropdown: true },
  { icon: DollarSign,   label: "Financeiro",          to: "/app/financeiro",   iconColor: "text-green-500",   hasDropdown: true },
  { icon: Package,      label: "Estoque",             to: "/app/estoque",      iconColor: "text-sky-500",     hasDropdown: true },
  { icon: Dumbbell,     label: "Treino",              to: "/app/treinos",      iconColor: "text-red-400",     hasDropdown: true },
  { icon: Zap,          label: "WOD",                 to: "/app/wod",          iconColor: "text-gray-600" },
  { icon: FileText,     label: "Relatórios",          to: "/app/relatorios",   iconColor: "text-gray-500" },
];

const bottomNav: NavItem[] = [
  { icon: Building2,         label: "Administrativo",      to: "/app/administrativo", iconColor: "text-gray-500", hasDropdown: true },
  { icon: Settings,          label: "Configurações",       to: "/app/empresa",        iconColor: "text-gray-500" },
  { icon: SlidersHorizontal, label: "Recursos do sistema", to: "/app/recursos",       iconColor: "text-gray-500" },
  { icon: ShoppingCart,      label: "Loja",                to: "/app/loja",           iconColor: "text-gray-500" },
  { icon: HelpCircle,        label: "Ajuda",               to: "/app/ajuda",          iconColor: "text-gray-500", hasDropdown: true },
];

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : item.iconColor}`} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.hasDropdown && (
            <ChevronDown className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed h-full z-10">

        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-gray-900">
              Fit<span className="text-primary">Core</span>Sys
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 truncate font-medium">
            {user?.contractorName ?? user?.name}
          </p>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {mainNav.map(item => (
            <NavItemLink key={item.to} item={item} />
          ))}

          {/* Separator */}
          <div className="my-2 border-t border-gray-100" />

          {bottomNav.map(item => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 py-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
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
