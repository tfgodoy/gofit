import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Eye, EyeOff, ShieldCheck, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { adminLogin, user } = useAuth();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  // Se já autenticado como owner, vai direto ao dashboard
  if (user?.role === "owner") {
    navigate("/admin/dashboard", { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await adminLogin(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    navigate("/admin/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white">
            Fit<span className="text-primary">Core</span>Sys
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8">

            {/* Badge */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Área Administrativa</span>
              </div>
            </div>

            <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">
              GoFit Admin
            </h1>
            <p className="text-gray-400 text-sm text-center mb-6">
              Acesso restrito à equipe GoFit
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gofit.com.br"
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
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                  <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Verificando..." : "Entrar"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Acesso para colaboradores GoFit.{" "}
            <a href="/login" className="underline hover:text-white transition-colors">
              Voltar ao login da academia
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
