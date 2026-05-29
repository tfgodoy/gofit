export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffRole =
  | "admin"
  | "teacher"
  | "receptionist"
  | "sales"
  | "nutritionist"
  | "physiotherapist"
  | "evaluator";

export type ContractorStatus = "active" | "inactive" | "suspended" | "trial";
export type ContractorPlan = "trial" | "starter" | "profissional" | "empresarial";

export interface Database {
  public: {
    Tables: {
      modalidades: {
        Row: {
          id: string;
          contractor_id: string;
          descricao: string;
          utiliza_agenda: boolean;
          utiliza_wod: boolean;
          exibir_wod_app: boolean;
          exibicao_wod: string;
          exibe_wod_antes_dia: boolean;
          dias_semana: string[];
          cor: string;
          icone: string;
          utiliza_gonutri: boolean;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          descricao: string;
          utiliza_agenda?: boolean;
          utiliza_wod?: boolean;
          exibir_wod_app?: boolean;
          exibicao_wod?: string;
          exibe_wod_antes_dia?: boolean;
          dias_semana?: string[];
          cor?: string;
          icone?: string;
          utiliza_gonutri?: boolean;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          descricao?: string;
          utiliza_agenda?: boolean;
          utiliza_wod?: boolean;
          exibir_wod_app?: boolean;
          exibicao_wod?: string;
          exibe_wod_antes_dia?: boolean;
          dias_semana?: string[];
          cor?: string;
          icone?: string;
          utiliza_gonutri?: boolean;
          ativo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      contratos: {
        Row: {
          id: string;
          contractor_id: string;
          descricao: string;
          tipo: string;
          duracao: number;
          tipo_duracao: string;
          valor_total: number;
          valor_por_mes: number | null;
          permite_renovar: boolean;
          renova_automaticamente: boolean;
          renovacao_quando: string | null;
          permite_parcelado: boolean;
          max_parcelas: number | null;
          formas_pagamento: string[];
          template_contrato: string | null;
          assinatura_eletronica: boolean;
          forma_envio_assinatura: string | null;
          ativo: boolean;
          limita_periodo_venda: boolean;
          data_inicio_venda: string | null;
          data_fim_venda: string | null;
          max_suspensoes: number | null;
          max_dias_suspensao: number | null;
          permite_pre_venda: boolean;
          possui_valor_adesao: boolean;
          valor_adesao: number | null;
          comissionar_consultor: boolean;
          categoria_receita: string | null;
          vende_app_aluno: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          descricao: string;
          tipo?: string;
          duracao?: number;
          tipo_duracao?: string;
          valor_total?: number;
          valor_por_mes?: number | null;
          permite_renovar?: boolean;
          renova_automaticamente?: boolean;
          renovacao_quando?: string | null;
          permite_parcelado?: boolean;
          max_parcelas?: number | null;
          formas_pagamento?: string[];
          template_contrato?: string | null;
          assinatura_eletronica?: boolean;
          forma_envio_assinatura?: string | null;
          ativo?: boolean;
          limita_periodo_venda?: boolean;
          data_inicio_venda?: string | null;
          data_fim_venda?: string | null;
          max_suspensoes?: number | null;
          max_dias_suspensao?: number | null;
          permite_pre_venda?: boolean;
          possui_valor_adesao?: boolean;
          valor_adesao?: number | null;
          comissionar_consultor?: boolean;
          categoria_receita?: string | null;
          vende_app_aluno?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          descricao?: string;
          tipo?: string;
          duracao?: number;
          tipo_duracao?: string;
          valor_total?: number;
          valor_por_mes?: number | null;
          permite_renovar?: boolean;
          renova_automaticamente?: boolean;
          renovacao_quando?: string | null;
          permite_parcelado?: boolean;
          max_parcelas?: number | null;
          formas_pagamento?: string[];
          template_contrato?: string | null;
          assinatura_eletronica?: boolean;
          forma_envio_assinatura?: string | null;
          ativo?: boolean;
          limita_periodo_venda?: boolean;
          data_inicio_venda?: string | null;
          data_fim_venda?: string | null;
          max_suspensoes?: number | null;
          max_dias_suspensao?: number | null;
          permite_pre_venda?: boolean;
          possui_valor_adesao?: boolean;
          valor_adesao?: number | null;
          comissionar_consultor?: boolean;
          categoria_receita?: string | null;
          vende_app_aluno?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contrato_modalidades: {
        Row: {
          id: string;
          contrato_id: string;
          nome: string;
          tipo_acesso: string;
          sessoes_por_semana: number | null;
          total_aulas: number | null;
          contabilizar_conjunto: boolean;
          modalidade_id: string | null;
          limitar_acessos: boolean;
          max_acessos: number | null;
          tipo_duracao_acessos: string;
          limitar_horarios: boolean;
          periodos_horario: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          contrato_id: string;
          nome?: string;
          tipo_acesso?: string;
          sessoes_por_semana?: number | null;
          total_aulas?: number | null;
          contabilizar_conjunto?: boolean;
          modalidade_id?: string | null;
          limitar_acessos?: boolean;
          max_acessos?: number | null;
          tipo_duracao_acessos?: string;
          limitar_horarios?: boolean;
          periodos_horario?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          contrato_id?: string;
          nome?: string;
          tipo_acesso?: string;
          sessoes_por_semana?: number | null;
          total_aulas?: number | null;
          contabilizar_conjunto?: boolean;
          modalidade_id?: string | null;
          limitar_acessos?: boolean;
          max_acessos?: number | null;
          tipo_duracao_acessos?: string;
          limitar_horarios?: boolean;
          periodos_horario?: unknown;
          created_at?: string;
        };
        Relationships: [];
      };
      contractors: {
        Row: {
          id: string;
          razao_social: string;
          nome_fantasia: string;
          cnpj: string | null;
          email: string;
          fone: string | null;
          fuso_horario: string;
          site: string | null;
          instagram: string | null;
          cep: string | null;
          logradouro: string | null;
          numero: string | null;
          bairro: string | null;
          complemento: string | null;
          cidade: string | null;
          uf: string | null;
          status: ContractorStatus;
          plan: ContractorPlan;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          razao_social: string;
          nome_fantasia: string;
          cnpj?: string | null;
          email: string;
          fone?: string | null;
          fuso_horario?: string;
          site?: string | null;
          instagram?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          bairro?: string | null;
          complemento?: string | null;
          cidade?: string | null;
          uf?: string | null;
          status?: ContractorStatus;
          plan?: ContractorPlan;
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          razao_social?: string;
          nome_fantasia?: string;
          cnpj?: string | null;
          email?: string;
          fone?: string | null;
          fuso_horario?: string;
          site?: string | null;
          instagram?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          bairro?: string | null;
          complemento?: string | null;
          cidade?: string | null;
          uf?: string | null;
          status?: ContractorStatus;
          plan?: ContractorPlan;
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contractor_auth: {
        Row: {
          id: string;
          contractor_id: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          password_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          password_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contractor_auth_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      staff: {
        Row: {
          id: string;
          contractor_id: string;
          name: string;
          email: string;
          role: StaffRole;
          password_hash: string;
          active: boolean;
          blocked: boolean;
          deleted_at: string | null;
          cpf: string | null;
          rg: string | null;
          data_nascimento: string | null;
          sexo: "masculino" | "feminino" | "outro" | null;
          telefone: string | null;
          tipo_conselho: string | null;
          numero_conselho: string | null;
          cep: string | null;
          logradouro: string | null;
          numero_endereco: string | null;
          bairro: string | null;
          complemento: string | null;
          cidade: string | null;
          uf: string | null;
          horarios_restricao: Json | null;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          name: string;
          email: string;
          role: StaffRole;
          password_hash: string;
          active?: boolean;
          blocked?: boolean;
          deleted_at?: string | null;
          cpf?: string | null;
          rg?: string | null;
          data_nascimento?: string | null;
          sexo?: "masculino" | "feminino" | "outro" | null;
          telefone?: string | null;
          tipo_conselho?: string | null;
          numero_conselho?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero_endereco?: string | null;
          bairro?: string | null;
          complemento?: string | null;
          cidade?: string | null;
          uf?: string | null;
          horarios_restricao?: Json | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          name?: string;
          email?: string;
          role?: StaffRole;
          password_hash?: string;
          active?: boolean;
          blocked?: boolean;
          deleted_at?: string | null;
          cpf?: string | null;
          rg?: string | null;
          data_nascimento?: string | null;
          sexo?: "masculino" | "feminino" | "outro" | null;
          telefone?: string | null;
          tipo_conselho?: string | null;
          numero_conselho?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero_endereco?: string | null;
          bairro?: string | null;
          complemento?: string | null;
          cidade?: string | null;
          uf?: string | null;
          horarios_restricao?: Json | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      students: {
        Row: {
          id: string;
          contractor_id: string;
          nome_completo: string;
          cpf: string | null;
          data_nascimento: string | null;
          sexo: "masculino" | "feminino" | "outro" | null;
          status: "lead" | "ativo" | "inativo" | "cancelado";
          telefone: string | null;
          email: string | null;
          cep: string | null;
          logradouro: string | null;
          numero: string | null;
          complemento: string | null;
          bairro: string | null;
          cidade: string | null;
          uf: string | null;
          responsavel_nome: string | null;
          responsavel_telefone: string | null;
          responsavel_email: string | null;
          staff_id: string | null;
          contatos_extras: Json;
          whatsapp_notificacoes: boolean;
          observacoes: string | null;
          foto_url: string | null;
          objetivo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          nome_completo: string;
          cpf?: string | null;
          data_nascimento?: string | null;
          sexo?: "masculino" | "feminino" | "outro" | null;
          status?: "lead" | "ativo" | "inativo" | "cancelado";
          telefone?: string | null;
          email?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          uf?: string | null;
          responsavel_nome?: string | null;
          responsavel_telefone?: string | null;
          responsavel_email?: string | null;
          staff_id?: string | null;
          contatos_extras?: Json;
          whatsapp_notificacoes?: boolean;
          observacoes?: string | null;
          foto_url?: string | null;
          objetivo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          nome_completo?: string;
          cpf?: string | null;
          data_nascimento?: string | null;
          sexo?: "masculino" | "feminino" | "outro" | null;
          status?: "lead" | "ativo" | "inativo" | "cancelado";
          telefone?: string | null;
          email?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          uf?: string | null;
          responsavel_nome?: string | null;
          responsavel_telefone?: string | null;
          responsavel_email?: string | null;
          staff_id?: string | null;
          contatos_extras?: Json;
          whatsapp_notificacoes?: boolean;
          observacoes?: string | null;
          foto_url?: string | null;
          objetivo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      invites: {
        Row: {
          id: string;
          contractor_id: string;
          email: string | null;
          telefone: string | null;
          nome: string | null;
          invited_name: string | null;
          role: string | null;
          status: "pending" | "used" | "expired";
          student_id: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          email?: string | null;
          telefone?: string | null;
          nome?: string | null;
          invited_name?: string | null;
          role?: string | null;
          status?: "pending" | "used" | "expired";
          student_id?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          email?: string | null;
          telefone?: string | null;
          nome?: string | null;
          invited_name?: string | null;
          role?: string | null;
          status?: "pending" | "used" | "expired";
          student_id?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      exercise_groups: {
        Row: {
          id:            string;
          contractor_id: string;
          nome:          string;
          created_at:    string;
        };
        Insert: {
          id?:           string;
          contractor_id: string;
          nome:          string;
          created_at?:   string;
        };
        Update: {
          id?:           string;
          contractor_id?: string;
          nome?:         string;
          created_at?:   string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_groups_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      exercises: {
        Row: {
          id:                string;
          contractor_id:     string;
          nome:              string;
          grupo_id:          string | null;
          intensidade:       "facil" | "intermediario" | "dificil" | null;
          nome_impressao:    string | null;
          equipamento:       string | null;
          descricao:         string | null;
          demonstracao_tipo: "imagem" | "video" | null;
          demonstracao_url:  string | null;
          criado_por:        string;
          created_at:        string;
          updated_at:        string;
        };
        Insert: {
          id?:               string;
          contractor_id:     string;
          nome:              string;
          grupo_id?:         string | null;
          intensidade?:      "facil" | "intermediario" | "dificil" | null;
          nome_impressao?:   string | null;
          equipamento?:      string | null;
          descricao?:        string | null;
          demonstracao_tipo?: "imagem" | "video" | null;
          demonstracao_url?: string | null;
          criado_por?:       string;
          created_at?:       string;
          updated_at?:       string;
        };
        Update: {
          id?:               string;
          contractor_id?:    string;
          nome?:             string;
          grupo_id?:         string | null;
          intensidade?:      "facil" | "intermediario" | "dificil" | null;
          nome_impressao?:   string | null;
          equipamento?:      string | null;
          descricao?:        string | null;
          demonstracao_tipo?: "imagem" | "video" | null;
          demonstracao_url?: string | null;
          criado_por?:       string;
          created_at?:       string;
          updated_at?:       string;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercises_grupo_id_fkey";
            columns: ["grupo_id"];
            referencedRelation: "exercise_groups";
            referencedColumns: ["id"];
          }
        ];
      };
      sessions: {
        Row: {
          id:            string;
          contractor_id: string;
          nome:          string;
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:           string;
          contractor_id: string;
          nome:          string;
          created_at?:   string;
          updated_at?:   string;
        };
        Update: {
          id?:           string;
          contractor_id?: string;
          nome?:         string;
          created_at?:   string;
          updated_at?:   string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      session_exercises: {
        Row: {
          id:             string;
          session_id:     string;
          exercise_id:    string | null;
          exercise_nome:  string;
          ordem:          number;
          tipo:           string;
          series_data:    import("./types").Json;
          compound_group: number | null;
          created_at:     string;
        };
        Insert: {
          id?:            string;
          session_id:     string;
          exercise_id?:   string | null;
          exercise_nome:  string;
          ordem?:         number;
          tipo?:          string;
          series_data?:   import("./types").Json;
          compound_group?: number | null;
          created_at?:    string;
        };
        Update: {
          id?:            string;
          session_id?:    string;
          exercise_id?:   string | null;
          exercise_nome?: string;
          ordem?:         number;
          tipo?:          string;
          series_data?:   import("./types").Json;
          compound_group?: number | null;
          created_at?:    string;
        };
        Relationships: [
          {
            foreignKeyName: "session_exercises_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      workouts: {
        Row: {
          id:                       string;
          contractor_id:            string;
          student_id:               string | null;
          nome:                     string;
          responsavel_id:           string | null;
          responsavel_nome:         string | null;
          tipo_treino:              string;
          nivel:                    string | null;
          sexo:                     string | null;
          frequencia_semanal:       number;
          idade_minima:             number | null;
          idade_maxima:             number | null;
          imprimir_automaticamente: boolean;
          controla_treino:          boolean;
          tipo_controle:            string | null;
          quantidade:               number | null;
          data_vencimento:          string | null;
          observacoes:              string | null;
          status:                   string;
          treinos_realizados:       number;
          created_at:               string;
          updated_at:               string;
        };
        Insert: {
          id?:                       string;
          contractor_id:             string;
          student_id?:               string | null;
          nome:                      string;
          responsavel_id?:           string | null;
          responsavel_nome?:         string | null;
          tipo_treino?:              string;
          nivel?:                    string | null;
          sexo?:                     string | null;
          frequencia_semanal?:       number;
          idade_minima?:             number | null;
          idade_maxima?:             number | null;
          imprimir_automaticamente?: boolean;
          controla_treino?:          boolean;
          tipo_controle?:            string | null;
          quantidade?:               number | null;
          data_vencimento?:          string | null;
          observacoes?:              string | null;
          status?:                   string;
          treinos_realizados?:       number;
          created_at?:               string;
          updated_at?:               string;
        };
        Update: {
          id?:                       string;
          contractor_id?:            string;
          student_id?:               string | null;
          nome?:                     string;
          responsavel_id?:           string | null;
          responsavel_nome?:         string | null;
          tipo_treino?:              string;
          nivel?:                    string | null;
          sexo?:                     string | null;
          frequencia_semanal?:       number;
          idade_minima?:             number | null;
          idade_maxima?:             number | null;
          imprimir_automaticamente?: boolean;
          controla_treino?:          boolean;
          tipo_controle?:            string | null;
          quantidade?:               number | null;
          data_vencimento?:          string | null;
          observacoes?:              string | null;
          status?:                   string;
          treinos_realizados?:       number;
          created_at?:               string;
          updated_at?:               string;
        };
        Relationships: [
          {
            foreignKeyName: "workouts_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_sessions: {
        Row: {
          id:         string;
          workout_id: string;
          nome:       string;
          ordem:      number;
          created_at: string;
        };
        Insert: {
          id?:        string;
          workout_id: string;
          nome?:      string;
          ordem?:     number;
          created_at?: string;
        };
        Update: {
          id?:        string;
          workout_id?: string;
          nome?:      string;
          ordem?:     number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_workout_id_fkey";
            columns: ["workout_id"];
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_session_exercises: {
        Row: {
          id:             string;
          session_id:     string;
          exercise_id:    string | null;
          exercise_nome:  string;
          ordem:          number;
          series:         number;
          tipo_metrica:   string;
          intervalo_seg:  number | null;
          observacao:     string | null;
          bi_set_grupo:   number | null;
          created_at:     string;
        };
        Insert: {
          id?:            string;
          session_id:     string;
          exercise_id?:   string | null;
          exercise_nome:  string;
          ordem?:         number;
          series?:        number;
          tipo_metrica?:  string;
          intervalo_seg?: number | null;
          observacao?:    string | null;
          bi_set_grupo?:  number | null;
          created_at?:    string;
        };
        Update: {
          id?:            string;
          session_id?:    string;
          exercise_id?:   string | null;
          exercise_nome?: string;
          ordem?:         number;
          series?:        number;
          tipo_metrica?:  string;
          intervalo_seg?: number | null;
          observacao?:    string | null;
          bi_set_grupo?:  number | null;
          created_at?:    string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_session_exercises_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_session_exercise_series: {
        Row: {
          id:                 string;
          exercise_sessao_id: string;
          numero_serie:       number;
          valor:              string;
          carga_kg:           number | null;
        };
        Insert: {
          id?:                string;
          exercise_sessao_id: string;
          numero_serie:       number;
          valor?:             string;
          carga_kg?:          number | null;
        };
        Update: {
          id?:                string;
          exercise_sessao_id?: string;
          numero_serie?:      number;
          valor?:             string;
          carga_kg?:          number | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_session_exercise_series_exercise_sessao_id_fkey";
            columns: ["exercise_sessao_id"];
            referencedRelation: "workout_session_exercises";
            referencedColumns: ["id"];
          }
        ];
      };
      rewards: {
        Row: {
          id:            string;
          contractor_id: string;
          descricao:     string;
          observacoes:   string | null;
          pontos:        number;
          foto_url:      string | null;
          ativo:         boolean;
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:           string;
          contractor_id: string;
          descricao:     string;
          observacoes?:  string | null;
          pontos?:       number;
          foto_url?:     string | null;
          ativo?:        boolean;
          created_at?:   string;
          updated_at?:   string;
        };
        Update: {
          id?:           string;
          contractor_id?: string;
          descricao?:    string;
          observacoes?:  string | null;
          pontos?:       number;
          foto_url?:     string | null;
          ativo?:        boolean;
          created_at?:   string;
          updated_at?:   string;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_contractor_id_fkey";
            columns: ["contractor_id"];
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          }
        ];
      };
      anamnese_questoes: {
        Row: {
          id:             string;
          contractor_id:  string;
          pergunta:       string;
          tipo:           string;
          opcoes:         Json;
          permite_outro:  boolean;
          tem_respostas:  boolean;
          max_caracteres: number | null;
          created_at:     string;
        };
        Insert: {
          id?:             string;
          contractor_id:   string;
          pergunta:        string;
          tipo:            string;
          opcoes?:         Json;
          permite_outro?:  boolean;
          tem_respostas?:  boolean;
          max_caracteres?: number | null;
          created_at?:     string;
        };
        Update: {
          id?:             string;
          contractor_id?:  string;
          pergunta?:       string;
          tipo?:           string;
          opcoes?:         Json;
          permite_outro?:  boolean;
          tem_respostas?:  boolean;
          max_caracteres?: number | null;
          created_at?:     string;
        };
        Relationships: [];
      };
      anamnese_modelos: {
        Row: {
          id:                      string;
          contractor_id:           string;
          descricao:               string;
          respondido_pelo_cliente: boolean;
          exigir_aceite:           boolean;
          created_at:              string;
        };
        Insert: {
          id?:                      string;
          contractor_id:            string;
          descricao:                string;
          respondido_pelo_cliente?: boolean;
          exigir_aceite?:           boolean;
          created_at?:              string;
        };
        Update: {
          id?:                      string;
          contractor_id?:           string;
          descricao?:               string;
          respondido_pelo_cliente?: boolean;
          exigir_aceite?:           boolean;
          created_at?:              string;
        };
        Relationships: [];
      };
      anamnese_modelo_questoes: {
        Row: {
          id:          string;
          modelo_id:   string;
          questao_id:  string;
          ordem:       number;
          obrigatoria: boolean;
        };
        Insert: {
          id?:          string;
          modelo_id:    string;
          questao_id:   string;
          ordem?:       number;
          obrigatoria?: boolean;
        };
        Update: {
          id?:          string;
          modelo_id?:   string;
          questao_id?:  string;
          ordem?:       number;
          obrigatoria?: boolean;
        };
        Relationships: [];
      };
      anamnese_respostas: {
        Row: {
          id:                   string;
          contractor_id:        string;
          modelo_id:            string | null;
          student_id:           string | null;
          token:                string;
          status:               string;
          respondente_nome:     string | null;
          respondente_email:    string | null;
          respondente_telefone: string | null;
          parq:                 Json;
          aceite:               boolean;
          created_at:           string;
          respondido_at:        string | null;
        };
        Insert: {
          id?:                   string;
          contractor_id:         string;
          modelo_id?:            string | null;
          student_id?:           string | null;
          token?:                string;
          status?:               string;
          respondente_nome?:     string | null;
          respondente_email?:    string | null;
          respondente_telefone?: string | null;
          parq?:                 Json;
          aceite?:               boolean;
          created_at?:           string;
          respondido_at?:        string | null;
        };
        Update: {
          id?:                   string;
          contractor_id?:        string;
          modelo_id?:            string | null;
          student_id?:           string | null;
          token?:                string;
          status?:               string;
          respondente_nome?:     string | null;
          respondente_email?:    string | null;
          respondente_telefone?: string | null;
          parq?:                 Json;
          aceite?:               boolean;
          created_at?:           string;
          respondido_at?:        string | null;
        };
        Relationships: [];
      };
      anamnese_resposta_itens: {
        Row: {
          id:          string;
          resposta_id: string;
          questao_id:  string;
          valor:       Json | null;
        };
        Insert: {
          id?:          string;
          resposta_id:  string;
          questao_id:   string;
          valor?:       Json | null;
        };
        Update: {
          id?:          string;
          resposta_id?: string;
          questao_id?:  string;
          valor?:       Json | null;
        };
        Relationships: [];
      };
      student_documents: {
        Row: {
          id:            string;
          contractor_id: string;
          student_id:    string;
          titulo:        string;
          descricao:     string | null;
          arquivo_url:   string | null;
          arquivo_nome:  string | null;
          created_at:    string;
        };
        Insert: {
          id?:           string;
          contractor_id: string;
          student_id:    string;
          titulo:        string;
          descricao?:    string | null;
          arquivo_url?:  string | null;
          arquivo_nome?: string | null;
          created_at?:   string;
        };
        Update: {
          id?:           string;
          contractor_id?: string;
          student_id?:   string;
          titulo?:       string;
          descricao?:    string | null;
          arquivo_url?:  string | null;
          arquivo_nome?: string | null;
          created_at?:   string;
        };
        Relationships: [];
      };
      student_exams: {
        Row: {
          id:             string;
          contractor_id:  string;
          student_id:     string;
          data_exame:     string | null;
          validade_meses: number | null;
          data_validade:  string | null;
          medico_nome:    string | null;
          crm:            string | null;
          arquivo_url:    string | null;
          arquivo_nome:   string | null;
          created_at:     string;
        };
        Insert: {
          id?:             string;
          contractor_id:   string;
          student_id:      string;
          data_exame?:     string | null;
          validade_meses?: number | null;
          data_validade?:  string | null;
          medico_nome?:    string | null;
          crm?:            string | null;
          arquivo_url?:    string | null;
          arquivo_nome?:   string | null;
          created_at?:     string;
        };
        Update: {
          id?:             string;
          contractor_id?:  string;
          student_id?:     string;
          data_exame?:     string | null;
          validade_meses?: number | null;
          data_validade?:  string | null;
          medico_nome?:    string | null;
          crm?:            string | null;
          arquivo_url?:    string | null;
          arquivo_nome?:   string | null;
          created_at?:     string;
        };
        Relationships: [];
      };
      schedule_grids: {
        Row: {
          id:                string;
          contractor_id:     string;
          modalidade_id:     string | null;
          modalidade_nome:   string | null;
          staff_id:          string | null;
          staff_nome:        string | null;
          nome:              string;
          dias_semana:       string[];
          hora_inicio:       string;
          hora_fim:          string;
          capacidade_maxima: number;
          cor:               string;
          ativo:             boolean;
          created_at:        string;
        };
        Insert: {
          id?:                string;
          contractor_id:      string;
          modalidade_id?:     string | null;
          modalidade_nome?:   string | null;
          staff_id?:          string | null;
          staff_nome?:        string | null;
          nome?:              string;
          dias_semana?:       string[];
          hora_inicio:        string;
          hora_fim:           string;
          capacidade_maxima?: number;
          cor?:               string;
          ativo?:             boolean;
          created_at?:        string;
        };
        Update: {
          id?:                string;
          contractor_id?:     string;
          modalidade_id?:     string | null;
          modalidade_nome?:   string | null;
          staff_id?:          string | null;
          staff_nome?:        string | null;
          nome?:              string;
          dias_semana?:       string[];
          hora_inicio?:       string;
          hora_fim?:          string;
          capacidade_maxima?: number;
          cor?:               string;
          ativo?:             boolean;
          created_at?:        string;
        };
        Relationships: [];
      };
      schedule_slots: {
        Row: {
          id:                string;
          contractor_id:     string;
          grid_id:           string | null;
          modalidade_id:     string | null;
          modalidade_nome:   string | null;
          staff_id:          string | null;
          staff_nome:        string | null;
          data:              string;
          hora_inicio:       string;
          hora_fim:          string;
          capacidade_maxima: number;
          cor:               string;
          status:            string;
          observacoes:       string | null;
          created_at:        string;
        };
        Insert: {
          id?:                string;
          contractor_id:      string;
          grid_id?:           string | null;
          modalidade_id?:     string | null;
          modalidade_nome?:   string | null;
          staff_id?:          string | null;
          staff_nome?:        string | null;
          data:               string;
          hora_inicio:        string;
          hora_fim:           string;
          capacidade_maxima?: number;
          cor?:               string;
          status?:            string;
          observacoes?:       string | null;
          created_at?:        string;
        };
        Update: {
          id?:                string;
          contractor_id?:     string;
          grid_id?:           string | null;
          modalidade_id?:     string | null;
          modalidade_nome?:   string | null;
          staff_id?:          string | null;
          staff_nome?:        string | null;
          data?:              string;
          hora_inicio?:       string;
          hora_fim?:          string;
          capacidade_maxima?: number;
          cor?:               string;
          status?:            string;
          observacoes?:       string | null;
          created_at?:        string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id:            string;
          contractor_id: string;
          slot_id:       string;
          student_id:    string | null;
          student_nome:  string | null;
          status:        string;
          reservado_em:  string | null;
          checkin_em:    string | null;
          observacoes:   string | null;
          created_at:    string;
        };
        Insert: {
          id?:            string;
          contractor_id:  string;
          slot_id:        string;
          student_id?:    string | null;
          student_nome?:  string | null;
          status?:        string;
          reservado_em?:  string | null;
          checkin_em?:    string | null;
          observacoes?:   string | null;
          created_at?:    string;
        };
        Update: {
          id?:            string;
          contractor_id?: string;
          slot_id?:       string;
          student_id?:    string | null;
          student_nome?:  string | null;
          status?:        string;
          reservado_em?:  string | null;
          checkin_em?:    string | null;
          observacoes?:   string | null;
          created_at?:    string;
        };
        Relationships: [];
      };
      cash_sessions: {
        Row: {
          id:                     string;
          contractor_id:          string;
          aberto_por:             string | null;
          status:                 "aberto" | "fechado";
          saldo_inicial:          number;
          saldo_final:            number | null;
          total_entradas:         number;
          total_saidas:           number;
          observacoes_abertura:   string | null;
          observacoes_fechamento: string | null;
          opened_at:              string;
          closed_at:              string | null;
          created_at:             string;
        };
        Insert: {
          id?:                     string;
          contractor_id:           string;
          aberto_por?:             string | null;
          status?:                 "aberto" | "fechado";
          saldo_inicial?:          number;
          saldo_final?:            number | null;
          total_entradas?:         number;
          total_saidas?:           number;
          observacoes_abertura?:   string | null;
          observacoes_fechamento?: string | null;
          opened_at?:              string;
          closed_at?:              string | null;
          created_at?:             string;
        };
        Update: {
          id?:                     string;
          contractor_id?:          string;
          aberto_por?:             string | null;
          status?:                 "aberto" | "fechado";
          saldo_inicial?:          number;
          saldo_final?:            number | null;
          total_entradas?:         number;
          total_saidas?:           number;
          observacoes_abertura?:   string | null;
          observacoes_fechamento?: string | null;
          opened_at?:              string;
          closed_at?:              string | null;
          created_at?:             string;
        };
        Relationships: [];
      };
      receivables: {
        Row: {
          id:              string;
          contractor_id:   string;
          student_id:      string | null;
          student_nome:    string | null;
          descricao:       string;
          valor:           number;
          vencimento:      string;
          status:          "pendente" | "pago" | "atrasado" | "cancelado";
          tipo:            "mensalidade" | "matricula" | "avulso" | "multa" | "aula_avulsa" | "outros";
          contrato_id:     string | null;
          forma_pagamento: string | null;
          valor_pago:      number | null;
          desconto:        number | null;
          juros:           number | null;
          multa:           number | null;
          parcela_numero:  number | null;
          total_parcelas:  number | null;
          pago_em:         string | null;
          cash_session_id: string | null;
          observacoes:     string | null;
          created_at:      string;
          updated_at:      string;
        };
        Insert: {
          id?:              string;
          contractor_id:    string;
          student_id?:      string | null;
          student_nome?:    string | null;
          descricao:        string;
          valor:            number;
          vencimento:       string;
          status?:          "pendente" | "pago" | "atrasado" | "cancelado";
          tipo?:            "mensalidade" | "matricula" | "avulso" | "multa" | "aula_avulsa" | "outros";
          contrato_id?:     string | null;
          forma_pagamento?: string | null;
          valor_pago?:      number | null;
          desconto?:        number | null;
          juros?:           number | null;
          multa?:           number | null;
          parcela_numero?:  number | null;
          total_parcelas?:  number | null;
          pago_em?:         string | null;
          cash_session_id?: string | null;
          observacoes?:     string | null;
          created_at?:      string;
          updated_at?:      string;
        };
        Update: {
          id?:              string;
          contractor_id?:   string;
          student_id?:      string | null;
          student_nome?:    string | null;
          descricao?:       string;
          valor?:           number;
          vencimento?:      string;
          status?:          "pendente" | "pago" | "atrasado" | "cancelado";
          tipo?:            "mensalidade" | "matricula" | "avulso" | "multa" | "aula_avulsa" | "outros";
          contrato_id?:     string | null;
          forma_pagamento?: string | null;
          valor_pago?:      number | null;
          desconto?:        number | null;
          juros?:           number | null;
          multa?:           number | null;
          parcela_numero?:  number | null;
          total_parcelas?:  number | null;
          pago_em?:         string | null;
          cash_session_id?: string | null;
          observacoes?:     string | null;
          created_at?:      string;
          updated_at?:      string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id:              string;
          contractor_id:   string;
          tipo:            "entrada" | "saida";
          categoria:       string | null;
          descricao:       string;
          valor:           number;
          data:            string;
          forma_pagamento: string | null;
          receivable_id:   string | null;
          cash_session_id: string | null;
          student_id:      string | null;
          student_nome:    string | null;
          observacoes:     string | null;
          created_at:      string;
        };
        Insert: {
          id?:              string;
          contractor_id:    string;
          tipo?:            "entrada" | "saida";
          categoria?:       string | null;
          descricao:        string;
          valor:            number;
          data?:            string;
          forma_pagamento?: string | null;
          receivable_id?:   string | null;
          cash_session_id?: string | null;
          student_id?:      string | null;
          student_nome?:    string | null;
          observacoes?:     string | null;
          created_at?:      string;
        };
        Update: {
          id?:              string;
          contractor_id?:   string;
          tipo?:            "entrada" | "saida";
          categoria?:       string | null;
          descricao?:       string;
          valor?:           number;
          data?:            string;
          forma_pagamento?: string | null;
          receivable_id?:   string | null;
          cash_session_id?: string | null;
          student_id?:      string | null;
          student_nome?:    string | null;
          observacoes?:     string | null;
          created_at?:      string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      staff_role: StaffRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
