import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Upload, Trash2, Download, Loader2, ChevronDown,
  FileImage, File,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

interface DocRecord {
  id: string;
  tipo: string;
  arquivo_nome: string;
  arquivo_path: string;
  tamanho: number | null;
  created_at: string;
}

const TIPOS = [
  { value: "rg",                     label: "RG" },
  { value: "cpf",                    label: "CPF" },
  { value: "comprovante_residencia", label: "Comprovante de residência" },
  { value: "carteira_conselho",      label: "Carteira do conselho" },
  { value: "cnh",                    label: "CNH" },
  { value: "ctps",                   label: "CTPS" },
  { value: "outros",                 label: "Outros" },
];

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.value, t.label]));

const TIPO_BADGE: Record<string, string> = {
  rg:                     "bg-blue-100 text-blue-700",
  cpf:                    "bg-indigo-100 text-indigo-700",
  comprovante_residencia: "bg-green-100 text-green-700",
  carteira_conselho:      "bg-purple-100 text-purple-700",
  cnh:                    "bg-orange-100 text-orange-700",
  ctps:                   "bg-yellow-100 text-yellow-700",
  outros:                 "bg-gray-100 text-gray-600",
};

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (["jpg", "jpeg", "png"].includes(ext ?? "")) return <FileImage className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  return <File className="w-4 h-4 text-gray-400 flex-shrink-0" />;
}

const SEL_CLASS = [
  "w-full bg-white border border-gray-200 rounded-md",
  "py-2 pl-3 pr-8 text-sm text-gray-700",
  "outline-none focus:border-primary transition-colors",
  "appearance-none cursor-pointer",
].join(" ");

export default function StaffDocumentosSection({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState("outros");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["staff-documentos", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_documentos")
        .select("*")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocRecord[];
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${contractorId}/${staffId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("staff-docs")
        .upload(path, file, { contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("staff_documentos").insert([{
        staff_id:      staffId,
        contractor_id: contractorId,
        tipo: tipo as "rg" | "cpf" | "comprovante_residencia" | "carteira_conselho" | "cnh" | "ctps" | "outros",
        arquivo_nome:  file.name,
        arquivo_path:  path,
        tamanho:       file.size,
      }]);

      if (insertErr) {
        await supabase.storage.from("staff-docs").remove([path]);
        throw insertErr;
      }

      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["staff-documentos", staffId] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar documento.");
    } finally {
      setUploading(false);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocRecord) => {
      await supabase.storage.from("staff-docs").remove([doc.arquivo_path]);
      const { error } = await supabase.from("staff_documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["staff-documentos", staffId] });
    },
    onError: () => toast.error("Erro ao remover documento."),
  });

  async function handleDownload(doc: DocRecord) {
    const { data, error } = await supabase.storage
      .from("staff-docs")
      .createSignedUrl(doc.arquivo_path, 120);

    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Documentos</h3>
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">

        {/* Seletor de tipo + botão de upload */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className={SEL_CLASS}
            >
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-primary text-white font-semibold px-3 py-2 rounded-md text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Upload className="w-4 h-4" />}
            {uploading ? "Enviando..." : "ANEXAR"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <p className="text-xs text-gray-400">PDF, JPG, PNG, DOC, DOCX · máx. 10 MB</p>

        {/* Lista de documentos */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-1">Nenhum documento anexado.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                <FileIcon name={doc.arquivo_nome} />
                <div className="flex-1 min-w-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold mb-0.5 ${TIPO_BADGE[doc.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                    {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                  </span>
                  <p className="text-sm font-medium text-gray-700 truncate">{doc.arquivo_nome}</p>
                  {doc.tamanho && <p className="text-xs text-gray-400">{fmtSize(doc.tamanho)}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  className="text-gray-400 hover:text-primary transition-colors"
                  title="Baixar"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirm("Remover este documento?")) deleteMutation.mutate(doc); }}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
