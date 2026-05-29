import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Trash2, Plus, Calendar, Loader2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────── */

type Session = {
  id:               string;
  titulo:           string;
  movimento:        string;
  conteudo:         string;
  informarResultado: boolean;
};

/* ── Constants ──────────────────────────────────────────── */

const MODALIDADES = ["+Cross", "Funcional", "Musculação", "Yoga", "Pilates", "Aeróbico"];
const MOVIMENTOS  = ["Workout", "Girls", "Heroes", "Open"];

/* ── Toggle ─────────────────────────────────────────────── */

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-[18px] w-8 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        value ? "bg-primary" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow ring-0 transition-transform ${
          value ? "translate-x-[14px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ── Rich-text editor stub ──────────────────────────────── */

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white">
        <select className="text-xs text-gray-500 outline-none border-0 bg-transparent cursor-pointer mr-1 py-0.5">
          <option>Normal</option><option>H1</option><option>H2</option><option>H3</option>
        </select>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" className="w-6 h-6 rounded text-xs font-bold text-gray-600 hover:bg-gray-100">B</button>
        <button type="button" className="w-6 h-6 rounded text-xs italic text-gray-600 hover:bg-gray-100">I</button>
        <button type="button" className="w-6 h-6 rounded text-xs underline text-gray-600 hover:bg-gray-100">U</button>
        <button type="button" className="w-6 h-6 rounded text-xs line-through text-gray-600 hover:bg-gray-100">S</button>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100 flex items-center justify-center">
          <span className="font-bold border-b-2 border-red-500 leading-none text-[11px]">A</span>
        </button>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100">≡</button>
        <button type="button" className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100">
          <span className="text-[10px] font-bold">1.</span>
        </button>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" className="w-6 h-6 rounded text-xs hover:bg-gray-100">😊</button>
      </div>
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange((e.target as HTMLDivElement).innerText)}
        className="min-h-[80px] p-3 text-sm text-gray-700 outline-none"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */

export default function WodFormPage() {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);

  const [descricao,  setDescricao]  = useState("");
  const [modalidade, setModalidade] = useState("+Cross");
  const [data,       setData]       = useState(
    searchParams.get("data") ?? new Date().toISOString().split("T")[0]
  );

  const [sessions,  setSessions]  = useState<Session[]>([
    { id: "1", titulo: "Warm-up", movimento: "", conteudo: "", informarResultado: false },
    { id: "2", titulo: "Skill",   movimento: "", conteudo: "", informarResultado: false },
    { id: "3", titulo: "WOD",     movimento: "", conteudo: "", informarResultado: false },
  ]);
  const [activeId, setActiveId] = useState("1");

  /* ── Load existing WOD ─────────────────────────────────── */
  useEffect(() => {
    if (!isEdit || !user?.contractorId) return;
    async function load() {
      const { data: wod } = await supabase
        .from("wods")
        .select("*")
        .eq("id", id!)
        .eq("contractor_id", user!.contractorId!)
        .maybeSingle();

      if (!wod) { toast.error("WOD não encontrado"); navigate("/app/wod"); return; }

      setDescricao((wod as any).descricao ?? "");
      setModalidade((wod as any).modalidade ?? "+Cross");
      setData((wod as any).data ?? "");

      const { data: sesList } = await supabase
        .from("wod_sessions")
        .select("*")
        .eq("wod_id", id!)
        .order("ordem");

      if (sesList && sesList.length > 0) {
        const loaded: Session[] = (sesList as any[]).map(s => ({
          id:               s.id,
          titulo:           s.titulo,
          movimento:        s.movimento,
          conteudo:         s.conteudo,
          informarResultado: s.informar_resultado,
        }));
        setSessions(loaded);
        setActiveId(loaded[0].id);
      }
      setLoading(false);
    }
    load();
  }, [isEdit, id, user]);

  /* ── Session helpers ────────────────────────────────────── */

  const active = sessions.find(s => s.id === activeId) ?? sessions[0];

  function addSession() {
    const newId = `new-${Date.now()}`;
    setSessions(prev => [...prev, { id: newId, titulo: "Nova sessão", movimento: "", conteudo: "", informarResultado: false }]);
    setActiveId(newId);
  }

  function removeSession(sid: string) {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sid);
      if (sid === activeId && next.length > 0) setActiveId(next[0].id);
      return next;
    });
  }

  function update(sid: string, field: keyof Session, val: unknown) {
    setSessions(prev => prev.map(s => s.id === sid ? { ...s, [field]: val } : s));
  }

  /* ── Save ───────────────────────────────────────────────── */

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!descricao.trim() && !data) { toast.error("Informe pelo menos a data do WOD"); return; }

    setSaving(true);
    try {
      let wodId = id;

      if (isEdit) {
        await supabase.from("wods").update({
          descricao:  descricao.trim(),
          modalidade,
          data,
          updated_at: new Date().toISOString(),
        }).eq("id", wodId!);

        /* Remove all old sessions then reinsert */
        await supabase.from("wod_sessions").delete().eq("wod_id", wodId!);
      } else {
        const { data: newWod, error } = await supabase
          .from("wods")
          .insert({
            contractor_id: user.contractorId!,
            descricao:     descricao.trim(),
            modalidade,
            data,
          })
          .select("id")
          .single();
        if (error || !newWod) { toast.error("Erro ao criar WOD"); return; }
        wodId = (newWod as any).id;
      }

      /* Insert sessions */
      if (sessions.length > 0) {
        await supabase.from("wod_sessions").insert(
          sessions.map((s, i) => ({
            wod_id:             wodId!,
            titulo:             s.titulo,
            movimento:          s.movimento,
            conteudo:           s.conteudo,
            informar_resultado: s.informarResultado,
            ordem:              i,
          }))
        );
      }

      toast.success(isEdit ? "WOD atualizado!" : "WOD criado!");
      navigate("/app/wod");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ─────────────────────────────────────────────── */

  async function handleDelete() {
    if (!isEdit || !id) return;
    if (!confirm("Excluir este WOD?")) return;
    await supabase.from("wods").delete().eq("id", id);
    toast.success("WOD excluído.");
    navigate("/app/wod");
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-80">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-white">
        <div className="flex-1 px-10 py-8" style={{ maxWidth: 960 }}>
          <h1 className="text-lg font-bold text-gray-800 mb-6">{isEdit ? "Editar WOD" : "Novo WOD"}</h1>

          {/* Dados principais */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-4">Dados principais</p>
            <div className="grid grid-cols-3 gap-8">
              <div className="border-b border-gray-300 pb-1">
                <input
                  type="text"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descrição"
                  className="w-full text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                />
              </div>
              <div className="border-b border-gray-300 pb-1">
                <select
                  value={modalidade}
                  onChange={e => setModalidade(e.target.value)}
                  className="w-full text-sm text-gray-700 outline-none bg-transparent appearance-none cursor-pointer"
                >
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="border-b border-gray-300 pb-1 relative">
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="w-full text-sm text-gray-700 outline-none bg-transparent appearance-none pr-6"
                />
                <Calendar className="w-4 h-4 text-gray-400 absolute right-0 top-0.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Sessões + Pré-visualização */}
          <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 260px" }}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-400">Sessões</p>
                <button type="button" onClick={addSession}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> SESSÃO
                </button>
              </div>

              <div className="flex border-b border-gray-200 mb-5">
                {sessions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      activeId === s.id
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {s.titulo}
                  </button>
                ))}
              </div>

              {active && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={active.titulo}
                        onChange={e => update(active.id, "titulo", e.target.value)}
                        placeholder="Título *"
                        className="w-full text-sm font-medium text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSession(active.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> REMOVER
                    </button>
                  </div>

                  <div className="border-b border-gray-200 pb-1">
                    <select
                      value={active.movimento}
                      onChange={e => update(active.id, "movimento", e.target.value)}
                      className="w-full text-sm text-gray-400 outline-none bg-transparent appearance-none cursor-pointer"
                    >
                      <option value="">Movimento Workout/Girls/Heroes/Open</option>
                      {MOVIMENTOS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <RichEditor
                    value={active.conteudo}
                    onChange={v => update(active.id, "conteudo", v)}
                  />

                  <div className="flex items-center gap-2.5 pt-1">
                    <Toggle
                      value={active.informarResultado}
                      onChange={v => update(active.id, "informarResultado", v)}
                    />
                    <span className="text-sm text-gray-500">Deve informar resultados</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pré-visualização */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Pré-visualização</p>
              <div className="space-y-2">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className="border border-gray-200 rounded-lg p-4 min-h-[80px] cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    <p className="text-sm text-gray-500 mb-1">{s.titulo}</p>
                    {s.conteudo && (
                      <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-4">{s.conteudo}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-10 pt-5 border-t border-gray-100">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm font-bold text-red-400 hover:text-red-600 transition-colors"
                >
                  EXCLUIR WOD
                </button>
              )}
            </div>
            <div className="flex gap-8">
              <button
                type="button"
                onClick={() => navigate("/app/wod")}
                className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors tracking-wide"
              >
                VOLTAR
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-8 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors tracking-wide"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                SALVAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
