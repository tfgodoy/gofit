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
