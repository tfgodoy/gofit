import { useState, useEffect } from "react";
import {
  UserPlus, Plus, Search, Loader2, Trash2,
  Phone, Mail, ExternalLink, MoreVertical,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface Lead {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  sexo: "masculino" | "feminino" | "outro" | null;
  objetivo: string | null;
  created_at: string;
}

/* ── helpers ─────────────────────────────────────────────────── */

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

/* ── Quick-create modal ─────────────────────────────────────── */

interface QuickForm { nome: string; telefone: string; email: string; }
const emptyQ: QuickForm = { nome: "", telefone: "", email: "" };

function QuickModal({ onSave, onClose }: {
  onSave: (f: QuickForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<QuickForm>(emptyQ);
  const [saving, setSaving] = useState(false);

  async function go() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Novo Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
            <input autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do lead" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className={inputClass} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">CANCELAR</button>
          <button
            onClick={go}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            CRIAR LEAD
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function LeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("students")
      .select("id, nome_completo, email, telefone, data_nascimento, sexo, objetivo, created_at")
      .eq("contractor_id", user.contractorId!)
      .eq("status", "lead")
      .order("created_at", { ascending: false });
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleSave(form: QuickForm) {
    if (!user?.contractorId) return;
    const { data: newStudent, error } = await supabase
      .from("students")
      .insert({
        contractor_id: user.contractorId,
        nome_completo: form.nome.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.replace(/\D/g, "") || null,
        status: "lead",
      })
      .select("id")
      .single();
    if (error || !newStudent) { toast.error("Erro ao criar lead"); return; }

    await supabase.from("opportunities").insert({
      contractor_id: user.contractorId,
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      telefone: form.telefone.replace(/\D/g, "") || null,
      etapa: "Novo lead",
      student_id: newStudent.id,
    });

    toast.success("Lead criado!");
    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("students").update({ status: "cancelado" }).eq("id", id);
    toast.success("Lead removido.");
    setDeleteId(null);
    load();
  }

  const filtered = leads.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.nome_completo.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.telefone ?? "").includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Leads</h1>
              <p className="text-sm text-gray-400">{leads.length} lead{leads.length !== 1 ? "s" : ""} no total</p>
            </div>
          </div>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            + LEAD
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, e-mail ou telefone..."
              className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <UserPlus className="w-7 h-7 text-blue-300" />
              </div>
              <p className="text-sm text-gray-400 font-semibold">
                {search ? "Nenhum resultado encontrado" : "Nenhum lead cadastrado"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">NOME</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">IDADE</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 hidden md:table-cell">SEXO</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 hidden lg:table-cell">OBJETIVO</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 hidden md:table-cell">CONTATO</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const phone = (l.telefone ?? "").replace(/\D/g, "");
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 group cursor-pointer"
                      onClick={() => navigate(`/app/crm/leads/${l.id}`)}
                    >
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => navigate(`/app/crm/leads/${l.id}`)}
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                            {getInitials(l.nome_completo)}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 hover:text-primary transition-colors">
                            {l.nome_completo}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{calcAge(l.data_nascimento)}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 hidden md:table-cell">
                        {l.sexo ? l.sexo.charAt(0).toUpperCase() + l.sexo.slice(1) : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 hidden lg:table-cell">
                        {l.objetivo ?? "—"}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                        <div className="space-y-0.5">
                          {l.telefone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600">{l.telefone}</span>
                              {phone && (
                                <button
                                  onClick={() => window.open(`https://wa.me/55${phone}`, "_blank")}
                                  className="text-[10px] font-bold text-green-600 hover:underline ml-1"
                                >
                                  WA
                                </button>
                              )}
                            </div>
                          )}
                          {l.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600 truncate max-w-[160px]">{l.email}</span>
                            </div>
                          )}
                          {!l.telefone && !l.email && <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/app/crm/leads/${l.id}`)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"
                            title="Visualizar perfil"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setMenuOpen(menuOpen === l.id ? null : l.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {menuOpen === l.id && (
                              <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                                <button
                                  onClick={() => { navigate(`/app/crm/leads/${l.id}`); setMenuOpen(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Visualizar perfil
                                </button>
                                <button
                                  onClick={() => { navigate(`/app/clientes/${l.id}/cadastro`); setMenuOpen(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => { setDeleteId(l.id); setMenuOpen(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  Remover
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && <QuickModal onSave={handleSave} onClose={() => setModal(false)} />}

      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Remover lead</h3>
            <p className="text-sm text-gray-500 mb-5">O lead será marcado como cancelado e removido desta lista.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700">Remover</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
