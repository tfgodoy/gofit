import { useState } from "react";

interface CEPData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export function useCEP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCEP(cep: string): Promise<CEPData | null> {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setError("CEP inválido");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data: CEPData = await res.json();
      if (data.erro) {
        setError("CEP não encontrado");
        return null;
      }
      return data;
    } catch {
      setError("Erro ao buscar CEP");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { fetchCEP, loading, error };
}
