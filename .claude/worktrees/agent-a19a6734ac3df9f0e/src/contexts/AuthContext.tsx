import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "contractor" | "teacher" | "receptionist" | "sales" | "nutritionist" | "physiotherapist" | "evaluator";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  contractorId?: string;
  contractorName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credential: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const OWNER_CREDENTIAL = import.meta.env.VITE_OWNER_EMAIL ?? "owner@fitcoresys.com.br";
const OWNER_PASSWORD = import.meta.env.VITE_OWNER_PASSWORD ?? "FitCore@2025!";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("fitcoresys_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AuthUser);
      } catch {
        localStorage.removeItem("fitcoresys_user");
      }
    }
    setLoading(false);
  }, []);

  async function login(credential: string, password: string): Promise<{ error?: string }> {
    if (credential === OWNER_CREDENTIAL && password === OWNER_PASSWORD) {
      const ownerUser: AuthUser = {
        id: "owner-0",
        name: "FitCoreSys Admin",
        email: OWNER_CREDENTIAL,
        role: "owner",
      };
      setUser(ownerUser);
      localStorage.setItem("fitcoresys_user", JSON.stringify(ownerUser));
      return {};
    }

    const isCNPJ = credential.replace(/\D/g, "").length === 14;
    const query = supabase
      .from("contractors")
      .select("id, razao_social, email, cnpj, status")
      .eq("status", "active");

    const { data: contractor, error: contractorError } = isCNPJ
      ? await query.eq("cnpj", credential.replace(/\D/g, "")).maybeSingle()
      : await query.eq("email", credential).maybeSingle();

    if (contractorError || !contractor) {
      return { error: "Credenciais inválidas ou empresa não encontrada." };
    }

    const { data: authData, error: authError } = await supabase
      .from("contractor_auth")
      .select("password_hash")
      .eq("contractor_id", contractor.id)
      .single();

    if (authError || !authData) {
      return { error: "Falha na autenticação. Contate o suporte." };
    }

    if (authData.password_hash !== btoa(password)) {
      return { error: "Senha incorreta." };
    }

    const contractorUser: AuthUser = {
      id: contractor.id,
      name: contractor.razao_social,
      email: contractor.email,
      role: "contractor",
      contractorId: contractor.id,
      contractorName: contractor.razao_social,
    };
    setUser(contractorUser);
    localStorage.setItem("fitcoresys_user", JSON.stringify(contractorUser));
    return {};
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("fitcoresys_user");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
