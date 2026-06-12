/**
 * Fase 15.2 — Página pública de cadastro de cartão via link seguro
 * Rota: /aluno/cartao/:token
 *
 * SEGURANÇA:
 *   - valida o token na Edge Function (hash + expiração + revogação + uso único);
 *   - exibe apenas nome parcial do aluno e nome da empresa;
 *   - número do cartão e CVV vão apenas no body da invocação — nunca em
 *     estado global, storage, log ou URL;
 *   - campos limpos após o submit;
 *   - contractor/student são resolvidos server-side pelo token — nada
 *     manipulável pelo aluno.
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CreditCard, Loader2, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { GoFitPayService, type CardLinkValidation } from "@/services/gofit-pay/GoFitPayService";

const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 " +
  "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function maskCardNumber(raw: string): string {
  return raw.replace(/\D/g, "").substring(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export default function CardRegistrationPage() {
  const { token } = useParams<{ token: string }>();

  const [validating, setValidating] = useState(true);
  const [linkInfo, setLinkInfo] = useState<CardLinkValidation | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cardAlias,  setCardAlias]  = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [ccv,        setCcv]        = useState("");

  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState<{ brand: string | null; last4: string | null } | null>(null);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    GoFitPayService.validateCardRegistrationLink(token).then(res => {
      setLinkInfo(res.success && res.data ? res.data : { valid: false, reason: res.error });
      setValidating(false);
    });
  }, [token]);

  async function handleSubmit() {
    setFormErr("");
    const digits = cardNumber.replace(/\D/g, "");
    const [mm, aa] = expiry.split("/");
    if (digits.length < 13)                { setFormErr("Número do cartão inválido."); return; }
    if (!holderName.trim())                { setFormErr("Informe o nome do titular."); return; }
    if (!mm || !aa || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(aa)) { setFormErr("Validade inválida. Use MM/AA."); return; }
    if (ccv.replace(/\D/g, "").length < 3) { setFormErr("CVV inválido."); return; }

    setSaving(true);
    const res = await GoFitPayService.tokenizeCardFromLink({
      token:        token!,
      card_number:  digits,
      holder_name:  holderName.trim(),
      expiry_month: mm,
      expiry_year:  aa,
      ccv:          ccv.replace(/\D/g, ""),
      card_alias:   cardAlias.trim() || undefined,
    });
    setSaving(false);

    // Limpa sensíveis sempre — sucesso ou erro
    setCardNumber(""); setCcv(""); setExpiry("");

    if (!res.success || !res.data) {
      setFormErr(res.error ?? "Não foi possível cadastrar o cartão. Tente novamente.");
      return;
    }
    setDone({ brand: res.data.card_brand, last4: res.data.card_last4 });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-6 space-y-5">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Cadastro de cartão</h1>
            <p className="text-xs text-gray-400">GoFit Pay — pagamento seguro</p>
          </div>
        </div>

        {validating ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !linkInfo?.valid ? (
          <div className="text-center py-8 space-y-3">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-700">Link inválido</p>
            <p className="text-xs text-gray-400">
              {linkInfo?.reason ?? "Este link não está mais disponível."}<br />
              Solicite um novo link à sua academia.
            </p>
          </div>
        ) : done ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Cartão cadastrado com sucesso!</p>
            <p className="text-sm text-gray-500">
              {done.brand ?? "Cartão"} terminado em <strong>{done.last4 ?? "????"}</strong>
            </p>
            <p className="text-xs text-gray-400">Você já pode fechar esta página.</p>
          </div>
        ) : (
          <>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-700">
                Olá, <strong>{linkInfo.student_name}</strong>! Cadastre seu cartão com
                segurança para <strong>{linkInfo.company_name}</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Número do cartão</label>
                <input inputMode="numeric" autoComplete="cc-number" value={cardNumber}
                  onChange={e => setCardNumber(maskCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome do titular</label>
                <input autoComplete="cc-name" value={holderName}
                  onChange={e => setHolderName(e.target.value)}
                  placeholder="Como impresso no cartão" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Apelido do cartão (opcional)</label>
                <input value={cardAlias} onChange={e => setCardAlias(e.target.value)}
                  placeholder="Ex.: meu cartão principal" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Validade</label>
                  <input inputMode="numeric" autoComplete="cc-exp" value={expiry}
                    onChange={e => {
                      const d = e.target.value.replace(/\D/g, "").substring(0, 4);
                      setExpiry(d.length > 2 ? `${d.substring(0, 2)}/${d.substring(2)}` : d);
                    }}
                    placeholder="MM/AA" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">CVV</label>
                  <input inputMode="numeric" type="password" autoComplete="off" value={ccv}
                    onChange={e => setCcv(e.target.value.replace(/\D/g, "").substring(0, 4))}
                    placeholder="•••" className={inputCls} />
                </div>
              </div>

              {formErr && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {formErr}
                </p>
              )}

              <button onClick={handleSubmit} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-bold px-4 py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {saving ? "Cadastrando..." : "CADASTRAR CARTÃO"}
              </button>

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                <ShieldCheck className="w-3 h-3 inline mr-1" />
                Seus dados são enviados com criptografia diretamente ao processador de
                pagamentos. O número completo do cartão e o CVV não ficam armazenados.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
