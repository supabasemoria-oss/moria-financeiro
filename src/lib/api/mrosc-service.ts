import { supabase } from '@/lib/supabase'
import { gerarParcelas, recalcularStatus, diffDias } from '@/lib/parcelas'
import { getTodaySaoPaulo } from '@/lib/utils'
import type {
  Instituicao, Projeto, Fornecedor, Rubrica, Despesa, Comprovante,
  ParcelaPagamento, ParcelaPagamentoUpdate, TermoAditivo,
  ProjetoComInstituicao, RubricaComDespesas, DespesaComRelacoes,
  ComprovanteComDespesa, ParcelaComRelacoes, DespesaFilters, ParcelaFilters,
  InstituicaoInsert, ProjetoInsert, FornecedorInsert, RubricaInsert,
  DespesaInsert, ComprovanteInsert, TermoAditivoInsert,
  LembreteAvulso, LembreteAvulsoInsert,
  Usuario, UsuarioInsert, UsuarioUpdate,
} from '@/lib/types'

function err(msg: string): never { throw new Error(msg) }

export const mroscService = {

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

  // ── Gestão de Ordem de Início (Marco Zero Financeiro) ──
  async getOrdensInicioMap(): Promise<Record<string, string>> {
    const fallback: Record<string, string> = {
      '7dbee6ff-142a-4862-ac8b-775399187fda': '2026-08-01',
    }
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('moria_ordens_inicio')
        if (local) {
          const parsed = JSON.parse(local)
          if (parsed && typeof parsed === 'object') return { ...fallback, ...parsed }
        }
      } catch {}
    }
    try {
      const { data, error } = await supabase.storage.from('logos').download('projetos_ordem_inicio.json')
      if (!error && data) {
        const text = await data.text()
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          const merged = { ...fallback, ...parsed }
          if (typeof window !== 'undefined') {
            localStorage.setItem('moria_ordens_inicio', JSON.stringify(merged))
          }
          return merged
        }
      }
    } catch {}
    return fallback
  },

  async setOrdemInicioProjeto(projetoId: string, dataOrdem: string | null): Promise<void> {
    const map = await this.getOrdensInicioMap()
    if (dataOrdem) {
      map[projetoId] = dataOrdem
    } else {
      delete map[projetoId]
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('moria_ordens_inicio', JSON.stringify(map))
      } catch {}
    }
    try {
      const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' })
      await supabase.storage.from('logos').upload('projetos_ordem_inicio.json', blob, {
        upsert: true,
        cacheControl: '60',
      })
    } catch (e) {
      console.warn('Aviso ao salvar ordens de início no Storage:', e)
    }
  },

  // ── Gestão de Metadados de Rubricas (Temporalidade e Sob Demanda) ──
  async getRubricasMetadadosMap(): Promise<Record<string, { data_inicio?: string | null; sob_demanda?: boolean | null }>> {
    const fallback: Record<string, { data_inicio?: string | null; sob_demanda?: boolean | null }> = {}
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('moria_rubricas_metadados')
        if (local) {
          const parsed = JSON.parse(local)
          if (parsed && typeof parsed === 'object') return { ...fallback, ...parsed }
        }
      } catch {}
    }
    try {
      const { data, error } = await supabase.storage.from('logos').download('rubricas_metadados.json')
      if (!error && data) {
        const text = await data.text()
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          const merged = { ...fallback, ...parsed }
          if (typeof window !== 'undefined') {
            localStorage.setItem('moria_rubricas_metadados', JSON.stringify(merged))
          }
          return merged
        }
      }
    } catch {}
    return fallback
  },

  async setRubricaMetadados(
    rubricaId: string,
    meta: { data_inicio?: string | null; sob_demanda?: boolean | null }
  ): Promise<void> {
    const map = await this.getRubricasMetadadosMap()
    map[rubricaId] = {
      ...(map[rubricaId] || {}),
      ...meta,
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('moria_rubricas_metadados', JSON.stringify(map))
      } catch {}
    }
    try {
      const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' })
      await supabase.storage.from('logos').upload('rubricas_metadados.json', blob, {
        upsert: true,
        cacheControl: '60',
      })
    } catch (e) {
      console.warn('Aviso ao salvar metadados de rubricas no Storage:', e)
    }
  },

  async setRubricasMetadadosBatch(
    metas: Record<string, { data_inicio?: string | null; sob_demanda?: boolean | null }>
  ): Promise<void> {
    const map = await this.getRubricasMetadadosMap()
    Object.assign(map, metas)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('moria_rubricas_metadados', JSON.stringify(map))
      } catch {}
    }
    try {
      const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' })
      await supabase.storage.from('logos').upload('rubricas_metadados.json', blob, {
        upsert: true,
        cacheControl: '60',
      })
    } catch (e) {
      console.warn('Aviso ao salvar metadados de rubricas no Storage em lote:', e)
    }
  },

  // ── Projetos ─────────────────────────────────────
  async getProjetos(): Promise<ProjetoComInstituicao[]> {
    const [ordensMap, { data, error }] = await Promise.all([
      this.getOrdensInicioMap(),
      supabase.from('projetos').select('*, instituicoes(*)').order('created_at', { ascending: false }),
    ])
    if (error) err(error.message)
    const list = (data || []).map((p: any) => ({
      ...p,
      data_ordem_inicio: ordensMap[p.id] || null,
    }))
    return list as unknown as ProjetoComInstituicao[]
  },

  async getProjeto(id: string): Promise<ProjetoComInstituicao | null> {
    const [ordensMap, { data, error }] = await Promise.all([
      this.getOrdensInicioMap(),
      supabase.from('projetos').select('*, instituicoes(*)').eq('id', id).single(),
    ])
    if (error || !data) return null
    return {
      ...(data as any),
      data_ordem_inicio: ordensMap[id] || null,
    } as unknown as ProjetoComInstituicao
  },

  async createProjeto(payload: ProjetoInsert): Promise<Projeto> {
    const { data_ordem_inicio, ...dbPayload } = payload
    const { data, error } = await supabase.from('projetos').insert(dbPayload).select().single()
    if (error) err(error.message)
    const projeto = data as Projeto
    if (data_ordem_inicio) {
      await this.setOrdemInicioProjeto(projeto.id, data_ordem_inicio)
      projeto.data_ordem_inicio = data_ordem_inicio
    }
    return projeto
  },

  async updateProjeto(id: string, payload: Partial<ProjetoInsert>): Promise<Projeto> {
    const { data_ordem_inicio, ...dbPayload } = payload
    let projeto: Projeto | null = null
    if (Object.keys(dbPayload).length > 0) {
      const { data, error } = await supabase.from('projetos').update(dbPayload).eq('id', id).select().single()
      if (error) err(error.message)
      projeto = data as Projeto
    } else {
      projeto = await this.getProjeto(id)
    }
    if (data_ordem_inicio) {
      await this.setOrdemInicioProjeto(id, data_ordem_inicio)
      if (projeto) projeto.data_ordem_inicio = data_ordem_inicio

      // Gerar automaticamente parcelas para rubricas do projeto que ainda não possuem cronograma
      try {
        const { data: rubricas } = await supabase.from('rubricas_orcamentarias').select('*').eq('projeto_id', id)
        if (rubricas && rubricas.length > 0) {
          const { data: parcelasExistentes } = await supabase.from('parcelas_pagamento').select('rubrica_id').eq('projeto_id', id)
          const rubricasComParcelas = new Set((parcelasExistentes || []).map((p) => p.rubrica_id))
          const metadadosMap = await this.getRubricasMetadadosMap()
          for (const rub of rubricas) {
            if (!rubricasComParcelas.has(rub.id)) {
              const meta = metadadosMap[rub.id]
              const rubricaCompleta: Rubrica = {
                ...rub,
                data_inicio: (rub as any).data_inicio ?? meta?.data_inicio ?? null,
                sob_demanda: (rub as any).sob_demanda ?? meta?.sob_demanda ?? false,
              }
              const parcelas = gerarParcelas(rubricaCompleta, data_ordem_inicio)
              if (parcelas.length > 0) {
                const BATCH_SIZE = 100
                for (let b = 0; b < parcelas.length; b += BATCH_SIZE) {
                  await supabase.from('parcelas_pagamento').insert(
                    parcelas.slice(b, b + BATCH_SIZE).map((p) => ({ ...p, rubrica_id: rub.id, projeto_id: id }))
                  )
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Aviso ao sincronizar parcelas da ordem de início:', e)
      }
    } else if (data_ordem_inicio !== undefined) {
      await this.setOrdemInicioProjeto(id, data_ordem_inicio)
      if (projeto) projeto.data_ordem_inicio = data_ordem_inicio
    }
    return projeto!
  },

  async deleteProjeto(id: string): Promise<void> {
    await this.setOrdemInicioProjeto(id, null)
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

  // ── Rubricas ─────────────────────────────────────
  async getRubricas(projetoId?: string): Promise<RubricaComDespesas[]> {
    let q = supabase
      .from('rubricas_orcamentarias')
      .select('*, despesas(*), parcelas_pagamento(*), projetos(*)')
      .order('created_at')
    if (projetoId && projetoId !== 'ALL') {
      q = q.eq('projeto_id', projetoId) as typeof q
    }
    const [metadadosMap, { data, error }] = await Promise.all([
      this.getRubricasMetadadosMap(),
      q,
    ])
    if (error) err(error.message)
    const list = (data || []).map((r: any) => {
      const meta = metadadosMap[r.id]
      return {
        ...r,
        data_inicio: r.data_inicio ?? meta?.data_inicio ?? null,
        sob_demanda: r.sob_demanda ?? meta?.sob_demanda ?? false,
      }
    })
    return list as unknown as RubricaComDespesas[]
  },

  async createRubrica(payload: RubricaInsert): Promise<Rubrica> {
    const { data_inicio, sob_demanda, ...dbPayload } = payload
    const qtd = dbPayload.quantidade ?? 1
    const vlUnit = dbPayload.valor_unitario ?? 0
    const vlTotal =
      dbPayload.valor_total !== undefined && dbPayload.valor_total !== null && Number(dbPayload.valor_total) > 0
        ? Number(dbPayload.valor_total)
        : (dbPayload.tipo_pagamento === 'RECORRENTE' && dbPayload.num_parcelas && dbPayload.num_parcelas > 1
            ? qtd * vlUnit * dbPayload.num_parcelas
            : qtd * vlUnit)
    const insert = { ...dbPayload, quantidade: qtd, valor_unitario: vlUnit, valor_total: vlTotal }
    const { data, error } = await supabase.from('rubricas_orcamentarias').insert(insert).select().single()
    if (error) err(error.message)
    const rubrica = data as Rubrica

    // Salvar metadados de temporalidade e execução sob demanda
    if (data_inicio !== undefined || sob_demanda !== undefined) {
      await this.setRubricaMetadados(rubrica.id, {
        data_inicio: data_inicio ?? null,
        sob_demanda: sob_demanda ?? false,
      })
      rubrica.data_inicio = data_inicio ?? null
      rubrica.sob_demanda = sob_demanda ?? false
    }

    // Buscar projeto para verificar Ordem de Início (marco zero financeiro)
    const proj = await this.getProjeto(rubrica.projeto_id)
    if (proj && proj.data_ordem_inicio) {
      const parcelas = gerarParcelas(rubrica, proj.data_ordem_inicio)
      if (parcelas.length > 0) {
        const BATCH_SIZE = 100
        for (let b = 0; b < parcelas.length; b += BATCH_SIZE) {
          await supabase.from('parcelas_pagamento').insert(
            parcelas.slice(b, b + BATCH_SIZE).map((p) => ({ ...p, rubrica_id: rubrica.id, projeto_id: rubrica.projeto_id }))
          )
        }
      }
    }
    return rubrica
  },

  async updateRubrica(id: string, payload: Partial<RubricaInsert>): Promise<Rubrica> {
    const { data_inicio, sob_demanda, ...dbPayload } = payload
    let rubrica: Rubrica | null = null
    if (Object.keys(dbPayload).length > 0) {
      const { data, error } = await supabase.from('rubricas_orcamentarias').update(dbPayload).eq('id', id).select().single()
      if (error) err(error.message)
      rubrica = data as Rubrica
    } else {
      const { data, error } = await supabase.from('rubricas_orcamentarias').select('*').eq('id', id).single()
      if (error) err(error.message)
      rubrica = data as Rubrica
    }
    if (data_inicio !== undefined || sob_demanda !== undefined) {
      await this.setRubricaMetadados(id, {
        ...(data_inicio !== undefined ? { data_inicio } : {}),
        ...(sob_demanda !== undefined ? { sob_demanda } : {}),
      })
      if (rubrica) {
        if (data_inicio !== undefined) rubrica.data_inicio = data_inicio
        if (sob_demanda !== undefined) rubrica.sob_demanda = sob_demanda
      }
    }
    return rubrica
  },

  async deleteRubrica(id: string): Promise<void> {
    const { error } = await supabase.from('rubricas_orcamentarias').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ── Lançamento Direto de Despesa Sob Demanda (Materiais / Aquisições Pontuais) ──
  async lancarDespesaSobDemanda(dados: {
    rubrica_id: string
    projeto_id: string
    fornecedor_id?: string | null
    valor: number
    data_pagamento: string
    descricao: string
    numero_documento_fiscal?: string | null
    observacoes?: string | null
    arquivo_nota_fiscal?: File | null
  }): Promise<Despesa> {
    const payload: any = {
      projeto_id: dados.projeto_id,
      rubrica_id: dados.rubrica_id,
      valor: dados.valor,
      descricao: dados.descricao,
      data_despesa: dados.data_pagamento,
      data_pagamento: dados.data_pagamento,
      status: 'PAGO',
      numero_documento_fiscal: dados.numero_documento_fiscal || null,
      observacoes: dados.observacoes || null,
    }
    if (dados.fornecedor_id) {
      payload.fornecedor_id = dados.fornecedor_id
    }
    const { data: despesa, error } = await supabase
      .from('despesas')
      .insert(payload)
      .select()
      .single()

    if (error) err(error.message)
    const desp = despesa as Despesa

    if (dados.arquivo_nota_fiscal && desp) {
      try {
        await this.uploadComprovante(dados.arquivo_nota_fiscal, desp.id, 'NOTA_FISCAL')
      } catch (uploadError) {
        console.error('Erro ao fazer upload da nota fiscal sob demanda:', uploadError)
      }
    }

    return desp
  },

  // ?? Despesas ?????????????????????????????????????
  async getDespesas(filters?: DespesaFilters): Promise<DespesaComRelacoes[]> {
    let q = supabase.from('despesas').select('*, projetos(*), rubricas_orcamentarias(*), fornecedores(*), comprovantes(*)')
    if (filters?.projetoId) q = q.eq('projeto_id', filters.projetoId) as typeof q
    if (filters?.rubrica_id) q = q.eq('rubrica_id', filters.rubrica_id) as typeof q
    if (filters?.status) q = q.eq('status', filters.status) as typeof q
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) err(error.message)
    return data as unknown as DespesaComRelacoes[]
  },

  async createDespesa(payload: DespesaInsert, arquivo_nota_fiscal?: File | null): Promise<Despesa> {
    const { data, error } = await supabase.from('despesas').insert(payload).select().single()
    if (error) err(error.message)
    const despesa = data as Despesa
    if (arquivo_nota_fiscal && despesa) {
      try {
        await this.uploadComprovante(arquivo_nota_fiscal, despesa.id, 'NOTA_FISCAL')
      } catch (uploadError) {
        console.error('Erro ao fazer upload da nota fiscal na criação de despesa:', uploadError)
      }
    }
    return despesa
  },

  async updateDespesa(id: string, payload: Partial<DespesaInsert>, arquivo_nota_fiscal?: File | null): Promise<Despesa> {
    const { data, error } = await supabase.from('despesas').update(payload).eq('id', id).select().single()
    if (error) err(error.message)
    const despesa = data as Despesa
    if (arquivo_nota_fiscal && despesa) {
      try {
        await this.uploadComprovante(arquivo_nota_fiscal, despesa.id, 'NOTA_FISCAL')
      } catch (uploadError) {
        console.error('Erro ao fazer upload da nota fiscal na atualização de despesa:', uploadError)
      }
    }
    // Sincronizar parcela vinculada se o status for alterado
    if (payload.status) {
      const { data: parc } = await supabase.from('parcelas_pagamento').select('id').eq('despesa_id', id).maybeSingle()
      if (parc) {
        if (payload.status === 'PENDENTE') {
          await supabase.from('parcelas_pagamento').update({
            status: 'PENDENTE',
            data_pagamento_real: null,
          }).eq('id', parc.id)
        } else if (payload.status === 'PAGO') {
          await supabase.from('parcelas_pagamento').update({
            status: 'PAGO',
            data_pagamento_real: payload.data_pagamento || payload.data_despesa || getTodaySaoPaulo(),
          }).eq('id', parc.id)
        }
      }
    }
    return despesa
  },

  async deleteDespesa(id: string): Promise<void> {
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ── Comprovantes ─────────────────────────────────
  async getComprovantes(despesaId?: string): Promise<ComprovanteComDespesa[]> {
    let q = supabase.from('comprovantes').select('*, despesas(*, projetos(*))')
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

  async getComprovanteUrl(storagePath: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(storagePath, 3600)
      if (!error && data?.signedUrl) {
        return data.signedUrl
      }
    } catch {
      // Ignora erro e recorre ao getPublicUrl
    }
    return this.getComprovantePublicUrl(storagePath)
  },

  async deleteComprovante(comprovanteId: string, storagePath?: string): Promise<void> {
    let path = storagePath
    if (!path) {
      const { data } = await supabase.from('comprovantes').select('storage_path').eq('id', comprovanteId).single()
      path = data?.storage_path
    }
    if (path) {
      const { error: storErr } = await supabase.storage.from('comprovantes').remove([path])
      if (storErr) console.warn('Aviso ao remover arquivo do storage:', storErr.message)
    }
    const { error } = await supabase.from('comprovantes').delete().eq('id', comprovanteId)
    if (error) err(error.message)
  },

  // ── Parcelas ─────────────────────────────────────
  async getParcelas(filters?: ParcelaFilters): Promise<ParcelaComRelacoes[]> {
    let q = supabase.from('parcelas_pagamento').select('*, rubricas_orcamentarias(*), projetos(*), despesas(*)')
    if (filters?.projetoId) q = q.eq('projeto_id', filters.projetoId) as typeof q
    if (filters?.rubricaId) q = q.eq('rubrica_id', filters.rubricaId) as typeof q
    if (filters?.status) q = q.eq('status', filters.status) as typeof q
    if (filters?.proximosDias !== undefined) {
      const hojeStr = getTodaySaoPaulo()
      const hoje = new Date(hojeStr + 'T12:00:00')
      const limite = new Date(hoje)
      limite.setDate(hoje.getDate() + filters.proximosDias)
      const ano = limite.getFullYear()
      const m = String(limite.getMonth() + 1).padStart(2, '0')
      const d = String(limite.getDate()).padStart(2, '0')
      q = q.lte('data_vencimento', `${ano}-${m}-${d}`) as typeof q
    }
    const ordensMap = await this.getOrdensInicioMap()
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, error } = await q.range(from, to).order('data_vencimento')
      if (error) err(error.message)
      if (data && data.length > 0) {
        allData = allData.concat(data)
        if (data.length < pageSize) {
          hasMore = false
        } else {
          page++
        }
      } else {
        hasMore = false
      }
    }

    const todas = allData as unknown as ParcelaComRelacoes[]
    todas.forEach((p) => {
      if (p.projetos) {
        p.projetos.data_ordem_inicio = ordensMap[p.projetos.id] || null
      }
    })
    // Regra: enquanto um projeto não tiver Ordem de Início, suas parcelas não são listadas
    const parcelas = todas.filter((p) => !p.projeto_id || Boolean(ordensMap[p.projeto_id]))
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

  async executarParcela(
    parcelaId: string,
    dados: {
      fornecedor_id: string
      data_pagamento_real: string
      numero_documento_fiscal?: string
      observacoes?: string
      arquivo_nota_fiscal?: File | null
    }
  ): Promise<ParcelaPagamento> {
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

    if (dados.arquivo_nota_fiscal && despesa) {
      try {
        await this.uploadComprovante(dados.arquivo_nota_fiscal, (despesa as Despesa).id, 'NOTA_FISCAL')
      } catch (uploadError) {
        console.error('Erro ao fazer upload da nota fiscal na execução:', uploadError)
      }
    }

    const { data: updated, error: uErr } = await supabase.from('parcelas_pagamento').update({
      status: 'PAGO', data_pagamento_real: dados.data_pagamento_real,
      despesa_id: (despesa as Despesa).id,
    }).eq('id', parcelaId).select().single()
    if (uErr) err(uErr.message)
    return updated as ParcelaPagamento
  },

  async executarParcelaRateada(
    parcelaId: string,
    pagamentos: Array<{
      fornecedor_id: string
      valor: number
      data_pagamento_real: string
      numero_documento_fiscal?: string
      observacoes?: string
      arquivo_nota_fiscal?: File | null
    }>
  ): Promise<ParcelaPagamento> {
    const { data: parcela, error: pErr } = await supabase.from('parcelas_pagamento').select('*').eq('id', parcelaId).single()
    if (pErr) err(pErr.message)
    const p = parcela as ParcelaPagamento

    let firstDespesaId: string | null = null

    for (let i = 0; i < pagamentos.length; i++) {
      const pag = pagamentos[i]
      const desc = pagamentos.length > 1
        ? `${p.descricao} (Item ${i + 1}/${pagamentos.length})`
        : p.descricao

      const { data: despesa, error: dErr } = await supabase.from('despesas').insert({
        projeto_id: p.projeto_id,
        rubrica_id: p.rubrica_id,
        fornecedor_id: pag.fornecedor_id,
        descricao: desc,
        valor: pag.valor,
        data_despesa: pag.data_pagamento_real,
        data_pagamento: pag.data_pagamento_real,
        status: 'PAGO',
        numero_documento_fiscal: pag.numero_documento_fiscal ?? null,
        observacoes: pag.observacoes ?? null,
      }).select().single()

      if (dErr) err(dErr.message)
      if (i === 0 && despesa) firstDespesaId = (despesa as Despesa).id

      if (pag.arquivo_nota_fiscal && despesa) {
        try {
          await this.uploadComprovante(pag.arquivo_nota_fiscal, (despesa as Despesa).id, 'NOTA_FISCAL')
        } catch (uploadError) {
          console.error('Erro ao fazer upload da nota fiscal no rateio:', uploadError)
        }
      }
    }

    const { data: updated, error: uErr } = await supabase.from('parcelas_pagamento').update({
      status: 'PAGO',
      data_pagamento_real: pagamentos[0]?.data_pagamento_real,
      despesa_id: firstDespesaId,
    }).eq('id', parcelaId).select().single()

    if (uErr) err(uErr.message)
    return updated as ParcelaPagamento
  },

  async updateParcela(id: string, update: ParcelaPagamentoUpdate): Promise<ParcelaPagamento> {
    const { data, error } = await supabase.from('parcelas_pagamento').update(update).eq('id', id).select().single()
    if (error) err(error.message)
    return data as ParcelaPagamento
  },

  async createParcela(payload: any): Promise<ParcelaPagamento> {
    const { data, error } = await supabase.from('parcelas_pagamento').insert(payload).select().single()
    if (error) err(error.message)
    return data as ParcelaPagamento
  },

  async deleteParcela(id: string): Promise<void> {
    const { error } = await supabase.from('parcelas_pagamento').delete().eq('id', id)
    if (error) err(error.message)
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

  // ?? Lembretes Avulsos ???????????????????????????????????????????????????
  async getLembretesAvulsos(projetoId?: string): Promise<LembreteAvulso[]> {
    let q = supabase.from('lembretes_avulsos').select('*, projetos(id, nome)').order('data_vencimento')
    if (projetoId) q = q.eq('projeto_id', projetoId) as typeof q
    const { data, error } = await q
    if (error) err(error.message)
    return (data ?? []) as unknown as LembreteAvulso[]
  },

  async createLembreteAvulso(payload: LembreteAvulsoInsert): Promise<LembreteAvulso> {
    const { data, error } = await supabase.from('lembretes_avulsos').insert(payload).select('*, projetos(id, nome)').single()
    if (error) err(error.message)
    return data as unknown as LembreteAvulso
  },

  async updateLembreteAvulso(id: string, payload: Partial<LembreteAvulsoInsert>): Promise<LembreteAvulso> {
    const { data, error } = await supabase.from('lembretes_avulsos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select('*, projetos(id, nome)').single()
    if (error) err(error.message)
    return data as unknown as LembreteAvulso
  },

  async deleteLembreteAvulso(id: string): Promise<void> {
    const { error } = await supabase.from('lembretes_avulsos').delete().eq('id', id)
    if (error) err(error.message)
  },

  // ── Gestão de Usuários ────────────────────────────────────────────────
  async getUsuarios(): Promise<Usuario[]> {
    const res = await fetch('/api/usuarios')
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Erro ao carregar usuários')
    }
    return res.json()
  },

  async createUsuario(payload: UsuarioInsert): Promise<Usuario> {
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Erro ao criar usuário')
    }
    return res.json()
  },

  async updateUsuario(id: string, payload: UsuarioUpdate): Promise<Usuario> {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Erro ao atualizar usuário')
    }
    return res.json()
  },

  async deleteUsuario(id: string): Promise<void> {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Erro ao excluir usuário')
    }
  },
}

export const moriaService = mroscService