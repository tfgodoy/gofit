/**
 * Fase 15.2 — Modal "Cartões" (carteira de cartões tokenizados do aluno)
 *
 * Aberto em: Cliente → Mais Ações → Cartões
 *
 * SEGURANÇA:
 *   - número do cartão e CVV existem apenas no estado local deste modal e
 *     são enviados uma única vez à Edge Function (tokenize_student_card);
 *   - campos são limpos imediatamente após o submit (sucesso ou erro);
 *   - nada sensível vai para localStorage/sessionStorage/console/toast;
 *   - a carteira exibe somente dados mascarados (bandeira + últimos 4).
 */

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Plus, Loader2, X, Star, Trash2, Link2, Copy,
  ExternalLink, CheckCircle2, MessageCircle,
} from "lucide-react";
import { GoFitPayService, type StudentCardMasked } from "@/services/gofit-pay/GoFitPayService";
import { toast } from "sonner";

interface Props {
  studentId:   string;
  studentName: string;
  companyName: string;
  onClose:     () => void;
}

const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 " +
  "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function maskCardNumber(raw: string): string {
  return raw.replace(/\D/g, "").substring(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function brandLabel(brand: string | null): string {
  if (!brand) return "Cartão";
  const b = brand.toUpperCase();
  if (b.includes("MASTER")) return "Mastercard";
  if (b.includes("VISA"))   return "Visa";
  if (b.includes("ELO"))    return "Elo";
  if (b.includes("AMEX"))   return "Amex";
  if (b.includes("HIPER"))  return "Hipercard";
  return brand;
}

export default function StudentCardsModal({ studentId, studentName, companyName, onClose }: Props) {
  const [cards, setCards]     = useState<StudentCardMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form — dados sensíveis só vivem aqui até o submit
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cardAlias,  setCardAlias]  = useState("");
  const [expiry,     setExpiry]     = useState(""); // MM/AA
  const [ccv,        setCcv]        = useState("");
  const [isDefault,  setIsDefault]  = useState(false);

  // Link de cadastro
  const [linkLoading, setLinkLoading] = useState(false);
  const [regLink, setRegLink] = useState<{ url: string; expiresAt: string } | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const res = await GoFitPayService.listStudentCards(studentId);
    if (res.success && res.data) setCards(res.data.cards);
    else toast.error(res.error ?? "Erro ao carregar cartões.");
    setLoading(false);
  }, [studentId]);

  useEffect(() => { loadCards(); }, [loadCards]);

  function clearForm() {
    setCardNumber(""); setHolderName(""); setCardAlias("");
    setExpiry(""); setCcv(""); setIsDefault(false);
  }

  async function handleSave() {
    const digits = cardNumber.replace(/\D/g, "");
    const [mm, aa] = expiry.split("/");
    if (digits.length < 13)                 { toast.error("Número do cartão inválido."); return; }
    if (!holderName.trim())                 { toast.error("Informe o nome do titular."); return; }
    if (!mm || !aa || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(aa)) { toast.error("Validade inválida. Use MM/AA."); return; }
    if (ccv.replace(/\D/g, "").length < 3)  { toast.error("CVV inválido."); return; }

    setSaving(true);
    const res = await GoFitPayService.tokenizeStudentCard({
      student_id:   studentId,
      card_number:  digits,
      holder_name:  holderName.trim(),
      expiry_month: mm,
      expiry_year:  aa,
      ccv:          ccv.replace(/\D/g, ""),
      card_alias:   cardAlias.trim() || undefined,
      is_default:   isDefault,
    });
    setSaving(false);
    clearForm(); // sensíveis limpos sempre — sucesso ou erro

    if (!res.success) {
      toast.error(res.error ?? "Erro ao cadastrar cartão.");
      return;
    }
    toast.success("Cartão cadastrado com sucesso!");
    setShowForm(false);
    await loadCards();
  }

  async function handleSetDefault(cardId: string) {
    const res = await GoFitPayService.setDefaultStudentCard(cardId);
    if (!res.success) { toast.error(res.error ?? "Erro ao definir principal."); return; }
    toast.success("Cartão principal atualizado.");
    await loadCards();
  }

  async function handleDeactivate(cardId: string) {
    if (!window.confirm("Remover este cartão da carteira?")) return;
    const res = await GoFitPayService.deactivateStudentCard(cardId);
    if (!res.success) { toast.error(res.error ?? "Erro ao remover cartão."); return; }
    toast.success("Cartão removido.");
    await loadCards();
  }

  async function handleGenerateLink() {
    setLinkLoading(true);
    const res = await GoFitPayService.createCardRegistrationLink(studentId);
    setLinkLoading(false);
    if (!res.success || !res.data) { toast.error(res.error ?? "Erro ao gerar link."); return; }
    setRegLink({ url: res.data.registration_url, expiresAt: res.data.expires_at });
  }

  function copyText(text: string, msg: string) {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(msg))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  const whatsappMsg = regLink
    ? `Olá, ${studentName.split(" ")[0]}. Segue o link para cadastrar seu cartão com segurança no GoFit Pay da ${companyName}: ${regLink.url}`
    : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Cartões</h3>
              <p className="text-xs text-gray-500 mt-0.5">{studentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-0">

          {/* ── Coluna esquerda: Carteira ── */}
          <div className="p-6 border-r border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-700">Carteira</h4>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> NOVO CARTÃO
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : cards.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Nenhum cartão cadastrado.<br />Cadastre pelo formulário ou envie o link ao aluno.
              </p>
            ) : (
              <div className="space-y-3">
                {cards.map(card => (
                  <div key={card.card_id}
                    className={`rounded-xl border px-4 py-3 ${card.is_default ? "border-primary/40 bg-primary/5" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{brandLabel(card.card_brand)}</p>
                        {card.card_alias && <p className="text-xs text-gray-500">{card.card_alias}</p>}
                        <p className="text-sm text-gray-600 tracking-widest mt-1">**** {card.card_last4 ?? "????"}</p>
                        {card.expiry_month && card.expiry_year && (
                          <p className="text-xs text-gray-400">Validade {card.expiry_month}/**</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {card.is_default ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                            <Star className="w-3 h-3 fill-primary" /> Principal
                          </span>
                        ) : (
                          <button onClick={() => handleSetDefault(card.card_id)}
                            className="text-xs text-gray-400 hover:text-primary transition-colors">
                            Tornar principal
                          </button>
                        )}
                        <button onClick={() => handleDeactivate(card.card_id)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Link para cadastro */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-400" /> Link para cadastro
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Facilite o cadastro do cartão de crédito enviando um link direto para o seu cliente.
              </p>
              {!regLink ? (
                <button
                  onClick={handleGenerateLink}
                  disabled={linkLoading}
                  className="inline-flex items-center gap-2 border border-primary text-primary text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {linkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  GERAR LINK
                </button>
              ) : (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-gray-600 break-all">{regLink.url}</p>
                  <p className="text-[11px] text-gray-400">
                    Válido até {new Date(regLink.expiresAt).toLocaleString("pt-BR")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copyText(regLink.url, "Link copiado!")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                    <button onClick={() => window.open(regLink.url, "_blank")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Abrir
                    </button>
                    <button onClick={() => copyText(whatsappMsg, "Mensagem copiada!")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 hover:underline">
                      <MessageCircle className="w-3 h-3" /> Copiar mensagem WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Coluna direita: Novo cartão ── */}
          <div className="p-6">
            {!showForm ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
                <CreditCard className="w-10 h-10 text-gray-200" />
                <p className="text-sm text-gray-400">Selecione "+ Novo cartão" para<br />cadastrar um cartão do aluno.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-700">Novo cartão</h4>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Número</label>
                  <input
                    inputMode="numeric" autoComplete="off"
                    value={cardNumber}
                    onChange={e => setCardNumber(maskCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nome do titular</label>
                  <input
                    autoComplete="off"
                    value={holderName}
                    onChange={e => setHolderName(e.target.value)}
                    placeholder="Como impresso no cartão"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Apelido do cartão</label>
                  <input
                    value={cardAlias}
                    onChange={e => setCardAlias(e.target.value)}
                    placeholder="Ex.: nubank virtual"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Data de validade</label>
                    <input
                      inputMode="numeric" autoComplete="off"
                      value={expiry}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, "").substring(0, 4);
                        setExpiry(d.length > 2 ? `${d.substring(0, 2)}/${d.substring(2)}` : d);
                      }}
                      placeholder="MM/AA"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">CVV</label>
                    <input
                      inputMode="numeric" autoComplete="off" type="password"
                      value={ccv}
                      onChange={e => setCcv(e.target.value.replace(/\D/g, "").substring(0, 4))}
                      placeholder="•••"
                      className={inputCls}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 pt-1 cursor-pointer">
                  <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary/30" />
                  Utilizar cartão como principal
                </label>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    onClick={() => { clearForm(); setShowForm(false); }}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
