/**
 * GoFit Pay — Service Layer (Fase 5)
 *
 * Exports públicos para uso nos componentes React.
 * AsaasService NÃO é exportado daqui — vive apenas nas Edge Functions.
 */

export { GoFitPayService, GoFitPayNotImplementedError } from "./GoFitPayService";
export { PaymentWebhookService } from "./PaymentWebhookService";
export type {
  // Enums / unions
  AsaasEnvironment,
  AccountStatus,
  ChargeStatus,
  BillingType,
  OnboardingStatus,
  // Entidades
  GoFitPayAccount,
  GoFitPaySettings,
  PaymentCharge,
  PaymentCustomer,
  WebhookEvent,
  // Payloads
  CreateChargePayload,
  CreateAccountPayload,
  EdgeFunctionResponse,
  // Utilitários
} from "./types";
// Fase 12
export type { OverdueItem, CollectionSummary } from "./GoFitPayService";
// Fase 11
export type { GoFitPayFee } from "./GoFitPayService";
// Fase 13
export type { ReportFilters, ReportSummary, BillingTypeStat, ReportCharge, ReportDiscrepancy } from "./GoFitPayService";
// Fase 14
export type { EnvironmentStatus, ProductionReadinessCheck, ProductionReadiness } from "./GoFitPayService";
// Fase 15
export type { PilotResult, RollbackResult } from "./GoFitPayService";
export {
  CHARGE_STATUS_LABEL,
  CHARGE_STATUS_COLOR,
  BILLING_TYPE_LABEL,
} from "./types";
