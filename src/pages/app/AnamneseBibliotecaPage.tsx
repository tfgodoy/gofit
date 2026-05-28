import { useState, useEffect } from "react";
import { Plus, Search, MoreVertical, Pencil, Trash2, ClipboardList, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── tipos ───────────────────────────────────────────────────────────────────

type TipoQuestao =
  | "sim_nao" | "sim_nao_qual" | "texto" | "numero"
  | "data" | "radio" | "checkbox" | "select";

interface Questao {
  id: string;
  pergunta: string;
  tipo: TipoQuestao;
  opcoes: string[];
  permite_outro: boolean;
  tem_respostas: boolean;
  max_caracteres: number | null;
}

// ─── mapeamentos ─────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoQuestao, string> = {
  sim_nao:      "Sim/Não",
  sim_nao_qual: "Sim/Não – Qual",
  texto:        "Texto livre",
  numero:       "Número",
  data:         "Data",
  radio:        "Escolha única",
  checkbox:     "Múltipla escolha",
  select:       "Seleção (dropdown)",
};

const TIPO_BADGE: Record<TipoQuestao, string> = {
  sim_nao:      "bg-blue-100 text-blue-800",
  sim_nao_qual: "bg-blue-100 text-blue-800",
  texto:        "bg-gray-100 text-gray-600",
  numero:       "bg-gray-100 text-gray-600",
  data:         "bg-gray-100 text-gray-600",
  radio:        "bg-purple-100 text-purple-800",
  checkbox:     "bg-purple-100 text-purple-800",
  select:       "bg-purple-100 text-purple-800",
};

const TIPOS_COM_OPCOES: TipoQuestao[] = ["radio", "checkbox", "select"];

const TODOS_TIPOS: TipoQuestao[] = [
  "sim_nao", "sim_nao_qual", "texto", "numero", "data", "radio", "checkbox", "select",
];

// ─── estado inicial do formulário ─────────────────────────────────────────────

interface FormState {
  pergunta: string;
  tipo: TipoQuestao;
  opcoes: string[];
  permite_outro: boolean;
  max_caracteres: string;
}

const FORM_VAZIO: FormState = {
  pergunta: "",
  tipo: "sim_nao",
  opcoes: [""],
  permite_outro: false,
  max_caracteres: "",
};

// ─── componente principal ─────────────────────────────────────────────────────

export default function AnamneseBibliotecaPage() {
  const { user } = useAuth();

  const [questoes, setQuestoes]   = useState<Questao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState<Questao | null>(null);
  const [form, setForm]           = useState<FormState>(FORM_VAZIO);
  const [saving, setSaving]       = useState(false);

  // ── carregamento ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.contractorId) return;
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("anamnese_questoes")
      .select("id, pergunta, tipo, opcoes, permite_outro, tem_respostas, max_caracteres")
      .eq("contractor_id", user!.contractorId!)
      .order("pergunta");
    if (!error) setQuestoes((data ?? []) as Questao[]);
    setLoading(false);
  }

  // ── filtro ────────────────────────────────────────────────────────────────

  const filtered = questoes.filter(q =>
    q.pergunta.toLowerCase().includes(search.toLowerCase())
  );

  // ── abrir dialog ──────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  }

  function openEdit(q: Questao) {
    setEditing(q);
    setForm({
      pergunta:      q.pergunta,
      tipo:          q.tipo,
      opcoes:        q.opcoes?.length ? q.opcoes : [""],
      permite_outro: q.permite_outro,
      max_caracteres: q.max_caracteres ? String(q.max_caracteres) : "",
    });
    setDialogOpen(true);
  }

  // ── mudança de tipo (reseta opções) ──────────────────────────────────────

  function handleTipoChange(tipo: TipoQuestao) {
    setForm(f => ({ ...f, tipo, opcoes: [""], permite_outro: false, max_caracteres: "" }));
  }

  // ── opções dinâmicas ─────────────────────────────────────────────────────

  function setOpcao(idx: number, val: string) {
    setForm(f => {
      const opcoes = [...f.opcoes];
      opcoes[idx] = val;
      return { ...f, opcoes };
    });
  }

  function addOpcao() {
    setForm(f => ({ ...f, opcoes: [...f.opcoes, ""] }));
  }

  function removeOpcao(idx: number) {
    setForm(f => ({ ...f, opcoes: f.opcoes.filter((_, i) => i !== idx) }));
  }

  // ── salvar ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.pergunta.trim()) {
      toast.error("A pergunta é obrigatória.");
      return;
    }
    const temOpcoes = TIPOS_COM_OPCOES.includes(form.tipo);
    const opcoesFiltradas = temOpcoes
      ? form.opcoes.map(o => o.trim()).filter(Boolean)
      : [];
    if (temOpcoes && opcoesFiltradas.length === 0) {
      toast.error("Adicione ao menos uma opção de resposta.");
      return;
    }

    setSaving(true);
    const payload = {
      pergunta:       form.pergunta.trim(),
      tipo:           form.tipo,
      opcoes:         opcoesFiltradas,
      permite_outro:  temOpcoes ? form.permite_outro : false,
      max_caracteres: form.tipo === "texto" && form.max_caracteres.trim()
        ? parseInt(form.max_caracteres, 10) || null
        : null,
    };

    if (editing) {
      const { error } = await supabase
        .from("anamnese_questoes")
        .update(payload)
        .eq("id", editing.id);
      if (error) { toast.error("Erro ao salvar."); setSaving(false); return; }
      toast.success("Pergunta atualizada.");
    } else {
      const { error } = await supabase
        .from("anamnese_questoes")
        .insert({ ...payload, contractor_id: user!.contractorId! });
      if (error) { toast.error("Erro ao criar."); setSaving(false); return; }
      toast.success("Pergunta criada.");
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  }

  // ── excluir ──────────────────────────────────────────────────────────────

  async function handleDelete(q: Questao) {
    if (q.tem_respostas) {
      toast.warning("Esta pergunta já possui respostas e não pode ser alterada.");
      return;
    }
    if (!window.confirm(`Excluir a pergunta "${q.pergunta}"?`)) return;
    const { error } = await supabase
      .from("anamnese_questoes")
      .delete()
      .eq("id", q.id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Pergunta excluída.");
    setQuestoes(prev => prev.filter(x => x.id !== q.id));
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Biblioteca de Perguntas</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Crie e gerencie as perguntas disponíveis para os modelos de anamnese
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" style={{ maxWidth: 280 }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar pergunta..."
                className="pl-9 text-sm h-9 w-64"
              />
            </div>
            <Button onClick={openNew} className="h-9 gap-1.5 text-sm">
              <Plus className="w-4 h-4" /> NOVA PERGUNTA
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-8 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-full">Pergunta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Tipo de resposta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-8 py-16 text-center">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-16 text-center">
                    <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {search ? "Nenhuma pergunta encontrada." : "Nenhuma pergunta cadastrada ainda."}
                    </p>
                    {!search && (
                      <button
                        onClick={openNew}
                        className="mt-2 text-primary text-sm hover:underline"
                      >
                        Criar primeira pergunta
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(q => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-3">
                      <span className="font-medium text-gray-800">{q.pergunta}</span>
                      {q.tem_respostas && (
                        <span className="ml-2 text-xs text-gray-400">(com respostas)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIPO_BADGE[q.tipo]}`}>
                        {TIPO_LABEL[q.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-gray-100">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                          <DropdownMenuItem
                            onClick={() => openEdit(q)}
                            className={q.tem_respostas ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(q)}
                            className={`text-red-600 focus:text-red-600 ${q.tem_respostas ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        {!loading && (
          <p className="text-xs text-gray-400 px-8 py-2 bg-white border-t border-gray-50">
            {filtered.length} de {questoes.length} pergunta{questoes.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Dialog criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Pergunta" : "Nova Pergunta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Banner: questão bloqueada */}
            {editing?.tem_respostas && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Esta questão <strong>não pode ser editada</strong> porque já obteve respostas.
                </p>
              </div>
            )}

            {/* Pergunta */}
            <div className="space-y-1.5">
              <Label htmlFor="pergunta">Pergunta <span className="text-red-500">*</span></Label>
              <Input
                id="pergunta"
                placeholder="Digite a pergunta..."
                value={form.pergunta}
                onChange={e => setForm(f => ({ ...f, pergunta: e.target.value }))}
                disabled={!!editing?.tem_respostas}
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo de resposta</Label>
              <div className="grid grid-cols-2 gap-2">
                {TODOS_TIPOS.map(tipo => {
                  const selected = form.tipo === tipo;
                  const locked = !!editing?.tem_respostas;
                  return (
                    <label
                      key={tipo}
                      className={`flex items-center gap-2.5 border rounded-xl px-3 py-2.5 transition-colors ${
                        locked
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      } ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipo"
                        value={tipo}
                        checked={selected}
                        disabled={locked}
                        onChange={() => handleTipoChange(tipo)}
                        className="sr-only"
                      />
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        selected ? "border-primary" : "border-gray-300"
                      }`}>
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </span>
                      <span className={`text-sm font-medium ${selected ? "text-primary" : "text-gray-700"}`}>
                        {TIPO_LABEL[tipo]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Limite de caracteres (apenas para texto livre) */}
            {form.tipo === "texto" && (
              <div className="space-y-1.5">
                <Label htmlFor="max_caracteres">Limite de caracteres <span className="text-gray-400 font-normal">(opcional)</span></Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="max_caracteres"
                    type="number"
                    min={1}
                    max={5000}
                    placeholder="Sem limite"
                    value={form.max_caracteres}
                    onChange={e => setForm(f => ({ ...f, max_caracteres: e.target.value }))}
                    disabled={!!editing?.tem_respostas}
                    className="w-36"
                  />
                  {form.max_caracteres && (
                    <span className="text-sm text-gray-500">
                      Aluno verá: <strong>0 / {form.max_caracteres}</strong>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">Deixe em branco para não limitar.</p>
              </div>
            )}

            {/* Opções (apenas para radio / checkbox / select) */}
            {TIPOS_COM_OPCOES.includes(form.tipo) && (
              <div className="space-y-2">
                <Label>Opções de resposta</Label>
                <div className="space-y-2">
                  {form.opcoes.map((op, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {form.tipo === "radio" && (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-400 flex-shrink-0" />
                      )}
                      {form.tipo === "checkbox" && (
                        <div className="w-3.5 h-3.5 rounded border border-gray-400 flex-shrink-0" />
                      )}
                      {form.tipo === "select" && (
                        <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">
                          {idx + 1}.
                        </span>
                      )}
                      <Input
                        value={op}
                        onChange={e => setOpcao(idx, e.target.value)}
                        placeholder={`Opção ${idx + 1}`}
                        className="h-8 text-sm"
                        disabled={!!editing?.tem_respostas}
                      />
                      {form.opcoes.length > 1 && !editing?.tem_respostas && (
                        <button
                          type="button"
                          onClick={() => removeOpcao(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!editing?.tem_respostas && (
                  <button
                    type="button"
                    onClick={addOpcao}
                    className="text-sm text-primary hover:underline"
                  >
                    + Adicionar opção
                  </button>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="permite_outro"
                    checked={form.permite_outro}
                    onCheckedChange={v => setForm(f => ({ ...f, permite_outro: !!v }))}
                    disabled={!!editing?.tem_respostas}
                  />
                  <label htmlFor="permite_outro" className={`text-sm text-gray-600 ${editing?.tem_respostas ? "opacity-60" : "cursor-pointer"}`}>
                    Permitir opção &quot;Outro&quot; com campo de texto
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            {!editing?.tem_respostas && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar pergunta"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
