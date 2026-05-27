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
import RelatoriosPage         from "@/pages/app/RelatoriosPage";
import ExerciciosPage         from "@/pages/app/ExerciciosPage";
import GruposExerciciosPage   from "@/pages/app/GruposExerciciosPage";
import ConvitePage            from "@/pages/public/ConvitePage";

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
            <Route path="/convite/:token" element={<ConvitePage />} />

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
            <Route path="/app/dashboards/*"      element={<AppGuard><PlaceholderPage title="Dashboards" /></AppGuard>} />
            <Route path="/app/crm/clube"         element={<AppGuard><ClubeRecompensasPage /></AppGuard>} />
            <Route path="/app/crm/*"             element={<AppGuard><PlaceholderPage title="CRM" /></AppGuard>} />
            <Route path="/app/agenda/*"          element={<AppGuard><PlaceholderPage title="Agenda" /></AppGuard>} />
            <Route path="/app/financeiro/*"      element={<AppGuard><PlaceholderPage title="Financeiro" /></AppGuard>} />
            <Route path="/app/estoque/*"         element={<AppGuard><PlaceholderPage title="Estoque" /></AppGuard>} />
            <Route path="/app/treinos/exercicios" element={<AppGuard><ExerciciosPage /></AppGuard>} />
            <Route path="/app/treinos/grupos"    element={<AppGuard><GruposExerciciosPage /></AppGuard>} />
            <Route path="/app/treinos/*"         element={<AppGuard><PlaceholderPage title="Treino" /></AppGuard>} />
            <Route path="/app/wod"               element={<AppGuard><WodPage /></AppGuard>} />
            <Route path="/app/relatorios"        element={<AppGuard><RelatoriosPage /></AppGuard>} />
            <Route path="/app/relatorios/*"      element={<AppGuard><PlaceholderPage title="Relatórios" /></AppGuard>} />
            <Route path="/app/administrativo/*"  element={<AppGuard><PlaceholderPage title="Administrativo" /></AppGuard>} />
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
