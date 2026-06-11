import AppLayout from "@/components/app/AppLayout";
import { GitMerge, Upload, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function ConciliarExtratoPag() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Conciliar extrato</h1>
              <p className="text-xs text-gray-400">Importe o extrato do banco e confira com os lançamentos do sistema</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-8">

          {/* Como funciona */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Como funciona a conciliação?</h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  step: "1",
                  icon: Upload,
                  color: "blue",
                  title: "Importe o extrato",
                  desc: "Exporte o extrato do seu banco em formato OFX ou CSV e importe aqui. Todos os bancos brasileiros suportam esse formato.",
                },
                {
                  step: "2",
                  icon: GitMerge,
                  color: "purple",
                  title: "Sistema cruza automaticamente",
                  desc: "O GoFit compara cada transação do extrato com os lançamentos registrados — por valor, data e horário.",
                },
                {
                  step: "3",
                  icon: CheckCircle,
                  color: "green",
                  title: "Revise e confirme",
                  desc: "Transações que batem ficam marcadas em verde. As que sobram indicam lançamentos faltando ou valores divergentes.",
                },
              ].map(({ step, icon: Icon, color, title, desc }) => (
                <div key={step} className="flex gap-4">
                  <div className={`w-8 h-8 rounded-full bg-${color}-100 text-${color}-600 flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                    {step}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 text-${color}-500`} />
                      <p className="text-sm font-semibold text-gray-800">{title}</p>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legenda dos status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4">O que cada status significa?</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: CheckCircle, color: "green",  label: "Conciliado",         desc: "Transação do extrato bateu com um lançamento do sistema (valor + data)" },
                { icon: AlertCircle, color: "red",    label: "Não encontrado",      desc: "Transação no extrato sem lançamento correspondente — falta lançar no GoFit" },
                { icon: Clock,       color: "yellow", label: "Divergência de valor", desc: "Data bate mas o valor é diferente — possível taxa, IOF ou erro de digitação" },
              ].map(({ icon: Icon, color, label, desc }) => (
                <div key={label} className={`flex gap-3 p-3 rounded-lg bg-${color}-50 border border-${color}-100`}>
                  <Icon className={`w-5 h-5 text-${color}-500 flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-sm font-semibold text-${color}-700`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload área — Em desenvolvimento */}
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center">
              <FileText className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-700">Importação de extrato</p>
              <p className="text-sm text-gray-400 mt-1">Em desenvolvimento — disponível em breve</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2">
              <span>Formatos que serão suportados:</span>
              <span className="font-semibold text-gray-600">OFX · CSV · TXT</span>
            </div>
            <button
              disabled
              className="mt-2 inline-flex items-center gap-2 bg-green-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg opacity-40 cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Importar extrato
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
