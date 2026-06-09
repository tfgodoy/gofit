import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, Check, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";

// ─── mapeamentos ─────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  sim_nao:      "Sim/Não",
  sim_nao_qual: "Sim/Não – Qual",
  texto:        "Texto livre",
  numero:       "Número",
  data:         "Data",
  radio:        "Escolha única",
  checkbox:     "Múltipla escolha",
  select:       "Seleção (dropdown)",
};

const TIPO_BADGE: Record<string, string> = {
  sim_nao:      "bg-blue-100 text-blue-800",
  sim_nao_qual: "bg-blue-100 text-blue-800",
  texto:        "bg-gray-100 text-gray-600",
  numero:       "bg-gray-100 text-gray-600",
  data:         "bg-gray-100 text-gray-600",
  radio:        "bg-orange-100 text-orange-800",
  checkbox:     "bg-orange-100 text-orange-800",
  select:       "bg-orange-100 text-orange-800",
};

const PARQ_PERGUNTAS = [
  "Algum médico já disse que você possui algum problema cardíaco e que deve realizar atividade física somente com supervisão?",
  "Você sente dor no peito quando realiza atividade física?",
  "No último mês, você teve dor no peito quando não estava realizando atividade física?",
  "Você perde o equilíbrio por causa de tontura ou perde a consciência?",
  "Você tem algum problema ósseo ou muscular que poderia ser agravado pela atividade física?",
  "Algum médico está receitando atualmente medicamentos para pressão arterial ou condição cardíaca?",
  "Você tem alguma outra razão pela qual não deve praticar atividade física?",
];

// ─── tipos ───────────────────────────────────────────────────────────────────

interface ModeloItem {
  id: string;
  questao_id: string;
  ordem: number;
  obrigatoria: boolean;
  pergunta: string;
  tipo: string;
}

interface BibliotecaQuestao {
  id: string;
  pergunta: string;
  tipo: string;
}

// ─── componente ──────────────────────────────────────────────────────────────

export default function AnamneseModeloEditPage() {
  const { id }       = useParams<{ id: string }>();
  const { user }     = useAuth();
  const navigate     = useNavigate();

  const [modeloNome, setModeloNome]           = useState("");
  const [items, setItems]                     = useState<ModeloItem[]>([]);
  const [biblioteca, setBiblioteca]           = useState<BibliotecaQuestao[]>([]);
  const [selectedId, setSelectedId]           = useState<string>("");
  const [selectedLabel, setSelectedLabel]     = useState<string>("");
  const [loading, setLoading]                 = useState(true);
  const [savingOrder, setSavingOrder]         = useState(false);
  const [dragSrcIdx, setDragSrcIdx]           = useState<number | null>(null);

  // dropdown fixo
  const [ddOpen, setDdOpen]       = useState(false);
  const [ddPos, setDdPos]         = useState({ top: 0, left: 0, width: 0 });
  const triggerRef                = useRef<HTMLButtonElement>(null);
  const ddRef                     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user?.contractorId) return;
    loadAll();
  }, [id, user]);

  // fecha dropdown ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        ddRef.current && !ddRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setDdOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadModelo(), loadItems()]);
    setLoading(false);
  }

  async function loadModelo() {
    const { data } = await supabase
      .from("anamnese_modelos")
      .select("descricao")
      .eq("id", id!)
      .single();
    if (data) setModeloNome((data as any).descricao ?? "");
  }

  async function loadItems() {
    const { data } = await supabase
      .from("anamnese_modelo_questoes")
      .select("id, questao_id, ordem, obrigatoria, anamnese_questoes(id, pergunta, tipo)")
      .eq("modelo_id", id!)
      .order("ordem");

    const rows = (data as any[]) ?? [];
    const mapped: ModeloItem[] = rows.map(row => ({
      id:          row.id,
      questao_id:  row.questao_id,
      ordem:       row.ordem,
      obrigatoria: row.obrigatoria,
      pergunta:    row.anamnese_questoes?.pergunta ?? "",
      tipo:        row.anamnese_questoes?.tipo     ?? "",
    }));
    setItems(mapped);

    const excludeIds = rows.map(r => r.questao_id as string);
    await loadBiblioteca(excludeIds);
  }

  async function loadBiblioteca(excludeIds: string[]) {
    const { data } = await supabase
      .from("anamnese_questoes")
      .select("id, pergunta, tipo")
      .eq("contractor_id", user!.contractorId!)
      .order("pergunta");
    const all = (data ?? []) as BibliotecaQuestao[];
    setBiblioteca(all.filter(q => !excludeIds.includes(q.id)));
  }

  // ── dropdown fixo ────────────────────────────────────────────────────────

  function handleTriggerClick() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDdPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setDdOpen(v => !v);
  }

  function handleSelectOption(q: BibliotecaQuestao) {
    setSelectedId(q.id);
    setSelectedLabel(q.pergunta);
    setDdOpen(false);
  }

  // ── adicionar pergunta ───────────────────────────────────────────────────

  async function handleAdd() {
    if (!selectedId) return;
    const maxOrdem = items.length > 0 ? Math.max(...items.map(i => i.ordem)) : -1;
    const { error } = await supabase
      .from("anamnese_modelo_questoes")
      .insert({
        modelo_id:   id!,
        questao_id:  selectedId,
        ordem:       maxOrdem + 1,
        obrigatoria: false,
      });
    if (error) { toast.error("Erro ao adicionar pergunta."); return; }
    setSelectedId("");
    setSelectedLabel("");
    await loadItems();
  }

  // ── toggle obrigatória ───────────────────────────────────────────────────

  async function handleToggle(item: ModeloItem) {
    const { error } = await supabase
      .from("anamnese_modelo_questoes")
      .update({ obrigatoria: !item.obrigatoria })
      .eq("id", item.id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    setItems(prev =>
      prev.map(x => x.id === item.id ? { ...x, obrigatoria: !x.obrigatoria } : x)
    );
  }

  // ── remover do modelo ────────────────────────────────────────────────────

  async function handleRemove(item: ModeloItem) {
    const { error } = await supabase
      .from("anamnese_modelo_questoes")
      .delete()
      .eq("id", item.id);
    if (error) { toast.error("Erro ao remover."); return; }
    toast.success("Pergunta removida.");
    await loadItems();
  }

  // ── drag & drop ──────────────────────────────────────────────────────────

  function handleDragStart(idx: number) {
    setDragSrcIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
    const next = [...items];
    const [moved] = next.splice(dragSrcIdx, 1);
    next.splice(targetIdx, 0, moved);
    setItems(next);
    setDragSrcIdx(targetIdx);
  }

  async function handleDragEnd() {
    const currentItems = items;
    setDragSrcIdx(null);
    setSavingOrder(true);
    await Promise.all(
      currentItems.map((item, idx) =>
        supabase
          .from("anamnese_modelo_questoes")
          .update({ ordem: idx })
          .eq("id", item.id)
      )
    );
    setSavingOrder(false);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/app/configuracoes/anamnese/modelos")}
            className="gap-1.5 text-gray-600 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">
            {modeloNome || "Carregando..."}
          </h1>
          {savingOrder && (
            <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">
              Salvando ordem...
            </span>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-3xl">

          {/* Seletor — dropdown fixo para escapar do overflow */}
          <div className="flex gap-3 items-center">
            <button
              ref={triggerRef}
              onClick={handleTriggerClick}
              className="flex-1 h-9 text-sm border border-gray-200 rounded-lg px-3 flex items-center justify-between bg-white hover:border-gray-300 transition-colors"
            >
              <span className={selectedId ? "text-gray-800 truncate" : "text-gray-400"}>
                {selectedLabel || "Escolha uma pergunta da biblioteca..."}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${ddOpen ? "rotate-180" : ""}`} />
            </button>
            <Button
              onClick={handleAdd}
              disabled={!selectedId}
              className="h-9 text-sm flex-shrink-0"
            >
              Adicionar
            </Button>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-400 text-sm">
              Nenhuma pergunta adicionada. Use o seletor acima.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 select-none transition-opacity ${
                    dragSrcIdx === idx ? "opacity-50" : "opacity-100"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.pergunta}</p>
                    <span className={`inline-flex mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      TIPO_BADGE[item.tipo] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {TIPO_LABEL[item.tipo] ?? item.tipo}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(item)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                        item.obrigatoria
                          ? "bg-primary text-white border-primary"
                          : "border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {item.obrigatoria ? "Obrigatória" : "Opcional"}
                    </button>
                    <button
                      onClick={() => handleRemove(item)}
                      className="p-1.5 text-red-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PAR-Q */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">
                PAR-Q — Questionário de Prontidão para Atividade Física
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Incluído automaticamente em todas as anamneses · Todas obrigatórias · Resposta: Sim/Não
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {PARQ_PERGUNTAS.map((p, i) => (
                <div key={i} className="px-4 py-3 flex gap-3">
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5 w-4 text-right">{i + 1}.</span>
                  <p className="text-sm text-gray-600">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown fixo — renderizado fora do overflow para não ser clipado */}
      {ddOpen && (
        <div
          ref={ddRef}
          style={{
            position: "fixed",
            top:      ddPos.top,
            left:     ddPos.left,
            width:    ddPos.width,
            zIndex:   9999,
            maxHeight: 260,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto"
        >
          {biblioteca.length === 0 ? (
            <div className="px-4 py-5 text-sm text-gray-400 text-center">
              Todas as perguntas já foram adicionadas
            </div>
          ) : (
            biblioteca.map(q => (
              <button
                key={q.id}
                onMouseDown={() => handleSelectOption(q)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
              >
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  TIPO_BADGE[q.tipo] ?? "bg-gray-100 text-gray-600"
                }`}>
                  {TIPO_LABEL[q.tipo] ?? q.tipo}
                </span>
                <span className="truncate">{q.pergunta}</span>
              </button>
            ))
          )}
        </div>
      )}
    </AppLayout>
  );
}
