-- Fase 3: Configuracao de comissao na grade + funcao de calculo automatico

ALTER TABLE schedule_grids
  ADD COLUMN IF NOT EXISTS comissionar_instrutor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_comissao text CHECK (tipo_comissao IN ('por_aula', 'por_cliente')),
  ADD COLUMN IF NOT EXISTS valor_comissao_centavos integer,
  ADD COLUMN IF NOT EXISTS min_clientes_comissao integer,
  ADD COLUMN IF NOT EXISTS considera_faltantes_comissao boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION calcular_comissao_aula(p_slot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot record;
  v_count integer;
  v_valor numeric;
  v_commission_id uuid;
BEGIN
  SELECT
    s.data,
    s.hora_inicio,
    s.modalidade_nome,
    s.contractor_id,
    g.staff_id,
    g.staff_nome,
    g.comissionar_instrutor,
    g.tipo_comissao,
    g.valor_comissao_centavos,
    g.min_clientes_comissao,
    g.considera_faltantes_comissao
  INTO v_slot
  FROM schedule_slots s
  JOIN schedule_grids g ON g.id = s.grid_id
  WHERE s.id = p_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('gerou', false, 'motivo', 'Slot nao encontrado');
  END IF;

  IF NOT v_slot.comissionar_instrutor THEN
    RETURN jsonb_build_object('gerou', false, 'motivo', 'Grade nao comissiona instrutor');
  END IF;

  IF v_slot.staff_id IS NULL THEN
    RETURN jsonb_build_object('gerou', false, 'motivo', 'Sem instrutor vinculado a grade');
  END IF;

  IF v_slot.valor_comissao_centavos IS NULL OR v_slot.valor_comissao_centavos <= 0 THEN
    RETURN jsonb_build_object('gerou', false, 'motivo', 'Valor de comissao nao configurado');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM bookings
  WHERE slot_id = p_slot_id
    AND (
      status = 'presente'
      OR (v_slot.considera_faltantes_comissao = true AND status = 'faltou')
    );

  IF v_slot.min_clientes_comissao IS NOT NULL AND v_count < v_slot.min_clientes_comissao THEN
    RETURN jsonb_build_object(
      'gerou', false,
      'motivo', 'Abaixo do minimo de ' || v_slot.min_clientes_comissao || ' alunos (teve ' || v_count || ')'
    );
  END IF;

  IF v_slot.tipo_comissao = 'por_aula' THEN
    v_valor := v_slot.valor_comissao_centavos::numeric / 100;
  ELSIF v_slot.tipo_comissao = 'por_cliente' THEN
    v_valor := (v_slot.valor_comissao_centavos * v_count)::numeric / 100;
  ELSE
    RETURN jsonb_build_object('gerou', false, 'motivo', 'Tipo de comissao nao definido');
  END IF;

  INSERT INTO commissions (
    contractor_id,
    staff_id,
    student_id,
    student_nome,
    tipo,
    descricao,
    valor_base,
    percentual,
    valor_comissao,
    status,
    referencia_id
  )
  SELECT
    v_slot.contractor_id,
    v_slot.staff_id,
    NULL,
    NULL,
    'aula',
    'Aula: ' || COALESCE(v_slot.modalidade_nome, 'Sem modalidade')
      || ' - ' || to_char(v_slot.data::date, 'DD/MM/YYYY')
      || ' ' || v_slot.hora_inicio
      || CASE WHEN v_slot.tipo_comissao = 'por_cliente'
        THEN ' (' || v_count || ' aluno' || CASE WHEN v_count != 1 THEN 's' ELSE '' END || ')'
        ELSE ''
      END,
    v_valor,
    100,
    v_valor,
    'pendente',
    p_slot_id
  WHERE NOT EXISTS (
    SELECT 1 FROM commissions
    WHERE referencia_id = p_slot_id AND tipo = 'aula'
  )
  RETURNING id INTO v_commission_id;

  IF v_commission_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'gerou', true,
      'valor', v_valor,
      'tipo', v_slot.tipo_comissao,
      'alunos_contados', v_count,
      'staff_nome', v_slot.staff_nome,
      'commission_id', v_commission_id
    );
  END IF;

  RETURN jsonb_build_object('gerou', false, 'motivo', 'Comissao ja existia para esta aula');
END;
$$;

GRANT EXECUTE ON FUNCTION calcular_comissao_aula(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_comissao_aula(uuid) TO service_role;
