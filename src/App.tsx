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
            <Route path="/app/dashboard" element={<AppGuard><ContractorDashboard /></AppGuard>} />
            <Route path="/app/alunos"    element={<AppGuard><AlunosPage /></AppGuard>} />
            <Route path="/app/alunos/novo" element={<AppGuard><AlunoFormPage /></AppGuard>} />
            <Route path="/app/alunos/:id"  element={<AppGuard><AlunoFormPage /></AppGuard>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
