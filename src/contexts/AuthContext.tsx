import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "contractor" | "teacher" | "receptionist" | "sales" | "nutritionist" | "physiotherapist" | "evaluator" | "admin";

export type ModulePerm = { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  contractorId?: string;
  contractorName?: string;
  staffId?: string;
  isStaff?: boolean;
  permissions?: Record<string, ModulePerm>; // module_name → perms
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credential: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  canView:   (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canEdit:   (module: string) => boolean;
  canDelete: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Permissões padrão por papel (fallback se não houver no banco)
const DEFAULT_PERMS: Record<string, Record<string, ModulePerm>> = {
  admin: {},
  teacher: {
    clientes:    { can_view: true,  can_create: false, can_edit: true,  can_delete: false },
    dashboards:  { can_view: false, can_create: false, can_edit: false, can_delete: false },
    crm:         { can_view: false, can_create: false, can_edit: false, can_delete: false },
    agenda:      { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    financeiro:  { can_view: false, can_create: false, can_edit: false, can_delete: false },
    estoque:     { can_view: false, can_create: false, can_edit: false, can_delete: false },
    treinos:     { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    wod:         { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    relatorios:  { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    avaliacoes:  { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
  },
  receptionist: {
    clientes:    { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    dashboards:  { can_view: false, can_create: false, can_edit: false, can_delete: false },
    crm:         { can_view: true,  can_create: true,  can_edit: false, can_delete: false },
    agenda:      { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
    financeiro:  { can_view: true,  can_create: true,  can_edit: false, can_delete: false },
    estoque:     { can_view: false, can_create: false, can_edit: false, can_delete: false },
    treinos:     { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    wod:         { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    relatorios:  { can_view: true,  can_create: false, can_edit: false, can_delete: false },
  },
  sales: {
    clientes:    { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    dashboards:  { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    crm:         { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
    agenda:      { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    financeiro:  { can_view: true,  can_create: true,  can_edit: false, can_delete: false },
    estoque:     { can_view: false, can_create: false, can_edit: false, can_delete: false },
    relatorios:  { can_view: true,  can_create: false, can_edit: false, can_delete: false },
  },
};

async function loadStaffPermissions(contractorId: string, role: string): Promise<Record<string, ModulePerm>> {
  const { data } = await supabase
    .from("role_permissions")
    .select("module_name, can_view, can_create, can_edit, can_delete")
    .eq("contractor_id", contractorId)
    .eq("role", role);

  if (data && data.length > 0) {
    const perms: Record<string, ModulePerm> = {};
    for (const row of data) {
      perms[row.module_name] = {
        can_view:   row.can_view   ?? false,
        can_create: row.can_create ?? false,
        can_edit:   row.can_edit   ?? false,
        can_delete: row.can_delete ?? false,
      };
    }
    return perms;
  }

  // Fallback para defaults em memória
  return DEFAULT_PERMS[role] ?? {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const stored = localStorage.getItem("fitcoresys_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AuthUser;
          // Para staff, re-busca permissões do banco a cada carregamento
          // assim mudanças no painel de permissões refletem imediatamente
          if (parsed.isStaff && parsed.contractorId && parsed.role) {
            const freshPerms = await loadStaffPermissions(parsed.contractorId, parsed.role);
            const updated = { ...parsed, permissions: freshPerms };
            setUser(updated);
            localStorage.setItem("fitcoresys_user", JSON.stringify(updated));
          } else {
            setUser(parsed);
          }
        } catch {
          localStorage.removeItem("fitcoresys_user");
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  async function login(credential: string, password: string): Promise<{ error?: string }> {
    // ── 1. Owner via Supabase Auth ───────────────────────────────
    // Tenta autenticar pelo Supabase Auth e verifica role 'admin' em user_roles
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credential.trim().toLowerCase(),
      password,
    });

    if (!authError && authData.user) {
      const { data: ownerRow } = await supabase
        .from("platform_owners")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (ownerRow?.user_id) {
        const ownerUser: AuthUser = {
          id: authData.user.id,
          name: "GoFit Admin",
          email: authData.user.email ?? credential,
          role: "owner",
        };
        setUser(ownerUser);
        localStorage.setItem("fitcoresys_user", JSON.stringify(ownerUser));
        return {};
      }

      // Autenticou no Supabase mas não é owner — encerra sessão e continua o fluxo
      await supabase.auth.signOut();
    }

    // ── 2. Contractor (dono da academia) ─────────────────────────
    const isCNPJ = credential.replace(/\D/g, "").length === 14;
    const contractorQuery = supabase
      .from("contractors")
      .select("id, razao_social, email, cnpj, status")
      .eq("status", "active");

    const { data: contractor } = isCNPJ
      ? await contractorQuery.eq("cnpj", credential.replace(/\D/g, "")).maybeSingle()
      : await contractorQuery.eq("email", credential.trim().toLowerCase()).maybeSingle();

    if (contractor) {
      const { data: authData } = await supabase
        .from("contractor_auth")
        .select("password_hash")
        .eq("contractor_id", contractor.id)
        .single();

      if (!authData) return { error: "Falha na autenticação. Contate o suporte." };
      if (authData.password_hash !== btoa(password)) return { error: "Senha incorreta." };

      // Sessão Supabase Auth — necessária para RLS por auth.uid() (ex.: company_modules)
      // e para as Edge Functions que resolvem o contractor pelo JWT.
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: contractor.email,
        password,
      });
      if (authErr) {
        console.warn("[auth] Sessão Supabase Auth não estabelecida:", authErr.message);
      }

      const contractorUser: AuthUser = {
        id:             contractor.id,
        name:           contractor.razao_social,
        email:          contractor.email,
        role:           "contractor",
        contractorId:   contractor.id,
        contractorName: contractor.razao_social,
      };
      setUser(contractorUser);
      localStorage.setItem("fitcoresys_user", JSON.stringify(contractorUser));
      return {};
    }

    // ── 3. Staff (colaborador da equipe) ─────────────────────────
    const { data: staffMember } = await supabase
      .from("staff")
      .select("id, name, email, role, password_hash, contractor_id, blocked, active, deleted_at")
      .eq("email", credential.trim().toLowerCase())
      .is("deleted_at", null)
      .maybeSingle();

    if (!staffMember) return { error: "Credenciais inválidas ou empresa não encontrada." };
    if (staffMember.blocked)  return { error: "Seu acesso foi bloqueado. Contate o administrador." };
    if (!staffMember.active)  return { error: "Conta inativa. Contate o administrador." };
    if (!staffMember.password_hash) return { error: "Senha não definida. Solicite ao administrador." };
    if (staffMember.password_hash !== btoa(password)) return { error: "Senha incorreta." };

    // Sessão Supabase Auth do colaborador (se provisionado em auth.users)
    const { error: staffAuthErr } = await supabase.auth.signInWithPassword({
      email: staffMember.email,
      password,
    });
    if (staffAuthErr) {
      console.warn("[auth] Sessão Supabase Auth não estabelecida (staff):", staffAuthErr.message);
    }

    // Busca o nome da academia
    const { data: contractorData } = await supabase
      .from("contractors")
      .select("razao_social")
      .eq("id", staffMember.contractor_id)
      .maybeSingle();

    // Carrega permissões do banco
    const permissions = await loadStaffPermissions(staffMember.contractor_id, staffMember.role);

    const staffUser: AuthUser = {
      id:             staffMember.id,
      name:           staffMember.name,
      email:          staffMember.email,
      role:           staffMember.role as UserRole,
      contractorId:   staffMember.contractor_id,
      contractorName: contractorData?.razao_social ?? "",
      staffId:        staffMember.id,
      isStaff:        true,
      permissions,
    };
    setUser(staffUser);
    localStorage.setItem("fitcoresys_user", JSON.stringify(staffUser));
    return {};
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("fitcoresys_user");
    supabase.auth.signOut();
  }

  // Helpers de permissão — contractor/owner sempre tem tudo
  function isFullAccess() {
    return !user?.isStaff || user.role === "admin";
  }
  function canView(module: string)   { return isFullAccess() || (user?.permissions?.[module]?.can_view   ?? false); }
  function canCreate(module: string) { return isFullAccess() || (user?.permissions?.[module]?.can_create ?? false); }
  function canEdit(module: string)   { return isFullAccess() || (user?.permissions?.[module]?.can_edit   ?? false); }
  function canDelete(module: string) { return isFullAccess() || (user?.permissions?.[module]?.can_delete ?? false); }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canView, canCreate, canEdit, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
