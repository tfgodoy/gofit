import { useState, useEffect } from "react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConfigItem {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  ativo: boolean;
}

interface Props {
  titulo: string;
  descricao: string;
  categoria: string;
  comCor?: boolean;
}

export default function CrmConfigListPage({ titulo, descricao, categoria, comCor }: Props) {
  const { user } = useAuth();
  const [items, setItems]       = useState<ConfigItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editId, setEditId]     = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor]   = useState("#6366f1");
  const [adding, setAdding]     = useState(false);
  const [newNome, setNewNome]   = useState("");
  const [newCor, setNewCor]     = useState("#6366f1");

  async function load() {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("crm_config")
      .select("id, nome, cor, ordem, ativo")
      .eq("contractor_id", user.contractorId)
      .eq("categoria", categoria)
      .order("ordem")
      .order("nome");
    setItems((data ?? []) as ConfigItem[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user, categoria]);

  async function handleAdd() {
    if (!newNome.trim() || !user?.contractorId) return;
    const { error } = await supabase.from("crm_config").insert({
      contractor_id: user.contractorId,
      categoria,
      nome: newNome.trim(),
      cor: comCor ? newCor : null,
    });
    if (error) { toast.error("Erro ao adicionar"); return; }
    toast.success("Adicionado com sucesso!");
    setAdding(false);
    setNewNome("");
    setNewCor("#6366f1");
    load();
  }

  async function handleSave(id: string) {
    if (!editNome.trim()) return;
    const { error } = await supabase
      .from("crm_config")
      .update({ nome: editNome.trim(), cor: comCor ? editCor : null })
      .eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!");
    setEditId(null);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("crm_config").delete().eq("id", id);
    toast.success("Removido!");
    load();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("crm_config").update({ ativo: !ativo }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, ativo: !ativo } : i));
  }

  const inp = "flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{descricao}</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> ADICIONAR
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {adding && (
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-primary/5">
                  {comCor && (
                    <input
                      type="color" value={newCor}
                      onChange={e => setNewCor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 flex-shrink-0"
                    />
                  )}
                  <input
                    autoFocus value={newNome}
                    onChange={e => setNewNome(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAdd()}
                    placeholder="Nome..."
                    className={inp}
                  />
                  <button onClick={handleAdd} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex-shrink-0">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setAdding(false); setNewNome(""); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {items.length === 0 && !adding ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <p className="text-sm text-gray-400">Nenhum item cadastrado.</p>
                  <button onClick={() => setAdding(true)} className="text-xs font-semibold text-primary hover:underline">
                    Adicionar primeiro item →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-gray-50">
                      {comCor && editId !== item.id && (
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.cor ?? "#d1d5db" }}
                        />
                      )}

                      {editId === item.id ? (
                        <>
                          {comCor && (
                            <input
                              type="color" value={editCor}
                              onChange={e => setEditCor(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border-0 flex-shrink-0"
                            />
                          )}
                          <input
                            autoFocus value={editNome}
                            onChange={e => setEditNome(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleSave(item.id); if (e.key === "Escape") setEditId(null); }}
                            className={inp}
                          />
                          <button onClick={() => handleSave(item.id)} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`flex-1 text-sm font-medium ${item.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>
                            {item.nome}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => toggleAtivo(item.id, item.ativo)}
                              className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                                item.ativo ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {item.ativo ? "Ativo" : "Inativo"}
                            </button>
                            <button
                              onClick={() => { setEditId(item.id); setEditNome(item.nome); setEditCor(item.cor ?? "#6366f1"); }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
