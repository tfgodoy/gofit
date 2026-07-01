import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

import LandingPage            from "@/pages/LandingPage";
import LoginPage              from "@/pages/LoginPage";
import ContractorRegisterPage from "@/pages/ContractorRegisterPage";
import AdminLoginPage            from "@/pages/admin/AdminLoginPage";
import AdminDashboard            from "@/pages/admin/AdminDashboard";
import AdminCompaniesPage        from "@/pages/admin/AdminCompaniesPage";
import AdminCompanyDetailsPage   from "@/pages/admin/AdminCompanyDetailsPage";
import AdminPlansPage            from "@/pages/admin/AdminPlansPage";
import AdminSubscriptionsPage    from "@/pages/admin/AdminSubscriptionsPage";
import AdminModulesPage          from "@/pages/admin/AdminModulesPage";
import AdminBillingPage          from "@/pages/admin/AdminBillingPage";
import AdminBillingInvoicesPage  from "@/pages/admin/AdminBillingInvoicesPage";
import AdminBillingOverduePage   from "@/pages/admin/AdminBillingOverduePage";
import AdminGuard                from "@/components/auth/AdminGuard";
import ContractorDashboard    from "@/pages/ContractorDashboard";
import AlunosPage             from "@/pages/app/AlunosPage";
import AlunoFormPage          from "@/pages/app/AlunoFormPage";
import ClienteDashboardPage   from "@/pages/app/ClienteDashboardPage";
import PlaceholderPage           from "@/pages/app/PlaceholderPage";
import ClubeRecompensasPage      from "@/pages/app/ClubeRecompensasPage";
import WodPage                from "@/pages/app/WodPage";
import AnamneseBibliotecaPage  from "@/pages/app/AnamneseBibliotecaPage";
import AnamneseModelosPage     from "@/pages/app/AnamneseModelosPage";
import AnamneseModeloEditPage  from "@/pages/app/AnamneseModeloEditPage";
import RelatoriosPage         from "@/pages/app/RelatoriosPage";
import ExerciciosPage         from "@/pages/app/ExerciciosPage";
import GruposExerciciosPage   from "@/pages/app/GruposExerciciosPage";
import SessoesPage            from "@/pages/app/SessoesPage";
import TreinosPage            from "@/pages/app/TreinosPage";
import TreinoFormPage         from "@/pages/app/TreinoFormPage";
import WodFormPage            from "@/pages/app/WodFormPage";
import EquipePage             from "@/pages/app/EquipePage";
import ContratosPage          from "@/pages/app/ContratosPage";
import ContratoFormPage       from "@/pages/app/ContratoFormPage";
import ModalidadesPage        from "@/pages/app/ModalidadesPage";
import CaixaPage              from "@/pages/app/CaixaPage";
import ContasReceberPage      from "@/pages/app/ContasReceberPage";
import VendasPage             from "@/pages/app/VendasPage";
import AgendaPage             from "@/pages/app/AgendaPage";
import GradesPage             from "@/pages/app/GradesPage";
import AvaliacaoFisicaFormPage from "@/pages/app/AvaliacaoFisicaFormPage";
import GraduacoesPage         from "@/pages/app/GraduacoesPage";
import LeadsPage              from "@/pages/app/LeadsPage";
import LeadPerfilPage         from "@/pages/app/LeadPerfilPage";
import OportunidadesPage      from "@/pages/app/OportunidadesPage";
import AtividadesPage         from "@/pages/app/AtividadesPage";
import CampanhasPage          from "@/pages/app/CampanhasPage";
import DashboardGerencialPage  from "@/pages/app/DashboardGerencialPage";
import DashboardCRMPage        from "@/pages/app/DashboardCRMPage";
import DashboardClientesPage   from "@/pages/app/DashboardClientesPage";
import DashboardFinanceiroPage from "@/pages/app/DashboardFinanceiroPage";
import PermissoesPage           from "@/pages/app/PermissoesPage";
import ParametrosFinanceirosPage from "@/pages/app/ParametrosFinanceirosPage";
import UnidadesPage             from "@/pages/app/UnidadesPage";
import IntegracoesHubPage       from "@/pages/app/IntegracoesHubPage";
import CrmConfigListPage        from "@/pages/app/CrmConfigListPage";
import ConfigCrmFunisPage       from "@/pages/app/ConfigCrmFunisPage";
import NfsePage                 from "@/pages/app/NfsePage";
import GoFitPayContaPage          from "@/pages/app/gofit-pay/GoFitPayContaPage";
import MatriculaPage            from "@/pages/app/MatriculaPage";
import VendaWizardPage          from "@/pages/app/VendaWizardPage";
import ContasPagarPage         from "@/pages/app/ContasPagarPage";
import FornecedoresPage        from "@/pages/app/FornecedoresPage";
import ConciliarExtratoPage    from "@/pages/app/ConciliarExtratoPage";
import ContasFinanceirasPage   from "@/pages/app/ContasFinanceirasPage";
import ExtratoContaPage        from "@/pages/app/ExtratoContaPage";
import CentroFinanceiroPage        from "@/pages/app/CentroFinanceiroPage";
import CategoriasFinanceirasPage   from "@/pages/app/CategoriasFinanceirasPage";
import TemplatesContratosPage      from "@/pages/app/TemplatesContratosPage";
import DrePage                 from "@/pages/app/DrePage";
import DashboardOperacionalPage from "@/pages/app/DashboardOperacionalPage";
import DashboardAgendaPage     from "@/pages/app/DashboardAgendaPage";
import ComissoesPage           from "@/pages/app/ComissoesPage";
import OcupacaoPage            from "@/pages/app/OcupacaoPage";
import ConvitePage                  from "@/pages/public/ConvitePage";
import AnamnesePublicPage           from "@/pages/public/AnamnesePublicPage";
import BookingPage                  from "@/pages/public/BookingPage";
import PublicReciboPage             from "@/pages/public/PublicReciboPage";
import CardRegistrationPage         from "@/pages/public/CardRegistrationPage";
import ConfigAgendamentoPublicoPage from "@/pages/app/ConfigAgendamentoPublicoPage";
import LojaModulosPage             from "@/pages/app/LojaModulosPage";
import GoFitPayLandingPage        from "@/pages/app/gofit-pay/GoFitPayLandingPage";
import GoFitPayAtivarPage         from "@/pages/app/gofit-pay/GoFitPayAtivarPage";
import GoFitPayPage               from "@/pages/app/gofit-pay/GoFitPayPage";
import GoFitPayCobrancasPage      from "@/pages/app/gofit-pay/GoFitPayCobrancasPage";
import GoFitPayInadimplenciaPage  from "@/pages/app/gofit-pay/GoFitPayInadimplenciaPage";
import GoFitPayRelatoriosPage     from "@/pages/app/gofit-pay/GoFitPayRelatoriosPage";
import GoFitPayProducaoPage       from "@/pages/app/gofit-pay/GoFitPayProducaoPage";

const queryClient = new QueryClient();

const staffRoles = ["contractor","teacher","receptionist","sales","nutritionist","physiotherapist","evaluator"] as const;

function AppGuard({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={[...staffRoles]}>{children}</AuthGuard>;
}

// Protege rota por módulo: redireciona para /app/dashboard se staff não tiver canView
function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { user, canView } = useAuth();
  if (user?.isStaff && !canView(module)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

// Bloqueia staff de acessar rotas admin (administrativo, configurações)
function AdminOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.isStaff && user.role !== "admin") {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/"        element={<LandingPage />} />
            <Route path="/login"   element={<LoginPage />} />
            <Route path="/cadastro" element={<ContractorRegisterPage />} />
            <Route path="/convite/:token"   element={<ConvitePage />} />
            <Route path="/anamnese/:token"  element={<AnamnesePublicPage />} />
            <Route path="/booking/:contractorId" element={<BookingPage />} />
            <Route path="/recibo/:token"    element={<PublicReciboPage />} />
            <Route path="/aluno/cartao/:token" element={<CardRegistrationPage />} />

            {/* Admin GoFit — área administrativa da plataforma */}
            <Route path="/admin/login"     element={<AdminLoginPage />} />
            <Route path="/admin/dashboard"      element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/companies"      element={<AdminGuard><AdminCompaniesPage /></AdminGuard>} />
            <Route path="/admin/companies/:id"  element={<AdminGuard><AdminCompanyDetailsPage /></AdminGuard>} />
            <Route path="/admin/plans"          element={<AdminGuard><AdminPlansPage /></AdminGuard>} />
            <Route path="/admin/subscriptions"  element={<AdminGuard><AdminSubscriptionsPage /></AdminGuard>} />
            <Route path="/admin/modules"        element={<AdminGuard><AdminModulesPage /></AdminGuard>} />
            <Route path="/admin/billing"        element={<AdminGuard><AdminBillingPage /></AdminGuard>} />
            <Route path="/admin/billing/invoices" element={<AdminGuard><AdminBillingInvoicesPage /></AdminGuard>} />
            <Route path="/admin/billing/overdue"  element={<AdminGuard><AdminBillingOverduePage /></AdminGuard>} />
            {/* Rotas admin futuras (Fases 6-7) ficam aqui — protegidas por AdminGuard */}
            <Route path="/admin/*"              element={<AdminGuard><Navigate to="/admin/dashboard" replace /></AdminGuard>} />

            {/* Owner legado — redireciona para /admin enquanto existir bookmarks antigos */}
            <Route path="/owner/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/owner/*"         element={<Navigate to="/admin/dashboard" replace />} />

            {/* App — empresa contratante */}
            <Route path="/app/dashboard"                   element={<AppGuard><ContractorDashboard /></AppGuard>} />
            <Route path="/app/clientes"                    element={<AppGuard><ModuleGuard module="clientes"><AlunosPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/novo"               element={<AppGuard><ModuleGuard module="clientes"><AlunoFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/:id/cadastro"       element={<AppGuard><ModuleGuard module="clientes"><AlunoFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/:id/dashboard"      element={<AppGuard><ModuleGuard module="clientes"><ClienteDashboardPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/:id/avaliacao-fisica/nova"  element={<AppGuard><ModuleGuard module="clientes"><AvaliacaoFisicaFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/:id/avaliacao-fisica/:avalId" element={<AppGuard><ModuleGuard module="clientes"><AvaliacaoFisicaFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/:id/matricula"             element={<AppGuard><ModuleGuard module="clientes"><MatriculaPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/clientes/:id/venda"                element={<AppGuard><ModuleGuard module="financeiro"><VendaWizardPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/gerencial"   element={<AppGuard><ModuleGuard module="dashboards"><DashboardGerencialPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/crm"        element={<AppGuard><ModuleGuard module="dashboards"><DashboardCRMPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/clientes"   element={<AppGuard><ModuleGuard module="dashboards"><DashboardClientesPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/financeiro"  element={<AppGuard><ModuleGuard module="dashboards"><DashboardFinanceiroPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/operacional" element={<AppGuard><ModuleGuard module="dashboards"><DashboardOperacionalPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/agenda"     element={<AppGuard><ModuleGuard module="dashboards"><DashboardAgendaPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/dashboards/*"          element={<AppGuard><ModuleGuard module="dashboards"><PlaceholderPage title="Dashboard em desenvolvimento" /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/leads"         element={<AppGuard><ModuleGuard module="crm"><LeadsPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/leads/:id"     element={<AppGuard><ModuleGuard module="crm"><LeadPerfilPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/oportunidades" element={<AppGuard><ModuleGuard module="crm"><OportunidadesPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/atividades"    element={<AppGuard><ModuleGuard module="crm"><AtividadesPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/automacoes"    element={<AppGuard><ModuleGuard module="crm"><CampanhasPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/clube"         element={<AppGuard><ModuleGuard module="crm"><ClubeRecompensasPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/crm/*"             element={<AppGuard><ModuleGuard module="crm"><PlaceholderPage title="CRM" /></ModuleGuard></AppGuard>} />
            <Route path="/app/agenda/agenda"   element={<AppGuard><ModuleGuard module="agenda"><AgendaPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/agenda/grades"   element={<AppGuard><ModuleGuard module="agenda"><GradesPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/agenda/ocupacao" element={<AppGuard><ModuleGuard module="agenda"><OcupacaoPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/agenda/*"        element={<AppGuard><ModuleGuard module="agenda"><PlaceholderPage title="Agenda" /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/caixa"              element={<AppGuard><ModuleGuard module="financeiro"><CaixaPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/contas-a-receber"  element={<AppGuard><ModuleGuard module="financeiro"><ContasReceberPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/contas-a-pagar"      element={<AppGuard><ModuleGuard module="financeiro"><ContasPagarPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/conciliar-extrato"  element={<AppGuard><ModuleGuard module="financeiro"><ConciliarExtratoPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/dre"               element={<AppGuard><ModuleGuard module="financeiro"><DrePage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/comissao"          element={<AppGuard><ModuleGuard module="financeiro"><ComissoesPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/vendas"            element={<AppGuard><ModuleGuard module="financeiro"><VendasPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/nfs-e"             element={<AppGuard><ModuleGuard module="financeiro"><NfsePage /></ModuleGuard></AppGuard>} />
            {/* FitCore Pay removido — o GoFit Pay assume este papel */}
            <Route path="/app/financeiro/pay"               element={<Navigate to="/app/gofit-pay" replace />} />
            <Route path="/app/gofit-pay/conta"              element={<AppGuard><GoFitPayContaPage /></AppGuard>} />
            <Route path="/app/financeiro/contas-financeiras" element={<AppGuard><ModuleGuard module="financeiro"><ContasFinanceirasPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/contas-financeiras/:contaId/extrato" element={<AppGuard><ModuleGuard module="financeiro"><ExtratoContaPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/financeiro/*"      element={<AppGuard><ModuleGuard module="financeiro"><PlaceholderPage title="Financeiro" /></ModuleGuard></AppGuard>} />
            <Route path="/app/estoque/*"         element={<AppGuard><ModuleGuard module="estoque"><PlaceholderPage title="Estoque" /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/treinos"       element={<AppGuard><ModuleGuard module="treinos"><TreinosPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/treinos/novo" element={<AppGuard><ModuleGuard module="treinos"><TreinoFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/treinos/:id"  element={<AppGuard><ModuleGuard module="treinos"><TreinoFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/exercicios" element={<AppGuard><ModuleGuard module="treinos"><ExerciciosPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/grupos"    element={<AppGuard><ModuleGuard module="treinos"><GruposExerciciosPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/sessoes"   element={<AppGuard><ModuleGuard module="treinos"><SessoesPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/treinos/*"         element={<AppGuard><ModuleGuard module="treinos"><PlaceholderPage title="Treino" /></ModuleGuard></AppGuard>} />
            <Route path="/app/wod"               element={<AppGuard><ModuleGuard module="wod"><WodPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/wod/novo"          element={<AppGuard><ModuleGuard module="wod"><WodFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/wod/:id"           element={<AppGuard><ModuleGuard module="wod"><WodFormPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/relatorios"        element={<AppGuard><ModuleGuard module="relatorios"><RelatoriosPage /></ModuleGuard></AppGuard>} />
            <Route path="/app/relatorios/*"      element={<AppGuard><ModuleGuard module="relatorios"><PlaceholderPage title="Relatórios" /></ModuleGuard></AppGuard>} />
            <Route path="/app/administrativo/equipe"              element={<AppGuard><AdminOnlyGuard><EquipePage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/administrativo/contratos"           element={<AppGuard><AdminOnlyGuard><ContratosPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/administrativo/contratos/novo"      element={<AppGuard><AdminOnlyGuard><ContratoFormPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/administrativo/contratos/:id/editar" element={<AppGuard><AdminOnlyGuard><ContratoFormPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/administrativo/permissoes"          element={<AppGuard><AdminOnlyGuard><PermissoesPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/administrativo/templates"           element={<AppGuard><AdminOnlyGuard><TemplatesContratosPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/administrativo/*"          element={<AppGuard><AdminOnlyGuard><PlaceholderPage title="Administrativo" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/modalidades"                  element={<AppGuard><AdminOnlyGuard><ModalidadesPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/agendamento-publico"         element={<AppGuard><AdminOnlyGuard><ConfigAgendamentoPublicoPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/anamnese/biblioteca"         element={<AppGuard><AdminOnlyGuard><AnamneseBibliotecaPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/anamnese/modelos"             element={<AppGuard><AdminOnlyGuard><AnamneseModelosPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/anamnese/modelos/:id/editar"  element={<AppGuard><AdminOnlyGuard><AnamneseModeloEditPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/graduacoes"    element={<AppGuard><AdminOnlyGuard><GraduacoesPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/financeiro"          element={<AppGuard><AdminOnlyGuard><ParametrosFinanceirosPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/centros-custo"          element={<AppGuard><AdminOnlyGuard><CentroFinanceiroPage tipo="custo" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/centros-receita"        element={<AppGuard><AdminOnlyGuard><CentroFinanceiroPage tipo="receita" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/categorias-despesa" element={<AppGuard><AdminOnlyGuard><CategoriasFinanceirasPage tipo="despesa" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/categorias-receita" element={<AppGuard><AdminOnlyGuard><CategoriasFinanceirasPage tipo="receita" /></AdminOnlyGuard></AppGuard>} />
            {/* legacy redirect */}
            <Route path="/app/configuracoes/categorias-financeiras" element={<Navigate to="/app/configuracoes/categorias-despesa" replace />} />
            <Route path="/app/configuracoes/fornecedores"     element={<AppGuard><AdminOnlyGuard><FornecedoresPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/unidades"        element={<AppGuard><AdminOnlyGuard><UnidadesPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/integracoes"    element={<AppGuard><AdminOnlyGuard><IntegracoesHubPage /></AdminOnlyGuard></AppGuard>} />
            {/* CRM Config */}
            <Route path="/app/configuracoes/crm/atividades/tipos-atividade"  element={<AppGuard><AdminOnlyGuard><CrmConfigListPage titulo="Tipos de atividades"  descricao="Categorias de atividades do CRM (ex: Ligação, WhatsApp, Email, Reunião)" categoria="tipo_atividade" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/como-conheceu"   element={<AppGuard><AdminOnlyGuard><CrmConfigListPage titulo="Como conheceu"        descricao="Como o lead descobriu a academia (ex: Instagram, Indicação, Google)" categoria="como_conheceu" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/tipos-visita"    element={<AppGuard><AdminOnlyGuard><CrmConfigListPage titulo="Tipos de visitas"     descricao="Modalidades de visita em oportunidades (ex: Presencial, Online)" categoria="tipo_visita_oportunidade" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/niveis-interesse"element={<AppGuard><AdminOnlyGuard><CrmConfigListPage titulo="Níveis de interesse"  descricao="Grau de interesse do lead em oportunidades (ex: Alto, Médio, Baixo)" categoria="nivel_interesse_oportunidade" comCor /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/motivos-perda"   element={<AppGuard><AdminOnlyGuard><CrmConfigListPage titulo="Motivos de Perda"     descricao="Razões pelo qual oportunidades são perdidas (ex: Preço, Concorrência)" categoria="motivo_perda" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/contratos/motivos-encerramento"   element={<AppGuard><AdminOnlyGuard><CrmConfigListPage titulo="Motivos de Encerramento" descricao="Motivos disponíveis ao encerrar um contrato de aluno" categoria="motivo_encerramento" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/funis-etapas"    element={<AppGuard><AdminOnlyGuard><ConfigCrmFunisPage /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/configuracoes/*"   element={<AppGuard><AdminOnlyGuard><PlaceholderPage title="Configurações" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/empresa"           element={<AppGuard><AdminOnlyGuard><PlaceholderPage title="Configurações" /></AdminOnlyGuard></AppGuard>} />
            <Route path="/app/recursos"          element={<AppGuard><AdminOnlyGuard><PlaceholderPage title="Recursos do Sistema" /></AdminOnlyGuard></AppGuard>} />
            {/* Loja de Módulos — Fase 2 */}
            <Route path="/app/loja"                    element={<AppGuard><LojaModulosPage /></AppGuard>} />
            {/* GoFit Pay — Fase 3 */}
            <Route path="/app/loja/gofit-pay"          element={<AppGuard><GoFitPayLandingPage /></AppGuard>} />
            <Route path="/app/loja/gofit-pay/ativar"   element={<AppGuard><GoFitPayAtivarPage /></AppGuard>} />
            <Route path="/app/gofit-pay"               element={<AppGuard><GoFitPayPage /></AppGuard>} />
            <Route path="/app/gofit-pay/cobrancas"      element={<AppGuard><GoFitPayCobrancasPage /></AppGuard>} />
            <Route path="/app/gofit-pay/inadimplencia" element={<AppGuard><GoFitPayInadimplenciaPage /></AppGuard>} />
            <Route path="/app/gofit-pay/relatorios"    element={<AppGuard><GoFitPayRelatoriosPage    /></AppGuard>} />
            <Route path="/app/gofit-pay/producao"      element={<AppGuard><GoFitPayProducaoPage      /></AppGuard>} />
            <Route path="/app/ajuda/*"                 element={<AppGuard><PlaceholderPage title="Ajuda" /></AppGuard>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
