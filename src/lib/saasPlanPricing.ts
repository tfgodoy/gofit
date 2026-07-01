// Cálculo de precificação dos planos SaaS da GoFit (Financeiro SaaS — GoFit cobrando a academia).
// annual_price e o equivalente mensal NUNCA são persistidos no banco — sempre derivados
// de price_monthly + annual_discount_percent, para nunca ficarem desalinhados.

export interface PlanPricingInput {
  price_monthly: number;
  annual_discount_percent: number;
}

export interface PlanPricingResult {
  monthlyPrice: number;
  annualPriceGross: number;
  annualDiscountPercent: number;
  annualPriceWithDiscount: number;
  annualMonthlyEquivalent: number;
}

export function computePlanPricing(plan: PlanPricingInput): PlanPricingResult {
  const monthlyPrice = plan.price_monthly;
  const annualDiscountPercent = plan.annual_discount_percent;
  const annualPriceGross = monthlyPrice * 12;
  const annualPriceWithDiscount = annualPriceGross * (1 - annualDiscountPercent / 100);
  const annualMonthlyEquivalent = annualPriceWithDiscount / 12;

  return {
    monthlyPrice,
    annualPriceGross,
    annualDiscountPercent,
    annualPriceWithDiscount,
    annualMonthlyEquivalent,
  };
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
