import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dumbbell, Eye, EyeOff, ShieldCheck, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type LoginMode = "contractor" | "owner";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<LoginMode>("contractor");
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(credential, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    navigate(mode === "owner" ? "/owner/dashboard" : "/app/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/30 via-white to-white flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">
            Fit<span className="text-primary">Core</span>Sys
          </span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Bem-vindo de volta</h1>
            <p className="text-gray-500 text-sm mb-6">Faça login para acessar o sistema</p>

            {/* Mode Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setMode("contractor"); setError(""); setCredential(""); setPassword(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === "contractor"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Empresa
              </button>
              <button
                type="button"
                onClick={() => { setMode("owner"); setError(""); setCredential(""); setPassword(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === "owner"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Owner
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {mode === "contractor" ? "CNPJ ou E-mail" : "E-mail"}
                </label>
                <input
                  type={mode === "contractor" ? "text" : "email"}
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder={mode === "contractor" ? "00.000.000/0000-00 ou email@empresa.com" : "admin@fitcoresys.com.br"}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            {mode === "contractor" && (
              <div className="mt-5 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
                Ainda não tem conta?{" "}
                <Link to="/cadastro" className="text-primary font-semibold hover:underline">
                  Criar conta grátis
                </Link>
              </div>
            )}

            {mode === "owner" && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Acesso restrito ao administrador do sistema FitCoreSys.</span>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Ao continuar, você concorda com os{" "}
            <a href="#" className="underline hover:text-gray-600">Termos de Uso</a>{" "}
            e a{" "}
            <a href="#" className="underline hover:text-gray-600">Política de Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
