import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

import LandingPage            from "@/pages/LandingPage";
import LoginPage              from "@/pages/LoginPage";
import ContractorRegisterPage from "@/pages/ContractorRegisterPage";
import OwnerDashboard         from "@/pages/OwnerDashboard";
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
import FitcorePayPage           from "@/pages/app/FitcorePayPage";
import MatriculaPage            from "@/pages/app/MatriculaPage";
import ContasPagarPage         from "@/pages/app/ContasPagarPage";
import ContasFinanceirasPage   from "@/pages/app/ContasFinanceirasPage";
import CentroFinanceiroPage        from "@/pages/app/CentroFinanceiroPage";
import CategoriasFinanceirasPage   from "@/pages/app/CategoriasFinanceirasPage";
import TemplatesContratosPage      from "@/pages/app/TemplatesContratosPage";
import DrePage                 from "@/pages/app/DrePage";
import DashboardOperacionalPage from "@/pages/app/DashboardOperacionalPage";
import DashboardAgendaPage     from "@/pages/app/DashboardAgendaPage";
import ComissoesPage           from "@/pages/app/ComissoesPage";
import OcupacaoPage            from "@/pages/app/OcupacaoPage";
import ConvitePage            from "@/pages/public/ConvitePage";
import AnamnesePublicPage     from "@/pages/public/AnamnesePublicPage";

const queryClient = new QueryClient();

const staffRoles = ["contractor","teacher","receptionist","sales","nutritionist","physiotherapist","evaluator"] as const;

function AppGuard({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={[...staffRoles]}>{children}</AuthGuard>;
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

            {/* Owner */}
            <Route path="/owner/dashboard" element={
              <AuthGuard allowedRoles={["owner"]}><OwnerDashboard /></AuthGuard>
            } />

            {/* App — empresa contratante */}
            <Route path="/app/dashboard"                   element={<AppGuard><ContractorDashboard /></AppGuard>} />
            <Route path="/app/clientes"                    element={<AppGuard><AlunosPage /></AppGuard>} />
            <Route path="/app/clientes/novo"               element={<AppGuard><AlunoFormPage /></AppGuard>} />
            <Route path="/app/clientes/:id/cadastro"       element={<AppGuard><AlunoFormPage /></AppGuard>} />
            <Route path="/app/clientes/:id/dashboard"      element={<AppGuard><ClienteDashboardPage /></AppGuard>} />
            <Route path="/app/clientes/:id/avaliacao-fisica/nova"  element={<AppGuard><AvaliacaoFisicaFormPage /></AppGuard>} />
            <Route path="/app/clientes/:id/avaliacao-fisica/:avalId" element={<AppGuard><AvaliacaoFisicaFormPage /></AppGuard>} />
            <Route path="/app/clientes/:id/matricula"             element={<AppGuard><MatriculaPage /></AppGuard>} />
            <Route path="/app/dashboards/gerencial"   element={<AppGuard><DashboardGerencialPage /></AppGuard>} />
            <Route path="/app/dashboards/crm"        element={<AppGuard><DashboardCRMPage /></AppGuard>} />
            <Route path="/app/dashboards/clientes"   element={<AppGuard><DashboardClientesPage /></AppGuard>} />
            <Route path="/app/dashboards/financeiro"  element={<AppGuard><DashboardFinanceiroPage /></AppGuard>} />
            <Route path="/app/dashboards/operacional" element={<AppGuard><DashboardOperacionalPage /></AppGuard>} />
            <Route path="/app/dashboards/agenda"     element={<AppGuard><DashboardAgendaPage /></AppGuard>} />
            <Route path="/app/dashboards/*"          element={<AppGuard><PlaceholderPage title="Dashboard em desenvolvimento" /></AppGuard>} />
            <Route path="/app/crm/leads"         element={<AppGuard><LeadsPage /></AppGuard>} />
            <Route path="/app/crm/oportunidades" element={<AppGuard><OportunidadesPage /></AppGuard>} />
            <Route path="/app/crm/atividades"    element={<AppGuard><AtividadesPage /></AppGuard>} />
            <Route path="/app/crm/automacoes"    element={<AppGuard><CampanhasPage /></AppGuard>} />
            <Route path="/app/crm/clube"         element={<AppGuard><ClubeRecompensasPage /></AppGuard>} />
            <Route path="/app/crm/*"             element={<AppGuard><PlaceholderPage title="CRM" /></AppGuard>} />
            <Route path="/app/agenda/agenda"   element={<AppGuard><AgendaPage /></AppGuard>} />
            <Route path="/app/agenda/grades"   element={<AppGuard><GradesPage /></AppGuard>} />
            <Route path="/app/agenda/ocupacao" element={<AppGuard><OcupacaoPage /></AppGuard>} />
            <Route path="/app/agenda/*"        element={<AppGuard><PlaceholderPage title="Agenda" /></AppGuard>} />
            <Route path="/app/financeiro/caixa"              element={<AppGuard><CaixaPage /></AppGuard>} />
            <Route path="/app/financeiro/contas-a-receber"  element={<AppGuard><ContasReceberPage /></AppGuard>} />
            <Route path="/app/financeiro/contas-a-pagar"    element={<AppGuard><ContasPagarPage /></AppGuard>} />
            <Route path="/app/financeiro/dre"               element={<AppGuard><DrePage /></AppGuard>} />
            <Route path="/app/financeiro/comissao"          element={<AppGuard><ComissoesPage /></AppGuard>} />
            <Route path="/app/financeiro/vendas"            element={<AppGuard><VendasPage /></AppGuard>} />
            <Route path="/app/financeiro/nfs-e"             element={<AppGuard><NfsePage /></AppGuard>} />
            <Route path="/app/financeiro/pay"               element={<AppGuard><FitcorePayPage /></AppGuard>} />
            <Route path="/app/financeiro/contas-financeiras" element={<AppGuard><ContasFinanceirasPage /></AppGuard>} />
            <Route path="/app/financeiro/*"      element={<AppGuard><PlaceholderPage title="Financeiro" /></AppGuard>} />
            <Route path="/app/estoque/*"         element={<AppGuard><PlaceholderPage title="Estoque" /></AppGuard>} />
            <Route path="/app/treinos/treinos"       element={<AppGuard><TreinosPage /></AppGuard>} />
            <Route path="/app/treinos/treinos/novo" element={<AppGuard><TreinoFormPage /></AppGuard>} />
            <Route path="/app/treinos/treinos/:id"  element={<AppGuard><TreinoFormPage /></AppGuard>} />
            <Route path="/app/treinos/exercicios" element={<AppGuard><ExerciciosPage /></AppGuard>} />
            <Route path="/app/treinos/grupos"    element={<AppGuard><GruposExerciciosPage /></AppGuard>} />
            <Route path="/app/treinos/sessoes"   element={<AppGuard><SessoesPage /></AppGuard>} />
            <Route path="/app/treinos/*"         element={<AppGuard><PlaceholderPage title="Treino" /></AppGuard>} />
            <Route path="/app/wod"               element={<AppGuard><WodPage /></AppGuard>} />
            <Route path="/app/wod/novo"          element={<AppGuard><WodFormPage /></AppGuard>} />
            <Route path="/app/wod/:id"           element={<AppGuard><WodFormPage /></AppGuard>} />
            <Route path="/app/relatorios"        element={<AppGuard><RelatoriosPage /></AppGuard>} />
            <Route path="/app/relatorios/*"      element={<AppGuard><PlaceholderPage title="Relatórios" /></AppGuard>} />
            <Route path="/app/administrativo/equipe"              element={<AppGuard><EquipePage /></AppGuard>} />
            <Route path="/app/administrativo/contratos"           element={<AppGuard><ContratosPage /></AppGuard>} />
            <Route path="/app/administrativo/contratos/novo"      element={<AppGuard><ContratoFormPage /></AppGuard>} />
            <Route path="/app/administrativo/contratos/:id/editar" element={<AppGuard><ContratoFormPage /></AppGuard>} />
            <Route path="/app/administrativo/permissoes"          element={<AppGuard><PermissoesPage /></AppGuard>} />
            <Route path="/app/administrativo/templates"           element={<AppGuard><TemplatesContratosPage /></AppGuard>} />
            <Route path="/app/administrativo/*"          element={<AppGuard><PlaceholderPage title="Administrativo" /></AppGuard>} />
            <Route path="/app/configuracoes/modalidades"                  element={<AppGuard><ModalidadesPage /></AppGuard>} />
            <Route path="/app/configuracoes/anamnese/biblioteca"         element={<AppGuard><AnamneseBibliotecaPage /></AppGuard>} />
            <Route path="/app/configuracoes/anamnese/modelos"             element={<AppGuard><AnamneseModelosPage /></AppGuard>} />
            <Route path="/app/configuracoes/anamnese/modelos/:id/editar"  element={<AppGuard><AnamneseModeloEditPage /></AppGuard>} />
            <Route path="/app/configuracoes/graduacoes"    element={<AppGuard><GraduacoesPage /></AppGuard>} />
            <Route path="/app/configuracoes/financeiro"          element={<AppGuard><ParametrosFinanceirosPage /></AppGuard>} />
            <Route path="/app/configuracoes/centros-custo"          element={<AppGuard><CentroFinanceiroPage tipo="custo" /></AppGuard>} />
            <Route path="/app/configuracoes/centros-receita"        element={<AppGuard><CentroFinanceiroPage tipo="receita" /></AppGuard>} />
            <Route path="/app/configuracoes/categorias-financeiras" element={<AppGuard><CategoriasFinanceirasPage /></AppGuard>} />
            <Route path="/app/configuracoes/unidades"        element={<AppGuard><UnidadesPage /></AppGuard>} />
            <Route path="/app/configuracoes/integracoes"    element={<AppGuard><IntegracoesHubPage /></AppGuard>} />
            {/* CRM Config */}
            <Route path="/app/configuracoes/crm/atividades/tipos-atividade"  element={<AppGuard><CrmConfigListPage titulo="Tipos de atividades"  descricao="Categorias de atividades do CRM (ex: Ligação, WhatsApp, Email, Reunião)" categoria="tipo_atividade" /></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/como-conheceu"   element={<AppGuard><CrmConfigListPage titulo="Como conheceu"        descricao="Como o lead descobriu a academia (ex: Instagram, Indicação, Google)" categoria="como_conheceu" /></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/tipos-visita"    element={<AppGuard><CrmConfigListPage titulo="Tipos de visitas"     descricao="Modalidades de visita em oportunidades (ex: Presencial, Online)" categoria="tipo_visita_oportunidade" /></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/niveis-interesse"element={<AppGuard><CrmConfigListPage titulo="Níveis de interesse"  descricao="Grau de interesse do lead em oportunidades (ex: Alto, Médio, Baixo)" categoria="nivel_interesse_oportunidade" comCor /></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/motivos-perda"   element={<AppGuard><CrmConfigListPage titulo="Motivos de Perda"     descricao="Razões pelo qual oportunidades são perdidas (ex: Preço, Concorrência)" categoria="motivo_perda" /></AppGuard>} />
            <Route path="/app/configuracoes/crm/oportunidades/funis-etapas"    element={<AppGuard><ConfigCrmFunisPage /></AppGuard>} />
            <Route path="/app/configuracoes/*"   element={<AppGuard><PlaceholderPage title="Configurações" /></AppGuard>} />
            <Route path="/app/empresa"           element={<AppGuard><PlaceholderPage title="Configurações" /></AppGuard>} />
            <Route path="/app/recursos"          element={<AppGuard><PlaceholderPage title="Recursos do Sistema" /></AppGuard>} />
            <Route path="/app/loja"              element={<AppGuard><PlaceholderPage title="Loja" /></AppGuard>} />
            <Route path="/app/ajuda/*"           element={<AppGuard><PlaceholderPage title="Ajuda" /></AppGuard>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
