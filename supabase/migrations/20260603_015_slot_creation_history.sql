CREATE OR REPLACE FUNCTION public.log_schedule_slot_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.schedule_slot_history (
    contractor_id,
    slot_id,
    evento,
    descricao,
    dados,
    criado_por,
    created_at
  )
  VALUES (
    NEW.contractor_id,
    NEW.id,
    'aula_criada',
    'Aula criada na agenda.',
    jsonb_build_object(
      'grid_id', NEW.grid_id,
      'modalidade_id', NEW.modalidade_id,
      'modalidade_nome', NEW.modalidade_nome,
      'staff_id', NEW.staff_id,
      'staff_nome', NEW.staff_nome,
      'unit_id', NEW.unit_id,
      'unit_nome', NEW.unit_nome,
      'data', NEW.data,
      'hora_inicio', NEW.hora_inicio,
      'hora_fim', NEW.hora_fim,
      'capacidade_maxima', NEW.capacidade_maxima,
      'status', NEW.status
    ),
    'sistema',
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_slots_created_history
  ON public.schedule_slots;

CREATE TRIGGER trg_schedule_slots_created_history
  AFTER INSERT ON public.schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.log_schedule_slot_created();
