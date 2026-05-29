import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, Save, Info } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── constants ──────────────────────────────────────────────── */

const ROLES: { key: string; label: string; description: string }[] = [
  { key: "admin",          label: "Administrador",    description: "Acesso total ao sistema"                       },
  { key: "teacher",        label: "Professor",        description: "Treinos, agenda e avaliações físicas"          },
  { key: "receptionist",   label: "Recepcionista",    description: "Atendimento, agenda e caixa"                   },
  { key: "sales",          label: "Vendas",           description: "CRM, oportunidades e financeiro"              },
  { key: "nutritionist",   label: "Nutricionista",    description: "Clientes e avaliações"                        },
  { key: "physiotherapist",label: "Fisioterapeuta",   description: "Clientes, treinos e avaliações"               },
  { key: "evaluator",      label: "Avaliador",        description: "Avaliações físicas e clientes (somente leitura)" },
];

const MODULES: { key: string; label: string }[] = [
  { key: "clientes",      label: "Clientes"           },
  { key: "crm",           label: "CRM"                },
  { key: "agenda",        label: "Agenda"             },
  { key: "financeiro",    label: "Financeiro"         },
  { key: "treinos",       label: "Treinos"            },
  { key: "wod",           label: "WOD"                },
  { key: "relatorios",    label: "Relatórios"         },
  { key: "avaliacoes",    label: "Avaliações Físicas" },
  { key: "configuracoes", label: "Configurações"      },
];

const ACTIONS: { key: "can_view" | "can_create" | "can_edit" | "can_delete"; label: string; color: string }[] = [
  { key: "can_view",   label: "Visualizar", color: "text-blue-700 bg-blue-50 border-blue-200"   },
  { key: "can_create", label: "Criar",      color: "text-green-700 bg-green-50 border-green-200" },
  { key: "can_edit",   label: "Editar",     color: "text-orange-700 bg-orange-50 border-orange-200" },
  { key: "can_delete", label: "Excluir",    color: "text-red-700 bg-red-50 border-red-200"     },
];

/* Default permissions per role */
type Perm = { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };

const DEFAULTS: Record<string, Record<string, Perm>> = {
  admin: Object.fromEntries(MODULES.map(m => [m.key, { can_view: true, can_create: true, can_edit: true, can_delete: true }])),
  teacher: {
    clientes:      { can_view: true,  can_create: false, can_edit: true,  can_delete: false },
    crm:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    agenda:        { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    financeiro:    { can_view: false, can_create: false, can_edit: false, can_delete: false },
    treinos:       { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    wod:           { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    relatorios:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    avaliacoes:    { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    configuracoes: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
  receptionist: {
    clientes:      { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    crm:           { can_view: true,  can_create: true,  can_edit: false, can_delete: false },
    agenda:        { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
    financeiro:    { can_view: true,  can_create: true,  can_edit: false, can_delete: false },
    treinos:       { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    wod:           { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    relatorios:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    avaliacoes:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    configuracoes: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
  sales: {
    clientes:      { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    crm:           { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
    agenda:        { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    financeiro:    { can_view: true,  can_create: true,  can_edit: false, can_delete: false },
    treinos:       { can_view: false, can_create: false, can_edit: false, can_delete: false },
    wod:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    relatorios:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    avaliacoes:    { can_view: false, can_create: false, can_edit: false, can_delete: false },
    configuracoes: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
  nutritionist: {
    clientes:      { can_view: true,  can_create: false, can_edit: true,  can_delete: false },
    crm:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    agenda:        { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    financeiro:    { can_view: false, can_create: false, can_edit: false, can_delete: false },
    treinos:       { can_view: false, can_create: false, can_edit: false, can_delete: false },
    wod:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    relatorios:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    avaliacoes:    { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    configuracoes: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
  physiotherapist: {
    clientes:      { can_view: true,  can_create: false, can_edit: true,  can_delete: false },
    crm:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    agenda:        { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    financeiro:    { can_view: false, can_create: false, can_edit: false, can_delete: false },
    treinos:       { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    wod:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    relatorios:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    avaliacoes:    { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    configuracoes: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
  evaluator: {
    clientes:      { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    crm:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    agenda:        { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    financeiro:    { can_view: false, can_create: false, can_edit: false, can_delete: false },
    treinos:       { can_view: false, can_create: false, can_edit: false, can_delete: false },
    wod:           { can_view: false, can_create: false, can_edit: false, can_delete: false },
    relatorios:    { can_view: false, can_create: false, can_edit: false, can_delete: false },
    avaliacoes:    { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
    configuracoes: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
};

/* ── types ──────────────────────────────────────────────────── */

type PermMatrix = Record<string, Record<string, Perm>>; // role → module → perm

/* ── Toggle switch ──────────────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${
        checked ? "bg-primary" : "bg-gray-200"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function PermissoesPage() {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState(ROLES[0].key);
  const [matrix, setMatrix]         = useState<PermMatrix>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [dirty, setDirty]           = useState(false);

  /* merge DB data over defaults */
  const buildMatrix = useCallback((dbRows: any[]): PermMatrix => {
    const base: PermMatrix = {};
    for (const role of ROLES) {
      base[role.key] = DEFAULTS[role.key] ? { ...DEFAULTS[role.key] } : {};
      for (const mod of MODULES) {
        if (!base[role.key][mod.key]) {
          base[role.key][mod.key] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
        }
      }
    }
    for (const row of dbRows) {
      if (!base[row.role]) base[row.role] = {};
      base[row.role][row.module_name] = {
        can_view:   row.can_view,
        can_create: row.can_create,
        can_edit:   row.can_edit,
        can_delete: row.can_delete,
      };
    }
    return base;
  }, []);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase
      .from("role_permissions")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .then(({ data }) => {
        setMatrix(buildMatrix((data ?? []) as any[]));
        setLoading(false);
      });
  }, [user, buildMatrix]);

  function toggle(role: string, mod: string, action: keyof Perm) {
    setMatrix(prev => {
      const rolePerm = { ...prev[role] };
      rolePerm[mod] = { ...rolePerm[mod], [action]: !rolePerm[mod][action] };
      return { ...prev, [role]: rolePerm };
    });
    setDirty(true);
  }

  function toggleAllModule(role: string, mod: string, allOn: boolean) {
    setMatrix(prev => {
      const rolePerm = { ...prev[role] };
      rolePerm[mod] = { can_view: allOn, can_create: allOn, can_edit: allOn, can_delete: allOn };
      return { ...prev, [role]: rolePerm };
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    setSaving(true);
    const cid = user.contractorId!;

    const upserts = [];
    for (const role of ROLES) {
      for (const mod of MODULES) {
        const p = matrix[role.key]?.[mod.key];
        if (!p) continue;
        upserts.push({
          contractor_id: cid,
          role:          role.key,
          module_name:   mod.key,
          can_view:      p.can_view,
          can_create:    p.can_create,
          can_edit:      p.can_edit,
          can_delete:    p.can_delete,
          updated_at:    new Date().toISOString(),
        });
      }
    }

    const { error } = await supabase
      .from("role_permissions")
      .upsert(upserts, { onConflict: "contractor_id,role,module_name" });

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar permissões");
      return;
    }
    toast.success("Permissões salvas!");
    setDirty(false);
  }

  function resetToDefaults() {
    const base: PermMatrix = {};
    for (const role of ROLES) {
      base[role.key] = { ...DEFAULTS[role.key] };
    }
    setMatrix(base);
    setDirty(true);
  }

  const roleInfo  = ROLES.find(r => r.key === activeRole)!;
  const rolePerm  = matrix[activeRole] ?? {};

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Perfis de Acesso</h1>
              <p className="text-sm text-gray-400 mt-0.5">Configure as permissões por papel de usuário</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetToDefaults}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Restaurar padrões
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              SALVAR PERMISSÕES
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 mb-6">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              As permissões configuram o que cada papel de funcionário pode fazer no sistema.
              O <strong>dono da academia</strong> sempre tem acesso total independente dessas configurações.
            </p>
          </div>

          <div className="flex gap-5">
            {/* Role tabs (left sidebar) */}
            <div className="w-56 flex-shrink-0 space-y-1">
              {ROLES.map(role => (
                <button
                  key={role.key}
                  onClick={() => setActiveRole(role.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                    activeRole === role.key
                      ? "bg-primary text-white shadow-sm"
                      : "bg-white border border-gray-100 text-gray-700 hover:border-primary/20 hover:bg-primary/5"
                  }`}
                >
                  <p className={`text-sm font-semibold ${activeRole === role.key ? "text-white" : "text-gray-800"}`}>
                    {role.label}
                  </p>
                  <p className={`text-xs mt-0.5 leading-snug ${activeRole === role.key ? "text-white/70" : "text-gray-400"}`}>
                    {role.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Permission matrix */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-800">{roleInfo.label}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{roleInfo.description}</p>
                </div>
                {activeRole === "admin" && (
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    Acesso total (não editável)
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3 w-44">MÓDULO</th>
                      {ACTIONS.map(a => (
                        <th key={a.key} className="text-center text-xs font-semibold text-gray-500 px-4 py-3 w-28">
                          <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${a.color}`}>
                            {a.label}
                          </span>
                        </th>
                      ))}
                      <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3 w-24">TUDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod, i) => {
                      const perm = rolePerm[mod.key] ?? { can_view: false, can_create: false, can_edit: false, can_delete: false };
                      const allOn = ACTIONS.every(a => perm[a.key]);
                      const isAdmin = activeRole === "admin";
                      return (
                        <tr key={mod.key} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                          <td className="px-6 py-3.5">
                            <span className="text-sm font-semibold text-gray-700">{mod.label}</span>
                          </td>
                          {ACTIONS.map(action => (
                            <td key={action.key} className="px-4 py-3.5 text-center">
                              <div className="flex justify-center">
                                <Toggle
                                  checked={perm[action.key]}
                                  onChange={_ => !isAdmin && toggle(activeRole, mod.key, action.key)}
                                />
                              </div>
                            </td>
                          ))}
                          <td className="px-4 py-3.5 text-center">
                            {!isAdmin && (
                              <button
                                onClick={() => toggleAllModule(activeRole, mod.key, !allOn)}
                                className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                                  allOn
                                    ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                }`}
                              >
                                {allOn ? "Nenhum" : "Todos"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
