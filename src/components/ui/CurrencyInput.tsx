import React, { useState, useEffect, useRef } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor numérico atual (ex: 440.00) */
  value: string;
  /** Chamado com a string formatada ao mudar (ex: "440,00") */
  onChange: (formatted: string) => void;
  className?: string;
}

/**
 * Input monetário estilo caixa eletrônico:
 * - Aceita apenas dígitos
 * - Preenche da direita para esquerda (últimos 2 dígitos = centavos)
 * - Ex: digitar 3,0,0 → "3,00" | digitar 4,4,0,0,0 → "440,00"
 */
export function CurrencyInput({ value, onChange, className, ...rest }: CurrencyInputProps) {
  // Extrai só os dígitos do valor recebido
  function toRawDigits(v: string): string {
    const digits = (v ?? "").replace(/\D/g, "");
    // Remove zeros à esquerda mas mantém pelo menos um
    return digits.replace(/^0+(\d)/, "$1") || "";
  }

  const [raw, setRaw] = useState(() => toRawDigits(value));
  const prevValue = useRef(value);

  // Sincroniza quando o pai muda o valor externamente (ex: limpar form)
  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      setRaw(toRawDigits(value));
    }
  }, [value]);

  function formatDisplay(digits: string): string {
    if (!digits) return "";
    const num = parseInt(digits, 10);
    return (num / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    // Limita a 10 dígitos (R$ 99.999.999,99)
    const clamped = digits.slice(0, 10);
    setRaw(clamped);
    const formatted = formatDisplay(clamped);
    prevValue.current = formatted;
    onChange(formatted);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newRaw = raw.slice(0, -1);
      setRaw(newRaw);
      const formatted = formatDisplay(newRaw);
      prevValue.current = formatted;
      onChange(formatted);
    }
  }

  const display = formatDisplay(raw);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      autoComplete="off"
    />
  );
}

/**
 * Converte a string formatada pt-BR do CurrencyInput ("2.935,80") em número (2935.8).
 * Use sempre este helper ao salvar — parseFloat direto corta nos separadores
 * ("978,60" → 978; "2.935,80" → 2.935).
 */
export function parseBRL(v: string): number {
  const n = parseFloat((v ?? "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export default CurrencyInput;
