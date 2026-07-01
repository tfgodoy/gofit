-- Fase 5 — Ajuste pós-validação
-- Adiciona constraint UNIQUE em saas_payments.asaas_payment_id para prevenir
-- duplicação por race condition no webhook. PostgreSQL permite múltiplos NULLs
-- em colunas UNIQUE, então pagamentos manuais (asaas_payment_id IS NULL) continuam
-- funcionando sem restrição.
ALTER TABLE public.saas_payments
  ADD CONSTRAINT IF NOT EXISTS saas_payments_asaas_payment_id_unique
  UNIQUE (asaas_payment_id);
