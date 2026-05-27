import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Plus, Calendar } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";

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

function RichEditor({ onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white">
        <select className="text-xs text-gray-500 outline-none border-0 bg-transparent cursor-pointer mr-1 py-0.5">
          <option>Normal</option>
          <option>H1</option>
          <option>H2</option>
          <option>H3</option>
        </select>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" title="Negrito"     className="w-6 h-6 rounded text-xs font-bold     text-gray-600 hover:bg-gray-100 transition-colors">B</button>
        <button type="button" title="Itálico"     className="w-6 h-6 rounded text-xs italic        text-gray-600 hover:bg-gray-100 transition-colors">I</button>
        <button type="button" title="Sublinhado"  className="w-6 h-6 rounded text-xs underline     text-gray-600 hover:bg-gray-100 transition-colors">U</button>
        <button type="button" title="Riscado"     className="w-6 h-6 rounded text-xs line-through  text-gray-600 hover:bg-gray-100 transition-colors">S</button>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" title="Cor do texto" className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors">
          <span className="font-bold border-b-2 border-red-500 leading-none text-[11px]">A</span>
        </button>
        <button type="button" title="Cor de fundo" className="w-6 h-6 rounded text-xs hover:bg-gray-100 flex items-center justify-center transition-colors">
          <span className="font-bold bg-yellow-200 leading-none text-[11px] px-0.5">A</span>
        </button>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" title="Citação"      className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors font-bold">"</button>
        <button type="button" title="Blockquote"   className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors font-bold">"</button>
        <button type="button" title="Lista"        className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors">≡</button>
        <button type="button" title="Lista numerada" className="w-6 h-6 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors">
          <span className="text-[10px] font-bold">1.</span>
        </button>
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" title="Emoji" className="w-6 h-6 rounded text-xs hover:bg-gray-100 transition-colors">😊</button>
      </div>

      {/* Editable area */}
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange((e.target as HTMLDivElement).innerText)}
        className="min-h-[80px] p-3 text-sm text-gray-700 outline-none"
      />
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */

export default function WodFormPage() {
  const navigate = useNavigate();

  const [descricao,  setDescricao]  = useState("");
  const [modalidade, setModalidade] = useState("+Cross");
  const [data,       setData]       = useState(new Date().toISOString().split("T")[0]);

  const [sessions,  setSessions]  = useState<Session[]>([
    { id: "1", titulo: "Warm-up", movimento: "", conteudo: "", informarResultado: false },
    { id: "2", titulo: "Skill",   movimento: "", conteudo: "", informarResultado: false },
    { id: "3", titulo: "WOD",     movimento: "", conteudo: "", informarResultado: false },
  ]);
  const [activeId, setActiveId] = useState("1");

  const active = sessions.find(s => s.id === activeId) ?? sessions[0];

  function addSession() {
    const id = String(Date.now());
    setSessions(prev => [...prev, { id, titulo: "Nova sessão", movimento: "", conteudo: "", informarResultado: false }]);
    setActiveId(id);
  }

  function removeSession(id: string) {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (id === activeId && next.length > 0) setActiveId(next[0].id);
      return next;
    });
  }

  function update(id: string, field: keyof Session, val: any) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-white">
        <div className="flex-1 px-10 py-8" style={{ maxWidth: 960 }}>

          {/* Page title */}
          <h1 className="text-lg font-bold text-gray-800 mb-6">Novo WOD</h1>

          {/* ── Dados principais ── */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-4">Dados principais</p>
            <div className="grid grid-cols-3 gap-8">

              {/* Descrição */}
              <div className="border-b border-gray-300 pb-1">
                <input
                  type="text"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descrição *"
                  className="w-full text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                />
              </div>

              {/* Modalidade */}
              <div className="border-b border-gray-300 pb-1">
                <select
                  value={modalidade}
                  onChange={e => setModalidade(e.target.value)}
                  className="w-full text-sm text-gray-700 outline-none bg-transparent appearance-none cursor-pointer"
                >
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Data */}
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

          {/* ── Sessões + Pré-visualização ── */}
          <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 260px" }}>

            {/* Sessões */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-400">Sessões</p>
                <button
                  type="button"
                  onClick={addSession}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> SESSÃO
                </button>
              </div>

              {/* Tabs */}
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

              {/* Active session editor */}
              {active && (
                <div className="space-y-4">

                  {/* Title + Remover */}
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

                  {/* Movimento dropdown */}
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

                  {/* Rich text editor */}
                  <RichEditor
                    value={active.conteudo}
                    onChange={v => update(active.id, "conteudo", v)}
                  />

                  {/* Movimentos placeholder */}
                  <div>
                    <p className="text-sm text-gray-400">Movimentos</p>
                  </div>

                  {/* Deve informar resultados */}
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
                    className="border border-gray-200 rounded-lg p-4 min-h-[80px] cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => setActiveId(s.id)}
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
          <div className="flex justify-end gap-8 mt-10 pt-5 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate("/app/wod")}
              className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors tracking-wide"
            >
              VOLTAR
            </button>
            <button
              type="button"
              className="bg-gray-900 text-white text-sm font-bold px-8 py-2.5 rounded-lg hover:bg-gray-800 transition-colors tracking-wide"
            >
              SALVAR
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
