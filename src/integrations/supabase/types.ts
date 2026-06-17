export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          contractor_id: string
          created_at: string | null
          data_atividade: string | null
          descricao: string | null
          id: string
          opportunity_id: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
          student_id: string | null
          tipo: string
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          data_atividade?: string | null
          descricao?: string | null
          id?: string
          opportunity_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          student_id?: string | null
          tipo?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          data_atividade?: string | null
          descricao?: string | null
          id?: string
          opportunity_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          student_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      anamnese_modelo_questoes: {
        Row: {
          id: string
          modelo_id: string
          obrigatoria: boolean
          ordem: number
          questao_id: string
        }
        Insert: {
          id?: string
          modelo_id: string
          obrigatoria?: boolean
          ordem?: number
          questao_id: string
        }
        Update: {
          id?: string
          modelo_id?: string
          obrigatoria?: boolean
          ordem?: number
          questao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_modelo_questoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "anamnese_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_modelo_questoes_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "anamnese_questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_modelos: {
        Row: {
          contractor_id: string
          created_at: string
          descricao: string
          exigir_aceite: boolean
          id: string
          para_aula_experimental: boolean
          respondido_pelo_cliente: boolean
        }
        Insert: {
          contractor_id: string
          created_at?: string
          descricao: string
          exigir_aceite?: boolean
          id?: string
          para_aula_experimental?: boolean
          respondido_pelo_cliente?: boolean
        }
        Update: {
          contractor_id?: string
          created_at?: string
          descricao?: string
          exigir_aceite?: boolean
          id?: string
          para_aula_experimental?: boolean
          respondido_pelo_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_modelos_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_questoes: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          max_caracteres: number | null
          opcoes: Json
          pergunta: string
          permite_outro: boolean
          tem_respostas: boolean
          tipo: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          max_caracteres?: number | null
          opcoes?: Json
          pergunta: string
          permite_outro?: boolean
          tem_respostas?: boolean
          tipo: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          max_caracteres?: number | null
          opcoes?: Json
          pergunta?: string
          permite_outro?: boolean
          tem_respostas?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_questoes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_resposta_itens: {
        Row: {
          id: string
          questao_id: string
          resposta_id: string
          valor: Json | null
        }
        Insert: {
          id?: string
          questao_id: string
          resposta_id: string
          valor?: Json | null
        }
        Update: {
          id?: string
          questao_id?: string
          resposta_id?: string
          valor?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_resposta_itens_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "anamnese_questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_resposta_itens_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "anamnese_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_respostas: {
        Row: {
          aceite: boolean
          contractor_id: string
          created_at: string
          id: string
          modelo_id: string | null
          parq: Json
          respondente_email: string | null
          respondente_nome: string | null
          respondente_telefone: string | null
          respondido_at: string | null
          status: string
          student_id: string | null
          token: string
        }
        Insert: {
          aceite?: boolean
          contractor_id: string
          created_at?: string
          id?: string
          modelo_id?: string | null
          parq?: Json
          respondente_email?: string | null
          respondente_nome?: string | null
          respondente_telefone?: string | null
          respondido_at?: string | null
          status?: string
          student_id?: string | null
          token?: string
        }
        Update: {
          aceite?: boolean
          contractor_id?: string
          created_at?: string
          id?: string
          modelo_id?: string | null
          parq?: Json
          respondente_email?: string | null
          respondente_nome?: string | null
          respondente_telefone?: string | null
          respondido_at?: string | null
          status?: string
          student_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_respostas_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_respostas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "anamnese_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_respostas_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      autentique_documents: {
        Row: {
          assinado_em: string | null
          autentique_id: string | null
          contractor_id: string
          created_at: string
          id: string
          link_assinatura: string | null
          status: string
          student_contract_id: string | null
          student_email: string | null
          student_id: string | null
          student_nome: string | null
        }
        Insert: {
          assinado_em?: string | null
          autentique_id?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          link_assinatura?: string | null
          status?: string
          student_contract_id?: string | null
          student_email?: string | null
          student_id?: string | null
          student_nome?: string | null
        }
        Update: {
          assinado_em?: string | null
          autentique_id?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          link_assinatura?: string | null
          status?: string
          student_contract_id?: string | null
          student_email?: string | null
          student_id?: string | null
          student_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autentique_documents_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autentique_documents_student_contract_id_fkey"
            columns: ["student_contract_id"]
            isOneToOne: false
            referencedRelation: "student_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autentique_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          anamnese_resposta_id: string | null
          cancelado_em: string | null
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_em: string | null
          consome_credito: boolean | null
          contractor_id: string
          contrato_id: string | null
          created_at: string
          credito_reposicao_id: string | null
          criado_por: string | null
          descontou_contrato: boolean
          id: string
          lead_id: string | null
          lead_nome: string | null
          observacoes: string | null
          origem_agendamento: string | null
          pessoa_tipo: string | null
          reservado_em: string | null
          slot_id: string
          status: string
          student_contract_id: string | null
          student_id: string | null
          student_nome: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          anamnese_resposta_id?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          checkin_em?: string | null
          consome_credito?: boolean | null
          contractor_id: string
          contrato_id?: string | null
          created_at?: string
          credito_reposicao_id?: string | null
          criado_por?: string | null
          descontou_contrato?: boolean
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          observacoes?: string | null
          origem_agendamento?: string | null
          pessoa_tipo?: string | null
          reservado_em?: string | null
          slot_id: string
          status?: string
          student_contract_id?: string | null
          student_id?: string | null
          student_nome?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          anamnese_resposta_id?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          checkin_em?: string | null
          consome_credito?: boolean | null
          contractor_id?: string
          contrato_id?: string | null
          created_at?: string
          credito_reposicao_id?: string | null
          criado_por?: string | null
          descontou_contrato?: boolean
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          observacoes?: string | null
          origem_agendamento?: string | null
          pessoa_tipo?: string | null
          reservado_em?: string | null
          slot_id?: string
          status?: string
          student_contract_id?: string | null
          student_id?: string | null
          student_nome?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_anamnese_resposta_id_fkey"
            columns: ["anamnese_resposta_id"]
            isOneToOne: false
            referencedRelation: "anamnese_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          contractor_id: string
          created_at: string | null
          email: string | null
          enviado_em: string | null
          id: string
          status: string | null
          student_id: string | null
          student_nome: string | null
          telefone: string | null
        }
        Insert: {
          campaign_id: string
          contractor_id: string
          created_at?: string | null
          email?: string | null
          enviado_em?: string | null
          id?: string
          status?: string | null
          student_id?: string | null
          student_nome?: string | null
          telefone?: string | null
        }
        Update: {
          campaign_id?: string
          contractor_id?: string
          created_at?: string | null
          email?: string | null
          enviado_em?: string | null
          id?: string
          status?: string | null
          student_id?: string | null
          student_nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          canal: string | null
          contractor_id: string
          created_at: string | null
          descricao: string | null
          dias_apos_gatilho: number | null
          gatilho: string | null
          id: string
          mensagem: string | null
          nome: string
          status: string | null
          tipo: string | null
          total_enviados: number | null
          updated_at: string | null
        }
        Insert: {
          canal?: string | null
          contractor_id: string
          created_at?: string | null
          descricao?: string | null
          dias_apos_gatilho?: number | null
          gatilho?: string | null
          id?: string
          mensagem?: string | null
          nome: string
          status?: string | null
          tipo?: string | null
          total_enviados?: number | null
          updated_at?: string | null
        }
        Update: {
          canal?: string | null
          contractor_id?: string
          created_at?: string | null
          descricao?: string | null
          dias_apos_gatilho?: number | null
          gatilho?: string | null
          id?: string
          mensagem?: string | null
          nome?: string
          status?: string | null
          tipo?: string | null
          total_enviados?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_sessions: {
        Row: {
          aberto_por: string | null
          closed_at: string | null
          contractor_id: string
          created_at: string
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          opened_at: string
          saldo_final: number | null
          saldo_inicial: number
          status: string
          total_entradas: number
          total_saidas: number
        }
        Insert: {
          aberto_por?: string | null
          closed_at?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          opened_at?: string
          saldo_final?: number | null
          saldo_inicial?: number
          status?: string
          total_entradas?: number
          total_saidas?: number
        }
        Update: {
          aberto_por?: string | null
          closed_at?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          opened_at?: string
          saldo_final?: number | null
          saldo_inicial?: number
          status?: string
          total_entradas?: number
          total_saidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          centro_custo_id: string | null
          centro_receita_id: string | null
          considerar_cac: boolean
          contractor_id: string
          created_at: string | null
          id: string
          is_cac: boolean | null
          nome: string
          tipo: string
        }
        Insert: {
          centro_custo_id?: string | null
          centro_receita_id?: string | null
          considerar_cac?: boolean
          contractor_id: string
          created_at?: string | null
          id?: string
          is_cac?: boolean | null
          nome: string
          tipo: string
        }
        Update: {
          centro_custo_id?: string | null
          centro_receita_id?: string | null
          considerar_cac?: boolean
          contractor_id?: string
          created_at?: string | null
          id?: string
          is_cac?: boolean | null
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_financeiras_centro_receita_id_fkey"
            columns: ["centro_receita_id"]
            isOneToOne: false
            referencedRelation: "centros_receita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_financeiras_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          contractor_id: string
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_receita: {
        Row: {
          contractor_id: string
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_receita_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          contractor_id: string
          created_at: string
          descricao: string
          id: string
          pago_em: string | null
          percentual: number
          referencia_id: string | null
          staff_id: string
          status: string
          student_id: string | null
          student_nome: string | null
          tipo: string
          valor_base: number
          valor_comissao: number
        }
        Insert: {
          contractor_id: string
          created_at?: string
          descricao: string
          id?: string
          pago_em?: string | null
          percentual: number
          referencia_id?: string | null
          staff_id: string
          status?: string
          student_id?: string | null
          student_nome?: string | null
          tipo?: string
          valor_base: number
          valor_comissao: number
        }
        Update: {
          contractor_id?: string
          created_at?: string
          descricao?: string
          id?: string
          pago_em?: string | null
          percentual?: number
          referencia_id?: string | null
          staff_id?: string
          status?: string
          student_id?: string | null
          student_nome?: string | null
          tipo?: string
          valor_base?: number
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      company_modules: {
        Row: {
          activated_at: string | null
          cancelled_at: string | null
          config_json: Json
          contractor_id: string
          created_at: string
          id: string
          module_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          cancelled_at?: string | null
          config_json?: Json
          contractor_id: string
          created_at?: string
          id?: string
          module_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          cancelled_at?: string | null
          config_json?: Json
          contractor_id?: string
          created_at?: string
          id?: string
          module_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_financeiras: {
        Row: {
          agencia: string | null
          agencia_digito: string | null
          ativo: boolean
          banco_codigo: string | null
          banco_nome: string | null
          conta: string | null
          conta_digito: string | null
          contractor_id: string
          created_at: string | null
          descricao: string
          id: string
          tipo: string
          titular_cpf: string | null
          titular_diferente: boolean
          titular_nome: string | null
        }
        Insert: {
          agencia?: string | null
          agencia_digito?: string | null
          ativo?: boolean
          banco_codigo?: string | null
          banco_nome?: string | null
          conta?: string | null
          conta_digito?: string | null
          contractor_id: string
          created_at?: string | null
          descricao: string
          id?: string
          tipo: string
          titular_cpf?: string | null
          titular_diferente?: boolean
          titular_nome?: string | null
        }
        Update: {
          agencia?: string | null
          agencia_digito?: string | null
          ativo?: boolean
          banco_codigo?: string | null
          banco_nome?: string | null
          conta?: string | null
          conta_digito?: string | null
          contractor_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          tipo?: string
          titular_cpf?: string | null
          titular_diferente?: boolean
          titular_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_financeiras_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          contractor_id: string
          created_at: string
          descricao: string
          id: string
          student_contract_id: string
          usuario_nome: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          descricao: string
          id?: string
          student_contract_id: string
          usuario_nome?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          descricao?: string
          id?: string
          student_contract_id?: string
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_student_contract_id_fkey"
            columns: ["student_contract_id"]
            isOneToOne: false
            referencedRelation: "student_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_suspensions: {
        Row: {
          contractor_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          motivo: string
          quantidade_dias: number | null
          status: string
          student_contract_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          motivo: string
          quantidade_dias?: number | null
          status?: string
          student_contract_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          motivo?: string
          quantidade_dias?: number | null
          status?: string
          student_contract_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_suspensions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_suspensions_student_contract_id_fkey"
            columns: ["student_contract_id"]
            isOneToOne: false
            referencedRelation: "student_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_auth: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_auth_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email: string
          fone: string | null
          fuso_horario: string
          id: string
          instagram: string | null
          logradouro: string | null
          nome_fantasia: string
          numero: string | null
          plan: string
          razao_social: string
          site: string | null
          status: string
          trial_ends_at: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email: string
          fone?: string | null
          fuso_horario?: string
          id?: string
          instagram?: string | null
          logradouro?: string | null
          nome_fantasia: string
          numero?: string | null
          plan?: string
          razao_social: string
          site?: string | null
          status?: string
          trial_ends_at?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string
          fone?: string | null
          fuso_horario?: string
          id?: string
          instagram?: string | null
          logradouro?: string | null
          nome_fantasia?: string
          numero?: string | null
          plan?: string
          razao_social?: string
          site?: string | null
          status?: string
          trial_ends_at?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contrato_modalidades: {
        Row: {
          considerar_antecipacoes: boolean | null
          considerar_reagendamentos: boolean | null
          contabilizar_conjunto: boolean
          contrato_id: string
          created_at: string
          id: string
          limitar_acessos: boolean
          limitar_horarios: boolean
          limite_antecipacoes: string | null
          limite_reagendamentos: string | null
          max_acessos: number | null
          modalidade_id: string | null
          nome: string
          periodos_horario: Json
          permite_antecipacoes: boolean | null
          permite_reagendamentos: boolean | null
          qtd_antecipacoes: number | null
          qtd_reagendamentos: number | null
          sessoes_no_periodo: number | null
          sessoes_por_semana: number | null
          tipo_acesso: string
          tipo_duracao_acessos: string
          tipo_periodo_acesso: string | null
          total_aulas: number | null
        }
        Insert: {
          considerar_antecipacoes?: boolean | null
          considerar_reagendamentos?: boolean | null
          contabilizar_conjunto?: boolean
          contrato_id: string
          created_at?: string
          id?: string
          limitar_acessos?: boolean
          limitar_horarios?: boolean
          limite_antecipacoes?: string | null
          limite_reagendamentos?: string | null
          max_acessos?: number | null
          modalidade_id?: string | null
          nome: string
          periodos_horario?: Json
          permite_antecipacoes?: boolean | null
          permite_reagendamentos?: boolean | null
          qtd_antecipacoes?: number | null
          qtd_reagendamentos?: number | null
          sessoes_no_periodo?: number | null
          sessoes_por_semana?: number | null
          tipo_acesso?: string
          tipo_duracao_acessos?: string
          tipo_periodo_acesso?: string | null
          total_aulas?: number | null
        }
        Update: {
          considerar_antecipacoes?: boolean | null
          considerar_reagendamentos?: boolean | null
          contabilizar_conjunto?: boolean
          contrato_id?: string
          created_at?: string
          id?: string
          limitar_acessos?: boolean
          limitar_horarios?: boolean
          limite_antecipacoes?: string | null
          limite_reagendamentos?: string | null
          max_acessos?: number | null
          modalidade_id?: string | null
          nome?: string
          periodos_horario?: Json
          permite_antecipacoes?: boolean | null
          permite_reagendamentos?: boolean | null
          qtd_antecipacoes?: number | null
          qtd_reagendamentos?: number | null
          sessoes_no_periodo?: number | null
          sessoes_por_semana?: number | null
          tipo_acesso?: string
          tipo_duracao_acessos?: string
          tipo_periodo_acesso?: string | null
          total_aulas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_modalidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_modalidades_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "modalidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          assinatura_eletronica: boolean
          ativo: boolean
          categoria_receita: string | null
          comissionar_consultor: boolean
          contabilizar_sessoes_conjunto: boolean | null
          contractor_id: string
          created_at: string
          data_fim_venda: string | null
          data_inicio_venda: string | null
          descricao: string
          duracao: number
          forma_envio_assinatura: string | null
          formas_pagamento: string[]
          id: string
          limita_periodo_venda: boolean
          max_dias_suspensao: number | null
          max_parcelas: number | null
          max_suspensoes: number | null
          permite_parcelado: boolean
          permite_pre_venda: boolean
          permite_renovar: boolean
          possui_valor_adesao: boolean
          renova_automaticamente: boolean
          renovacao_quando: string | null
          template_contrato: string | null
          tipo: string
          tipo_cobranca: string | null
          tipo_duracao: string
          updated_at: string
          valor_adesao: number | null
          valor_por_mes: number | null
          valor_total: number
          vende_app_aluno: boolean
        }
        Insert: {
          assinatura_eletronica?: boolean
          ativo?: boolean
          categoria_receita?: string | null
          comissionar_consultor?: boolean
          contabilizar_sessoes_conjunto?: boolean | null
          contractor_id: string
          created_at?: string
          data_fim_venda?: string | null
          data_inicio_venda?: string | null
          descricao: string
          duracao?: number
          forma_envio_assinatura?: string | null
          formas_pagamento?: string[]
          id?: string
          limita_periodo_venda?: boolean
          max_dias_suspensao?: number | null
          max_parcelas?: number | null
          max_suspensoes?: number | null
          permite_parcelado?: boolean
          permite_pre_venda?: boolean
          permite_renovar?: boolean
          possui_valor_adesao?: boolean
          renova_automaticamente?: boolean
          renovacao_quando?: string | null
          template_contrato?: string | null
          tipo?: string
          tipo_cobranca?: string | null
          tipo_duracao?: string
          updated_at?: string
          valor_adesao?: number | null
          valor_por_mes?: number | null
          valor_total?: number
          vende_app_aluno?: boolean
        }
        Update: {
          assinatura_eletronica?: boolean
          ativo?: boolean
          categoria_receita?: string | null
          comissionar_consultor?: boolean
          contabilizar_sessoes_conjunto?: boolean | null
          contractor_id?: string
          created_at?: string
          data_fim_venda?: string | null
          data_inicio_venda?: string | null
          descricao?: string
          duracao?: number
          forma_envio_assinatura?: string | null
          formas_pagamento?: string[]
          id?: string
          limita_periodo_venda?: boolean
          max_dias_suspensao?: number | null
          max_parcelas?: number | null
          max_suspensoes?: number | null
          permite_parcelado?: boolean
          permite_pre_venda?: boolean
          permite_renovar?: boolean
          possui_valor_adesao?: boolean
          renova_automaticamente?: boolean
          renovacao_quando?: string | null
          template_contrato?: string | null
          tipo?: string
          tipo_cobranca?: string | null
          tipo_duracao?: string
          updated_at?: string
          valor_adesao?: number | null
          valor_por_mes?: number | null
          valor_total?: number
          vende_app_aluno?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contratos_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_config: {
        Row: {
          ativo: boolean
          categoria: string
          contractor_id: string
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          contractor_id: string
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          contractor_id?: string
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_config_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funil_etapas: {
        Row: {
          cor: string
          created_at: string
          funil_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          cor?: string
          created_at?: string
          funil_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          cor?: string
          created_at?: string
          funil_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_funil_etapas_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "crm_funis"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funis: {
        Row: {
          ativo: boolean
          contractor_id: string
          created_at: string
          id: string
          nome: string
          padrao: boolean
        }
        Insert: {
          ativo?: boolean
          contractor_id: string
          created_at?: string
          id?: string
          nome: string
          padrao?: boolean
        }
        Update: {
          ativo?: boolean
          contractor_id?: string
          created_at?: string
          id?: string
          nome?: string
          padrao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_funis_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          contractor_id: string
          created_at: string | null
          data_validade: string | null
          descricao: string | null
          id: string
          tipo: string
          updated_at: string | null
          uso_unico: boolean
          usos_maximo: number | null
          usos_realizados: number
          valor: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          contractor_id: string
          created_at?: string | null
          data_validade?: string | null
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string | null
          uso_unico?: boolean
          usos_maximo?: number | null
          usos_realizados?: number
          valor?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          contractor_id?: string
          created_at?: string | null
          data_validade?: string | null
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string | null
          uso_unico?: boolean
          usos_maximo?: number | null
          usos_realizados?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_groups: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_groups_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          contractor_id: string
          created_at: string
          criado_por: string
          demonstracao_tipo: string | null
          demonstracao_url: string | null
          descricao: string | null
          equipamento: string | null
          grupo_id: string | null
          id: string
          intensidade: string | null
          nome: string
          nome_impressao: string | null
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          criado_por?: string
          demonstracao_tipo?: string | null
          demonstracao_url?: string | null
          descricao?: string | null
          equipamento?: string | null
          grupo_id?: string | null
          id?: string
          intensidade?: string | null
          nome: string
          nome_impressao?: string | null
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          criado_por?: string
          demonstracao_tipo?: string | null
          demonstracao_url?: string | null
          descricao?: string | null
          equipamento?: string | null
          grupo_id?: string | null
          id?: string
          intensidade?: string | null
          nome?: string
          nome_impressao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "exercise_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          contractor_id: string
          dias_notificacao_antes: number | null
          dias_tolerancia: number | null
          formas_pagamento: string[] | null
          id: string
          juros_mensal: number | null
          multa_atraso: number | null
          multa_encerramento_ativo: boolean
          multa_encerramento_percentual: number
          updated_at: string | null
        }
        Insert: {
          contractor_id: string
          dias_notificacao_antes?: number | null
          dias_tolerancia?: number | null
          formas_pagamento?: string[] | null
          id?: string
          juros_mensal?: number | null
          multa_atraso?: number | null
          multa_encerramento_ativo?: boolean
          multa_encerramento_percentual?: number
          updated_at?: string | null
        }
        Update: {
          contractor_id?: string
          dias_notificacao_antes?: number | null
          dias_tolerancia?: number | null
          formas_pagamento?: string[] | null
          id?: string
          juros_mensal?: number | null
          multa_atraso?: number | null
          multa_encerramento_ativo?: boolean
          multa_encerramento_percentual?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      fixed_enrollments: {
        Row: {
          ativo: boolean
          contractor_id: string
          created_at: string
          dia_semana: string | null
          grid_id: string
          id: string
          student_id: string
          student_nome: string | null
        }
        Insert: {
          ativo?: boolean
          contractor_id: string
          created_at?: string
          dia_semana?: string | null
          grid_id: string
          id?: string
          student_id: string
          student_nome?: string | null
        }
        Update: {
          ativo?: boolean
          contractor_id?: string
          created_at?: string
          dia_semana?: string | null
          grid_id?: string
          id?: string
          student_id?: string
          student_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_enrollments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_enrollments_grid_id_fkey"
            columns: ["grid_id"]
            isOneToOne: false
            referencedRelation: "schedule_grids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedor_historico_valores: {
        Row: {
          created_at: string | null
          fornecedor_id: string
          id: string
          observacao: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          fornecedor_id: string
          id?: string
          observacao?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          fornecedor_id?: string
          id?: string
          observacao?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_historico_valores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          bairro: string | null
          banco: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          complemento: string | null
          condicao_pagamento: string | null
          conta: string | null
          contractor_id: string
          cpf_cnpj: string | null
          created_at: string | null
          dia_vencimento: number | null
          email: string | null
          forma_pagamento_padrao: string | null
          id: string
          logradouro: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          subcategoria_id: string | null
          telefone: string | null
          tipo: string | null
          tipo_conta: string | null
          tipo_fornecedor: string | null
          uf: string | null
          updated_at: string | null
          valor_diaria: number | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          bairro?: string | null
          banco?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          condicao_pagamento?: string | null
          conta?: string | null
          contractor_id: string
          cpf_cnpj?: string | null
          created_at?: string | null
          dia_vencimento?: number | null
          email?: string | null
          forma_pagamento_padrao?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          subcategoria_id?: string | null
          telefone?: string | null
          tipo?: string | null
          tipo_conta?: string | null
          tipo_fornecedor?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_diaria?: number | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          bairro?: string | null
          banco?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          condicao_pagamento?: string | null
          conta?: string | null
          contractor_id?: string
          cpf_cnpj?: string | null
          created_at?: string | null
          dia_vencimento?: number | null
          email?: string | null
          forma_pagamento_padrao?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          subcategoria_id?: string | null
          telefone?: string | null
          tipo?: string | null
          tipo_conta?: string | null
          tipo_fornecedor?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_diaria?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      gofit_pay_accounts: {
        Row: {
          account_status: string
          activated_at: string | null
          asaas_account_id: string | null
          asaas_api_key_ref: string | null
          asaas_environment: string | null
          asaas_wallet_id: string | null
          automatic_transfer_enabled: boolean
          contractor_id: string
          created_at: string
          credit_card_anticipation_enabled: boolean
          display_name: string | null
          id: string
          last_sync_at: string | null
          production_linked_at: string | null
          production_verified_at: string | null
          provider: string
          provider_account_id: string | null
          provider_api_key_encrypted: string | null
          provider_environment: string
          provider_wallet_id: string | null
          status: string
          sync_error: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          activated_at?: string | null
          asaas_account_id?: string | null
          asaas_api_key_ref?: string | null
          asaas_environment?: string | null
          asaas_wallet_id?: string | null
          automatic_transfer_enabled?: boolean
          contractor_id: string
          created_at?: string
          credit_card_anticipation_enabled?: boolean
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          production_linked_at?: string | null
          production_verified_at?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_api_key_encrypted?: string | null
          provider_environment?: string
          provider_wallet_id?: string | null
          status?: string
          sync_error?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          activated_at?: string | null
          asaas_account_id?: string | null
          asaas_api_key_ref?: string | null
          asaas_environment?: string | null
          asaas_wallet_id?: string | null
          automatic_transfer_enabled?: boolean
          contractor_id?: string
          created_at?: string
          credit_card_anticipation_enabled?: boolean
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          production_linked_at?: string | null
          production_verified_at?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_api_key_encrypted?: string | null
          provider_environment?: string
          provider_wallet_id?: string | null
          status?: string
          sync_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gofit_pay_accounts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      gofit_pay_card_registration_links: {
        Row: {
          contractor_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          provider_environment: string
          revoked_at: string | null
          student_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          provider_environment?: string
          revoked_at?: string | null
          student_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          provider_environment?: string
          revoked_at?: string | null
          student_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gofit_pay_card_registration_links_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gofit_pay_card_registration_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      gofit_pay_collection_notes: {
        Row: {
          contractor_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          receivable_id: string
          student_id: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          receivable_id: string
          student_id?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          receivable_id?: string
          student_id?: string | null
        }
        Relationships: []
      }
      gofit_pay_config: {
        Row: {
          agencia: string | null
          agencia_digito: string | null
          antecipacao_automatica: boolean
          asaas_account_id: string | null
          asaas_environment: string
          asaas_webhook_token: string | null
          bairro: string | null
          banco_codigo: string | null
          banco_nome: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          conta_digito: string | null
          conta_num: string | null
          contractor_id: string
          created_at: string
          desconto_ativo: boolean
          desconto_dias_antecipacao: number
          desconto_percentual: number
          estado: string | null
          id: string
          juros_ativo: boolean
          juros_percentual: number
          logradouro: string | null
          multa_ativa: boolean
          multa_percentual: number
          nome_exibicao: string | null
          nome_fantasia: string | null
          numero_end: string | null
          onboarding_status: string
          onboarding_step: number
          razao_social: string | null
          resp_celular: string | null
          resp_cpf: string | null
          resp_email: string | null
          resp_nascimento: string | null
          resp_nome: string | null
          resp_renda_mensal: number | null
          tipo_conta: string | null
          tipo_empresa: string | null
          titular_documento: string | null
          titular_nome: string | null
          transferencia_automatica: boolean
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          agencia_digito?: string | null
          antecipacao_automatica?: boolean
          asaas_account_id?: string | null
          asaas_environment?: string
          asaas_webhook_token?: string | null
          bairro?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta_digito?: string | null
          conta_num?: string | null
          contractor_id: string
          created_at?: string
          desconto_ativo?: boolean
          desconto_dias_antecipacao?: number
          desconto_percentual?: number
          estado?: string | null
          id?: string
          juros_ativo?: boolean
          juros_percentual?: number
          logradouro?: string | null
          multa_ativa?: boolean
          multa_percentual?: number
          nome_exibicao?: string | null
          nome_fantasia?: string | null
          numero_end?: string | null
          onboarding_status?: string
          onboarding_step?: number
          razao_social?: string | null
          resp_celular?: string | null
          resp_cpf?: string | null
          resp_email?: string | null
          resp_nascimento?: string | null
          resp_nome?: string | null
          resp_renda_mensal?: number | null
          tipo_conta?: string | null
          tipo_empresa?: string | null
          titular_documento?: string | null
          titular_nome?: string | null
          transferencia_automatica?: boolean
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          agencia_digito?: string | null
          antecipacao_automatica?: boolean
          asaas_account_id?: string | null
          asaas_environment?: string
          asaas_webhook_token?: string | null
          bairro?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta_digito?: string | null
          conta_num?: string | null
          contractor_id?: string
          created_at?: string
          desconto_ativo?: boolean
          desconto_dias_antecipacao?: number
          desconto_percentual?: number
          estado?: string | null
          id?: string
          juros_ativo?: boolean
          juros_percentual?: number
          logradouro?: string | null
          multa_ativa?: boolean
          multa_percentual?: number
          nome_exibicao?: string | null
          nome_fantasia?: string | null
          numero_end?: string | null
          onboarding_status?: string
          onboarding_step?: number
          razao_social?: string | null
          resp_celular?: string | null
          resp_cpf?: string | null
          resp_email?: string | null
          resp_nascimento?: string | null
          resp_nome?: string | null
          resp_renda_mensal?: number | null
          tipo_conta?: string | null
          tipo_empresa?: string | null
          titular_documento?: string | null
          titular_nome?: string | null
          transferencia_automatica?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gofit_pay_config_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      gofit_pay_fees: {
        Row: {
          billing_type: string
          contractor_id: string | null
          created_at: string
          description: string | null
          fixed_fee: number
          id: string
          installment_max: number | null
          installment_min: number | null
          is_active: boolean
          is_demo: boolean
          label: string
          percentage_fee: number
          settlement_days: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_type: string
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          fixed_fee?: number
          id?: string
          installment_max?: number | null
          installment_min?: number | null
          is_active?: boolean
          is_demo?: boolean
          label: string
          percentage_fee?: number
          settlement_days?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_type?: string
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          fixed_fee?: number
          id?: string
          installment_max?: number | null
          installment_min?: number | null
          is_active?: boolean
          is_demo?: boolean
          label?: string
          percentage_fee?: number
          settlement_days?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gofit_pay_settings: {
        Row: {
          allowed_for_real_charges: boolean
          auto_anticipation_enabled: boolean
          auto_confirm_received: boolean
          auto_transfer_disabled: boolean
          boleto_expiry_days: number
          charge_description_template: string | null
          contractor_id: string
          created_at: string
          display_name: string | null
          early_discount_days: number | null
          early_discount_enabled: boolean
          early_discount_percent: number | null
          environment: string
          gofit_pay_account_id: string | null
          id: string
          interest_enabled: boolean
          interest_percent: number | null
          late_fee_enabled: boolean
          late_fee_percent: number | null
          notify_on_overdue: boolean
          pilot_enabled_at: string | null
          pilot_notes: string | null
          pix_expiry_hours: number
          production_approved_at: string | null
          production_approved_by: string | null
          production_enabled: boolean
          production_notes: string | null
          rollback_at: string | null
          rollback_notes: string | null
          send_payment_email: boolean
          send_payment_sms: boolean
          send_payment_whatsapp: boolean
          updated_at: string
          webhook_token: string | null
          webhook_url: string | null
        }
        Insert: {
          allowed_for_real_charges?: boolean
          auto_anticipation_enabled?: boolean
          auto_confirm_received?: boolean
          auto_transfer_disabled?: boolean
          boleto_expiry_days?: number
          charge_description_template?: string | null
          contractor_id: string
          created_at?: string
          display_name?: string | null
          early_discount_days?: number | null
          early_discount_enabled?: boolean
          early_discount_percent?: number | null
          environment?: string
          gofit_pay_account_id?: string | null
          id?: string
          interest_enabled?: boolean
          interest_percent?: number | null
          late_fee_enabled?: boolean
          late_fee_percent?: number | null
          notify_on_overdue?: boolean
          pilot_enabled_at?: string | null
          pilot_notes?: string | null
          pix_expiry_hours?: number
          production_approved_at?: string | null
          production_approved_by?: string | null
          production_enabled?: boolean
          production_notes?: string | null
          rollback_at?: string | null
          rollback_notes?: string | null
          send_payment_email?: boolean
          send_payment_sms?: boolean
          send_payment_whatsapp?: boolean
          updated_at?: string
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          allowed_for_real_charges?: boolean
          auto_anticipation_enabled?: boolean
          auto_confirm_received?: boolean
          auto_transfer_disabled?: boolean
          boleto_expiry_days?: number
          charge_description_template?: string | null
          contractor_id?: string
          created_at?: string
          display_name?: string | null
          early_discount_days?: number | null
          early_discount_enabled?: boolean
          early_discount_percent?: number | null
          environment?: string
          gofit_pay_account_id?: string | null
          id?: string
          interest_enabled?: boolean
          interest_percent?: number | null
          late_fee_enabled?: boolean
          late_fee_percent?: number | null
          notify_on_overdue?: boolean
          pilot_enabled_at?: string | null
          pilot_notes?: string | null
          pix_expiry_hours?: number
          production_approved_at?: string | null
          production_approved_by?: string | null
          production_enabled?: boolean
          production_notes?: string | null
          rollback_at?: string | null
          rollback_notes?: string | null
          send_payment_email?: boolean
          send_payment_sms?: boolean
          send_payment_whatsapp?: boolean
          updated_at?: string
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gofit_pay_settings_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gofit_pay_settings_gofit_pay_account_id_fkey"
            columns: ["gofit_pay_account_id"]
            isOneToOne: false
            referencedRelation: "gofit_pay_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gofit_pay_student_cards: {
        Row: {
          card_alias: string | null
          card_brand: string | null
          card_holder_name: string | null
          card_last4: string | null
          contractor_id: string
          created_at: string
          credit_card_token_encrypted: string
          deleted_at: string | null
          expiry_month: string | null
          expiry_year: string | null
          id: string
          is_default: boolean
          payment_customer_id: string | null
          provider: string
          provider_customer_id: string
          provider_environment: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          card_alias?: string | null
          card_brand?: string | null
          card_holder_name?: string | null
          card_last4?: string | null
          contractor_id: string
          created_at?: string
          credit_card_token_encrypted: string
          deleted_at?: string | null
          expiry_month?: string | null
          expiry_year?: string | null
          id?: string
          is_default?: boolean
          payment_customer_id?: string | null
          provider?: string
          provider_customer_id: string
          provider_environment?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          card_alias?: string | null
          card_brand?: string | null
          card_holder_name?: string | null
          card_last4?: string | null
          contractor_id?: string
          created_at?: string
          credit_card_token_encrypted?: string
          deleted_at?: string | null
          expiry_month?: string | null
          expiry_year?: string | null
          id?: string
          is_default?: boolean
          payment_customer_id?: string | null
          provider?: string
          provider_customer_id?: string
          provider_environment?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gofit_pay_student_cards_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gofit_pay_student_cards_payment_customer_id_fkey"
            columns: ["payment_customer_id"]
            isOneToOne: false
            referencedRelation: "payment_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gofit_pay_student_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      gofit_pay_webhook_events: {
        Row: {
          asaas_event_id: string | null
          asaas_payment_id: string | null
          contractor_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload_json: Json | null
          processed: boolean
          processed_at: string | null
          processing_attempts: number
          provider: string
          provider_environment: string
          provider_event_id: string | null
          provider_payment_id: string | null
          raw_payload: Json
          receivable_id: string | null
          received_at: string
          source_ip: string | null
        }
        Insert: {
          asaas_event_id?: string | null
          asaas_payment_id?: string | null
          contractor_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload_json?: Json | null
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          provider?: string
          provider_environment?: string
          provider_event_id?: string | null
          provider_payment_id?: string | null
          raw_payload?: Json
          receivable_id?: string | null
          received_at?: string
          source_ip?: string | null
        }
        Update: {
          asaas_event_id?: string | null
          asaas_payment_id?: string | null
          contractor_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload_json?: Json | null
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          provider?: string
          provider_environment?: string
          provider_event_id?: string | null
          provider_payment_id?: string | null
          raw_payload?: Json
          receivable_id?: string | null
          received_at?: string
          source_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gofit_pay_webhook_events_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      graduation_levels: {
        Row: {
          contractor_id: string
          cor: string | null
          created_at: string | null
          descricao: string | null
          id: string
          modalidade_id: string | null
          nome: string
          ordem: number | null
        }
        Insert: {
          contractor_id: string
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          modalidade_id?: string | null
          nome: string
          ordem?: number | null
        }
        Update: {
          contractor_id?: string
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          modalidade_id?: string | null
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      graduations: {
        Row: {
          contractor_id: string
          created_at: string | null
          data_graduacao: string
          graduation_level_id: string
          id: string
          observacoes: string | null
          student_id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          data_graduacao: string
          graduation_level_id: string
          id?: string
          observacoes?: string | null
          student_id: string
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          data_graduacao?: string
          graduation_level_id?: string
          id?: string
          observacoes?: string | null
          student_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          contractor_id: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_name: string | null
          nome: string | null
          role: string | null
          status: string
          student_id: string | null
          telefone: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_name?: string | null
          nome?: string | null
          role?: string | null
          status?: string
          student_id?: string | null
          telefone?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_name?: string | null
          nome?: string | null
          role?: string | null
          status?: string
          student_id?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      modalidades: {
        Row: {
          ativo: boolean
          contractor_id: string
          cor: string
          created_at: string
          descricao: string
          dias_semana: string[]
          exibe_wod_antes_dia: boolean
          exibicao_wod: string
          exibir_wod_app: boolean
          icone: string
          id: string
          permite_agendamento_publico: boolean
          utiliza_agenda: boolean
          utiliza_gonutri: boolean
          utiliza_wod: boolean
        }
        Insert: {
          ativo?: boolean
          contractor_id: string
          cor?: string
          created_at?: string
          descricao: string
          dias_semana?: string[]
          exibe_wod_antes_dia?: boolean
          exibicao_wod?: string
          exibir_wod_app?: boolean
          icone?: string
          id?: string
          permite_agendamento_publico?: boolean
          utiliza_agenda?: boolean
          utiliza_gonutri?: boolean
          utiliza_wod?: boolean
        }
        Update: {
          ativo?: boolean
          contractor_id?: string
          cor?: string
          created_at?: string
          descricao?: string
          dias_semana?: string[]
          exibe_wod_antes_dia?: boolean
          exibicao_wod?: string
          exibir_wod_app?: boolean
          icone?: string
          id?: string
          permite_agendamento_publico?: boolean
          utiliza_agenda?: boolean
          utiliza_gonutri?: boolean
          utiliza_wod?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "modalidades_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string
          icon: string | null
          id: string
          is_visible: boolean
          name: string
          route: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          is_visible?: boolean
          name: string
          route?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          is_visible?: boolean
          name?: string
          route?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      nfse_config: {
        Row: {
          aliquota_iss: number | null
          ambiente: string | null
          ativo: boolean | null
          codigo_tributacao: string | null
          contractor_id: string
          descricao_servico: string | null
          id: string
          inscricao_municipal: string | null
          municipio_codigo: string | null
          municipio_nome: string | null
          numero_rps_atual: number | null
          regime_tributario: string | null
          serie_rps: string | null
          updated_at: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          ambiente?: string | null
          ativo?: boolean | null
          codigo_tributacao?: string | null
          contractor_id: string
          descricao_servico?: string | null
          id?: string
          inscricao_municipal?: string | null
          municipio_codigo?: string | null
          municipio_nome?: string | null
          numero_rps_atual?: number | null
          regime_tributario?: string | null
          serie_rps?: string | null
          updated_at?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          ambiente?: string | null
          ativo?: boolean | null
          codigo_tributacao?: string | null
          contractor_id?: string
          descricao_servico?: string | null
          id?: string
          inscricao_municipal?: string | null
          municipio_codigo?: string | null
          municipio_nome?: string | null
          numero_rps_atual?: number | null
          regime_tributario?: string | null
          serie_rps?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nfse_emissions: {
        Row: {
          contractor_id: string
          created_at: string | null
          data_emissao: string | null
          id: string
          mensagem_erro: string | null
          numero_nfse: string | null
          numero_rps: number | null
          pdf_url: string | null
          receivable_id: string | null
          status: string | null
          student_id: string | null
          student_nome: string | null
          valor_iss: number | null
          valor_servico: number | null
          xml_url: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          data_emissao?: string | null
          id?: string
          mensagem_erro?: string | null
          numero_nfse?: string | null
          numero_rps?: number | null
          pdf_url?: string | null
          receivable_id?: string | null
          status?: string | null
          student_id?: string | null
          student_nome?: string | null
          valor_iss?: number | null
          valor_servico?: number | null
          xml_url?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          data_emissao?: string | null
          id?: string
          mensagem_erro?: string | null
          numero_nfse?: string | null
          numero_rps?: number | null
          pdf_url?: string | null
          receivable_id?: string | null
          status?: string | null
          student_id?: string | null
          student_nome?: string | null
          valor_iss?: number | null
          valor_servico?: number | null
          xml_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          lido: boolean
          link: string | null
          mensagem: string | null
          student_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          lido?: boolean
          link?: string | null
          mensagem?: string | null
          student_id?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          lido?: boolean
          link?: string | null
          mensagem?: string | null
          student_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          contractor_id: string
          created_at: string | null
          data_entrada: string | null
          data_prevista: string | null
          email: string | null
          etapa: string | null
          id: string
          modalidade_id: string | null
          motivo_perda: string | null
          nivel_interesse: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          student_id: string | null
          telefone: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          data_entrada?: string | null
          data_prevista?: string | null
          email?: string | null
          etapa?: string | null
          id?: string
          modalidade_id?: string | null
          motivo_perda?: string | null
          nivel_interesse?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          student_id?: string | null
          telefone?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          data_entrada?: string | null
          data_prevista?: string | null
          email?: string | null
          etapa?: string | null
          id?: string
          modalidade_id?: string | null
          motivo_perda?: string | null
          nivel_interesse?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          student_id?: string | null
          telefone?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      partner_checkins: {
        Row: {
          contractor_id: string
          created_at: string | null
          data_checkin: string
          id: string
          partner: string
          raw_data: Json | null
          status: string | null
          usuario_id_ext: string | null
          usuario_nome: string | null
          valor_repasse: number | null
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          data_checkin: string
          id?: string
          partner: string
          raw_data?: Json | null
          status?: string | null
          usuario_id_ext?: string | null
          usuario_nome?: string | null
          valor_repasse?: number | null
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          data_checkin?: string
          id?: string
          partner?: string
          raw_data?: Json | null
          status?: string | null
          usuario_id_ext?: string | null
          usuario_nome?: string | null
          valor_repasse?: number | null
        }
        Relationships: []
      }
      partner_integrations: {
        Row: {
          api_key: string | null
          api_secret: string | null
          ativo: boolean | null
          contract_id: string | null
          contractor_id: string
          created_at: string | null
          id: string
          observacoes: string | null
          partner: string
          ultimo_sync: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          ativo?: boolean | null
          contract_id?: string | null
          contractor_id: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          partner: string
          ultimo_sync?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          ativo?: boolean | null
          contract_id?: string | null
          contractor_id?: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          partner?: string
          ultimo_sync?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      payables: {
        Row: {
          anexo_url: string | null
          categoria: string
          categoria_id: string | null
          centro_custo_id: string | null
          conta_financeira_id: string | null
          contractor_id: string
          created_at: string
          data_competencia: string | null
          descricao: string
          forma_pagamento: string | null
          fornecedor: string | null
          hora_pagamento: string | null
          id: string
          observacoes: string | null
          pago_em: string | null
          status: string
          subcategoria_id: string | null
          tipo: string | null
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          anexo_url?: string | null
          categoria?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_financeira_id?: string | null
          contractor_id: string
          created_at?: string
          data_competencia?: string | null
          descricao: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          hora_pagamento?: string | null
          id?: string
          observacoes?: string | null
          pago_em?: string | null
          status?: string
          subcategoria_id?: string | null
          tipo?: string | null
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          anexo_url?: string | null
          categoria?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_financeira_id?: string | null
          contractor_id?: string
          created_at?: string
          data_competencia?: string | null
          descricao?: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          hora_pagamento?: string | null
          id?: string
          observacoes?: string | null
          pago_em?: string | null
          status?: string
          subcategoria_id?: string | null
          tipo?: string | null
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_conta_financeira_id_fkey"
            columns: ["conta_financeira_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_charges: {
        Row: {
          amount: number | null
          asaas_environment: string | null
          asaas_payment_id: string | null
          bank_slip_url: string | null
          billing_type: string
          cancelled_at: string | null
          card_brand: string | null
          card_last4: string | null
          charge_mode: string | null
          confirmed_at: string | null
          contractor_id: string
          created_at: string
          description: string | null
          due_date: string
          external_reference: string | null
          id: string
          invoice_url: string | null
          net_value: number | null
          paid_at: string | null
          payment_customer_id: string | null
          payment_url: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string
          provider_charge_id: string | null
          provider_environment: string
          raw_response_json: Json | null
          receivable_id: string | null
          refunded_at: string | null
          status: string
          student_card_id: string | null
          student_contract_id: string | null
          student_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          amount?: number | null
          asaas_environment?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          billing_type: string
          cancelled_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          charge_mode?: string | null
          confirmed_at?: string | null
          contractor_id: string
          created_at?: string
          description?: string | null
          due_date: string
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          net_value?: number | null
          paid_at?: string | null
          payment_customer_id?: string | null
          payment_url?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_environment?: string
          raw_response_json?: Json | null
          receivable_id?: string | null
          refunded_at?: string | null
          status?: string
          student_card_id?: string | null
          student_contract_id?: string | null
          student_id?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          amount?: number | null
          asaas_environment?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string
          cancelled_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          charge_mode?: string | null
          confirmed_at?: string | null
          contractor_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          net_value?: number | null
          paid_at?: string | null
          payment_customer_id?: string | null
          payment_url?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_environment?: string
          raw_response_json?: Json | null
          receivable_id?: string | null
          refunded_at?: string | null
          status?: string
          student_card_id?: string | null
          student_contract_id?: string | null
          student_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_charges_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_charges_payment_customer_id_fkey"
            columns: ["payment_customer_id"]
            isOneToOne: false
            referencedRelation: "payment_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_charges_student_card_id_fkey"
            columns: ["student_card_id"]
            isOneToOne: false
            referencedRelation: "gofit_pay_student_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_customers: {
        Row: {
          asaas_customer_id: string | null
          asaas_environment: string | null
          client_id: string
          contractor_id: string
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          provider: string
          provider_customer_id: string | null
          student_id: string | null
          sync_error: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_environment?: string | null
          client_id: string
          contractor_id: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          provider?: string
          provider_customer_id?: string | null
          student_id?: string | null
          sync_error?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_environment?: string | null
          client_id?: string
          contractor_id?: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          provider?: string
          provider_customer_id?: string | null
          student_id?: string | null
          sync_error?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_customers_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_config: {
        Row: {
          api_key_priv: string | null
          api_key_pub: string | null
          ativo: boolean | null
          contractor_id: string
          gateway: string | null
          id: string
          split_percent: number | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_priv?: string | null
          api_key_pub?: string | null
          ativo?: boolean | null
          contractor_id: string
          gateway?: string | null
          id?: string
          split_percent?: number | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_priv?: string | null
          api_key_pub?: string | null
          ativo?: boolean | null
          contractor_id?: string
          gateway?: string | null
          id?: string
          split_percent?: number | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      physical_evaluations: {
        Row: {
          abdomen_cm: number | null
          altura_cm: number | null
          antebraco_direito_cm: number | null
          antebraco_esquerdo_cm: number | null
          avaliador_id: string | null
          avaliador_nome: string | null
          braco_direito_cm: number | null
          braco_esquerdo_cm: number | null
          cintura_cm: number | null
          contractor_id: string
          coxa_direita_cm: number | null
          coxa_esquerda_cm: number | null
          created_at: string | null
          data_avaliacao: string
          dobra_abdominal_mm: number | null
          dobra_axilar_mm: number | null
          dobra_coxa_mm: number | null
          dobra_peitoral_mm: number | null
          dobra_subescapular_mm: number | null
          dobra_suprailiaca_mm: number | null
          dobra_triceps_mm: number | null
          id: string
          imc: number | null
          massa_gorda_kg: number | null
          massa_magra_kg: number | null
          observacoes: string | null
          panturrilha_direita_cm: number | null
          panturrilha_esquerda_cm: number | null
          percentual_gordura: number | null
          peso_kg: number | null
          protocolo: string | null
          quadril_cm: number | null
          student_id: string
          torax_cm: number | null
          updated_at: string | null
        }
        Insert: {
          abdomen_cm?: number | null
          altura_cm?: number | null
          antebraco_direito_cm?: number | null
          antebraco_esquerdo_cm?: number | null
          avaliador_id?: string | null
          avaliador_nome?: string | null
          braco_direito_cm?: number | null
          braco_esquerdo_cm?: number | null
          cintura_cm?: number | null
          contractor_id: string
          coxa_direita_cm?: number | null
          coxa_esquerda_cm?: number | null
          created_at?: string | null
          data_avaliacao: string
          dobra_abdominal_mm?: number | null
          dobra_axilar_mm?: number | null
          dobra_coxa_mm?: number | null
          dobra_peitoral_mm?: number | null
          dobra_subescapular_mm?: number | null
          dobra_suprailiaca_mm?: number | null
          dobra_triceps_mm?: number | null
          id?: string
          imc?: number | null
          massa_gorda_kg?: number | null
          massa_magra_kg?: number | null
          observacoes?: string | null
          panturrilha_direita_cm?: number | null
          panturrilha_esquerda_cm?: number | null
          percentual_gordura?: number | null
          peso_kg?: number | null
          protocolo?: string | null
          quadril_cm?: number | null
          student_id: string
          torax_cm?: number | null
          updated_at?: string | null
        }
        Update: {
          abdomen_cm?: number | null
          altura_cm?: number | null
          antebraco_direito_cm?: number | null
          antebraco_esquerdo_cm?: number | null
          avaliador_id?: string | null
          avaliador_nome?: string | null
          braco_direito_cm?: number | null
          braco_esquerdo_cm?: number | null
          cintura_cm?: number | null
          contractor_id?: string
          coxa_direita_cm?: number | null
          coxa_esquerda_cm?: number | null
          created_at?: string | null
          data_avaliacao?: string
          dobra_abdominal_mm?: number | null
          dobra_axilar_mm?: number | null
          dobra_coxa_mm?: number | null
          dobra_peitoral_mm?: number | null
          dobra_subescapular_mm?: number | null
          dobra_suprailiaca_mm?: number | null
          dobra_triceps_mm?: number | null
          id?: string
          imc?: number | null
          massa_gorda_kg?: number | null
          massa_magra_kg?: number | null
          observacoes?: string | null
          panturrilha_direita_cm?: number | null
          panturrilha_esquerda_cm?: number | null
          percentual_gordura?: number | null
          peso_kg?: number | null
          protocolo?: string | null
          quadril_cm?: number | null
          student_id?: string
          torax_cm?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_receipts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          receipt_data: Json
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          receipt_data: Json
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          receipt_data?: Json
          token?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          anexo_url: string | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_payment_url: string | null
          cash_session_id: string | null
          categoria_id: string | null
          centro_receita_id: string | null
          conta_financeira_id: string | null
          contractor_id: string
          contrato_id: string | null
          created_at: string
          data_competencia: string | null
          desconto: number
          descricao: string
          forma_pagamento: string | null
          gateway_provider: string | null
          gateway_status: string | null
          hora_recebimento: string | null
          id: string
          juros: number
          modo: string | null
          multa: number
          observacoes: string | null
          pagador: string | null
          pago_em: string | null
          parcela_numero: number | null
          status: string
          student_contract_id: string | null
          student_id: string | null
          student_nome: string | null
          subcategoria_id: string | null
          tipo: string
          total_parcelas: number | null
          updated_at: string
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          anexo_url?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_payment_url?: string | null
          cash_session_id?: string | null
          categoria_id?: string | null
          centro_receita_id?: string | null
          conta_financeira_id?: string | null
          contractor_id: string
          contrato_id?: string | null
          created_at?: string
          data_competencia?: string | null
          desconto?: number
          descricao: string
          forma_pagamento?: string | null
          gateway_provider?: string | null
          gateway_status?: string | null
          hora_recebimento?: string | null
          id?: string
          juros?: number
          modo?: string | null
          multa?: number
          observacoes?: string | null
          pagador?: string | null
          pago_em?: string | null
          parcela_numero?: number | null
          status?: string
          student_contract_id?: string | null
          student_id?: string | null
          student_nome?: string | null
          subcategoria_id?: string | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          anexo_url?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_payment_url?: string | null
          cash_session_id?: string | null
          categoria_id?: string | null
          centro_receita_id?: string | null
          conta_financeira_id?: string | null
          contractor_id?: string
          contrato_id?: string | null
          created_at?: string
          data_competencia?: string | null
          desconto?: number
          descricao?: string
          forma_pagamento?: string | null
          gateway_provider?: string | null
          gateway_status?: string | null
          hora_recebimento?: string | null
          id?: string
          juros?: number
          modo?: string | null
          multa?: number
          observacoes?: string | null
          pagador?: string | null
          pago_em?: string | null
          parcela_numero?: number | null
          status?: string
          student_contract_id?: string | null
          student_id?: string | null
          student_nome?: string | null
          subcategoria_id?: string | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_centro_receita_id_fkey"
            columns: ["centro_receita_id"]
            isOneToOne: false
            referencedRelation: "centros_receita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_conta_financeira_id_fkey"
            columns: ["conta_financeira_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_student_contract_id_fkey"
            columns: ["student_contract_id"]
            isOneToOne: false
            referencedRelation: "student_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          ativo: boolean
          contractor_id: string
          created_at: string
          descricao: string
          foto_url: string | null
          id: string
          observacoes: string | null
          pontos: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contractor_id: string
          created_at?: string
          descricao: string
          foto_url?: string | null
          id?: string
          observacoes?: string | null
          pontos?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contractor_id?: string
          created_at?: string
          descricao?: string
          foto_url?: string | null
          id?: string
          observacoes?: string | null
          pontos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          contractor_id: string
          id: string
          module_name: string
          role: string
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          contractor_id: string
          id?: string
          module_name: string
          role: string
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          contractor_id?: string
          id?: string
          module_name?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      schedule_grids: {
        Row: {
          acesso_antecedencia_min: number | null
          acesso_tolerancia_atraso_min: number | null
          agenda_livre: boolean
          antecedencia_checkin_min: number
          ativo: boolean
          cancelar_checkin_limite_min: number | null
          capacidade_maxima: number
          checkin_app_modo: string
          comissionar_instrutor: boolean
          considera_faltantes_comissao: boolean
          contractor_id: string
          cor: string
          created_at: string
          dias_semana: string[]
          duracao_minutos: number | null
          encerramento_checkin_min: number
          exibir_app_modo: string
          fila_espera_ativa: boolean
          hora_fim: string
          hora_inicio: string
          id: string
          max_clientes_especiais: number | null
          max_leads: number | null
          min_clientes_comissao: number | null
          modalidade_id: string | null
          modalidade_nome: string | null
          nome: string
          permite_cancelar_checkin: boolean
          permite_clientes_especiais: boolean
          permite_leads: boolean
          restricao_genero: string | null
          staff_id: string | null
          staff_nome: string | null
          tipo: string
          tipo_comissao: string | null
          unit_id: string | null
          unit_nome: string | null
          valor_comissao_centavos: number | null
        }
        Insert: {
          acesso_antecedencia_min?: number | null
          acesso_tolerancia_atraso_min?: number | null
          agenda_livre?: boolean
          antecedencia_checkin_min?: number
          ativo?: boolean
          cancelar_checkin_limite_min?: number | null
          capacidade_maxima?: number
          checkin_app_modo?: string
          comissionar_instrutor?: boolean
          considera_faltantes_comissao?: boolean
          contractor_id: string
          cor?: string
          created_at?: string
          dias_semana?: string[]
          duracao_minutos?: number | null
          encerramento_checkin_min?: number
          exibir_app_modo?: string
          fila_espera_ativa?: boolean
          hora_fim: string
          hora_inicio: string
          id?: string
          max_clientes_especiais?: number | null
          max_leads?: number | null
          min_clientes_comissao?: number | null
          modalidade_id?: string | null
          modalidade_nome?: string | null
          nome?: string
          permite_cancelar_checkin?: boolean
          permite_clientes_especiais?: boolean
          permite_leads?: boolean
          restricao_genero?: string | null
          staff_id?: string | null
          staff_nome?: string | null
          tipo?: string
          tipo_comissao?: string | null
          unit_id?: string | null
          unit_nome?: string | null
          valor_comissao_centavos?: number | null
        }
        Update: {
          acesso_antecedencia_min?: number | null
          acesso_tolerancia_atraso_min?: number | null
          agenda_livre?: boolean
          antecedencia_checkin_min?: number
          ativo?: boolean
          cancelar_checkin_limite_min?: number | null
          capacidade_maxima?: number
          checkin_app_modo?: string
          comissionar_instrutor?: boolean
          considera_faltantes_comissao?: boolean
          contractor_id?: string
          cor?: string
          created_at?: string
          dias_semana?: string[]
          duracao_minutos?: number | null
          encerramento_checkin_min?: number
          exibir_app_modo?: string
          fila_espera_ativa?: boolean
          hora_fim?: string
          hora_inicio?: string
          id?: string
          max_clientes_especiais?: number | null
          max_leads?: number | null
          min_clientes_comissao?: number | null
          modalidade_id?: string | null
          modalidade_nome?: string | null
          nome?: string
          permite_cancelar_checkin?: boolean
          permite_clientes_especiais?: boolean
          permite_leads?: boolean
          restricao_genero?: string | null
          staff_id?: string | null
          staff_nome?: string | null
          tipo?: string
          tipo_comissao?: string | null
          unit_id?: string | null
          unit_nome?: string | null
          valor_comissao_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_grids_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_grids_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "modalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_grids_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_grids_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_replacement_credits: {
        Row: {
          contractor_id: string
          contrato_id: string | null
          created_at: string
          gerado_em: string
          gerado_por: string | null
          id: string
          modalidade_id: string | null
          modalidade_nome: string | null
          motivo: string | null
          observacoes: string | null
          original_booking_id: string
          original_slot_id: string
          status: string
          student_contract_id: string | null
          student_id: string
          student_nome: string | null
          updated_at: string
          usado_em: string | null
          used_booking_id: string | null
          used_slot_id: string | null
          validade: string | null
        }
        Insert: {
          contractor_id: string
          contrato_id?: string | null
          created_at?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          modalidade_id?: string | null
          modalidade_nome?: string | null
          motivo?: string | null
          observacoes?: string | null
          original_booking_id: string
          original_slot_id: string
          status?: string
          student_contract_id?: string | null
          student_id: string
          student_nome?: string | null
          updated_at?: string
          usado_em?: string | null
          used_booking_id?: string | null
          used_slot_id?: string | null
          validade?: string | null
        }
        Update: {
          contractor_id?: string
          contrato_id?: string | null
          created_at?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          modalidade_id?: string | null
          modalidade_nome?: string | null
          motivo?: string | null
          observacoes?: string | null
          original_booking_id?: string
          original_slot_id?: string
          status?: string
          student_contract_id?: string | null
          student_id?: string
          student_nome?: string | null
          updated_at?: string
          usado_em?: string | null
          used_booking_id?: string | null
          used_slot_id?: string | null
          validade?: string | null
        }
        Relationships: []
      }
      schedule_session_usage: {
        Row: {
          booking_id: string
          contractor_id: string
          contrato_id: string | null
          created_at: string
          criado_por: string | null
          estornado: boolean
          estornado_em: string | null
          estornado_por: string | null
          id: string
          modalidade_id: string | null
          modalidade_nome: string | null
          motivo: string | null
          motivo_estorno: string | null
          origem_agendamento: string | null
          quantidade: number
          slot_id: string
          status_booking: string
          student_contract_id: string | null
          student_id: string
          student_nome: string | null
          tipo_consumo: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          contractor_id: string
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          id?: string
          modalidade_id?: string | null
          modalidade_nome?: string | null
          motivo?: string | null
          motivo_estorno?: string | null
          origem_agendamento?: string | null
          quantidade?: number
          slot_id: string
          status_booking: string
          student_contract_id?: string | null
          student_id: string
          student_nome?: string | null
          tipo_consumo?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          contractor_id?: string
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          id?: string
          modalidade_id?: string | null
          modalidade_nome?: string | null
          motivo?: string | null
          motivo_estorno?: string | null
          origem_agendamento?: string | null
          quantidade?: number
          slot_id?: string
          status_booking?: string
          student_contract_id?: string | null
          student_id?: string
          student_nome?: string | null
          tipo_consumo?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_slot_history: {
        Row: {
          booking_id: string | null
          contractor_id: string
          created_at: string
          criado_por: string | null
          dados: Json
          descricao: string
          evento: string
          id: string
          lead_id: string | null
          origem_agendamento: string | null
          pessoa_tipo: string | null
          slot_id: string
          student_id: string | null
        }
        Insert: {
          booking_id?: string | null
          contractor_id: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          descricao: string
          evento: string
          id?: string
          lead_id?: string | null
          origem_agendamento?: string | null
          pessoa_tipo?: string | null
          slot_id: string
          student_id?: string | null
        }
        Update: {
          booking_id?: string | null
          contractor_id?: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          descricao?: string
          evento?: string
          id?: string
          lead_id?: string | null
          origem_agendamento?: string | null
          pessoa_tipo?: string | null
          slot_id?: string
          student_id?: string | null
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          capacidade_maxima: number
          contractor_id: string
          cor: string
          created_at: string
          data: string
          grid_id: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          modalidade_id: string | null
          modalidade_nome: string | null
          observacoes: string | null
          staff_id: string | null
          staff_nome: string | null
          status: string
          tipo: string
          unit_id: string | null
          unit_nome: string | null
        }
        Insert: {
          capacidade_maxima?: number
          contractor_id: string
          cor?: string
          created_at?: string
          data: string
          grid_id?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          modalidade_id?: string | null
          modalidade_nome?: string | null
          observacoes?: string | null
          staff_id?: string | null
          staff_nome?: string | null
          status?: string
          tipo?: string
          unit_id?: string | null
          unit_nome?: string | null
        }
        Update: {
          capacidade_maxima?: number
          contractor_id?: string
          cor?: string
          created_at?: string
          data?: string
          grid_id?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          modalidade_id?: string | null
          modalidade_nome?: string | null
          observacoes?: string | null
          staff_id?: string | null
          staff_nome?: string | null
          status?: string
          tipo?: string
          unit_id?: string | null
          unit_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_grid_id_fkey"
            columns: ["grid_id"]
            isOneToOne: false
            referencedRelation: "schedule_grids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "modalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          compound_group: number | null
          created_at: string
          exercise_id: string | null
          exercise_nome: string
          id: string
          ordem: number
          series_data: Json
          session_id: string
          tipo: string
        }
        Insert: {
          compound_group?: number | null
          created_at?: string
          exercise_id?: string | null
          exercise_nome: string
          id?: string
          ordem?: number
          series_data?: Json
          session_id: string
          tipo?: string
        }
        Update: {
          compound_group?: number | null
          created_at?: string
          exercise_id?: string | null
          exercise_nome?: string
          id?: string
          ordem?: number
          series_data?: Json
          session_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          agencia: string | null
          bairro: string | null
          banco: string | null
          blocked: boolean
          carga_horaria_semanal: number | null
          cargo_descricao: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          complemento: string | null
          conta: string | null
          contractor_id: string
          cpf: string | null
          created_at: string
          ctps_numero: string | null
          ctps_serie: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string
          horarios_restricao: Json | null
          id: string
          logradouro: string | null
          name: string
          numero_conselho: string | null
          numero_endereco: string | null
          observacoes: string | null
          password_hash: string
          pis_pasep: string | null
          rg: string | null
          role: string
          sexo: string | null
          telefone: string | null
          tipo_conselho: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          uf: string | null
          updated_at: string
          valor_passagem: number | null
        }
        Insert: {
          active?: boolean
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          blocked?: boolean
          carga_horaria_semanal?: number | null
          cargo_descricao?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          contractor_id: string
          cpf?: string | null
          created_at?: string
          ctps_numero?: string | null
          ctps_serie?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email: string
          horarios_restricao?: Json | null
          id?: string
          logradouro?: string | null
          name: string
          numero_conselho?: string | null
          numero_endereco?: string | null
          observacoes?: string | null
          password_hash: string
          pis_pasep?: string | null
          rg?: string | null
          role: string
          sexo?: string | null
          telefone?: string | null
          tipo_conselho?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          uf?: string | null
          updated_at?: string
          valor_passagem?: number | null
        }
        Update: {
          active?: boolean
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          blocked?: boolean
          carga_horaria_semanal?: number | null
          cargo_descricao?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          contractor_id?: string
          cpf?: string | null
          created_at?: string
          ctps_numero?: string | null
          ctps_serie?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string
          horarios_restricao?: Json | null
          id?: string
          logradouro?: string | null
          name?: string
          numero_conselho?: string | null
          numero_endereco?: string | null
          observacoes?: string | null
          password_hash?: string
          pis_pasep?: string | null
          rg?: string | null
          role?: string
          sexo?: string | null
          telefone?: string | null
          tipo_conselho?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          uf?: string | null
          updated_at?: string
          valor_passagem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documentos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          contractor_id: string
          created_at: string
          id: string
          staff_id: string
          tamanho: number | null
          tipo: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          contractor_id: string
          created_at?: string
          id?: string
          staff_id: string
          tamanho?: number | null
          tipo?: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          contractor_id?: string
          created_at?: string
          id?: string
          staff_id?: string
          tamanho?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_documentos_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documentos_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_ferias: {
        Row: {
          contractor_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          dias: number
          id: string
          observacao: string | null
          staff_id: string
          status: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          dias?: number
          id?: string
          observacao?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dias?: number
          id?: string
          observacao?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_ferias_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_ferias_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_ocorrencias: {
        Row: {
          atraso_segundos: number | null
          contractor_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          hora_chegada: string | null
          hora_saida: string | null
          id: string
          staff_id: string
          status: string
          tipo: string
        }
        Insert: {
          atraso_segundos?: number | null
          contractor_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          hora_chegada?: string | null
          hora_saida?: string | null
          id?: string
          staff_id: string
          status?: string
          tipo: string
        }
        Update: {
          atraso_segundos?: number | null
          contractor_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          hora_chegada?: string | null
          hora_saida?: string | null
          id?: string
          staff_id?: string
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_ocorrencias_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_ocorrencias_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salarios: {
        Row: {
          contractor_id: string
          created_at: string
          data_vigencia: string
          id: string
          motivo: string
          observacao: string | null
          staff_id: string
          valor: number
        }
        Insert: {
          contractor_id: string
          created_at?: string
          data_vigencia: string
          id?: string
          motivo: string
          observacao?: string | null
          staff_id: string
          valor: number
        }
        Update: {
          contractor_id?: string
          created_at?: string
          data_vigencia?: string
          id?: string
          motivo?: string
          observacao?: string | null
          staff_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_salarios_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_salarios_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      student_contracts: {
        Row: {
          bloqueado: boolean | null
          cancelar_contas_encerrar: boolean | null
          contractor_id: string
          contrato_id: string
          created_at: string | null
          data_congelamento_fim: string | null
          data_congelamento_inicio: string | null
          data_encerramento_prog: string | null
          data_fim: string | null
          data_inicio: string
          desconto: number | null
          descricao_encerramento: string | null
          dia_vencimento: number
          forma_pagamento: string | null
          id: string
          motivo_bloqueio: string | null
          motivo_congelamento: string | null
          motivo_encerramento: string | null
          num_parcelas: number | null
          observacoes: string | null
          renovacao_automatica: boolean | null
          status: string
          student_id: string
          tipo_venda: string | null
          updated_at: string | null
          valor_mensalidade: number
        }
        Insert: {
          bloqueado?: boolean | null
          cancelar_contas_encerrar?: boolean | null
          contractor_id: string
          contrato_id: string
          created_at?: string | null
          data_congelamento_fim?: string | null
          data_congelamento_inicio?: string | null
          data_encerramento_prog?: string | null
          data_fim?: string | null
          data_inicio: string
          desconto?: number | null
          descricao_encerramento?: string | null
          dia_vencimento?: number
          forma_pagamento?: string | null
          id?: string
          motivo_bloqueio?: string | null
          motivo_congelamento?: string | null
          motivo_encerramento?: string | null
          num_parcelas?: number | null
          observacoes?: string | null
          renovacao_automatica?: boolean | null
          status?: string
          student_id: string
          tipo_venda?: string | null
          updated_at?: string | null
          valor_mensalidade: number
        }
        Update: {
          bloqueado?: boolean | null
          cancelar_contas_encerrar?: boolean | null
          contractor_id?: string
          contrato_id?: string
          created_at?: string | null
          data_congelamento_fim?: string | null
          data_congelamento_inicio?: string | null
          data_encerramento_prog?: string | null
          data_fim?: string | null
          data_inicio?: string
          desconto?: number | null
          descricao_encerramento?: string | null
          dia_vencimento?: number
          forma_pagamento?: string | null
          id?: string
          motivo_bloqueio?: string | null
          motivo_congelamento?: string | null
          motivo_encerramento?: string | null
          num_parcelas?: number | null
          observacoes?: string | null
          renovacao_automatica?: boolean | null
          status?: string
          student_id?: string
          tipo_venda?: string | null
          updated_at?: string | null
          valor_mensalidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_contracts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_contracts_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          contractor_id: string
          created_at: string
          descricao: string | null
          id: string
          student_id: string
          titulo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          contractor_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          student_id: string
          titulo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          contractor_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          student_id?: string
          titulo?: string
        }
        Relationships: []
      }
      student_exams: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          contractor_id: string
          created_at: string
          crm: string | null
          data_exame: string | null
          data_validade: string | null
          id: string
          medico_nome: string | null
          student_id: string
          validade_meses: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          contractor_id: string
          created_at?: string
          crm?: string | null
          data_exame?: string | null
          data_validade?: string | null
          id?: string
          medico_nome?: string | null
          student_id: string
          validade_meses?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          contractor_id?: string
          created_at?: string
          crm?: string | null
          data_exame?: string | null
          data_validade?: string | null
          id?: string
          medico_nome?: string | null
          student_id?: string
          validade_meses?: number | null
        }
        Relationships: []
      }
      students: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          contatos_extras: Json | null
          contractor_id: string
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          foto_url: string | null
          id: string
          logradouro: string | null
          nome_completo: string
          numero: string | null
          objetivo: string | null
          observacoes: string | null
          origem: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          sexo: string | null
          staff_id: string | null
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          whatsapp_notificacoes: boolean
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contatos_extras?: Json | null
          contractor_id: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          logradouro?: string | null
          nome_completo: string
          numero?: string | null
          objetivo?: string | null
          observacoes?: string | null
          origem?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sexo?: string | null
          staff_id?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp_notificacoes?: boolean
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contatos_extras?: Json | null
          contractor_id?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          logradouro?: string | null
          nome_completo?: string
          numero?: string | null
          objetivo?: string | null
          observacoes?: string | null
          origem?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sexo?: string | null
          staff_id?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp_notificacoes?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "students_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategorias_financeiras: {
        Row: {
          categoria_id: string
          contractor_id: string
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          categoria_id: string
          contractor_id: string
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          categoria_id?: string
          contractor_id?: string
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategorias_financeiras_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_contratos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          contractor_id: string
          created_at: string | null
          descricao: string
          id: string
          updated_at: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          contractor_id: string
          created_at?: string | null
          descricao: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          contractor_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_contratos_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          cash_session_id: string | null
          categoria: string
          contractor_id: string
          created_at: string
          data: string
          descricao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          receivable_id: string | null
          student_id: string | null
          student_nome: string | null
          tipo: string
          valor: number
        }
        Insert: {
          cash_session_id?: string | null
          categoria?: string
          contractor_id: string
          created_at?: string
          data?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          receivable_id?: string | null
          student_id?: string | null
          student_nome?: string | null
          tipo: string
          valor: number
        }
        Update: {
          cash_session_id?: string | null
          categoria?: string
          contractor_id?: string
          created_at?: string
          data?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          receivable_id?: string | null
          student_id?: string | null
          student_nome?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          anexo_url: string | null
          conta_destino_id: string
          conta_origem_id: string
          contractor_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          observacoes: string | null
          valor: number
        }
        Insert: {
          anexo_url?: string | null
          conta_destino_id: string
          conta_origem_id: string
          contractor_id: string
          created_at?: string
          data: string
          descricao?: string
          id?: string
          observacoes?: string | null
          valor: number
        }
        Update: {
          anexo_url?: string | null
          conta_destino_id?: string
          conta_origem_id?: string
          contractor_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          contractor_id: string
          created_at: string | null
          email: string | null
          id: string
          is_principal: boolean | null
          logradouro: string | null
          nome: string
          numero: string | null
          telefone: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contractor_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_principal?: boolean | null
          logradouro?: string | null
          nome: string
          numero?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contractor_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_principal?: boolean | null
          logradouro?: string | null
          nome?: string
          numero?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wod_sessions: {
        Row: {
          conteudo: string
          id: string
          informar_resultado: boolean | null
          movimento: string
          ordem: number | null
          titulo: string
          wod_id: string
        }
        Insert: {
          conteudo?: string
          id?: string
          informar_resultado?: boolean | null
          movimento?: string
          ordem?: number | null
          titulo?: string
          wod_id: string
        }
        Update: {
          conteudo?: string
          id?: string
          informar_resultado?: boolean | null
          movimento?: string
          ordem?: number | null
          titulo?: string
          wod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wod_sessions_wod_id_fkey"
            columns: ["wod_id"]
            isOneToOne: false
            referencedRelation: "wods"
            referencedColumns: ["id"]
          },
        ]
      }
      wods: {
        Row: {
          contractor_id: string
          created_at: string | null
          data: string
          descricao: string
          id: string
          modalidade: string
          updated_at: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          data: string
          descricao?: string
          id?: string
          modalidade?: string
          updated_at?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          data?: string
          descricao?: string
          id?: string
          modalidade?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      workout_session_exercise_series: {
        Row: {
          carga_kg: number | null
          exercise_sessao_id: string
          id: string
          numero_serie: number
          valor: string
        }
        Insert: {
          carga_kg?: number | null
          exercise_sessao_id: string
          id?: string
          numero_serie: number
          valor?: string
        }
        Update: {
          carga_kg?: number | null
          exercise_sessao_id?: string
          id?: string
          numero_serie?: number
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_exercise_series_exercise_sessao_id_fkey"
            columns: ["exercise_sessao_id"]
            isOneToOne: false
            referencedRelation: "workout_session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_session_exercises: {
        Row: {
          bi_set_grupo: number | null
          created_at: string
          exercise_id: string | null
          exercise_nome: string
          id: string
          intervalo_seg: number | null
          observacao: string | null
          ordem: number
          series: number
          session_id: string
          tipo_metrica: string
        }
        Insert: {
          bi_set_grupo?: number | null
          created_at?: string
          exercise_id?: string | null
          exercise_nome: string
          id?: string
          intervalo_seg?: number | null
          observacao?: string | null
          ordem?: number
          series?: number
          session_id: string
          tipo_metrica?: string
        }
        Update: {
          bi_set_grupo?: number | null
          created_at?: string
          exercise_id?: string | null
          exercise_nome?: string
          id?: string
          intervalo_seg?: number | null
          observacao?: string | null
          ordem?: number
          series?: number
          session_id?: string
          tipo_metrica?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          contractor_id: string
          controla_treino: boolean
          created_at: string
          data_vencimento: string | null
          frequencia_semanal: number
          id: string
          idade_maxima: number | null
          idade_minima: number | null
          imprimir_automaticamente: boolean
          nivel: string | null
          nome: string
          observacoes: string | null
          quantidade: number | null
          responsavel_id: string | null
          responsavel_nome: string | null
          sexo: string | null
          status: string
          student_id: string | null
          tipo_controle: string | null
          tipo_treino: string
          treinos_realizados: number
          updated_at: string
        }
        Insert: {
          contractor_id: string
          controla_treino?: boolean
          created_at?: string
          data_vencimento?: string | null
          frequencia_semanal?: number
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          imprimir_automaticamente?: boolean
          nivel?: string | null
          nome: string
          observacoes?: string | null
          quantidade?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          sexo?: string | null
          status?: string
          student_id?: string | null
          tipo_controle?: string | null
          tipo_treino?: string
          treinos_realizados?: number
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          controla_treino?: boolean
          created_at?: string
          data_vencimento?: string | null
          frequencia_semanal?: number
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          imprimir_automaticamente?: boolean
          nivel?: string | null
          nome?: string
          observacoes?: string | null
          quantidade?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          sexo?: string | null
          status?: string
          student_id?: string | null
          tipo_controle?: string | null
          tipo_treino?: string
          treinos_realizados?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_slot_occupancy: {
        Row: {
          slot_id: string | null
          total_reservas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calcular_comissao_aula: { Args: { p_slot_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
