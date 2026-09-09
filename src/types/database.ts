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
      comprovantes: {
        Row: {
          content_type: string | null
          created_at: string
          despesa_id: string
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          despesa_id: string
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          content_type?: string | null
          created_at?: string
          despesa_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
        }
        Relationships: [
          {
            foreignKeyName: "comprovantes_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          created_at: string
          data_despesa: string
          data_pagamento: string | null
          descricao: string
          fornecedor_id: string
          id: string
          numero_documento_fiscal: string | null
          observacoes: string | null
          projeto_id: string
          rubrica_id: string
          status: Database["public"]["Enums"]["status_despesa"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_despesa: string
          data_pagamento?: string | null
          descricao: string
          fornecedor_id: string
          id?: string
          numero_documento_fiscal?: string | null
          observacoes?: string | null
          projeto_id: string
          rubrica_id: string
          status?: Database["public"]["Enums"]["status_despesa"]
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          data_despesa?: string
          data_pagamento?: string | null
          descricao?: string
          fornecedor_id?: string
          id?: string
          numero_documento_fiscal?: string | null
          observacoes?: string | null
          projeto_id?: string
          rubrica_id?: string
          status?: Database["public"]["Enums"]["status_despesa"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_projetos"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "despesas_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "rubricas_orcamentarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "vw_saldos_rubricas"
            referencedColumns: ["rubrica_id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          conta: string | null
          cpf_cnpj: string
          created_at: string
          id: string
          razao_social_nome: string
          tipo_chave_pix: Database["public"]["Enums"]["tipo_chave_pix"] | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          cpf_cnpj: string
          created_at?: string
          id?: string
          razao_social_nome: string
          tipo_chave_pix?: Database["public"]["Enums"]["tipo_chave_pix"] | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          cpf_cnpj?: string
          created_at?: string
          id?: string
          razao_social_nome?: string
          tipo_chave_pix?: Database["public"]["Enums"]["tipo_chave_pix"] | null
          updated_at?: string
        }
        Relationships: []
      }
      instituicoes: {
        Row: {
          cnpj: string
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          razao_social: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          razao_social: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          razao_social?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parcelas_pagamento: {
        Row: {
          created_at: string
          data_pagamento_real: string | null
          data_vencimento: string
          descricao: string
          despesa_id: string | null
          id: string
          numero_parcela: number
          projeto_id: string
          rubrica_id: string
          status: Database["public"]["Enums"]["status_parcela"]
          total_parcelas: number
          updated_at: string
          valor_previsto: number
        }
        Insert: {
          created_at?: string
          data_pagamento_real?: string | null
          data_vencimento: string
          descricao: string
          despesa_id?: string | null
          id?: string
          numero_parcela: number
          projeto_id: string
          rubrica_id: string
          status?: Database["public"]["Enums"]["status_parcela"]
          total_parcelas: number
          updated_at?: string
          valor_previsto: number
        }
        Update: {
          created_at?: string
          data_pagamento_real?: string | null
          data_vencimento?: string
          descricao?: string
          despesa_id?: string | null
          id?: string
          numero_parcela?: number
          projeto_id?: string
          rubrica_id?: string
          status?: Database["public"]["Enums"]["status_parcela"]
          total_parcelas?: number
          updated_at?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_pagamento_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_projetos"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "rubricas_orcamentarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "vw_saldos_rubricas"
            referencedColumns: ["rubrica_id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          instituicao_id: string
          nome: string
          numero_termo: string | null
          status: Database["public"]["Enums"]["status_projeto"]
          updated_at: string
          valor_total_aprovado: number
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          instituicao_id: string
          nome: string
          numero_termo?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          updated_at?: string
          valor_total_aprovado?: number
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          instituicao_id?: string
          nome?: string
          numero_termo?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          updated_at?: string
          valor_total_aprovado?: number
        }
        Relationships: [
          {
            foreignKeyName: "projetos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rubricas_orcamentarias: {
        Row: {
          codigo_natureza_despesa: string
          created_at: string
          descricao: string
          dia_vencimento: number | null
          frequencia_meses: number | null
          id: string
          num_parcelas: number | null
          projeto_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_rubrica"]
          tipo_pagamento: Database["public"]["Enums"]["tipo_pagamento"]
          unidade: string
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          codigo_natureza_despesa: string
          created_at?: string
          descricao: string
          dia_vencimento?: number | null
          frequencia_meses?: number | null
          id?: string
          num_parcelas?: number | null
          projeto_id: string
          quantidade?: number
          tipo: Database["public"]["Enums"]["tipo_rubrica"]
          tipo_pagamento?: Database["public"]["Enums"]["tipo_pagamento"]
          unidade?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          codigo_natureza_despesa?: string
          created_at?: string
          descricao?: string
          dia_vencimento?: number | null
          frequencia_meses?: number | null
          id?: string
          num_parcelas?: number | null
          projeto_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_rubrica"]
          tipo_pagamento?: Database["public"]["Enums"]["tipo_pagamento"]
          unidade?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubricas_orcamentarias_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubricas_orcamentarias_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_projetos"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      termos_aditivos: {
        Row: {
          created_at: string
          data_fim_anterior: string
          data_fim_nova: string
          id: string
          motivo: string | null
          numero_aditivo: number
          projeto_id: string
        }
        Insert: {
          created_at?: string
          data_fim_anterior: string
          data_fim_nova: string
          id?: string
          motivo?: string | null
          numero_aditivo: number
          projeto_id: string
        }
        Update: {
          created_at?: string
          data_fim_anterior?: string
          data_fim_nova?: string
          id?: string
          motivo?: string | null
          numero_aditivo?: number
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_aditivos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_aditivos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_projetos"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
    }
    Views: {
      vw_resumo_projetos: {
        Row: {
          instituicao_cnpj: string | null
          instituicao_nome: string | null
          numero_termo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          saldo_remanescente: number | null
          status_projeto: Database["public"]["Enums"]["status_projeto"] | null
          total_executado_pago: number | null
          total_executado_pendente: number | null
          total_planejado_rubricas: number | null
          valor_total_aprovado: number | null
        }
        Relationships: []
      }
      vw_saldos_rubricas: {
        Row: {
          codigo_natureza_despesa: string | null
          numero_termo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          quantidade: number | null
          rubrica_descricao: string | null
          rubrica_id: string | null
          rubrica_tipo: Database["public"]["Enums"]["tipo_rubrica"] | null
          saldo_disponivel: number | null
          saldo_real: number | null
          total_comprometido: number | null
          total_lancamentos: number | null
          total_pago: number | null
          total_pendente: number | null
          unidade: string | null
          valor_orcado: number | null
          valor_unitario: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rubricas_orcamentarias_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubricas_orcamentarias_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_projetos"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      status_despesa: "PENDENTE" | "PAGO" | "CANCELADO"
      status_parcela: "FUTURO" | "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO"
      status_projeto:
        | "PLANEJAMENTO"
        | "EM_ANDAMENTO"
        | "PRESTACAO_CONTAS"
        | "CONCLUIDO"
        | "CANCELADO"
      tipo_chave_pix: "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | "ALEATORIA"
      tipo_documento:
        | "NOTA_FISCAL"
        | "RECIBO"
        | "COMPROVANTE_PIX"
        | "FOLHA_PAGAMENTO"
        | "GUIA_IMPOSTO"
        | "CONTRATO"
        | "COTACAO"
        | "OUTRO"
      tipo_pagamento: "UNICO" | "RECORRENTE" | "PARCELADO"
      tipo_rubrica: "SERVICO" | "MATERIAL" | "LOCACAO" | "RH" | "OUTROS"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_despesa: ["PENDENTE", "PAGO", "CANCELADO"],
      status_parcela: ["FUTURO", "PENDENTE", "PAGO", "ATRASADO", "CANCELADO"],
      status_projeto: [
        "PLANEJAMENTO",
        "EM_ANDAMENTO",
        "PRESTACAO_CONTAS",
        "CONCLUIDO",
        "CANCELADO",
      ],
      tipo_chave_pix: ["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"],
      tipo_documento: [
        "NOTA_FISCAL",
        "RECIBO",
        "COMPROVANTE_PIX",
        "FOLHA_PAGAMENTO",
        "GUIA_IMPOSTO",
        "CONTRATO",
        "COTACAO",
        "OUTRO",
      ],
      tipo_pagamento: ["UNICO", "RECORRENTE", "PARCELADO"],
      tipo_rubrica: ["SERVICO", "MATERIAL", "LOCACAO", "RH", "OUTROS"],
    },
  },
} as const
