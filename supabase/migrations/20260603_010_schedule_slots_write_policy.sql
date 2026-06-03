-- Permite que o app crie, edite e cancele aulas geradas pelas grades.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_slots'
      AND policyname = 'schedule_slots_anon_all'
  ) THEN
    CREATE POLICY "schedule_slots_anon_all"
      ON public.schedule_slots
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

WITH dias AS (
  SELECT generate_series(current_date, current_date + interval '89 days', interval '1 day')::date AS data
),
grades_sem_aulas AS (
  SELECT g.*
  FROM public.schedule_grids g
  WHERE g.ativo = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.schedule_slots s
      WHERE s.grid_id = g.id
        AND s.data >= current_date
    )
)
INSERT INTO public.schedule_slots (
  contractor_id,
  grid_id,
  modalidade_id,
  modalidade_nome,
  staff_id,
  staff_nome,
  tipo,
  unit_id,
  unit_nome,
  data,
  hora_inicio,
  hora_fim,
  capacidade_maxima,
  cor,
  status
)
SELECT
  g.contractor_id,
  g.id,
  g.modalidade_id,
  g.modalidade_nome,
  g.staff_id,
  g.staff_nome,
  g.tipo,
  g.unit_id,
  g.unit_nome,
  d.data,
  g.hora_inicio,
  g.hora_fim,
  g.capacidade_maxima,
  g.cor,
  'agendado'
FROM grades_sem_aulas g
CROSS JOIN dias d
WHERE (
  CASE EXTRACT(DOW FROM d.data)::int
    WHEN 0 THEN 'dom'
    WHEN 1 THEN 'seg'
    WHEN 2 THEN 'ter'
    WHEN 3 THEN 'qua'
    WHEN 4 THEN 'qui'
    WHEN 5 THEN 'sex'
    WHEN 6 THEN 'sab'
  END
) = ANY(g.dias_semana)
AND NOT EXISTS (
  SELECT 1
  FROM public.schedule_slots s
  WHERE s.grid_id = g.id
    AND s.data = d.data
    AND s.hora_inicio = g.hora_inicio
);
