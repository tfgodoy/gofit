CREATE TABLE IF NOT EXISTS public.contas_financeiras (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id     uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  descricao         text        NOT NULL,
  tipo              text        NOT NULL CHECK (tipo IN ('conta_corrente', 'conta_poupanca', 'outro')),
  banco_codigo      text,
  banco_nome        text,
  agencia           text,
  agencia_digito    text,
  conta             text,
  conta_digito      text,
  titular_diferente boolean     NOT NULL DEFAULT false,
  titular_nome      text,
  titular_cpf       text,
  ativo             boolean     NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all anon" ON public.contas_financeiras
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX ON public.contas_financeiras (contractor_id);
