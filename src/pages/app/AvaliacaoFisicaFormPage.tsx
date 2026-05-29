import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface Avaliacao {
  avaliador_nome: string;
  data_avaliacao: string;
  peso_kg: string;
  altura_cm: string;
  imc: string;
  protocolo: string;
  percentual_gordura: string;
  massa_gorda_kg: string;
  massa_magra_kg: string;
  cintura_cm: string;
  quadril_cm: string;
  abdomen_cm: string;
  torax_cm: string;
  braco_direito_cm: string;
  braco_esquerdo_cm: string;
  antebraco_direito_cm: string;
  antebraco_esquerdo_cm: string;
  coxa_direita_cm: string;
  coxa_esquerda_cm: string;
  panturrilha_direita_cm: string;
  panturrilha_esquerda_cm: string;
  dobra_peitoral_mm: string;
  dobra_axilar_mm: string;
  dobra_triceps_mm: string;
  dobra_subescapular_mm: string;
  dobra_abdominal_mm: string;
  dobra_suprailiaca_mm: string;
  dobra_coxa_mm: string;
  observacoes: string;
}

const empty: Avaliacao = {
  avaliador_nome: "",
  data_avaliacao: new Date().toISOString().split("T")[0],
  peso_kg: "", altura_cm: "", imc: "",
  protocolo: "pollock7",
  percentual_gordura: "", massa_gorda_kg: "", massa_magra_kg: "",
  cintura_cm: "", quadril_cm: "", abdomen_cm: "", torax_cm: "",
  braco_direito_cm: "", braco_esquerdo_cm: "",
  antebraco_direito_cm: "", antebraco_esquerdo_cm: "",
  coxa_direita_cm: "", coxa_esquerda_cm: "",
  panturrilha_direita_cm: "", panturrilha_esquerda_cm: "",
  dobra_peitoral_mm: "", dobra_axilar_mm: "", dobra_triceps_mm: "",
  dobra_subescapular_mm: "", dobra_abdominal_mm: "",
  dobra_suprailiaca_mm: "", dobra_coxa_mm: "",
  observacoes: "",
};

/* ── helpers ────────────────────────────────────────────────── */

function n(v: string): number | null {
  const parsed = parseFloat(v.replace(",", "."));
  return isNaN(parsed) ? null : parsed;
}

function calcIMC(peso: string, altura: string): string {
  const p = parseFloat(peso.replace(",", "."));
  const h = parseFloat(altura.replace(",", "."));
  if (!p || !h || h <= 0) return "";
  const imc = p / ((h / 100) ** 2);
  return imc.toFixed(1);
}

function imcClass(imc: number): string {
  if (imc < 18.5) return "text-blue-600";
  if (imc < 25)   return "text-green-600";
  if (imc < 30)   return "text-yellow-600";
  return "text-red-600";
}

function imcLabel(imc: number): string {
  if (imc < 18.5) return "Abaixo do peso";
  if (imc < 25)   return "Peso normal";
  if (imc < 30)   return "Sobrepeso";
  if (imc < 35)   return "Obesidade I";
  if (imc < 40)   return "Obesidade II";
  return "Obesidade III";
}

/* ── section wrapper ─────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── page ───────────────────────────────────────────────────── */

export default function AvaliacaoFisicaFormPage() {
  const { id: studentId, avalId } = useParams<{ id: string; avalId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<Avaliacao>(empty);
  const [studentName, setStudentName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!avalId);

  /* load student name */
  useEffect(() => {
    if (!studentId || !user) return;
    supabase
      .from("students")
      .select("nome_completo")
      .eq("id", studentId)
      .eq("contractor_id", user.contractorId!)
      .single()
      .then(({ data }) => { if (data) setStudentName((data as any).nome_completo); });
  }, [studentId, user]);

  /* load existing evaluation */
  useEffect(() => {
    if (!avalId || !user) return;
    supabase
      .from("physical_evaluations")
      .select("*")
      .eq("id", avalId)
      .eq("contractor_id", user.contractorId!)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        const str = (v: number | null) => v != null ? String(v) : "";
        setForm({
          avaliador_nome:          d.avaliador_nome ?? "",
          data_avaliacao:          d.data_avaliacao ?? "",
          peso_kg:                 str(d.peso_kg),
          altura_cm:               str(d.altura_cm),
          imc:                     str(d.imc),
          protocolo:               d.protocolo ?? "pollock7",
          percentual_gordura:      str(d.percentual_gordura),
          massa_gorda_kg:          str(d.massa_gorda_kg),
          massa_magra_kg:          str(d.massa_magra_kg),
          cintura_cm:              str(d.cintura_cm),
          quadril_cm:              str(d.quadril_cm),
          abdomen_cm:              str(d.abdomen_cm),
          torax_cm:                str(d.torax_cm),
          braco_direito_cm:        str(d.braco_direito_cm),
          braco_esquerdo_cm:       str(d.braco_esquerdo_cm),
          antebraco_direito_cm:    str(d.antebraco_direito_cm),
          antebraco_esquerdo_cm:   str(d.antebraco_esquerdo_cm),
          coxa_direita_cm:         str(d.coxa_direita_cm),
          coxa_esquerda_cm:        str(d.coxa_esquerda_cm),
          panturrilha_direita_cm:  str(d.panturrilha_direita_cm),
          panturrilha_esquerda_cm: str(d.panturrilha_esquerda_cm),
          dobra_peitoral_mm:       str(d.dobra_peitoral_mm),
          dobra_axilar_mm:         str(d.dobra_axilar_mm),
          dobra_triceps_mm:        str(d.dobra_triceps_mm),
          dobra_subescapular_mm:   str(d.dobra_subescapular_mm),
          dobra_abdominal_mm:      str(d.dobra_abdominal_mm),
          dobra_suprailiaca_mm:    str(d.dobra_suprailiaca_mm),
          dobra_coxa_mm:           str(d.dobra_coxa_mm),
          observacoes:             d.observacoes ?? "",
        });
        setLoading(false);
      });
  }, [avalId, user]);

  /* IMC auto-calc */
  function set(k: keyof Avaliacao, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === "peso_kg" || k === "altura_cm") {
        next.imc = calcIMC(
          k === "peso_kg" ? v : prev.peso_kg,
          k === "altura_cm" ? v : prev.altura_cm,
        );
      }
      return next;
    });
  }

  async function handleSave() {
    if (!studentId || !user) return;
    setSaving(true);
    const payload = {
      contractor_id:           user.contractorId!,
      student_id:              studentId!,
      avaliador_nome:          form.avaliador_nome || null,
      data_avaliacao:          form.data_avaliacao,
      peso_kg:                 n(form.peso_kg),
      altura_cm:               n(form.altura_cm),
      imc:                     n(form.imc),
      protocolo:               form.protocolo,
      percentual_gordura:      n(form.percentual_gordura),
      massa_gorda_kg:          n(form.massa_gorda_kg),
      massa_magra_kg:          n(form.massa_magra_kg),
      cintura_cm:              n(form.cintura_cm),
      quadril_cm:              n(form.quadril_cm),
      abdomen_cm:              n(form.abdomen_cm),
      torax_cm:                n(form.torax_cm),
      braco_direito_cm:        n(form.braco_direito_cm),
      braco_esquerdo_cm:       n(form.braco_esquerdo_cm),
      antebraco_direito_cm:    n(form.antebraco_direito_cm),
      antebraco_esquerdo_cm:   n(form.antebraco_esquerdo_cm),
      coxa_direita_cm:         n(form.coxa_direita_cm),
      coxa_esquerda_cm:        n(form.coxa_esquerda_cm),
      panturrilha_direita_cm:  n(form.panturrilha_direita_cm),
      panturrilha_esquerda_cm: n(form.panturrilha_esquerda_cm),
      dobra_peitoral_mm:       n(form.dobra_peitoral_mm),
      dobra_axilar_mm:         n(form.dobra_axilar_mm),
      dobra_triceps_mm:        n(form.dobra_triceps_mm),
      dobra_subescapular_mm:   n(form.dobra_subescapular_mm),
      dobra_abdominal_mm:      n(form.dobra_abdominal_mm),
      dobra_suprailiaca_mm:    n(form.dobra_suprailiaca_mm),
      dobra_coxa_mm:           n(form.dobra_coxa_mm),
      observacoes:             form.observacoes || null,
      updated_at:              new Date().toISOString(),
    };

    let err: unknown;
    if (avalId) {
      ({ error: err } = await supabase
        .from("physical_evaluations")
        .update(payload)
        .eq("id", avalId));
    } else {
      ({ error: err } = await supabase
        .from("physical_evaluations")
        .insert(payload));
    }

    setSaving(false);
    if (err) {
      toast.error("Erro ao salvar avaliação");
      return;
    }
    toast.success(avalId ? "Avaliação atualizada!" : "Avaliação registrada!");
    navigate(`/app/clientes/${studentId}/dashboard`);
  }

  const imcNum = parseFloat(form.imc);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={`/app/clientes/${studentId}/dashboard`}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {avalId ? "Editar Avaliação Física" : "Nova Avaliação Física"}
            </h1>
            {studentName && (
              <p className="text-sm text-gray-500 mt-0.5">{studentName}</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Dados básicos */}
          <Section title="Dados Básicos">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data da Avaliação *" half>
                <input
                  type="date"
                  value={form.data_avaliacao}
                  onChange={e => set("data_avaliacao", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Avaliador" half>
                <input
                  type="text"
                  value={form.avaliador_nome}
                  onChange={e => set("avaliador_nome", e.target.value)}
                  placeholder="Nome do avaliador"
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* Antropometria */}
          <Section title="Antropometria">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.peso_kg}
                  onChange={e => set("peso_kg", e.target.value)}
                  placeholder="0.0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Altura (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.altura_cm}
                  onChange={e => set("altura_cm", e.target.value)}
                  placeholder="0.0"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">IMC (calculado)</label>
                <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                  form.imc ? "border-gray-200 bg-gray-50" : "border-dashed border-gray-200 bg-gray-50"
                }`}>
                  <span className={`text-lg font-bold ${form.imc ? imcClass(imcNum) : "text-gray-300"}`}>
                    {form.imc || "—"}
                  </span>
                  {form.imc && (
                    <span className={`text-xs font-semibold ${imcClass(imcNum)}`}>
                      {imcLabel(imcNum)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Composição corporal */}
          <Section title="Composição Corporal">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Protocolo</label>
                <select
                  value={form.protocolo}
                  onChange={e => set("protocolo", e.target.value)}
                  className={inputClass}
                >
                  <option value="pollock7">Pollock 7 dobras</option>
                  <option value="pollock3">Pollock 3 dobras</option>
                  <option value="durnin">Durnin-Womersley</option>
                  <option value="faulkner">Faulkner</option>
                  <option value="bioimpedancia">Bioimpedância</option>
                  <option value="dexa">DEXA</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">% Gordura</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.percentual_gordura}
                  onChange={e => set("percentual_gordura", e.target.value)}
                  placeholder="0.0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Massa Gorda (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.massa_gorda_kg}
                  onChange={e => set("massa_gorda_kg", e.target.value)}
                  placeholder="0.0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Massa Magra (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.massa_magra_kg}
                  onChange={e => set("massa_magra_kg", e.target.value)}
                  placeholder="0.0"
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          {/* Circunferências */}
          <Section title="Circunferências (cm)">
            <div className="grid grid-cols-4 gap-4">
              {([
                ["cintura_cm",              "Cintura"],
                ["quadril_cm",              "Quadril"],
                ["abdomen_cm",              "Abdômen"],
                ["torax_cm",                "Tórax"],
                ["braco_direito_cm",        "Braço Direito"],
                ["braco_esquerdo_cm",       "Braço Esquerdo"],
                ["antebraco_direito_cm",    "Antebraço Direito"],
                ["antebraco_esquerdo_cm",   "Antebraço Esquerdo"],
                ["coxa_direita_cm",         "Coxa Direita"],
                ["coxa_esquerda_cm",        "Coxa Esquerda"],
                ["panturrilha_direita_cm",  "Panturrilha Direita"],
                ["panturrilha_esquerda_cm", "Panturrilha Esquerda"],
              ] as [keyof Avaliacao, string][]).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form[k]}
                    onChange={e => set(k, e.target.value)}
                    placeholder="0.0"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Dobras cutâneas */}
          <Section title="Dobras Cutâneas (mm)">
            <div className="grid grid-cols-4 gap-4">
              {([
                ["dobra_peitoral_mm",     "Peitoral"],
                ["dobra_axilar_mm",       "Axilar Média"],
                ["dobra_triceps_mm",      "Tríceps"],
                ["dobra_subescapular_mm", "Subescapular"],
                ["dobra_abdominal_mm",    "Abdominal"],
                ["dobra_suprailiaca_mm",  "Suprailíaca"],
                ["dobra_coxa_mm",         "Coxa"],
              ] as [keyof Avaliacao, string][]).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form[k]}
                    onChange={e => set(k, e.target.value)}
                    placeholder="0.0"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Observações */}
          <Section title="Observações">
            <textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              rows={3}
              placeholder="Observações sobre a avaliação..."
              className={`${inputClass} resize-none`}
            />
          </Section>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 pb-8">
            <Link
              to={`/app/clientes/${studentId}/dashboard`}
              className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              CANCELAR
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || !form.data_avaliacao}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              SALVAR AVALIAÇÃO
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
