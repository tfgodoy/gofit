import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer } from "lucide-react";

const fmtBRL = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtD   = (s: string) => new Date(s.includes("T") ? s : s + "T12:00:00").toLocaleDateString("pt-BR");

export default function PublicReciboPage() {
  const { token } = useParams<{ token: string }>();
  const [data,    setData]    = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    async function fetch_() {
      const { data: row, error: err } = await supabase
        .from("public_receipts")
        .select("receipt_data")
        .eq("token", token!)
        .maybeSingle();
      if (err || !row) { setError(true); setLoading(false); return; }
      setData(row.receipt_data);
      setLoading(false);
    }
    if (token) fetch_();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
      <p className="text-2xl font-bold text-gray-700">Recibo não encontrado</p>
      <p className="text-sm text-gray-400">O link pode ter expirado ou é inválido.</p>
    </div>
  );

  const {
    nomeLoja, studentNome, studentCpf, reciboNum, dataExtensa,
    currentUserName, totalSelecionado, selectedGroups,
    endereco, razaoSocial, cnpj, fone,
  } = data;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Botão imprimir */}
        <div className="flex justify-end mb-4">
          <button onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>

        {/* Recibo */}
        <div id="recibo-content" className="bg-white rounded-2xl shadow-md p-10 font-sans text-sm text-gray-900">
          <h1 className="text-center text-xl font-bold mb-1">Recibo {nomeLoja?.toUpperCase()}</h1>
          <p className="text-center text-xs text-gray-400 mb-6">Recibo nº {reciboNum}</p>

          <p className="leading-relaxed mb-5">
            <strong>Recebi de</strong>: {studentNome}
            {studentCpf ? `, CPF: ${studentCpf}` : ""},{" "}
            a quantia de <strong>{fmtBRL(totalSelecionado)}</strong>, referente aos pagamentos abaixo:
          </p>

          {/* Grupos */}
          {(selectedGroups ?? []).map((group: any, gi: number) => (
            <div key={gi} className={gi > 0 ? "mt-5 pt-5 border-t border-dashed border-gray-300" : ""}>
              <p className="font-bold text-gray-900 mb-1">{group.label}</p>
              {group.periodo && <p className="text-xs text-gray-400 mb-3">{group.periodo}</p>}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400">
                    <th className="text-left py-1.5 w-7">#</th>
                    <th className="text-left py-1.5">Descrição</th>
                    <th className="text-left py-1.5 whitespace-nowrap">Vencimento</th>
                    <th className="text-left py-1.5 whitespace-nowrap">Recebido em</th>
                    <th className="text-right py-1.5 whitespace-nowrap">Valor pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(group.selItems ?? []).map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-1.5 text-gray-500">{item.parcela_numero ?? idx+1}</td>
                      <td className="py-1.5 text-gray-700">{item.descricao}</td>
                      <td className="py-1.5 text-gray-500 whitespace-nowrap">{fmtD(item.vencimento)}</td>
                      <td className="py-1.5 text-gray-500 whitespace-nowrap">{item.pago_em ? fmtD(item.pago_em) : "—"}</td>
                      <td className="py-1.5 text-right font-semibold text-green-600 whitespace-nowrap">{fmtBRL(Number(item.valor_pago ?? item.valor))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="py-1.5 px-1 font-bold text-gray-700">Subtotal</td>
                    <td className="py-1.5 text-right font-bold text-green-600">
                      {fmtBRL((group.selItems ?? []).reduce((s: number, i: any) => s + Number(i.valor_pago ?? i.valor), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Total geral */}
          {(selectedGroups?.length ?? 0) > 1 && (
            <div className="text-right pt-3 mt-3 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-900">Total recebido: </span>
              <span className="text-sm font-bold text-green-600">{fmtBRL(totalSelecionado)}</span>
            </div>
          )}

          {/* Assinatura */}
          <div className="grid grid-cols-2 gap-8 mt-10">
            <div />
            <div className="text-center">
              <div className="border-t border-gray-600 mb-1" />
              <p className="font-bold text-sm">{currentUserName}</p>
              <p className="text-xs text-gray-500">{dataExtensa}</p>
            </div>
          </div>

          {/* Rodapé empresa */}
          <div className="mt-6 pt-5 border-t border-dashed border-gray-200 text-xs text-gray-500 space-y-0.5">
            {endereco    && <p>{endereco}</p>}
            {razaoSocial && <p>{razaoSocial}</p>}
            {cnpj        && <p>{cnpj}</p>}
            {fone        && <p>{fone}</p>}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Gerado por FitCoreSys · {new Date().getFullYear()}
        </p>
      </div>

      {/* CSS de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          #recibo-content { box-shadow: none; border-radius: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}
