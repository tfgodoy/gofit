import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Dumbbell, Users, Calendar, DollarSign, Package, FileText,
  Settings, LogOut, Home, Filter, SlidersHorizontal,
  ShoppingCart, HelpCircle, ChevronDown, Zap, TrendingUp,
  Building2, BarChart2, PieChart, Activity, GraduationCap,
  UserPlus, Lightbulb, CheckSquare, Bot, Search, Gift,
  LayoutGrid, CalendarCheck, Wallet, Landmark, ShoppingBag,
  ArrowUpCircle, ArrowDownCircle, CreditCard,
  Tags, Scale, ClipboardList, Shield, PlayCircle,
  BookOpen, LayoutTemplate, ScrollText, Banknote, Plug,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

interface GrandNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  iconColor: string;
}

interface SubNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  iconColor: string;
  children?: GrandNavItem[];
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  iconColor: string;
  end?: boolean;
  children?: SubNavItem[];
}

const mainNav: NavItem[] = [
  {
    icon: Home, label: "Início", to: "/app/dashboard",
    iconColor: "text-orange-400", end: true,
  },
  {
    icon: TrendingUp, label: "Dashboards", to: "/app/dashboards",
    iconColor: "text-teal-500",
    children: [
      { icon: PieChart,      label: "CRM",         to: "/app/dashboards/crm",         iconColor: "text-primary" },
      { icon: BarChart2,     label: "Gerencial",   to: "/app/dashboards/gerencial",   iconColor: "text-primary" },
      { icon: Activity,      label: "Operacional", to: "/app/dashboards/operacional", iconColor: "text-primary" },
      { icon: GraduationCap, label: "Professores", to: "/app/dashboards/professores", iconColor: "text-primary" },
      { icon: Users,         label: "Clientes",    to: "/app/dashboards/clientes",    iconColor: "text-primary" },
      { icon: DollarSign,    label: "Financeiro",  to: "/app/dashboards/financeiro",  iconColor: "text-primary" },
      { icon: Calendar,      label: "Agenda",      to: "/app/dashboards/agenda",      iconColor: "text-primary" },
      { icon: Dumbbell,      label: "Treino",      to: "/app/dashboards/treino",      iconColor: "text-primary" },
      { icon: Zap,           label: "Wod",         to: "/app/dashboards/wod",         iconColor: "text-primary" },
    ],
  },
  {
    icon: Users, label: "Clientes", to: "/app/clientes",
    iconColor: "text-blue-500",
  },
  {
    icon: Filter, label: "CRM", to: "/app/crm",
    iconColor: "text-orange-500",
    children: [
      { icon: UserPlus,    label: "Leads",              to: "/app/crm/leads",        iconColor: "text-orange-500" },
      { icon: Lightbulb,   label: "Oportunidades",      to: "/app/crm/oportunidades",iconColor: "text-orange-500" },
      { icon: CheckSquare, label: "Atividades",          to: "/app/crm/atividades",   iconColor: "text-orange-500" },
      { icon: Bot,         label: "Automações",          to: "/app/crm/automacoes",   iconColor: "text-orange-500" },
      { icon: Search,      label: "Pesquisas",           to: "/app/crm/pesquisas",    iconColor: "text-orange-500" },
      { icon: Gift,        label: "Clube de recompensa", to: "/app/crm/clube",        iconColor: "text-orange-500" },
    ],
  },
  {
    icon: Calendar, label: "Agenda", to: "/app/agenda",
    iconColor: "text-teal-400",
    children: [
      { icon: Calendar,      label: "Agenda",             to: "/app/agenda/agenda",  iconColor: "text-teal-400" },
      { icon: LayoutGrid,    label: "Grades de horários", to: "/app/agenda/grades",  iconColor: "text-teal-400" },
      { icon: CalendarCheck, label: "Ocupação",            to: "/app/agenda/ocupacao",iconColor: "text-teal-400" },
    ],
  },
  {
    icon: DollarSign, label: "Financeiro", to: "/app/financeiro",
    iconColor: "text-green-500",
    children: [
      { icon: Wallet,          label: "Caixa",              to: "/app/financeiro/caixa",              iconColor: "text-green-500" },
      { icon: TrendingUp,      label: "Comissão",           to: "/app/financeiro/comissao",           iconColor: "text-green-500" },
      { icon: ArrowUpCircle,   label: "Contas a pagar",     to: "/app/financeiro/contas-a-pagar",     iconColor: "text-green-500" },
      { icon: ArrowDownCircle, label: "Contas a receber",   to: "/app/financeiro/contas-a-receber",   iconColor: "text-green-500" },
      { icon: Landmark,        label: "Contas financeiras", to: "/app/financeiro/contas-financeiras", iconColor: "text-green-500" },
      { icon: CreditCard,      label: "FitCore Pay",        to: "/app/financeiro/pay",                iconColor: "text-green-500" },
      { icon: FileText,        label: "NFS-e",              to: "/app/financeiro/nfs-e",              iconColor: "text-green-500" },
      { icon: FileText,        label: "NFC-e",              to: "/app/financeiro/nfc-e",              iconColor: "text-green-500" },
      { icon: ShoppingBag,     label: "Vendas",             to: "/app/financeiro/vendas",             iconColor: "text-green-500" },
    ],
  },
  {
    icon: Package, label: "Estoque", to: "/app/estoque",
    iconColor: "text-sky-500",
    children: [
      { icon: Package, label: "Produtos",              to: "/app/estoque/produtos",    iconColor: "text-sky-500" },
      { icon: Tags,    label: "Categorias de produtos", to: "/app/estoque/categorias",  iconColor: "text-sky-500" },
      { icon: Scale,   label: "Unidades de medida",    to: "/app/estoque/unidades",    iconColor: "text-sky-500" },
    ],
  },
  {
    icon: Dumbbell, label: "Treino", to: "/app/treinos",
    iconColor: "text-red-400",
    children: [
      { icon: Dumbbell,      label: "Exercícios",          to: "/app/treinos/exercicios", iconColor: "text-red-400" },
      { icon: ClipboardList, label: "Grupos de exercícios", to: "/app/treinos/grupos",     iconColor: "text-red-400" },
      { icon: CalendarCheck, label: "Sessões",              to: "/app/treinos/sessoes",    iconColor: "text-red-400" },
      { icon: FileText,      label: "Treinos",              to: "/app/treinos/treinos",    iconColor: "text-red-400" },
    ],
  },
  { icon: Zap,      label: "WOD",       to: "/app/wod",       iconColor: "text-gray-600" },
  { icon: FileText, label: "Relatórios", to: "/app/relatorios", iconColor: "text-gray-500" },
];

const bottomNav: NavItem[] = [
  {
    icon: Building2, label: "Administrativo", to: "/app/administrativo",
    iconColor: "text-gray-500",
    children: [
      { icon: Users,      label: "Equipe",     to: "/app/administrativo/equipe",     iconColor: "text-gray-500" },
      { icon: ScrollText, label: "Contratos",  to: "/app/administrativo/contratos",  iconColor: "text-gray-500" },
      { icon: Shield,     label: "Permissões", to: "/app/administrativo/permissoes", iconColor: "text-gray-500" },
    ],
  },
  {
    icon: Settings, label: "Configurações", to: "/app/configuracoes",
    iconColor: "text-gray-500",
    children: [
      { icon: LayoutGrid,    label: "Modalidades",            to: "/app/configuracoes/modalidades",  iconColor: "text-gray-500" },
      { icon: GraduationCap, label: "Graduações",             to: "/app/configuracoes/graduacoes",   iconColor: "text-gray-500" },
      { icon: Banknote,      label: "Parâmetros Financeiros", to: "/app/configuracoes/financeiro",   iconColor: "text-gray-500" },
      { icon: Building2,     label: "Unidades",               to: "/app/configuracoes/unidades",     iconColor: "text-gray-500" },
      { icon: Plug,          label: "Integrações",            to: "/app/configuracoes/integracoes",  iconColor: "text-gray-500" },
      {
        icon: ClipboardList, label: "Anamnese", to: "/app/configuracoes/anamnese",
        iconColor: "text-gray-500",
        children: [
          { icon: BookOpen,       label: "Biblioteca de perguntas", to: "/app/configuracoes/anamnese/biblioteca", iconColor: "text-gray-500" },
          { icon: LayoutTemplate, label: "Modelos de Anamnese",     to: "/app/configuracoes/anamnese/modelos",    iconColor: "text-gray-500" },
        ],
      },
    ],
  },
  { icon: SlidersHorizontal, label: "Recursos do sistema", to: "/app/recursos", iconColor: "text-gray-500" },
  { icon: ShoppingCart,      label: "Loja",                to: "/app/loja",     iconColor: "text-gray-500" },
  {
    icon: HelpCircle, label: "Ajuda", to: "/app/ajuda",
    iconColor: "text-gray-500",
    children: [
      { icon: HelpCircle, label: "Central de ajuda", to: "/app/ajuda/central",   iconColor: "text-gray-500" },
      { icon: PlayCircle, label: "Tutoriais",          to: "/app/ajuda/tutoriais", iconColor: "text-gray-500" },
    ],
  },
];

function NavItemLink({
  item,
  expandedKey,
  onToggle,
}: {
  item: NavItem;
  expandedKey: string | null;
  onToggle: (key: string) => void;
}) {
  const Icon = item.icon;
  const location = useLocation();
  const isExpanded = expandedKey === item.to;

  /* auto-detect which child sub-dropdown to open based on current path */
  const [expandedSub, setExpandedSub] = useState<string | null>(() => {
    for (const child of item.children ?? []) {
      if (child.children?.some(gc => location.pathname.startsWith(gc.to))) {
        return child.to;
      }
    }
    return null;
  });

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => onToggle(item.to)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
            isExpanded
              ? "bg-primary/10 text-primary"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Icon className={`w-4 h-4 flex-shrink-0 ${isExpanded ? "text-primary" : item.iconColor}`} />
          <span className="flex-1 truncate text-left">{item.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 opacity-40 flex-shrink-0 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="ml-1 mt-0.5 mb-1 pl-2 border-l-2 border-gray-100 space-y-0.5">
            {item.children.map(child => {
              const SubIcon = child.icon;

              /* child with nested grandchildren → render as collapsible group */
              if (child.children) {
                const isSubExpanded = expandedSub === child.to;
                return (
                  <div key={child.to}>
                    <button
                      onClick={() => setExpandedSub(isSubExpanded ? null : child.to)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                        isSubExpanded
                          ? "text-primary"
                          : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSubExpanded ? "text-primary" : child.iconColor}`} />
                      <span className="flex-1 text-left leading-tight">{child.label}</span>
                      <ChevronDown className={`w-3 h-3 opacity-40 flex-shrink-0 transition-transform duration-200 ${isSubExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {isSubExpanded && (
                      <div className="ml-1 mt-0.5 mb-0.5 pl-2 border-l-2 border-gray-100 space-y-0.5">
                        {child.children.map(gc => {
                          const GcIcon = gc.icon;
                          return (
                            <NavLink
                              key={gc.to}
                              to={gc.to}
                              className={({ isActive }) =>
                                `flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                                  isActive ? "text-primary" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                                }`
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <GcIcon className={`w-3 h-3 flex-shrink-0 ${isActive ? "text-primary" : gc.iconColor}`} />
                                  <span className="leading-tight">{gc.label}</span>
                                </>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              /* regular child link */
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "text-primary"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-primary" : child.iconColor}`} />
                      <span className="truncate">{child.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    const all = [...mainNav, ...bottomNav];
    for (const item of all) {
      if (item.children?.some(c => location.pathname.startsWith(c.to))) {
        setExpandedKey(item.to);
        return;
      }
    }
  }, [location.pathname]);

  function handleToggle(key: string) {
    setExpandedKey(prev => (prev === key ? null : key));
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

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
            <NavItemLink
              key={item.to}
              item={item}
              expandedKey={expandedKey}
              onToggle={handleToggle}
            />
          ))}

          <div className="my-2 border-t border-gray-100" />

          {bottomNav.map(item => (
            <NavItemLink
              key={item.to}
              item={item}
              expandedKey={expandedKey}
              onToggle={handleToggle}
            />
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
