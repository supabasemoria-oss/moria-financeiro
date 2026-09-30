import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@/types/database'

// ?? Row types ???????????????????????????????????????????????????????
export type Instituicao = Tables<'instituicoes'>
export type Projeto = Tables<'projetos'>
export type Fornecedor = Tables<'fornecedores'>
export type Rubrica = Tables<'rubricas_orcamentarias'>
export type Despesa = Tables<'despesas'>
export type Comprovante = Tables<'comprovantes'>
export type ParcelaPagamento = Tables<'parcelas_pagamento'>
export type TermoAditivo = Tables<'termos_aditivos'>

// ?? Insert types ?????????????????????????????????????????????????????
export type InstituicaoInsert = TablesInsert<'instituicoes'>
export type ProjetoInsert = TablesInsert<'projetos'>
export type FornecedorInsert = TablesInsert<'fornecedores'>
export type RubricaInsert = TablesInsert<'rubricas_orcamentarias'>
export type DespesaInsert = TablesInsert<'despesas'>
export type ComprovanteInsert = TablesInsert<'comprovantes'>
export type ParcelaPagamentoInsert = TablesInsert<'parcelas_pagamento'>
export type TermoAditivoInsert = TablesInsert<'termos_aditivos'>

// ?? Update types ?????????????????????????????????????????????????????
export type RubricaUpdate = TablesUpdate<'rubricas_orcamentarias'>
export type DespesaUpdate = TablesUpdate<'despesas'>
export type ParcelaPagamentoUpdate = TablesUpdate<'parcelas_pagamento'>
export type ProjetoUpdate = TablesUpdate<'projetos'>

// ?? Enum types ????????????????????????????????????????????????????????
export type StatusProjeto = Enums<'status_projeto'>
export type TipoRubrica = Enums<'tipo_rubrica'>
export type TipoPagamento = Enums<'tipo_pagamento'>
export type StatusDespesa = Enums<'status_despesa'>
export type StatusParcela = Enums<'status_parcela'>
export type TipoDocumento = Enums<'tipo_documento'>
export type TipoChavePix = Enums<'tipo_chave_pix'>

// ?? Relational types ??????????????????????????????????????????????????
export type ProjetoComInstituicao = Projeto & { instituicoes: Instituicao | null }
export type RubricaComDespesas = Rubrica & {
  despesas?: Despesa[]
  parcelas_pagamento?: ParcelaPagamento[]
  projetos?: Projeto | null
}
export type DespesaComRelacoes = Despesa & {
  projetos: Projeto | null
  rubricas_orcamentarias: Rubrica | null
  fornecedores: Fornecedor | null
  comprovantes?: Comprovante[]
}
export type ComprovanteComDespesa = Comprovante & { despesas: Despesa | null }
export type ParcelaComRelacoes = ParcelaPagamento & {
  rubricas_orcamentarias: Rubrica | null
  projetos: Projeto | null
  despesas: Despesa | null
}

// ?? Filter types ?????????????????????????????????????????????????????
export interface DespesaFilters {
  projetoId?: string
  rubrica_id?: string
  status?: StatusDespesa
}

export interface ParcelaFilters {
  projetoId?: string
  rubricaId?: string
  status?: StatusParcela
  proximosDias?: number
}

// ?? Alerta type ???????????????????????????????????????????????????????
export type AlertaTipo = 'PARCELA_ATRASADA' | 'PARCELA_VENCENDO' | 'VIGENCIA_CRITICA' | 'TERMO_ADITIVO'
export type NivelAlerta = 'URGENTE' | 'ATENCAO' | 'INFO'

export interface Alerta {
  id: string
  tipo: AlertaTipo
  nivel: NivelAlerta
  urgencia?: NivelAlerta
  titulo: string
  descricao: string
  data_referencia: string
  dias_restantes: number
  projeto_id?: string
  projeto_nome?: string
  parcela_id?: string
  valor?: number | null
  referencia_id?: string
  referencia_tipo?: 'parcela' | 'projeto'
}

// ?? LocalDatabase (legado ? mantido para compatibilidade de tipos) ????
export interface LocalDatabase {
  instituicoes: Instituicao[]
  projetos: Projeto[]
  fornecedores: Fornecedor[]
  rubricas_orcamentarias: Rubrica[]
  despesas: Despesa[]
  comprovantes: Comprovante[]
  parcelas_pagamento: ParcelaPagamento[]
  termos_aditivos: TermoAditivo[]
}

// ?? Lembretes Avulsos ??????????????????????????????????????????????????
export type StatusLembrete = 'PENDENTE' | 'CONCLUIDO' | 'CANCELADO'

export interface LembreteAvulso {
  id: string
  titulo: string
  descricao: string | null
  data_vencimento: string
  projeto_id: string | null
  valor: number | null
  recorrente: boolean
  frequencia_dias: number | null
  status: StatusLembrete
  notificar_email: boolean
  email_destino: string | null
  created_at: string
  updated_at: string
  projetos?: { id: string; nome: string } | null
}

export interface LembreteAvulsoInsert {
  titulo: string
  descricao?: string | null
  data_vencimento: string
  projeto_id?: string | null
  valor?: number | null
  recorrente?: boolean
  frequencia_dias?: number | null
  status?: StatusLembrete
  notificar_email?: boolean
  email_destino?: string | null
}

// ── Usuários & Permissões (RBAC Granular) ───────────────────────────
export type RoleUsuario = 'ADMIN' | 'OPERADOR' | 'CONSULTA'

export interface PermissoesUsuario {
  despesas_lancar: boolean
  despesas_quitar: boolean
  despesas_excluir: boolean
  comprovantes_anexar: boolean
  projetos_gerenciar: boolean
  orcamento_gerenciar: boolean
  fornecedores_gerenciar: boolean
  relatorios_exportar: boolean
  configuracoes_acessar: boolean
}

export const PERMISSOES_LABELS: Record<keyof PermissoesUsuario, { label: string; descricao: string }> = {
  despesas_lancar: { label: "Lançar Despesas", descricao: "Registrar novos gastos e compras no livro caixa" },
  despesas_quitar: { label: "Quitar Parcelas", descricao: "Liquidar obrigações financeiras e pagamentos" },
  despesas_excluir: { label: "Excluir Despesas e Parcelas", descricao: "Remover lançamentos e parcelas registradas" },
  comprovantes_anexar: { label: "Anexar Comprovantes e NFs", descricao: "Upload e vínculo de documentos fiscais" },
  projetos_gerenciar: { label: "Gerenciar Projetos e Termos", descricao: "Criar, editar e alterar dados de projetos" },
  orcamento_gerenciar: { label: "Gerenciar Orçamento e Rubricas", descricao: "Criar, ajustar e redistribuir rubricas" },
  fornecedores_gerenciar: { label: "Cadastrar Fornecedores", descricao: "Cadastrar e editar credores e prestadores" },
  relatorios_exportar: { label: "Exportar Relatórios e Transferegov", descricao: "Baixar extratos CSV e lotes MROSC" },
  configuracoes_acessar: { label: "Acessar Configurações", descricao: "Alterar parâmetros do sistema e chaves" },
}

export const PERMISSOES_DEFAULT_POR_ROLE: Record<RoleUsuario, PermissoesUsuario> = {
  ADMIN: {
    despesas_lancar: true,
    despesas_quitar: true,
    despesas_excluir: true,
    comprovantes_anexar: true,
    projetos_gerenciar: true,
    orcamento_gerenciar: true,
    fornecedores_gerenciar: true,
    relatorios_exportar: true,
    configuracoes_acessar: true,
  },
  OPERADOR: {
    despesas_lancar: true,
    despesas_quitar: true,
    despesas_excluir: false,
    comprovantes_anexar: true,
    projetos_gerenciar: false,
    orcamento_gerenciar: false,
    fornecedores_gerenciar: true,
    relatorios_exportar: true,
    configuracoes_acessar: false,
  },
  CONSULTA: {
    despesas_lancar: false,
    despesas_quitar: false,
    despesas_excluir: false,
    comprovantes_anexar: false,
    projetos_gerenciar: false,
    orcamento_gerenciar: false,
    fornecedores_gerenciar: false,
    relatorios_exportar: true,
    configuracoes_acessar: false,
  },
}

export interface Usuario {
  id: string
  email: string
  nome: string
  cargo: string | null
  role: RoleUsuario
  telefone: string | null
  ativo: boolean
  permissoes?: PermissoesUsuario | null
  created_at: string
  updated_at: string
}

export interface UsuarioInsert {
  email: string
  nome: string
  cargo?: string | null
  role?: RoleUsuario
  telefone?: string | null
  password?: string
  ativo?: boolean
  permissoes?: PermissoesUsuario | null
}

export interface UsuarioUpdate {
  nome?: string
  cargo?: string | null
  role?: RoleUsuario
  telefone?: string | null
  password?: string
  ativo?: boolean
  permissoes?: PermissoesUsuario | null
}

// Re-export Database for convenience
export type { Database }