import React from "react";
import { Shield, FlaskConical } from "lucide-react";

interface GoFitPayEnvironmentBadgeProps {
  environment: "sandbox" | "production" | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export function GoFitPayEnvironmentBadge({
  environment,
  size = "sm",
  className = "",
}: GoFitPayEnvironmentBadgeProps) {
  if (!environment) return null;

  const isProduction = environment === "production";

  const base =
    size === "md"
      ? "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
      : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border";

  const colors = isProduction
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  const Icon = isProduction ? Shield : FlaskConical;
  const iconSize = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  const label = isProduction ? "PRODUÇÃO" : "SANDBOX";

  return (
    <span className={`${base} ${colors} ${className}`}>
      <Icon className={iconSize} />
      {label}
    </span>
  );
}
