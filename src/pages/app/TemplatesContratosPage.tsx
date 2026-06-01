import { useState, useEffect, useRef } from "react";
import {
  Plus, Search, MoreVertical, Pencil, Trash2, Download,
  Upload, Code2, FileText, ChevronLeft, ChevronRight,
  AlertTriangle, X, ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── Types ───────────────────────────────────────────────────────────── */
interface Template {
  id: string;
  descricao: string;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

/* ── Campos disponíveis ──────────────────────────────────────────────── */
interface Campo { label: string; variavel: string }
interface BlocoAvancado { label: string; codigo: string }
interface GrupoCampos {
  grupo: string;
  itens?: Campo[];
  blocos?: BlocoAvancado[];  // para foreach/if com sintaxe multilinha
}

const CAMPOS: GrupoCampos[] = [
  { grupo: "Empresa (Filial)", itens: [
    { label: "Logomarca",                        variavel: "LogoFilial" },
    { label: "Razão social",                     variavel: "RazaoSocialFilial" },
    { label: "Nome fantasia",                    variavel: "NomeFantasiaFilial" },
    { label: "CNPJ / CPF",                       variavel: "CnpjCpfFilial" },
    { label: "Endereço",                         variavel: "EnderecoFilial" },
    { label: "Número do endereço",               variavel: "NumeroEnderecoFilial" },
    { label: "Bairro",                           variavel: "BairroFilial" },
    { label: "CEP",                              variavel: "CepFilial" },
    { label: "Cidade",                           variavel: "CidadeFilial" },
    { label: "UF",                               variavel: "UfFilial" },
    { label: "Data de impressão",                variavel: "DataImpressao" },
  ]},
  { grupo: "Cliente", itens: [
    { label: "Nome",                             variavel: "NomeCliente" },
    { label: "CPF",                              variavel: "CpfCliente" },
    { label: "RG",                               variavel: "RgCliente" },
    { label: "E-mail",                           variavel: "EmailCliente" },
    { label: "Telefone",                         variavel: "TelefoneCliente" },
    { label: "Endereço",                         variavel: "EnderecoCliente" },
    { label: "Número do endereço",               variavel: "NumeroEnderecoCliente" },
    { label: "Bairro",                           variavel: "BairroCliente" },
    { label: "CEP",                              variavel: "CepCliente" },
    { label: "Cidade",                           variavel: "CidadeCliente" },
    { label: "UF",                               variavel: "UfCliente" },
  ]},
  { grupo: "Contrato", itens: [
    { label: "Descrição",                        variavel: "DescricaoContrato" },
    { label: "Duração",                          variavel: "DuracaoContrato" },
    { label: "Valor total (formatado)",          variavel: "ValorTotalContratoFormatado" },
    { label: "Valor de adesão (formatado)",      variavel: "ValorAdesaoFormatado" },
    { label: "Data de início",                   variavel: "DataInicioContrato" },
    { label: "Data de validade",                 variavel: "DataValidadeContrato" },
  ]},
  { grupo: "Modalidades (loop)", blocos: [
    {
      label: "Loop de modalidades",
      codigo: "<<foreach [modalidade in Modalidades]>>\n<<[modalidade.DescricaoModalidade]>>\n<<[modalidade.QtdeSessoesPorSemana]>> sessões/semana\n<</foreach>>",
    },
    {
      label: "Grade de horários (dentro do loop de modalidades)",
      codigo: "<<foreach [gradeHorario in modalidade.GradeHorarios]>>\n<<[gradeHorario.DiaDaSemana]>> das <<[gradeHorario.HorarioInicial]>> às <<[gradeHorario.HorarioFinal]>>\n<</foreach>>",
    },
  ]},
  { grupo: "Parcelas (loop)", blocos: [
    {
      label: "Loop de parcelas",
      codigo: "<<foreach [parcela in Parcelas]>>\nR$<<[parcela.ValorFormatado]>> com vencimento em <<[parcela.DataVencimento]>>\n<</foreach>>",
    },
  ]},
  { grupo: "Condicional", blocos: [
    {
      label: "Exibir bloco só se houver adesão",
      codigo: "<<if [ValorAdesao > 0]>>\nR$<<[ValorAdesaoFormatado]>> refere-se à taxa de adesão\n<</if>>",
    },
  ]},
];

/* ── Menu ⋮ ─────────────────────────────────────────────────────────── */
function MenuAcoes({ onEditar, onDownload, onRemover }: {
  onEditar: () => void;
  onDownload: () => void;
  onRemover: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
          <button onClick={() => { setOpen(false); onEditar(); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar
          </button>
          <button onClick={() => { setOpen(false); onDownload(); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5 text-gray-400" /> Download
          </button>
          <button onClick={() => { setOpen(false); onRemover(); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Modal Campos Disponíveis ────────────────────────────────────────── */
function CopiarBtn({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }
  return (
    <button
      onClick={copiar}
      title="Copiar"
      className="ml-1.5 flex-shrink-0 p-1 rounded hover:bg-primary/10 transition-colors text-gray-400 hover:text-primary"
    >
      {copiado ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CamposModal({ onClose }: { onClose: () => void }) {
  const [abertos, setAbertos] = useState<string[]>(["Empresa"]);
  const toggle = (g: string) =>
    setAbertos(a => a.includes(g) ? a.filter(x => x !== g) : [...a, g]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Campos disponíveis</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Instrução rápida */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Copie a variável (coluna da direita) e cole no Word exatamente como está — sem alterar maiúsculas, minúsculas ou acentos.
            Exemplo: <code className="font-mono bg-amber-100 px-1 rounded">{"<<[RazaoSocialEmpresa]>>"}</code> → sairá <strong>FIT CORE STUDIO LTDA</strong>
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {CAMPOS.map(({ grupo, itens, blocos }) => (
            <div key={grupo}>
              {/* Cabeçalho do grupo */}
              <button
                onClick={() => toggle(grupo)}
                className="flex items-center justify-between w-full px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
              >
                {grupo}
                {abertos.includes(grupo)
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {abertos.includes(grupo) && itens && (
                <div>
                  <div className="grid grid-cols-2 px-5 py-1.5 border-b border-gray-100 bg-gray-50/50">
                    <span className="text-xs text-gray-400 font-semibold">Campo</span>
                    <span className="text-xs text-gray-400 font-semibold">Variável para copiar</span>
                  </div>
                  {itens.map(({ label, variavel }) => {
                    const sintaxe = `<<[${variavel}]>>`;
                    return (
                      <div key={variavel} className="grid grid-cols-2 items-center px-5 py-2.5 border-b border-gray-50 hover:bg-primary/5 transition-colors">
                        <span className="text-sm text-gray-700">{label}</span>
                        <div className="flex items-center">
                          <code className="text-xs font-mono text-primary bg-primary/5 px-2 py-1 rounded truncate">
                            {sintaxe}
                          </code>
                          <CopiarBtn texto={sintaxe} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {abertos.includes(grupo) && blocos && (
                <div className="divide-y divide-gray-50">
                  {blocos.map(({ label, codigo }) => (
                    <div key={label} className="px-5 py-3 hover:bg-primary/5 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-600">{label}</span>
                        <CopiarBtn texto={codigo} />
                      </div>
                      <pre className="text-xs font-mono text-primary bg-primary/5 px-3 py-2 rounded whitespace-pre-wrap leading-relaxed">
                        {codigo}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2 transition-colors">
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal Novo/Editar Template ──────────────────────────────────────── */
function TemplateModal({ onClose, onSaved, editing }: {
  onClose: () => void;
  onSaved: () => void;
  editing?: Template | null;
}) {
  const { user } = useAuth();
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [arquivo, setArquivo]     = useState<File | null>(null);
  const [saving, setSaving]       = useState(false);
  const [showCampos, setShowCampos] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nomeAtual = editing?.arquivo_nome ?? null;

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!descricao.trim()) { toast.error("Preencha a descrição."); return; }
    if (!editing && !arquivo) { toast.error("Selecione um arquivo .doc ou .docx."); return; }
    setSaving(true);
    try {
      let arquivo_path = editing?.arquivo_path ?? null;
      let arquivo_nome = editing?.arquivo_nome ?? null;
      if (arquivo) {
        const ext  = arquivo.name.split(".").pop();
        const path = `${user.contractorId}/${Date.now()}.${ext}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upErr } = await (supabase as any).storage
          .from("templates").upload(path, arquivo, { upsert: true });
        if (upErr) throw upErr;
        arquivo_path = path;
        arquivo_nome = arquivo.name;
        if (editing?.arquivo_path && editing.arquivo_path !== path) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).storage.from("templates").remove([editing.arquivo_path]);
        }
      }
      const payload = {
        contractor_id: user.contractorId,
        descricao: descricao.trim(),
        arquivo_path,
        arquivo_nome,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = editing
        ? await (supabase as any).from("templates_contratos").update(payload).eq("id", editing.id)
        : await (supabase as any).from("templates_contratos").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Template atualizado." : "Template criado.");
      onSaved(); onClose();
    } catch {
      toast.error("Erro ao salvar template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {editing ? "Editar template" : "Novo template"}
            </h2>
            <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
              <input
                autoFocus
                type="text"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Contrato Mensal 2025"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {/* Botões auxiliares */}
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCampos(true)}
                className="flex items-center gap-1.5 border border-primary text-primary text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                <Code2 className="w-3.5 h-3.5" /> CAMPOS DISPONÍVEIS
              </button>
            </div>
            {/* Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Arquivo do template</label>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                {arquivo ? (
                  <p className="text-sm font-medium text-primary">{arquivo.name}</p>
                ) : nomeAtual ? (
                  <p className="text-sm text-gray-500 text-center">{nomeAtual}</p>
                ) : (
                  <p className="text-sm text-gray-400">Clique para selecionar o arquivo</p>
                )}
                <button type="button"
                  className="bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                  {nomeAtual || arquivo ? "ALTERAR ARQUIVO" : "SELECIONAR ARQUIVO"}
                </button>
                <p className="text-xs text-gray-400">doc, docx</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setArquivo(f); }}
              />
            </div>
          </div>
          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 pb-5">
            <button onClick={onClose}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="bg-primary text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
      {showCampos && <CamposModal onClose={() => setShowCampos(false)} />}
    </>
  );
}

/* ── Confirm Remover ─────────────────────────────────────────────────── */
function ConfirmModal({ nome, onConfirm, onClose }: {
  nome: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">Remover template?</h3>
        <p className="text-sm text-gray-500 mb-6">
          O template <strong>"{nome}"</strong> será removido permanentemente.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button onClick={onConfirm}
            className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
            REMOVER
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function TemplatesContratosPage() {
  const { user } = useAuth();
  const [all, setAll]             = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Template | null>(null);
  const [confirmId, setConfirmId] = useState<Template | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("templates_contratos")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("descricao", { ascending: true });
    setAll((data ?? []) as Template[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const filtered = all.filter(t =>
    !search || t.descricao.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDownload(t: Template) {
    if (!t.arquivo_path) { toast.error("Nenhum arquivo vinculado a este template."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).storage
      .from("templates").download(t.arquivo_path);
    if (error || !data) { toast.error("Erro ao baixar arquivo."); return; }
    const url = URL.createObjectURL(data);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = t.arquivo_nome ?? "template.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRemover(t: Template) {
    if (t.arquivo_path) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).storage.from("templates").remove([t.arquivo_path]);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("templates_contratos").delete().eq("id", t.id);
    if (error) { toast.error("Erro ao remover template."); return; }
    toast.success("Template removido.");
    setConfirmId(null);
    load();
  }

  function fmtData(s: string) {
    return new Date(s).toLocaleDateString("pt-BR");
  }

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Templates</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> + TEMPLATE
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50 px-8 py-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">
                    {all.length === 0 ? "Nenhum template cadastrado." : "Nenhum resultado encontrado."}
                  </p>
                  {all.length === 0 && (
                    <button onClick={() => setShowModal(true)}
                      className="text-xs font-semibold text-primary hover:underline">
                      Criar primeiro template →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                        <th className="text-left px-6 py-3">Descrição</th>
                        <th className="text-left px-4 py-3">Arquivo</th>
                        <th className="text-left px-4 py-3">Criado em</th>
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginated.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{t.descricao}</td>
                          <td className="px-4 py-4 text-xs text-gray-500">
                            {t.arquivo_nome ? (
                              <span className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                {t.arquivo_nome}
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Sem arquivo</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-500">{fmtData(t.created_at)}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end">
                              <MenuAcoes
                                onEditar={() => setEditing(t)}
                                onDownload={() => handleDownload(t)}
                                onRemover={() => setConfirmId(t)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Paginação */}
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                    <span>Página {page} de {totalPages} — {filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-1">
                      <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </AppLayout>

      {(showModal || editing) && (
        <TemplateModal
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
          editing={editing}
        />
      )}

      {confirmId && (
        <ConfirmModal
          nome={confirmId.descricao}
          onConfirm={() => handleRemover(confirmId)}
          onClose={() => setConfirmId(null)}
        />
      )}
    </>
  );
}
