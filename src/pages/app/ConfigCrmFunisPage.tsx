import { useState, useEffect } from "react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Pencil, Trash2, Check, X, Loader2, ChevronDown, ChevronRight, GripVertical,
} from "lucide-react";
import { toast } from "sonner";

interface Etapa {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface Funil {
  id: string;
  nome: string;
  padrao: boolean;
  ativo: boolean;
  etapas: Etapa[];
}

const COR_DEFAULTS = ["#3b82f6", "#8b5cf6", "#f97316", "#22c55e", "#ef4444", "#14b8a6", "#eab308"];

const inp = "flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

export default function ConfigCrmFunisPage() {
  const { user } = useAuth();
  const [funis, setFunis]         = useState<Funil[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Funil form
  const [addingFunil, setAddingFunil]   = useState(false);
  const [newFunilNome, setNewFunilNome] = useState("");
  const [editFunilId, setEditFunilId]   = useState<string | null>(null);
  const [editFunilNome, setEditFunilNome] = useState("");

  // Etapa form (per funil)
  const [addingEtapa, setAddingEtapa]   = useState<string | null>(null); // funil_id
  const [newEtapaNome, setNewEtapaNome] = useState("");
  const [newEtapaCor, setNewEtapaCor]   = useState("#6366f1");
  const [editEtapaId, setEditEtapaId]   = useState<string | null>(null);
  const [editEtapaNome, setEditEtapaNome] = useState("");
  const [editEtapaCor, setEditEtapaCor]   = useState("#6366f1");

  async function load() {
    if (!user?.contractorId) return;
    const { data: funisData } = await supabase
      .from("crm_funis")
      .select("id, nome, padrao, ativo")
      .eq("contractor_id", user.contractorId)
      .order("created_at");
    const { data: etapasData } = await supabase
      .from("crm_funil_etapas")
      .select("id, funil_id, nome, cor, ordem")
      .order("ordem");

    const etapasByFunil: Record<string, Etapa[]> = {};
    for (const e of (etapasData ?? []) as (Etapa & { funil_id: string })[]) {
      (etapasByFunil[e.funil_id] ??= []).push(e);
    }

    setFunis(
      (funisData ?? []).map((f: { id: string; nome: string; padrao: boolean; ativo: boolean }) => ({
        ...f, etapas: etapasByFunil[f.id] ?? [],
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleAddFunil() {
    if (!newFunilNome.trim() || !user?.contractorId) return;
    const { error } = await supabase.from("crm_funis").insert({
      contractor_id: user.contractorId,
      nome: newFunilNome.trim(),
    });
    if (error) { toast.error("Erro ao criar funil"); return; }
    toast.success("Funil criado!");
    setAddingFunil(false);
    setNewFunilNome("");
    load();
  }

  async function handleSaveFunil(id: string) {
    if (!editFunilNome.trim()) return;
    await supabase.from("crm_funis").update({ nome: editFunilNome.trim() }).eq("id", id);
    toast.success("Salvo!");
    setEditFunilId(null);
    load();
  }

  async function handleDeleteFunil(id: string) {
    await supabase.from("crm_funis").delete().eq("id", id);
    toast.success("Funil removido!");
    load();
  }

  async function handleAddEtapa(funilId: string) {
    if (!newEtapaNome.trim()) return;
    const funil = funis.find(f => f.id === funilId);
    const ordem = (funil?.etapas.length ?? 0);
    await supabase.from("crm_funil_etapas").insert({
      funil_id: funilId, nome: newEtapaNome.trim(), cor: newEtapaCor, ordem,
    });
    toast.success("Etapa adicionada!");
    setAddingEtapa(null);
    setNewEtapaNome("");
    setNewEtapaCor("#6366f1");
    load();
  }

  async function handleSaveEtapa(id: string) {
    if (!editEtapaNome.trim()) return;
    await supabase.from("crm_funil_etapas").update({ nome: editEtapaNome.trim(), cor: editEtapaCor }).eq("id", id);
    toast.success("Salvo!");
    setEditEtapaId(null);
    load();
  }

  async function handleDeleteEtapa(id: string) {
    await supabase.from("crm_funil_etapas").delete().eq("id", id);
    load();
  }

  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Funis e Etapas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Configure os funis de vendas e suas etapas do CRM.</p>
          </div>
          <button
            onClick={() => setAddingFunil(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> NOVO FUNIL
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {addingFunil && (
              <div className="flex items-center gap-3 bg-white border border-primary/30 rounded-2xl px-5 py-3">
                <input
                  autoFocus value={newFunilNome}
                  onChange={e => setNewFunilNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddFunil()}
                  placeholder="Nome do funil..."
                  className={inp}
                />
                <button onClick={handleAddFunil} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setAddingFunil(false); setNewFunilNome(""); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {funis.length === 0 && !addingFunil && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-sm text-gray-400">Nenhum funil cadastrado.</p>
                <button onClick={() => setAddingFunil(true)} className="text-xs font-semibold text-primary hover:underline">
                  Criar primeiro funil →
                </button>
              </div>
            )}

            {funis.map(funil => {
              const isOpen = expandedId === funil.id;
              return (
                <div key={funil.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Funil header */}
                  <div className="flex items-center gap-3 px-5 py-3 group">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : funil.id)}
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400"
                    >
                      {isOpen
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {editFunilId === funil.id ? (
                      <>
                        <input
                          autoFocus value={editFunilNome}
                          onChange={e => setEditFunilNome(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveFunil(funil.id); if (e.key === "Escape") setEditFunilId(null); }}
                          className={inp}
                        />
                        <button onClick={() => handleSaveFunil(funil.id)} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditFunilId(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-semibold text-gray-800">{funil.nome}</span>
                        {funil.padrao && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Padrão</span>
                        )}
                        <span className="text-xs text-gray-400">{funil.etapas.length} etapas</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditFunilId(funil.id); setEditFunilNome(funil.nome); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!funil.padrao && (
                            <button onClick={() => handleDeleteFunil(funil.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Pipeline preview chips */}
                  {!isOpen && funil.etapas.length > 0 && (
                    <div className="flex items-center gap-1.5 px-5 pb-3 flex-wrap">
                      {funil.etapas.map(e => (
                        <span
                          key={e.id}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: e.cor }}
                        >
                          {e.nome}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Etapas expanded */}
                  {isOpen && (
                    <div className="border-t border-gray-50 px-5 py-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Etapas</p>

                      {funil.etapas.map(etapa => (
                        <div key={etapa.id} className="flex items-center gap-3 group/etapa">
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.cor }} />

                          {editEtapaId === etapa.id ? (
                            <>
                              <input
                                type="color" value={editEtapaCor}
                                onChange={e => setEditEtapaCor(e.target.value)}
                                className="w-7 h-7 rounded cursor-pointer border-0 flex-shrink-0"
                              />
                              <input
                                autoFocus value={editEtapaNome}
                                onChange={e => setEditEtapaNome(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleSaveEtapa(etapa.id); if (e.key === "Escape") setEditEtapaId(null); }}
                                className={inp}
                              />
                              <button onClick={() => handleSaveEtapa(etapa.id)} className="p-1 rounded bg-green-100 text-green-700">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditEtapaId(null)} className="p-1 rounded bg-gray-100 text-gray-500">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-700">{etapa.nome}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover/etapa:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setEditEtapaId(etapa.id); setEditEtapaNome(etapa.nome); setEditEtapaCor(etapa.cor); }}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-400"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteEtapa(etapa.id)} className="p-1 rounded hover:bg-red-50 text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Cor defaults quickpick */}
                      {addingEtapa === funil.id ? (
                        <div className="flex items-center gap-2 mt-2 pl-7">
                          <div className="flex gap-1">
                            {COR_DEFAULTS.map(c => (
                              <button
                                key={c}
                                onClick={() => setNewEtapaCor(c)}
                                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                                style={{ backgroundColor: c, borderColor: newEtapaCor === c ? "#1f2937" : "transparent" }}
                              />
                            ))}
                            <input
                              type="color" value={newEtapaCor}
                              onChange={e => setNewEtapaCor(e.target.value)}
                              className="w-5 h-5 rounded cursor-pointer border-0"
                            />
                          </div>
                          <input
                            autoFocus value={newEtapaNome}
                            onChange={e => setNewEtapaNome(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddEtapa(funil.id)}
                            placeholder="Nome da etapa..."
                            className={inp}
                          />
                          <button onClick={() => handleAddEtapa(funil.id)} className="p-1 rounded bg-green-100 text-green-700">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setAddingEtapa(null); setNewEtapaNome(""); }} className="p-1 rounded bg-gray-100 text-gray-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingEtapa(funil.id); setNewEtapaNome(""); setNewEtapaCor("#6366f1"); }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline pl-7 mt-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar etapa
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
