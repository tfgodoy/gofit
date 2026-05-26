import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import ContractorRegisterPage from "@/pages/ContractorRegisterPage";
import OwnerDashboard from "@/pages/OwnerDashboard";
import ContractorDashboard from "@/pages/ContractorDashboard";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<ContractorRegisterPage />} />

            {/* Owner only */}
            <Route
              path="/owner/dashboard"
              element={
                <AuthGuard allowedRoles={["owner"]}>
                  <OwnerDashboard />
                </AuthGuard>
              }
            />

            {/* Contractor and staff */}
            <Route
              path="/app/dashboard"
              element={
                <AuthGuard allowedRoles={["contractor", "teacher", "receptionist", "sales", "nutritionist", "physiotherapist", "evaluator"]}>
                  <ContractorDashboard />
                </AuthGuard>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
