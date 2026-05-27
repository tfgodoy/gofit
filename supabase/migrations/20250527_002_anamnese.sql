-- ============================================================
-- ANAMNESE MODULE
-- ============================================================

-- Biblioteca de perguntas reutilizáveis
CREATE TABLE IF NOT EXISTS public.anamnese_questoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  pergunta      text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('sim_nao','sim_nao_qual','texto','numero','data','radio','checkbox','select')),
  opcoes        jsonb NOT NULL DEFAULT '[]',
  permite_outro boolean NOT NULL DEFAULT false,
  tem_respostas boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Modelos de anamnese
CREATE TABLE IF NOT EXISTS public.anamnese_modelos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id           uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  descricao               text NOT NULL,
  respondido_pelo_cliente boolean NOT NULL DEFAULT true,
  exigir_aceite           boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Perguntas vinculadas a um modelo (pivot com ordem e obrigatoriedade)
CREATE TABLE IF NOT EXISTS public.anamnese_modelo_questoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id   uuid NOT NULL REFERENCES public.anamnese_modelos(id) ON DELETE CASCADE,
  questao_id  uuid NOT NULL REFERENCES public.anamnese_questoes(id) ON DELETE CASCADE,
  ordem       int NOT NULL DEFAULT 0,
  obrigatoria boolean NOT NULL DEFAULT false
);

-- Instâncias de respostas enviadas aos alunos
CREATE TABLE IF NOT EXISTS public.anamnese_respostas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id        uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  modelo_id            uuid REFERENCES public.anamnese_modelos(id),
  student_id           uuid REFERENCES public.students(id),
  token                text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status               text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','respondido')),
  respondente_nome     text,
  respondente_email    text,
  respondente_telefone text,
  parq                 jsonb NOT NULL DEFAULT '{}',
  aceite               boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  respondido_at        timestamptz
);

-- Itens de resposta (uma linha por pergunta respondida)
CREATE TABLE IF NOT EXISTS public.anamnese_resposta_itens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.anamnese_respostas(id) ON DELETE CASCADE,
  questao_id  uuid NOT NULL REFERENCES public.anamnese_questoes(id),
  valor       jsonb
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_anamnese_questoes_contractor ON public.anamnese_questoes(contractor_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_modelos_contractor  ON public.anamnese_modelos(contractor_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_respostas_contractor ON public.anamnese_respostas(contractor_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_respostas_student    ON public.anamnese_respostas(student_id);
