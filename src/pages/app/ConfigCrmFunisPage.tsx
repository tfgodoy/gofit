import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Check, X, Loader2, GripVertical, MoreVertical,
  Filter, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface Etapa { id: string; nome: string; cor: string; ordem: number; }
interface Funil { id: string; nome: string; padrao: boolean; ativo: boolean; etapas: Etapa[]; }

/* ── helpers ────────────────────────────────────────────────── */

const COR_DEFAULTS = ["#6366f1", "#8b5cf6", "#3b82f6", "#f97316", "#22c55e", "#ef4444", "#14b8a6", "#eab308"];

const inp =
  "flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

/** Etapas que ficam fixas no fundo do funil (não arrastáveis) */
const FIXED_NOMES = ["Perdido", "Perdeu", "Ganhou", "Matrícula"];
function isFixed(nome: string) {
  return FIXED_NOMES.some(f => nome.toLowerCase() === f.toLowerCase());
}

/* ── DropdownMenu ────────────────────────────────────────────── */

function DropMenu({ items }: { items: { label: string; danger?: boolean; onClick: () => void }[] }) {
  return (
    <div className="absolute right-0 top-7 z-30 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px]">
      {items.map(item => (
        <button
          key={item.label}
          onClick={e => { e.stopPropagation(); item.onClick(); }}
          className={`w-full text-left text-sm px-4 py-2 hover:bg-gray-50 transition-colors ${
            item.danger ? "text-red-500" : "text-gray-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function ConfigCrmFunisPage() {
  const { user } = useAuth();
  const [funis, setFunis]     = useState<Funil[]>([]);
  const [loading, setLoading] = useState(true);

  // Funil form
  const [addingFunil, setAddingFunil]     = useState(false);
  const [newFunilNome, setNewFunilNome]   = useState("");
  const [editFunilId, setEditFunilId]     = useState<string | null>(null);
  const [editFunilNome, setEditFunilNome] = useState("");
  const [menuFunilId, setMenuFunilId]     = useState<string | null>(null);

  // Etapa form
  const [addingEtapa, setAddingEtapa]       = useState<string | null>(null);
  const [newEtapaNome, setNewEtapaNome]     = useState("");
  const [newEtapaCor, setNewEtapaCor]       = useState("#6366f1");
  const [editEtapaId, setEditEtapaId]       = useState<string | null>(null);
  const [editEtapaNome, setEditEtapaNome]   = useState("");
  const [editEtapaCor, setEditEtapaCor]     = useState("#6366f1");
  const [menuEtapaId, setMenuEtapaId]       = useState<string | null>(null);

  // Drag
  const [dragId, setDragId]     = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

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

    const byFunil: Record<string, Etapa[]> = {};
    for (const e of (etapasData ?? []) as (Etapa & { funil_id: string })[]) {
      (byFunil[e.funil_id] ??= []).push(e);
    }
    setFunis(
      (funisData ?? []).map((f: { id: string; nome: string; padrao: boolean; ativo: boolean }) => ({
        ...f, etapas: byFunil[f.id] ?? [],
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  // Close menus on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFunilId(null);
        setMenuEtapaId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Funil CRUD ── */

  async function handleAddFunil() {
    if (!newFunilNome.trim() || !user?.contractorId) return;
    const { error } = await supabase.from("crm_funis").insert({
      contractor_id: user.contractorId, nome: newFunilNome.trim(),
    });
    if (error) { toast.error("Erro ao criar funil"); return; }
    toast.success("Funil criado!");
    setAddingFunil(false); setNewFunilNome(""); load();
  }

  async function handleSaveFunil(id: string) {
    if (!editFunilNome.trim()) return;
    await supabase.from("crm_funis").update({ nome: editFunilNome.trim() }).eq("id", id);
    toast.success("Funil renomeado!"); setEditFunilId(null); load();
  }

  async function handleDeleteFunil(id: string) {
    await supabase.from("crm_funis").delete().eq("id", id);
    toast.success("Funil removido!"); load();
  }

  /* ── Etapa CRUD ── */

  async function handleAddEtapa(funilId: string) {
    if (!newEtapaNome.trim()) return;
    const funil = funis.find(f => f.id === funilId);
    const movable = funil?.etapas.filter(e => !isFixed(e.nome)) ?? [];
    const ordem = movable.length;
    await supabase.from("crm_funil_etapas").insert({
      funil_id: funilId, nome: newEtapaNome.trim(), cor: newEtapaCor, ordem,
    });
    toast.success("Etapa adicionada!");
    setAddingEtapa(null); setNewEtapaNome(""); setNewEtapaCor("#6366f1"); load();
  }

  async function handleSaveEtapa(id: string) {
    if (!editEtapaNome.trim()) return;
    await supabase.from("crm_funil_etapas").update({ nome: editEtapaNome.trim(), cor: editEtapaCor }).eq("id", id);
    toast.success("Etapa renomeada!"); setEditEtapaId(null); load();
  }

  async function handleDeleteEtapa(id: string) {
    await supabase.from("crm_funil_etapas").delete().eq("id", id);
    toast.success("Etapa removida!"); load();
  }

  /* ── Drag-and-drop reorder ── */

  async function handleDrop(funilId: string, fromId: string, toId: string) {
    if (fromId === toId) return;
    const funil = funis.find(f => f.id === funilId);
    if (!funil) return;

    // Only reorder movable stages
    const movable = funil.etapas.filter(e => !isFixed(e.nome));
    const fromIdx = movable.findIndex(e => e.id === fromId);
    const toIdx   = movable.findIndex(e => e.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...movable];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Optimistic update
    const fixed = funil.etapas.filter(e => isFixed(e.nome));
    setFunis(prev => prev.map(f =>
      f.id === funilId ? { ...f, etapas: [...reordered, ...fixed] } : f
    ));

    // Persist
    await Promise.all(reordered.map((e, i) =>
      supabase.from("crm_funil_etapas").update({ ordem: i }).eq("id", e.id)
    ));
  }

  /* ── Render ── */

  return (
    <AppLayout>
      <div ref={menuRef} className="px-8 py-6 max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Funis e etapas</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Otimize suas estratégias configurando novos funis ou adicionando etapas.
            </p>
          </div>
          <button
            onClick={() => setAddingFunil(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> FUNIL
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* New funil inline form */}
            {addingFunil && (
              <div className="flex items-center gap-3 bg-white border border-primary/30 rounded-2xl px-5 py-3 shadow-sm">
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
              const movable = funil.etapas.filter(e => !isFixed(e.nome));
              const fixed   = funil.etapas.filter(e => isFixed(e.nome));

              return (
                <div key={funil.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* ── Funil header ── */}
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Filter className="w-4 h-4 text-primary" />
                    </div>

                    {editFunilId === funil.id ? (
                      <>
                        <input
                          autoFocus value={editFunilNome}
                          onChange={e => setEditFunilNome(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleSaveFunil(funil.id);
                            if (e.key === "Escape") setEditFunilId(null);
                          }}
                          className={inp}
                        />
                        <button onClick={() => handleSaveFunil(funil.id)} className="p-1.5 rounded-lg bg-green-100 text-green-700">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditFunilId(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-bold text-gray-800">{funil.nome}</span>
                        {funil.padrao && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Padrão
                          </span>
                        )}
                        <div className="relative">
                          <button
                            onClick={e => { e.stopPropagation(); setMenuFunilId(menuFunilId === funil.id ? null : funil.id); setMenuEtapaId(null); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuFunilId === funil.id && (
                            <DropMenu items={[
                              { label: "Renomear", onClick: () => { setEditFunilId(funil.id); setEditFunilNome(funil.nome); setMenuFunilId(null); } },
                              ...(!funil.padrao ? [{ label: "Excluir", danger: true, onClick: () => { handleDeleteFunil(funil.id); setMenuFunilId(null); } }] : []),
                            ]} />
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── ADICIONAR NOVA ETAPA button ── */}
                  <div className="px-4 pt-4 pb-3">
                    {addingEtapa === funil.id ? (
                      <div className="border border-primary/20 rounded-xl p-3 space-y-2 bg-gray-50">
                        <div className="flex gap-1.5 flex-wrap">
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
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: newEtapaCor }} />
                          <input
                            autoFocus value={newEtapaNome}
                            onChange={e => setNewEtapaNome(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddEtapa(funil.id)}
                            placeholder="Nome da etapa..."
                            className={inp}
                          />
                          <button onClick={() => handleAddEtapa(funil.id)} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex-shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setAddingEtapa(null); setNewEtapaNome(""); }}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingEtapa(funil.id); setNewEtapaNome(""); setNewEtapaCor("#6366f1"); }}
                        className="w-full py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors tracking-wide"
                      >
                        ADICIONAR NOVA ETAPA
                      </button>
                    )}
                  </div>

                  {/* ── Etapas draggable ── */}
                  <div className="px-4 pb-2 space-y-0.5">
                    {movable.map(etapa => {
                      const isDragging = dragId === etapa.id;
                      const isOver     = dragOver === etapa.id && dragId !== etapa.id;
                      return (
                        <div
                          key={etapa.id}
                          draggable={editEtapaId !== etapa.id}
                          onDragStart={() => setDragId(etapa.id)}
                          onDragEnd={() => { setDragId(null); setDragOver(null); }}
                          onDragOver={e => { e.preventDefault(); setDragOver(etapa.id); }}
                          onDrop={e => { e.preventDefault(); if (dragId) handleDrop(funil.id, dragId, etapa.id); setDragId(null); setDragOver(null); }}
                          className={`flex items-center gap-3 px-2 py-2.5 rounded-xl group/row transition-all ${
                            isDragging ? "opacity-40" : ""
                          } ${isOver ? "bg-primary/5 border border-dashed border-primary/30" : "hover:bg-gray-50"}`}
                        >
                          <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />

                          {editEtapaId === etapa.id ? (
                            <>
                              <input
                                type="color" value={editEtapaCor}
                                onChange={e => setEditEtapaCor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border-0 flex-shrink-0"
                              />
                              <input
                                autoFocus value={editEtapaNome}
                                onChange={e => setEditEtapaNome(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleSaveEtapa(etapa.id);
                                  if (e.key === "Escape") setEditEtapaId(null);
                                }}
                                className={inp}
                              />
                              <button onClick={() => handleSaveEtapa(etapa.id)} className="p-1 rounded bg-green-100 text-green-700 flex-shrink-0">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditEtapaId(null)} className="p-1 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.cor }} />
                              <span className="flex-1 text-sm text-gray-700">{etapa.nome}</span>
                              <div className="relative opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button
                                  onClick={e => { e.stopPropagation(); setMenuEtapaId(menuEtapaId === etapa.id ? null : etapa.id); setMenuFunilId(null); }}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-400"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {menuEtapaId === etapa.id && (
                                  <DropMenu items={[
                                    { label: "Renomear", onClick: () => { setEditEtapaId(etapa.id); setEditEtapaNome(etapa.nome); setEditEtapaCor(etapa.cor); setMenuEtapaId(null); } },
                                    { label: "Excluir", danger: true, onClick: () => { handleDeleteEtapa(etapa.id); setMenuEtapaId(null); } },
                                  ]} />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Etapas fixas (Perdido / Matrícula) ── */}
                  {fixed.length > 0 && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-50 mt-1 space-y-0.5">
                      {fixed.map(etapa => {
                        const isWin  = etapa.nome.toLowerCase().includes("matr") || etapa.nome.toLowerCase() === "ganhou";
                        const isLose = etapa.nome.toLowerCase() === "perdido" || etapa.nome.toLowerCase() === "perdeu";
                        return (
                          <div key={etapa.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl group/row hover:bg-gray-50">
                            {isWin  && <ThumbsUp   className="w-4 h-4 text-green-500 flex-shrink-0" />}
                            {isLose && <ThumbsDown className="w-4 h-4 text-red-400 flex-shrink-0" />}
                            {!isWin && !isLose && <div className="w-4 h-4 flex-shrink-0" />}
                            <span className="flex-1 text-sm text-gray-700">{etapa.nome}</span>
                            <div className="relative opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button
                                onClick={e => { e.stopPropagation(); setMenuEtapaId(menuEtapaId === etapa.id ? null : etapa.id); setMenuFunilId(null); }}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {menuEtapaId === etapa.id && (
                                <DropMenu items={[
                                  { label: "Renomear", onClick: () => { setEditEtapaId(etapa.id); setEditEtapaNome(etapa.nome); setEditEtapaCor(etapa.cor); setMenuEtapaId(null); } },
                                  { label: "Excluir", danger: true, onClick: () => { handleDeleteEtapa(etapa.id); setMenuEtapaId(null); } },
                                ]} />
                              )}
                            </div>
                          </div>
                        );
                      })}
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
