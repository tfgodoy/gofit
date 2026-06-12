/**
 * Fase 15.4 — Status visual para cobranças integradas ao GoFit Pay.
 *
 * Esta camada é APENAS visual/operacional: nunca altera o status real da
 * receivable nem a regra de baixa (CONFIRMED não baixa; RECEIVED baixa).
 *
 * Exibe somente dados não sensíveis: card_brand, card_last4,
 * provider_charge_id, gateway_status, billing_type, charge_mode.
 */

export interface GatewayChargeInfo {
  status:               string | null;
  billing_type:         string | null;
  charge_mode:          string | null;
  card_brand:           string | null;
  card_last4:           string | null;
  provider_charge_id:   string | null;
  invoice_url:          string | null;
  provider_environment: string | null;
}

export interface ReceivableGatewayView {
  status:           string;
  vencimento:       string;
  gateway_status?:  string | null;
  asaas_payment_id?: string | null;
}

export interface DisplayStatus {
  /** Badge curta (ex.: "Cartão aprovado") */
  label:       string;
  /** Texto explicativo para tooltip/detalhe */
  description: string;
  /** Classes tailwind do badge */
  bg:          string;
  text:        string;
  /** Menor = mais prioritário */
  priority:    number;
  /** Cartão mascarado, quando disponível (ex.: "VISA **** 4444") */
  cardMasked?: string;
}

const FAIL_STATUSES = ["FAILED", "REFUSED", "ERROR", "CHARGEBACK", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED"];

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Resolve o status visual do gateway para uma receivable.
 * Retorna null quando não há nada do gateway a exibir além do status financeiro
 * (ex.: receivable paga manualmente sem cobrança, ou cancelada).
 */
export function getReceivableDisplayStatus(
  r: ReceivableGatewayView,
  charge?: GatewayChargeInfo | null
): DisplayStatus | null {
  const gwStatus   = (charge?.status ?? r.gateway_status ?? "").toUpperCase();
  const hasGateway = !!(r.asaas_payment_id || charge?.provider_charge_id);
  const cardMasked = charge?.card_brand && charge?.card_last4
    ? `${charge.card_brand} **** ${charge.card_last4}`
    : undefined;
  const vencido = r.status !== "pago" && r.status !== "cancelado" && r.vencimento < todayISO();

  // 1. Pago — destaque de origem quando veio do gateway
  if (r.status === "pago") {
    if (hasGateway) {
      return {
        label: "Pago via GoFit Pay",
        description: "Pagamento confirmado pelo gateway e baixado automaticamente.",
        bg: "bg-green-100", text: "text-green-700", priority: 1, cardMasked,
      };
    }
    return null; // badge financeira "Recebido" já cobre
  }

  // 2. Cancelado financeiro — badge financeira cobre
  if (r.status === "cancelado") return null;

  // 3. Falha no gateway
  if (FAIL_STATUSES.includes(gwStatus)) {
    return {
      label: "Falha na cobrança",
      description: "O gateway reportou falha nesta cobrança. Ação necessária.",
      bg: "bg-red-100", text: "text-red-700", priority: 3, cardMasked,
    };
  }

  // 4. Cartão aprovado (CONFIRMED) — aguardando liquidação
  if (gwStatus === "CONFIRMED") {
    return {
      label: vencido ? "Cartão aprovado (vencida)" : "Cartão aprovado",
      description:
        "Cartão aprovado pelo gateway. A baixa financeira será feita automaticamente quando o Asaas confirmar o recebimento (liquidação).",
      bg: "bg-purple-100", text: "text-purple-700", priority: 4, cardMasked,
    };
  }

  // 5. Cancelada no gateway, financeiro ainda pendente
  if (gwStatus === "CANCELLED" || gwStatus === "REFUNDED") {
    return {
      label: "Cobrança cancelada",
      description: "A cobrança foi cancelada no gateway, mas o financeiro continua pendente. Emita nova cobrança se necessário.",
      bg: "bg-gray-100", text: "text-gray-600", priority: 5, cardMasked,
    };
  }

  // 6. Vencida
  if (vencido) {
    if (hasGateway) {
      return {
        label: "Vencida — cobrança enviada",
        description: "Cobrança enviada ao Asaas, mas o vencimento passou sem pagamento.",
        bg: "bg-red-100", text: "text-red-600", priority: 6, cardMasked,
      };
    }
    return null; // badge financeira "Atrasado" cobre
  }

  // 7. Pendente com cobrança no gateway
  if (hasGateway) {
    const bt = (charge?.billing_type ?? "").toUpperCase();
    if (bt === "PIX") {
      return {
        label: "Pix aguardando",
        description: "Cobrança Pix enviada ao Asaas. Aguardando pagamento.",
        bg: "bg-blue-100", text: "text-blue-700", priority: 7,
      };
    }
    if (bt === "BOLETO") {
      return {
        label: "Boleto aguardando",
        description: "Boleto enviado ao Asaas. Aguardando pagamento.",
        bg: "bg-blue-100", text: "text-blue-700", priority: 7,
      };
    }
    if (bt === "CREDIT_CARD") {
      return {
        label: "Cartão pendente",
        description: "Cobrança de cartão enviada ao Asaas. Aguardando confirmação do gateway.",
        bg: "bg-blue-100", text: "text-blue-700", priority: 7, cardMasked,
      };
    }
    return {
      label: "Cobrança enviada",
      description: "Cobrança enviada ao Asaas. Aguardando pagamento ou atualização de status.",
      bg: "bg-blue-100", text: "text-blue-700", priority: 7, cardMasked,
    };
  }

  // 8. Pendente sem cobrança gateway
  return {
    label: "Sem cobrança",
    description: "Sem cobrança GoFit Pay emitida para esta parcela.",
    bg: "bg-gray-100", text: "text-gray-400", priority: 8,
  };
}

/** Label do modo de cobrança para exibição. */
export function chargeModeLabel(mode: string | null | undefined): string {
  if (mode === "tokenized_card") return "Cartão tokenizado";
  if (mode === "invoice_url")    return "Link de fatura";
  return "—";
}
