import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { useCEP } from "@/hooks/useCEP";
import { supabase } from "@/integrations/supabase/client";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Bahia",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
];

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Sao_Paulo": "Brasília / São Paulo (GMT-3)",
  "America/Manaus": "Manaus (GMT-4)",
  "America/Belem": "Belém (GMT-3)",
  "America/Fortaleza": "Fortaleza (GMT-3)",
  "America/Recife": "Recife (GMT-3)",
  "America/Maceio": "Maceió (GMT-3)",
  "America/Bahia": "Salvador (GMT-3)",
  "America/Cuiaba": "Cuiabá (GMT-4)",
  "America/Porto_Velho": "Porto Velho (GMT-4)",
  "America/Boa_Vista": "Boa Vista (GMT-4)",
  "America/Rio_Branco": "Rio Branco (GMT-5)",
  "America/Noronha": "Fernando de Noronha (GMT-2)",
};

function formatCNPJ(value: string) {
  const v = value.replace(/\D/g, "").slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function formatPhone(value: string) {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}

function formatCEP(value: string) {
  const v = value.replace(/\D/g, "").slice(0, 8);
  if (v.length <= 5) return v;
  return `${v.slice(0, 5)}-${v.slice(5)}`;
}

interface FormState {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email: string;
  fone: string;
  fuso_horario: string;
  site: string;
  instagram: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  uf: string;
  senha: string;
  confirmar_senha: string;
}

const initial: FormState = {
  razao_social: "", nome_fantasia: "", cnpj: "", email: "",
  fone: "", fuso_horario: "America/Sao_Paulo", site: "", instagram: "",
  cep: "", logradouro: "", numero: "", bairro: "",
  complemento: "", cidade: "", uf: "", senha: "", confirmar_senha: "",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: "hsl(270 60% 50%)" }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-none border-0 border-b border-gray-200 focus:outline-none focus:border-primary bg-transparent transition-colors placeholder:text-gray-300";

export default function ContractorRegisterPage() {
  const { fetchCEP, loading: cepLoading } = useCEP();
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCEPBlur() {
    const data = await fetchCEP(form.cep);
    if (data) {
      setForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (form.senha.length < 8) {
      setFormError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (form.senha !== form.confirmar_senha) {
      setFormError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.from("contractors").insert([{
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj: form.cnpj.replace(/\D/g, ""),
      email: form.email,
      fone: form.fone.replace(/\D/g, ""),
      fuso_horario: form.fuso_horario,
      site: form.site || null,
      instagram: form.instagram || null,
      cep: form.cep.replace(/\D/g, ""),
      logradouro: form.logradouro,
      numero: form.numero,
      bairro: form.bairro,
      complemento: form.complemento || null,
      cidade: form.cidade,
      uf: form.uf || null,
      status: "active" as const,
    }]).select("id").single();

    if (error || !data) {
      setFormError("Erro ao criar conta. Verifique os dados e tente novamente.");
      setSubmitting(false);
      return;
    }

    await supabase.from("contractor_auth").insert([{
      contractor_id: data.id,
      password_hash: btoa(form.senha),
    }]);

    setSubmitting(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/30 via-white to-white px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Conta criada!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Sua empresa foi cadastrada com sucesso no FitCoreSys. Faça login para começar.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Ir para o login <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">
            Fit<span className="text-primary">Core</span>Sys
          </span>
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Criar conta</h1>
          <p className="text-gray-500 text-sm mt-1">Preencha os dados da sua empresa para começar.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Dados principais */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            {/* Tab header like the screenshot */}
            <div className="border-b border-gray-100">
              <div className="px-6">
                <span className="inline-block py-4 text-sm font-semibold text-primary border-b-2 border-primary">
                  INFORMAÇÕES
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-sm font-semibold text-gray-700">Dados principais</p>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                <Field label="Razão social" required>
                  <input
                    className={inputCls}
                    value={form.razao_social}
                    onChange={(e) => set("razao_social", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Nome fantasia" required>
                  <input
                    className={inputCls}
                    value={form.nome_fantasia}
                    onChange={(e) => set("nome_fantasia", e.target.value)}
                    required
                  />
                </Field>
                <Field label="CNPJ">
                  <input
                    className={inputCls}
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                </Field>
                <Field label="Fone">
                  <input
                    className={inputCls}
                    value={form.fone}
                    onChange={(e) => set("fone", formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
                <Field label="E-mail">
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Fuso horário" required>
                  <select
                    className={inputCls + " cursor-pointer"}
                    value={form.fuso_horario}
                    onChange={(e) => set("fuso_horario", e.target.value)}
                    required
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{TIMEZONE_LABELS[tz]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Site">
                  <input
                    className={inputCls}
                    value={form.site}
                    onChange={(e) => set("site", e.target.value)}
                    placeholder="www.suaempresa.com.br"
                  />
                </Field>
                <Field label="Instagram">
                  <input
                    className={inputCls}
                    value={form.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="@suaempresa"
                  />
                </Field>
              </div>

              {/* Endereço */}
              <p className="text-sm font-semibold text-gray-700 pt-2">Endereço</p>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                <Field label="CEP" required>
                  <div className="relative">
                    <input
                      className={inputCls}
                      value={form.cep}
                      onChange={(e) => set("cep", formatCEP(e.target.value))}
                      onBlur={handleCEPBlur}
                      placeholder="00000-000"
                      required
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                    )}
                  </div>
                </Field>
                <Field label="Logradouro" required>
                  <input
                    className={inputCls}
                    value={form.logradouro}
                    onChange={(e) => set("logradouro", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Número" required>
                  <input
                    className={inputCls}
                    value={form.numero}
                    onChange={(e) => set("numero", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Bairro" required>
                  <input
                    className={inputCls}
                    value={form.bairro}
                    onChange={(e) => set("bairro", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Cidade" required>
                  <input
                    className={inputCls}
                    value={form.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    className={inputCls}
                    value={form.complemento}
                    onChange={(e) => set("complemento", e.target.value)}
                    placeholder="Apto, sala, loja..."
                  />
                </Field>
              </div>

              {/* Senha */}
              <p className="text-sm font-semibold text-gray-700 pt-2">Acesso</p>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                <Field label="Senha" required>
                  <input
                    type="password"
                    className={inputCls}
                    value={form.senha}
                    onChange={(e) => set("senha", e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </Field>
                <Field label="Confirmar senha" required>
                  <input
                    type="password"
                    className={inputCls}
                    value={form.confirmar_senha}
                    onChange={(e) => set("confirmar_senha", e.target.value)}
                    placeholder="Repita a senha"
                    required
                  />
                </Field>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {formError}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <Link to="/login" className="text-sm text-gray-500 hover:text-primary transition-colors">
              Já tenho conta
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                <>SALVAR <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
