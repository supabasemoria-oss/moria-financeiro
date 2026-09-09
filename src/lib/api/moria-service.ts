import { supabase } from '@/lib/supabase'
import { gerarParcelas, recalcularStatus, diffDias } from '@/lib/parcelas'
import type {
  Instituicao, Projeto, Fornecedor, Rubrica, Despesa, Comprovante,
  ParcelaPagamento, ParcelaPagamentoUpdate, TermoAditivo,
  ProjetoComInstituicao, RubricaComDespesas, DespesaComRelacoes,
  ComprovanteComDespesa, ParcelaComRelacoes, DespesaFilters, ParcelaFilters,
  InstituicaoInsert, ProjetoInsert, FornecedorInsert, RubricaInsert,
  DespesaInsert, ComprovanteInsert, TermoAditivoInsert,
} from '@/lib/types'

function err(msg: string): never { throw new Error(msg) }

export const moriaService = {

  // ?? Instituicoes ?????????????????????????????????
  async getInstituicoes(): Promise<Instituicao[]> {
    const { data, error } = await supabase.from('instituicoes').select('*').order('razao_social')
    if (error) err(error.message)
    return data as Instituicao[]
  },

  async getInstituicao(id: string): Promise<Instituicao | null> {
    const { data, error } = await supabase.from('instituicoes').select('*').eq('id', id).single()
    if (error) return null
    return data as Instituicao
  },

  async createInstituicao(payload: InstituicaoInsert): Promise<Instituicao> {
    const { data, error } = await supabase.from('instituicoes').insert(payload).select().single()
    if (error) err(error.message)
    return data as Instituicao
  },

  async updateInstituicao(id: string, payload: Partial<InstituicaoInsert>): Promise<Instituicao> {
    const { data, error } = await supabase.from('instituicoes').update(payload).eq('id', id).select().single()
    if (error) err(error.message)
    return data as Instituicao
  },

  async deleteInstituicao(id: string): Promise<void> {
    const { error } = await supabase.from('instituicoes').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ?? Projetos ?????????????????????????????????????
  async getProjetos(): Promise<ProjetoComInstituicao[]> {
    const { data, error } = await supabase.from('projetos').select('*, instituicoes(*)').order('created_at', { ascending: false })
    if (error) err(error.message)
    return data as unknown as ProjetoComInstituicao[]
  },

  async getProjeto(id: string): Promise<ProjetoComInstituicao | null> {
    const { data, error } = await supabase.from('projetos').select('*, instituicoes(*)').eq('id', id).single()
    if (error) return null
    return data as unknown as ProjetoComInstituicao
  },

  async createProjeto(payload: ProjetoInsert): Promise<Projeto> {
    const { data, error } = await supabase.from('projetos').insert(payload).select().single()
    if (error) err(error.message)
    return data as Projeto
  },

  async updateProjeto(id: string, payload: Partial<ProjetoInsert>): Promise<Projeto> {
    const { data, error } = await supabase.from('projetos').update(payload).eq('id', id).select().single()
    if (error) err(error.message)
    return data as Projeto
  },

  async deleteProjeto(id: string): Promise<void> {
    const { error } = await supabase.from('projetos').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ?? Fornecedores ?????????????????????????????????
  async getFornecedores(): Promise<Fornecedor[]> {
    const { data, error } = await supabase.from('fornecedores').select('*').order('razao_social_nome')
    if (error) err(error.message)
    return data as Fornecedor[]
  },

  async createFornecedor(payload: FornecedorInsert): Promise<Fornecedor> {
    const { data, error } = await supabase.from('fornecedores').insert(payload).select().single()
    if (error) err(error.message)
    return data as Fornecedor
  },

  async updateFornecedor(id: string, payload: Partial<FornecedorInsert>): Promise<Fornecedor> {
    const { data, error } = await supabase.from('fornecedores').update(payload).eq('id', id).select().single()
    if (error) err(error.message)
    return data as Fornecedor
  },

  async deleteFornecedor(id: string): Promise<void> {
    const { error } = await supabase.from('fornecedores').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ?? Rubricas ?????????????????????????????????????
  async getRubricas(projetoId: string): Promise<RubricaComDespesas[]> {
    const { data, error } = await supabase
      .from('rubricas_orcamentarias')
      .select('*, despesas(*)')
      .eq('projeto_id', projetoId)
      .order('created_at')
    if (error) err(error.message)
    return data as unknown as RubricaComDespesas[]
  },

  async createRubrica(payload: RubricaInsert): Promise<Rubrica> {
    const qtd = payload.quantidade ?? 1
    const vlUnit = payload.valor_unitario ?? 0
    const insert = { ...payload, quantidade: qtd, valor_unitario: vlUnit, valor_total: qtd * vlUnit }
    const { data, error } = await supabase.from('rubricas_orcamentarias').insert(insert).select().single()
    if (error) err(error.message)
    const rubrica = data as Rubrica
    // Buscar projeto para data_inicio
    const { data: proj } = await supabase.from('projetos').select('data_inicio').eq('id', rubrica.projeto_id).single()
    if (proj) {
      const parcelas = gerarParcelas(rubrica, proj.data_inicio)
      if (parcelas.length > 0) {
        await supabase.from('parcelas_pagamento').insert(parcelas.map((p) => ({ ...p, rubrica_id: rubrica.id, projeto_id: rubrica.projeto_id })))
      }
    }
    return rubrica
  },

  async deleteRubrica(id: string): Promise<void> {
    const { error } = await supabase.from('rubricas_orcamentarias').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ?? Despesas ?????????????????????????????????????
  async getDespesas(filters?: DespesaFilters): Promise<DespesaComRelacoes[]> {
    let q = supabase.from('despesas').select('*, projetos(*), rubricas_orcamentarias(*), fornecedores(*)')
    if (filters?.projetoId) q = q.eq('projeto_id', filters.projetoId) as typeof q
    if (filters?.rubrica_id) q = q.eq('rubrica_id', filters.rubrica_id) as typeof q
    if (filters?.status) q = q.eq('status', filters.status) as typeof q
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) err(error.message)
    return data as unknown as DespesaComRelacoes[]
  },

  async createDespesa(payload: DespesaInsert): Promise<Despesa> {
    const { data, error } = await supabase.from('despesas').insert(payload).select().single()
    if (error) err(error.message)
    return data as Despesa
  },

  async updateDespesa(id: string, payload: Partial<DespesaInsert>): Promise<Despesa> {
    const { data, error } = await supabase.from('despesas').update(payload).eq('id', id).select().single()
    if (error) err(error.message)
    return data as Despesa
  },

  async deleteDespesa(id: string): Promise<void> {
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ?? Comprovantes ?????????????????????????????????
  async getComprovantes(despesaId?: string): Promise<ComprovanteComDespesa[]> {
    let q = supabase.from('comprovantes').select('*, despesas(*)')
    if (despesaId) q = q.eq('despesa_id', despesaId) as typeof q
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) err(error.message)
    return data as unknown as ComprovanteComDespesa[]
  },

  async uploadComprovante(file: File, despesaId: string, tipoDocumento: ComprovanteInsert['tipo_documento']): Promise<Comprovante> {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `despesa_${despesaId}/${Date.now()}_${cleanName}`
    const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, file)
    if (upErr) err(upErr.message)
    const { data, error } = await supabase.from('comprovantes').insert({
      despesa_id: despesaId, tipo_documento: tipoDocumento,
      file_name: file.name, storage_path: path,
      file_size: file.size, content_type: file.type || 'application/pdf',
    }).select().single()
    if (error) err(error.message)
    return data as Comprovante
  },

  getComprovantePublicUrl(storagePath: string): string {
    const { data } = supabase.storage.from('comprovantes').getPublicUrl(storagePath)
    return data.publicUrl
  },

  // ?? Parcelas ?????????????????????????????????????
  async getParcelas(filters?: ParcelaFilters): Promise<ParcelaComRelacoes[]> {
    let q = supabase.from('parcelas_pagamento').select('*, rubricas_orcamentarias(*), projetos(*), despesas(*)')
    if (filters?.projetoId) q = q.eq('projeto_id', filters.projetoId) as typeof q
    if (filters?.rubricaId) q = q.eq('rubrica_id', filters.rubricaId) as typeof q
    if (filters?.status) q = q.eq('status', filters.status) as typeof q
    if (filters?.proximosDias !== undefined) {
      const hoje = new Date(); hoje.setHours(0,0,0,0)
      const limite = new Date(hoje); limite.setDate(hoje.getDate() + filters.proximosDias)
      q = q.lte('data_vencimento', limite.toISOString().split('T')[0]) as typeof q
    }
    const { data, error } = await q.order('data_vencimento')
    if (error) err(error.message)
    // Recalcular status e persistir mudancas
    const parcelas = (data ?? []) as unknown as ParcelaComRelacoes[]
    const atualizadas = parcelas.filter((p) => {
      if (p.status === 'PAGO' || p.status === 'CANCELADO') return false
      const dias = diffDias(p.data_vencimento)
      const novo = dias < 0 ? 'ATRASADO' : dias <= 30 ? 'PENDENTE' : 'FUTURO'
      return novo !== p.status
    })
    for (const p of atualizadas) {
      const dias = diffDias(p.data_vencimento)
      const novo = dias < 0 ? 'ATRASADO' : dias <= 30 ? 'PENDENTE' : 'FUTURO'
      await supabase.from('parcelas_pagamento').update({ status: novo }).eq('id', p.id)
      p.status = novo as ParcelaPagamento['status']
    }
    return parcelas
  },

  async executarParcela(parcelaId: string, dados: { fornecedor_id: string; data_pagamento_real: string; numero_documento_fiscal?: string; observacoes?: string }): Promise<ParcelaPagamento> {
    const { data: parcela, error: pErr } = await supabase.from('parcelas_pagamento').select('*').eq('id', parcelaId).single()
    if (pErr) err(pErr.message)
    const p = parcela as ParcelaPagamento
    const { data: despesa, error: dErr } = await supabase.from('despesas').insert({
      projeto_id: p.projeto_id, rubrica_id: p.rubrica_id,
      fornecedor_id: dados.fornecedor_id, descricao: p.descricao,
      valor: p.valor_previsto, data_despesa: dados.data_pagamento_real,
      data_pagamento: dados.data_pagamento_real, status: 'PAGO',
      numero_documento_fiscal: dados.numero_documento_fiscal ?? null,
      observacoes: dados.observacoes ?? null,
    }).select().single()
    if (dErr) err(dErr.message)
    const { data: updated, error: uErr } = await supabase.from('parcelas_pagamento').update({
      status: 'PAGO', data_pagamento_real: dados.data_pagamento_real,
      despesa_id: (despesa as Despesa).id,
    }).eq('id', parcelaId).select().single()
    if (uErr) err(uErr.message)
    return updated as ParcelaPagamento
  },

  async updateParcela(id: string, update: ParcelaPagamentoUpdate): Promise<ParcelaPagamento> {
    const { data, error } = await supabase.from('parcelas_pagamento').update(update).eq('id', id).select().single()
    if (error) err(error.message)
    return data as ParcelaPagamento
  },

  // ?? Termos Aditivos ??????????????????????????????
  async getTermosAditivos(projetoId?: string): Promise<TermoAditivo[]> {
    let q = supabase.from('termos_aditivos').select('*').order('numero_aditivo', { ascending: false })
    if (projetoId) q = q.eq('projeto_id', projetoId) as typeof q
    const { data, error } = await q
    if (error) err(error.message)
    return data as TermoAditivo[]
  },

  async createTermoAditivo(payload: TermoAditivoInsert): Promise<TermoAditivo> {
    const { data, error } = await supabase.from('termos_aditivos').insert(payload).select().single()
    if (error) err(error.message)
    await supabase.from('projetos').update({ data_fim: payload.data_fim_nova }).eq('id', payload.projeto_id)
    return data as TermoAditivo
  },
}