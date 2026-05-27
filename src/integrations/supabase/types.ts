export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffRole =
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
          id:            string;
          contractor_id: string;
          pergunta:      string;
          tipo:          string;
          opcoes:        Json;
          permite_outro: boolean;
          tem_respostas: boolean;
          created_at:    string;
        };
        Insert: {
          id?:            string;
          contractor_id:  string;
          pergunta:       string;
          tipo:           string;
          opcoes?:        Json;
          permite_outro?: boolean;
          tem_respostas?: boolean;
          created_at?:    string;
        };
        Update: {
          id?:            string;
          contractor_id?: string;
          pergunta?:      string;
          tipo?:          string;
          opcoes?:        Json;
          permite_outro?: boolean;
          tem_respostas?: boolean;
          created_at?:    string;
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
