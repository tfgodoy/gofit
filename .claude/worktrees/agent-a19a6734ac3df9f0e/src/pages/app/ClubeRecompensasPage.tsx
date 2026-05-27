import { useState, useEffect, useRef } from "react";
import {
  Search, SlidersHorizontal, MoreVertical, Hand,
  ImageIcon, Info, X, Loader2, Plus, Users, Gift, Package,
  Pencil, Trash2,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "visao-geral" | "configuracoes" | "recompensas";

interface Reward {
  id:          string;
  descricao:   string;
  observacoes: string | null;
  pontos:      number;
  foto_url:    string | null;
  created_at:  string;
}

/* ── Recompensa Modal (create + edit) ───────────────────── */
function RecompensaModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Reward;
  onClose: () => void;
  onSaved: (r: Reward) => void;
}) {
  const { user }   = useAuth();
  const fileRef    = useRef<HTMLInputElement>(null);
  const isEdit     = !!initial;

  const [descricao,   setDescricao]   = useState(initial?.descricao   ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [pontos,      setPontos]      = useState(initial ? String(initial.pontos) : "");
  const [preview,     setPreview]     = useState<string | null>(initial?.foto_url ?? null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Imagem muito grande (máx 3 MB)."); return; }
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!descricao.trim()) { setError("Descrição é obrigatória."); return; }
    if (!pontos || isNaN(Number(pontos))) { setError("Informe os pontos para resgate."); return; }
    if (!user?.contractorId) return;
    setSaving(true);
    setError("");

    const payload = {
      contractor_id: user.contractorId!,
      descricao:     descricao.trim(),
      observacoes:   observacoes.trim() || null,
      pontos:        Number(pontos),
      foto_url:      preview,
    };

    if (isEdit) {
      const { data, error: dbError } = await supabase
        .from("rewards")
        .update(payload)
        .eq("id", initial!.id)
        .select()
        .single();
      setSaving(false);
      if (dbError || !data) { setError("Erro ao salvar. Tente novamente."); return; }
      onSaved(data as Reward);
    } else {
      const { data, error: dbError } = await supabase
        .from("rewards")
        .insert([payload])
        .select()
        .single();
      setSaving(false);
      if (dbError || !data) { setError("Erro ao salvar. Tente novamente."); return; }
      onSaved(data as Reward);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <Gift className="w-4 h-4 text-orange-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 flex-1">
            {isEdit ? "Editar recompensa" : "Nova recompensa"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descrição *"
            className="w-full border-0 border-b border-gray-200 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors bg-transparent"
          />

          <input
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Observações"
            className="w-full border-0 border-b border-gray-200 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors bg-transparent"
          />

          <input
            type="number"
            value={pontos}
            onChange={e => setPontos(e.target.value)}
            placeholder="Pontos para resgate *"
            className="w-full border-0 border-b border-gray-200 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors bg-transparent"
          />

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600 leading-relaxed">
              Dica: Prefira imagens sem fundo ou com fundo branco, mantendo um padrão entre os produtos.
              Recomendamos imagens com pelo menos 400×400 pixels.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            {preview ? (
              <img src={preview} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-orange-300" />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="bg-orange-500 text-white text-xs font-bold px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              {preview ? "ALTERAR IMAGEM" : "SELECIONAR IMAGEM"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-orange-500 hover:underline">
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reward card ─────────────────────────────────────── */
function RewardCard({
  reward,
  onEdit,
  onDelete,
}: {
  reward:   Reward;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex gap-3 p-3">
      {/* Image */}
      <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
        {reward.foto_url ? (
          <img src={reward.foto_url} alt={reward.descricao} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-7 h-7 text-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-bold text-gray-900 uppercase leading-tight line-clamp-1">{reward.descricao}</p>

          {/* 3-dot menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {open && (
              <div className="absolute right-0 top-6 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[120px]">
                <button
                  onClick={() => { setOpen(false); onEdit(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar
                </button>
                <button
                  onClick={() => { setOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover
                </button>
              </div>
            )}
          </div>
        </div>

        {reward.observacoes && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{reward.observacoes}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-gray-700">{reward.pontos.toLocaleString("pt-BR")} FC</span>
          <button className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:underline">
            <Hand className="w-3 h-3" /> RESGATAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Visão Geral tab ─────────────────────────────────── */
function VisaoGeral({ rewardCount }: { rewardCount: number }) {
  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const now    = new Date();
  const period = `${MONTHS[now.getMonth()]}/${now.getFullYear()}`;

  return (
    <div className="p-6">
      <div className="flex items-center justify-end gap-3 mb-5">
        <span className="text-xs text-gray-500 font-medium">Período: <strong>{period}</strong></span>
        <button className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
          <SlidersHorizontal className="w-3.5 h-3.5" /> FILTROS
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {([
          { label: "Clientes participantes", value: 0, Icon: Users   },
          { label: "Pontos distribuídos",    value: 0, Icon: Gift    },
          { label: "Resgates realizados",    value: 0, Icon: Package },
        ] as const).map(({ label, value, Icon }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{value.toLocaleString("pt-BR")}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Top clientes",     Icon: Users },
          { label: "Top gatilhos",     Icon: Gift  },
          { label: "Top recompensas",  Icon: Gift  },
        ].map(({ label, Icon }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </div>
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Icon className="w-8 h-8 text-gray-200" />
              <p className="text-xs text-gray-400">
                {label === "Top recompensas" && rewardCount === 0
                  ? "Nenhuma recompensa cadastrada"
                  : "Sem dados no período"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Recompensas tab ─────────────────────────────────── */
function RecompensasTab({
  rewards,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  rewards:  Reward[];
  loading:  boolean;
  onAdd:    () => void;
  onEdit:   (r: Reward) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = rewards.filter(r =>
    r.descricao.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs bg-white">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar"
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> RECOMPENSA
          </button>
          <button className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" /> FILTROS
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl border border-gray-100">
          <Gift className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">Nenhuma recompensa cadastrada</p>
          <button onClick={onAdd} className="text-xs text-orange-500 font-semibold hover:underline">
            + Adicionar recompensa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(r => (
            <RewardCard
              key={r.id}
              reward={r}
              onEdit={() => onEdit(r)}
              onDelete={() => onDelete(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function ClubeRecompensasPage() {
  const { user } = useAuth();
  const [tab,        setTab]        = useState<Tab>("visao-geral");
  const [rewards,    setRewards]    = useState<Reward[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<Reward | undefined>(undefined);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase
      .from("rewards")
      .select("id, descricao, observacoes, pontos, foto_url, created_at")
      .eq("contractor_id", user.contractorId!)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRewards((data as Reward[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  function openAdd() {
    setEditTarget(undefined);
    setShowModal(true);
  }

  function openEdit(r: Reward) {
    setEditTarget(r);
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta recompensa?")) return;
    await supabase.from("rewards").update({ ativo: false }).eq("id", id);
    setRewards(prev => prev.filter(r => r.id !== id));
  }

  function handleSaved(r: Reward) {
    setRewards(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = r;
        return next;
      }
      return [r, ...prev];
    });
    setShowModal(false);
    setTab("recompensas");
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "visao-geral",   label: "VISÃO GERAL"   },
    { key: "configuracoes", label: "CONFIGURAÇÕES" },
    { key: "recompensas",   label: "RECOMPENSAS"   },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <h1 className="text-lg font-bold text-gray-900">Clube de recompensas</h1>
        </div>

        <div className="m-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-gray-200 flex">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-8 py-3.5 text-xs font-bold tracking-wide transition-colors border-b-2 ${
                  tab === t.key
                    ? "border-orange-500 text-orange-500"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "visao-geral" && <VisaoGeral rewardCount={rewards.length} />}
          {tab === "configuracoes" && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <SlidersHorizontal className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Configurações em desenvolvimento</p>
            </div>
          )}
          {tab === "recompensas" && (
            <RecompensasTab
              rewards={rewards}
              loading={loading}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {showModal && (
        <RecompensaModal
          initial={editTarget}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
}
