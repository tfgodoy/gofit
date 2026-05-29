import { useState, useEffect } from "react";
import {
  Building2, Plus, Pencil, Trash2, X, Loader2, Star, MapPin,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCEP } from "@/hooks/useCEP";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface Unit {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  is_principal: boolean;
  ativo: boolean;
  created_at: string;
}

interface UnitForm {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  is_principal: boolean;
  ativo: boolean;
}

const emptyForm: UnitForm = {
  nome: "", cnpj: "", telefone: "", email: "",
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf: "",
  is_principal: false, ativo: true,
};

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`;
}

/* ── Unit Modal ─────────────────────────────────────────────── */

function UnitModal({
  unit,
  hasOtherPrincipal,
  onSave,
  onClose,
}: {
  unit: Unit | null;
  hasOtherPrincipal: boolean;
  onSave: (form: UnitForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UnitForm>(
    unit
      ? {
          nome:         unit.nome,
          cnpj:         unit.cnpj ?? "",
          telefone:     unit.telefone ?? "",
          email:        unit.email ?? "",
          cep:          unit.cep ?? "",
          logradouro:   unit.logradouro ?? "",
          numero:       unit.numero ?? "",
          complemento:  unit.complemento ?? "",
          bairro:       unit.bairro ?? "",
          cidade:       unit.cidade ?? "",
          uf:           unit.uf ?? "",
          is_principal: unit.is_principal,
          ativo:        unit.ativo,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const { fetchCEP, loading: cepLoading } = useCEP();

  function set(k: keyof UnitForm, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleCEP(raw: string) {
    const cep = maskCEP(raw);
    set("cep", cep);
    if (cep.replace(/\D/g, "").length === 8) {
      const data = await fetchCEP(cep);
      if (data) {
        setForm(prev => ({
          ...prev,
          logradouro: data.logradouro,
          bairro:     data.bairro,
          cidade:     data.localidade,
          uf:         data.uf,
        }));
      }
    }
  }

  async function go() {
    if (!form.nome.trim()) { toast.error("Informe o nome da unidade"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">
            {unit ? "Editar Unidade" : "Nova Unidade"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Dados básicos */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Dados da unidade</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da unidade *</label>
                <input
                  autoFocus
                  value={form.nome}
                  onChange={e => set("nome", e.target.value)}
                  placeholder="Ex: Unidade Centro, Filial Norte..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CNPJ</label>
                <input
                  value={form.cnpj}
                  onChange={e => set("cnpj", maskCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                <input
                  value={form.telefone}
                  onChange={e => set("telefone", e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="contato@academia.com.br"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Endereço</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">CEP</label>
                <div className="relative">
                  <input
                    value={form.cep}
                    onChange={e => handleCEP(e.target.value)}
                    placeholder="00000-000"
                    className={inputClass}
                  />
                  {cepLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 absolute right-2.5 top-2.5" />
                  )}
                </div>
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Logradouro</label>
                <input value={form.logradouro} onChange={e => set("logradouro", e.target.value)} placeholder="Rua, Av..." className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Número</label>
                <input value={form.numero} onChange={e => set("numero", e.target.value)} placeholder="Nº" className={inputClass} />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Complemento</label>
                <input value={form.complemento} onChange={e => set("complemento", e.target.value)} placeholder="Sala, andar..." className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bairro</label>
                <input value={form.bairro} onChange={e => set("bairro", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
                <input value={form.cidade} onChange={e => set("cidade", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">UF</label>
                <input value={form.uf} onChange={e => set("uf", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Configurações</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_principal}
                  onChange={e => set("is_principal", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary"
                  disabled={unit?.is_principal && !form.is_principal}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Unidade principal</p>
                  <p className="text-xs text-gray-400">Identificada como a sede da empresa</p>
                  {hasOtherPrincipal && !unit?.is_principal && (
                    <p className="text-xs text-orange-600 mt-0.5">Atenção: outra unidade já é a principal. Marcando esta, a outra será alterada.</p>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={e => set("ativo", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Unidade ativa</p>
                  <p className="text-xs text-gray-400">Unidades inativas não aparecem nas seleções do sistema</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">CANCELAR</button>
          <button
            onClick={go}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function UnidadesPage() {
  const { user } = useAuth();
  const [units, setUnits]       = useState<Unit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<false | null | Unit>(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("units")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .order("is_principal", { ascending: false })
      .order("nome");
    setUnits((data ?? []) as Unit[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleSave(form: UnitForm) {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;

    const payload = {
      contractor_id: cid,
      nome:          form.nome.trim(),
      cnpj:          form.cnpj.trim() || null,
      telefone:      form.telefone.trim() || null,
      email:         form.email.trim() || null,
      cep:           form.cep.trim() || null,
      logradouro:    form.logradouro.trim() || null,
      numero:        form.numero.trim() || null,
      complemento:   form.complemento.trim() || null,
      bairro:        form.bairro.trim() || null,
      cidade:        form.cidade.trim() || null,
      uf:            form.uf.trim() || null,
      is_principal:  form.is_principal,
      ativo:         form.ativo,
      updated_at:    new Date().toISOString(),
    };

    /* if marking as principal, clear others first */
    if (form.is_principal) {
      await supabase.from("units").update({ is_principal: false }).eq("contractor_id", cid);
    }

    if (modal && (modal as Unit).id) {
      await supabase.from("units").update(payload).eq("id", (modal as Unit).id);
      toast.success("Unidade atualizada!");
    } else {
      await supabase.from("units").insert(payload);
      toast.success("Unidade criada!");
    }

    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("units").delete().eq("id", id);
    toast.success("Unidade excluída.");
    setDeleteId(null);
    load();
  }

  const hasPrincipal = units.some(u => u.is_principal);
  const deleteTarget = deleteId ? units.find(u => u.id === deleteId) : null;

  return (
    <AppLayout>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Unidades</h1>
              <p className="text-sm text-gray-400">Gerencie as filiais e unidades da academia</p>
            </div>
          </div>
          <button
            onClick={() => setModal(null)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            NOVA UNIDADE
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary/30" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Nenhuma unidade cadastrada</p>
            <p className="text-xs text-gray-400">Clique em "NOVA UNIDADE" para adicionar a primeira filial</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {units.map(unit => (
              <div
                key={unit.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 group"
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {unit.is_principal && (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    )}
                    <h3 className="text-sm font-bold text-gray-800 truncate">{unit.nome}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                    <button onClick={() => setModal(unit)} className="p-1.5 rounded hover:bg-gray-100" title="Editar">
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => setDeleteId(unit.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1.5">
                  {unit.cnpj && (
                    <p className="text-xs text-gray-500">CNPJ: {unit.cnpj}</p>
                  )}
                  {unit.telefone && (
                    <p className="text-xs text-gray-500">{unit.telefone}</p>
                  )}
                  {unit.email && (
                    <p className="text-xs text-gray-500 truncate">{unit.email}</p>
                  )}
                  {(unit.logradouro || unit.cidade) && (
                    <div className="flex items-start gap-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>
                        {[unit.logradouro, unit.numero, unit.complemento].filter(Boolean).join(", ")}
                        {unit.cidade && ` — ${unit.cidade}${unit.uf ? `/${unit.uf}` : ""}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer badges */}
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50">
                  {unit.is_principal && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      Principal
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    unit.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {unit.ativo ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal !== false && (
        <UnitModal
          unit={modal}
          hasOtherPrincipal={hasPrincipal && !(modal as Unit)?.is_principal}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir unidade</h3>
            <p className="text-sm text-gray-500 mb-5">
              Tem certeza que deseja excluir <strong>{deleteTarget.nome}</strong>?
              {deleteTarget.is_principal && (
                <span className="block mt-1 text-orange-600 font-semibold">
                  Atenção: esta é a unidade principal.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
              <button onClick={() => handleDelete(deleteTarget.id)} className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
