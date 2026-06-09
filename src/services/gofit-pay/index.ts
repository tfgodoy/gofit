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
export {
  CHARGE_STATUS_LABEL,
  CHARGE_STATUS_COLOR,
  BILLING_TYPE_LABEL,
} from "./types";
