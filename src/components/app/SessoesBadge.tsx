import { useMemo } from "react";
import { ResultadoVerificacao } from "@/hooks/useVerificarSessoes";

interface SessoesBadgeProps {
  resultado: ResultadoVerificacao | null;
  className?: string;
}

/**
 * Componente de badge que exibe progresso de sessões do aluno
 * Mostra: "📅 2/3 sessões" ou "⚡ 5/10 sessões" se conjunto
 */
export function SessoesBadge({ resultado, className = "" }: SessoesBadgeProps) {
  if (!resultado || resultado.sessoes_limite === 0) {
    return null;
  }

  const percentual = useMemo(() => {
    return (resultado.sessoes_usadas / resultado.sessoes_limite) * 100;
  }, [resultado]);

  const isConjunto = resultado.contabilizar_conjunto;
  const icon = isConjunto ? "⚡" : "📅";

  const corClasses = useMemo(() => {
    if (percentual >= 100) {
      return "bg-red-100 text-red-700 border-red-200";
    } else if (percentual >= 75) {
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    } else {
      return "bg-green-100 text-green-700 border-green-200";
    }
  }, [percentual]);

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${corClasses} ${className}`}
      title={resultado.motivo}
    >
      {icon} {resultado.sessoes_usadas}/{resultado.sessoes_limite}
    </span>
  );
}
