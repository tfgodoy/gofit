-- Fase 1 - Engine SQL de verificacao de sessoes do aluno.

CREATE OR REPLACE FUNCTION public.verificar_sessoes_aluno(
  p_contractor_id uuid,
  p_student_id uuid,
  p_student_contract_id uuid,
  p_modalidade_id uuid DEFAULT NULL,
  p_data_aula date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_contrato record;
  v_modalidade record;
  v_sessoes_usadas numeric := 0;
  v_limite numeric := 0;
  v_data_inicio_periodo date;
  v_data_fim_periodo date;
  v_conjunto boolean := false;
  v_tipo_acesso text := 'padrao';
BEGIN
  SELECT sc.*, c.contabilizar_sessoes_conjunto
  INTO v_contrato
  FROM public.student_contracts sc
  JOIN public.contratos c ON c.id = sc.contrato_id
  WHERE sc.id = p_student_contract_id
    AND sc.student_id = p_student_id
    AND sc.contractor_id = p_contractor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'permitido', false,
      'motivo', 'Contrato nao encontrado',
      'sessoes_usadas', 0,
      'sessoes_limite', 0,
      'sessoes_restantes', 0
    );
  END IF;

  SELECT *
  INTO v_modalidade
  FROM public.contrato_modalidades
  WHERE contrato_id = v_contrato.contrato_id
    AND (
      p_modalidade_id IS NULL
      OR modalidade_id = p_modalidade_id
    )
  ORDER BY
    CASE WHEN modalidade_id = p_modalidade_id THEN 0 ELSE 1 END,
    created_at
  LIMIT 1;

  IF NOT FOUND OR COALESCE(v_modalidade.tipo_acesso, 'padrao') IN ('padrao', 'gonutri') THEN
    RETURN jsonb_build_object(
      'permitido', true,
      'motivo', 'Acesso padrao livre',
      'sessoes_usadas', 0,
      'sessoes_limite', 0,
      'sessoes_restantes', 0,
      'contabilizar_conjunto', COALESCE(v_contrato.contabilizar_sessoes_conjunto, false)
    );
  END IF;

  v_tipo_acesso := COALESCE(v_modalidade.tipo_acesso, 'padrao');
  v_conjunto := COALESCE(v_contrato.contabilizar_sessoes_conjunto, false);

  IF v_tipo_acesso = 'pacote_aulas' THEN
    v_data_inicio_periodo := v_contrato.data_inicio;
    v_data_fim_periodo := COALESCE(v_contrato.data_fim, '9999-12-31'::date);

    IF v_conjunto OR p_modalidade_id IS NULL THEN
      SELECT COALESCE(SUM(u.quantidade), 0)
      INTO v_sessoes_usadas
      FROM public.schedule_session_usage u
      JOIN public.schedule_slots s ON s.id = u.slot_id
      WHERE u.contractor_id = p_contractor_id
        AND u.student_id = p_student_id
        AND u.student_contract_id = p_student_contract_id
        AND u.estornado = false
        AND s.data BETWEEN v_data_inicio_periodo AND v_data_fim_periodo;

      SELECT COALESCE(MAX(total_aulas), 0)
      INTO v_limite
      FROM public.contrato_modalidades
      WHERE contrato_id = v_contrato.contrato_id
        AND total_aulas IS NOT NULL;
    ELSE
      SELECT COALESCE(SUM(u.quantidade), 0)
      INTO v_sessoes_usadas
      FROM public.schedule_session_usage u
      JOIN public.schedule_slots s ON s.id = u.slot_id
      WHERE u.contractor_id = p_contractor_id
        AND u.student_id = p_student_id
        AND u.student_contract_id = p_student_contract_id
        AND u.modalidade_id = p_modalidade_id
        AND u.estornado = false
        AND s.data BETWEEN v_data_inicio_periodo AND v_data_fim_periodo;

      v_limite := COALESCE(v_modalidade.total_aulas, 0);
    END IF;
  ELSE
    v_data_inicio_periodo := date_trunc('week', p_data_aula)::date;
    v_data_fim_periodo := v_data_inicio_periodo + 6;

    IF v_conjunto OR p_modalidade_id IS NULL THEN
      SELECT COALESCE(SUM(u.quantidade), 0)
      INTO v_sessoes_usadas
      FROM public.schedule_session_usage u
      JOIN public.schedule_slots s ON s.id = u.slot_id
      WHERE u.contractor_id = p_contractor_id
        AND u.student_id = p_student_id
        AND u.student_contract_id = p_student_contract_id
        AND u.estornado = false
        AND s.data BETWEEN v_data_inicio_periodo AND v_data_fim_periodo;

      SELECT COALESCE(MAX(sessoes_por_semana), 0)
      INTO v_limite
      FROM public.contrato_modalidades
      WHERE contrato_id = v_contrato.contrato_id
        AND sessoes_por_semana IS NOT NULL;
    ELSE
      SELECT COALESCE(SUM(u.quantidade), 0)
      INTO v_sessoes_usadas
      FROM public.schedule_session_usage u
      JOIN public.schedule_slots s ON s.id = u.slot_id
      WHERE u.contractor_id = p_contractor_id
        AND u.student_id = p_student_id
        AND u.student_contract_id = p_student_contract_id
        AND u.modalidade_id = p_modalidade_id
        AND u.estornado = false
        AND s.data BETWEEN v_data_inicio_periodo AND v_data_fim_periodo;

      v_limite := COALESCE(v_modalidade.sessoes_por_semana, 0);
    END IF;
  END IF;

  IF COALESCE(v_limite, 0) = 0 THEN
    RETURN jsonb_build_object(
      'permitido', true,
      'motivo', 'Sem limite configurado',
      'sessoes_usadas', v_sessoes_usadas,
      'sessoes_limite', 0,
      'sessoes_restantes', 0,
      'tipo_acesso', v_tipo_acesso,
      'contabilizar_conjunto', v_conjunto,
      'periodo_inicio', v_data_inicio_periodo,
      'periodo_fim', v_data_fim_periodo
    );
  END IF;

  IF v_sessoes_usadas < v_limite THEN
    RETURN jsonb_build_object(
      'permitido', true,
      'motivo', 'Dentro do limite',
      'sessoes_usadas', v_sessoes_usadas,
      'sessoes_limite', v_limite,
      'sessoes_restantes', v_limite - v_sessoes_usadas,
      'tipo_acesso', v_tipo_acesso,
      'contabilizar_conjunto', v_conjunto,
      'periodo_inicio', v_data_inicio_periodo,
      'periodo_fim', v_data_fim_periodo
    );
  END IF;

  RETURN jsonb_build_object(
    'permitido', false,
    'motivo', CASE
      WHEN v_tipo_acesso = 'pacote_aulas' THEN 'Limite de aulas do pacote atingido'
      ELSE 'Limite de sessoes atingido para este periodo'
    END,
    'sessoes_usadas', v_sessoes_usadas,
    'sessoes_limite', v_limite,
    'sessoes_restantes', 0,
    'tipo_acesso', v_tipo_acesso,
    'contabilizar_conjunto', v_conjunto,
    'periodo_inicio', v_data_inicio_periodo,
    'periodo_fim', v_data_fim_periodo
  );
END;
$$;
