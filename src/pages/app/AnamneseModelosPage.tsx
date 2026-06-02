import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreVertical, Pencil, Trash2, ExternalLink, ClipboardList, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── tipos ───────────────────────────────────────────────────────────────────

interface Modelo {
  id: string;
  descricao: string;
  respondido_pelo_cliente: boolean;
  exigir_aceite: boolean;
  para_aula_experimental: boolean;
  created_at: string;
  questoes_count?: number;
}

interface FormState {
  descricao: string;
  respondido_pelo_cliente: boolean;
  exigir_aceite: boolean;
}

const FORM_VAZIO: FormState = {
  descricao: "",
  respondido_pelo_cliente: true,
  exigir_aceite: true,
};

// ─── componente ──────────────────────────────────────────────────────────────

export default function AnamneseModelosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [modelos, setModelos]     = useState<Modelo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState<Modelo | null>(null);
  const [form, setForm]           = useState<FormState>(FORM_VAZIO);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!user?.contractorId) return;
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("anamnese_modelos")
      .select("id, descricao, respondido_pelo_cliente, exigir_aceite, para_aula_experimental, created_at")
      .eq("contractor_id", user!.contractorId!)
      .order("created_at", { ascending: false });

    if (error) { setLoading(false); return; }

    const lista = (data ?? []) as Modelo[];

    const counts = await Promise.all(
      lista.map(m =>
        supabase
          .from("anamnese_modelo_questoes")
          .select("id", { count: "exact", head: true })
          .eq("modelo_id", m.id)
          .then(({ count }) => count ?? 0)
      )
    );

    setModelos(lista.map((m, i) => ({ ...m, questoes_count: counts[i] })));
    setLoading(false);
  }

  const filtered = modelos.filter(m =>
    m.descricao.toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("pt-BR");
  }

  function openNew() {
    setEditing(null);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  }

  function openRename(m: Modelo) {
    setEditing(m);
    setForm({
      descricao: m.descricao,
      respondido_pelo_cliente: m.respondido_pelo_cliente,
      exigir_aceite: m.exigir_aceite,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.descricao.trim()) {
      toast.error("A descrição é obrigatória.");
      return;
    }
    setSaving(true);

    const payload = {
      descricao:               form.descricao.trim(),
      respondido_pelo_cliente: form.respondido_pelo_cliente,
      exigir_aceite:           form.exigir_aceite,
    };

    if (editing) {
      const { error } = await supabase
        .from("anamnese_modelos")
        .update(payload)
        .eq("id", editing.id);
      if (error) { toast.error("Erro ao salvar."); setSaving(false); return; }
      toast.success("Modelo atualizado.");
      setSaving(false);
      setDialogOpen(false);
      load();
    } else {
      const { data, error } = await supabase
        .from("anamnese_modelos")
        .insert({ ...payload, contractor_id: user!.contractorId! })
        .select("id")
        .single();
      if (error || !data) { toast.error("Erro ao criar."); setSaving(false); return; }
      toast.success("Modelo criado.");
      setSaving(false);
      setDialogOpen(false);
      navigate(`/app/configuracoes/anamnese/modelos/${(data as any).id}/editar`);
    }
  }

  async function handleToggleAE(m: Modelo) {
    if (!user?.contractorId) return;
    // Remove o flag de todos
    await supabase.from("anamnese_modelos")
      .update({ para_aula_experimental: false })
      .eq("contractor_id", user.contractorId);
    // Ativa no selecionado (ou desativa se já era o mesmo)
    if (!m.para_aula_experimental) {
      await supabase.from("anamnese_modelos")
        .update({ para_aula_experimental: true })
        .eq("id", m.id);
      toast.success(`"${m.descricao}" definida como anamnese de aula experimental.`);
    } else {
      toast.success("Anamnese de aula experimental removida.");
    }
    load();
  }

  async function handleDelete(m: Modelo) {
    if (!window.confirm(`Excluir o modelo "${m.descricao}"?`)) return;
    const { error } = await supabase
      .from("anamnese_modelos")
      .delete()
      .eq("id", m.id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Modelo excluído.");
    setModelos(prev => prev.filter(x => x.id !== m.id));
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Modelos de Anamnese</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Crie modelos com perguntas personalizadas para enviar aos alunos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" style={{ maxWidth: 280 }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar modelo..."
                className="pl-9 text-sm h-9 w-64"
              />
            </div>
            <Button onClick={openNew} className="h-9 gap-1.5 text-sm">
              <Plus className="w-4 h-4" /> NOVO MODELO
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-8 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-full">Descrição</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Perguntas</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Criado em</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      {search ? "Nenhum modelo encontrado." : "Nenhum modelo cadastrado ainda."}
                    </p>
                    {!search && (
                      <button onClick={openNew} className="mt-2 text-primary text-sm hover:underline">
                        Criar primeiro modelo
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{m.descricao}</span>
                        {m.para_aula_experimental && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            <Zap className="w-2.5 h-2.5" /> Aula Experimental
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{m.questoes_count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-gray-100">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[180px]">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => navigate(`/app/configuracoes/anamnese/modelos/${m.id}/editar`)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-2" /> Editar perguntas
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => openRename(m)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleToggleAE(m)}
                          >
                            <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" />
                            {m.para_aula_experimental
                              ? "Remover da aula experimental"
                              : "Definir como aula experimental"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 cursor-pointer"
                            onClick={() => handleDelete(m)}
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
            {filtered.length} de {modelos.length} modelo{modelos.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Dialog criar / renomear */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Renomear Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            <div className="space-y-1.5">
              <Label htmlFor="descricao">
                Nome / Descrição <span className="text-red-500">*</span>
              </Label>
              <Input
                id="descricao"
                placeholder="Ex.: Avaliação inicial..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Respondido pelo cliente</p>
                <p className="text-xs text-gray-400 mt-0.5">O aluno preenche o formulário diretamente</p>
              </div>
              <Switch
                checked={form.respondido_pelo_cliente}
                onCheckedChange={v => setForm(f => ({ ...f, respondido_pelo_cliente: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Exigir aceite do cliente</p>
                <p className="text-xs text-gray-400 mt-0.5">Checkbox de confirmação ao final</p>
              </div>
              <Switch
                checked={form.exigir_aceite}
                onCheckedChange={v => setForm(f => ({ ...f, exigir_aceite: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar e adicionar perguntas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
