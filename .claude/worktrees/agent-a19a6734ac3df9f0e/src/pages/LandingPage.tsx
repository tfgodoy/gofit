import { Link } from "react-router-dom";
import {
  Users, Calendar, BarChart2, Dumbbell, ClipboardList,
  ShieldCheck, Smartphone, Zap, CheckCircle, ArrowRight,
  Mail, Phone, MapPin, ChevronRight
} from "lucide-react";

const features = [
  { icon: Users, title: "Gestão de Alunos", desc: "Cadastro completo com histórico, anamnese, evolução e contratos digitais." },
  { icon: Calendar, title: "Agendamentos", desc: "Controle de aulas, avaliações físicas e consultas com agenda inteligente." },
  { icon: BarChart2, title: "Financeiro", desc: "Mensalidades, inadimplências, receitas e relatórios em tempo real." },
  { icon: Dumbbell, title: "Treinos Personalizados", desc: "Monte e envie treinos com banco de exercícios e vídeos explicativos." },
  { icon: ClipboardList, title: "Avaliação Física", desc: "Fichas completas de avaliação com gráficos de evolução corporal." },
  { icon: Smartphone, title: "App do Aluno", desc: "Seus alunos acessam treinos, dieta e agenda direto pelo celular." },
  { icon: ShieldCheck, title: "Multi-perfil", desc: "Acesse com perfis de recepcionista, professor, nutricionista e mais." },
  { icon: Zap, title: "Notificações", desc: "Alertas automáticos de vencimento, aniversário e renovação de plano." },
];

const plans = [
  {
    name: "Starter",
    price: "R$ 89",
    period: "/mês",
    highlight: false,
    features: ["Até 100 alunos", "Gestão financeira básica", "Agendamentos", "App do aluno", "Suporte por e-mail"],
  },
  {
    name: "Profissional",
    price: "R$ 179",
    period: "/mês",
    highlight: true,
    features: ["Até 500 alunos", "Financeiro completo", "Avaliação física", "Treinos personalizados", "Multi-professor", "Suporte prioritário"],
  },
  {
    name: "Empresarial",
    price: "R$ 299",
    period: "/mês",
    highlight: false,
    features: ["Alunos ilimitados", "Módulo nutrição", "Módulo fisioterapia", "Relatórios avançados", "API integração", "Suporte 24/7"],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAV */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">
              Fit<span className="text-primary">Core</span>Sys
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-primary transition-colors">Planos</a>
            <a href="#contato" className="hover:text-primary transition-colors">Contato</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Começar grátis
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-32 pb-24 px-4 bg-gradient-to-br from-white via-secondary/30 to-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-secondary px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3.5 h-3.5" /> Sistema completo para academias e studios
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              Gerencie sua academia com{" "}
              <span className="text-primary">inteligência</span> e{" "}
              <span className="text-primary">simplicidade</span>
            </h1>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              O FitCoreSys reúne gestão de alunos, financeiro, treinos, avaliação física e muito mais em uma plataforma moderna e fácil de usar.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/cadastro"
                className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                Teste grátis por 14 dias
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:border-primary hover:text-primary transition-colors"
              >
                Ver funcionalidades
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Cancele quando quiser</span>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Alunos ativos</p>
                    <p className="font-bold text-xl text-gray-900">1.248</p>
                  </div>
                  <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
                </div>
                {[
                  { name: "Ana Carolina", plan: "Musculação", status: "Ativo" },
                  { name: "Pedro Henrique", plan: "Funcional", status: "Ativo" },
                  { name: "Juliana Melo", plan: "Pilates", status: "Vence hoje" },
                  { name: "Roberto Silva", plan: "Personal", status: "Ativo" },
                ].map((a) => (
                  <div key={a.name} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {a.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.plan}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.status === "Ativo" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-4 -right-4 bg-primary text-white rounded-xl px-4 py-3 shadow-lg text-sm font-semibold">
                R$ 18.450 / mês
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "+2.000", label: "Academias parceiras" },
            { value: "+500K", label: "Alunos gerenciados" },
            { value: "99,9%", label: "Uptime garantido" },
            { value: "4.9★", label: "Avaliação média" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="funcionalidades" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">
              Tudo que sua academia precisa
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Uma plataforma completa que cresce junto com o seu negócio.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group p-5 rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all bg-white"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section id="planos" className="py-24 px-4 bg-gradient-to-br from-secondary/20 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">Planos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">
              Escolha o plano ideal
            </h2>
            <p className="text-gray-500 mt-3">Sem taxas ocultas. Cancele quando quiser.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border transition-all ${
                  plan.highlight
                    ? "bg-primary text-white border-primary shadow-2xl shadow-primary/30 scale-105"
                    : "bg-white border-gray-100 hover:border-primary/30 hover:shadow-lg"
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block text-xs font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full mb-4">
                    Mais popular
                  </span>
                )}
                <h3 className={`font-bold text-lg mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-end gap-1 mb-6">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm mb-1 ${plan.highlight ? "text-white/70" : "text-gray-400"}`}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-white/90" : "text-gray-600"}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-white" : "text-primary"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/cadastro"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  Começar agora
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Pronto para transformar sua academia?
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Junte-se a mais de 2.000 academias que já crescem com o FitCoreSys.
          </p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 bg-white text-primary font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-colors shadow-xl"
          >
            Criar conta gratuita <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contato" className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Dumbbell className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg">FitCoreSys</span>
            </div>
            <p className="text-sm leading-relaxed">
              Sistema de gestão completo para academias, studios e personal trainers.
            </p>
          </div>

          <div>
            <p className="font-semibold text-white mb-3">Produto</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
              <li><a href="#planos" className="hover:text-white transition-colors">Planos</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Acessar sistema</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-white mb-3">Legal</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Termos de uso</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
              <li><a href="#" className="hover:text-white transition-colors">LGPD</a></li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-white mb-3">Contato</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> contato@fitcoresys.com.br</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> (31) 9 8961-2625</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Contagem, MG</li>
              <li className="flex items-center gap-2">
                <span className="font-bold text-xs">IG</span>
                <a href="https://www.instagram.com/fitcorestudio" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  @fitcorestudio
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p>© {new Date().getFullYear()} FitCoreSys. Todos os direitos reservados.</p>
          <p>Desenvolvido com ❤️ para o fitness brasileiro</p>
        </div>
      </footer>
    </div>
  );
}
