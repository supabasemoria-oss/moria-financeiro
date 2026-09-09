import type { Rubrica, ParcelaPagamento } from '@/lib/types'

function hoje(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function diffDias(dataStr: string): number {
  const alvo = new Date(dataStr + 'T00:00:00')
  alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje().getTime()) / 86400000)
}

function calcularDataVencimento(dataInicioStr: string, idx: number, freqMeses: number, diaVenc: number | null): string {
  const base = new Date(dataInicioStr + 'T00:00:00')
  const mes = base.getMonth() + idx * freqMeses
  const data = new Date(base.getFullYear(), mes, diaVenc ?? base.getDate())
  if (data.getMonth() !== ((mes % 12) + 12) % 12) data.setDate(0)
  return data.toISOString().split('T')[0]
}

export function gerarParcelas(rubrica: Rubrica, dataInicioProjeto: string): Omit<ParcelaPagamento, 'id' | 'created_at' | 'updated_at'>[] {
  const tipoPag = rubrica.tipo_pagamento ?? 'UNICO'
  if (tipoPag === 'UNICO') {
    const d = diaParaData(dataInicioProjeto, rubrica.dia_vencimento)
    return [{ rubrica_id: rubrica.id, projeto_id: rubrica.projeto_id, numero_parcela: 1, total_parcelas: 1,
      descricao: rubrica.descricao + ' - Pagamento unico', valor_previsto: rubrica.valor_total,
      data_vencimento: d, data_pagamento_real: null, status: statusInicial(d), despesa_id: null }]
  }
  const num = rubrica.num_parcelas ?? 1
  const freq = rubrica.frequencia_meses ?? 1
  const vlUnit = Math.round(rubrica.valor_total / num * 100) / 100
  return Array.from({ length: num }, (_, i) => {
    const d = calcularDataVencimento(dataInicioProjeto, i, freq, rubrica.dia_vencimento)
    const label = tipoPag === 'PARCELADO'
      ? rubrica.descricao + ' - Parcela ' + (i + 1) + '/' + num
      : rubrica.descricao + ' - ' + labelMes(d)
    return { rubrica_id: rubrica.id, projeto_id: rubrica.projeto_id, numero_parcela: i + 1, total_parcelas: num,
      descricao: label, valor_previsto: vlUnit, data_vencimento: d,
      data_pagamento_real: null, status: statusInicial(d), despesa_id: null }
  })
}

export function recalcularStatus(parcelas: ParcelaPagamento[]): ParcelaPagamento[] {
  return parcelas.map((p) => {
    if (p.status === 'PAGO' || p.status === 'CANCELADO') return p
    const dias = diffDias(p.data_vencimento)
    const novo: ParcelaPagamento['status'] = dias < 0 ? 'ATRASADO' : dias <= 30 ? 'PENDENTE' : 'FUTURO'
    if (novo === p.status) return p
    return { ...p, status: novo, updated_at: new Date().toISOString() }
  })
}

function diaParaData(base: string, dia: number | null): string {
  if (!dia) return base
  const d = new Date(base + 'T00:00:00')
  d.setDate(dia)
  return d.toISOString().split('T')[0]
}

function statusInicial(dataVenc: string): ParcelaPagamento['status'] {
  const dias = diffDias(dataVenc)
  if (dias < 0) return 'ATRASADO'
  if (dias <= 30) return 'PENDENTE'
  return 'FUTURO'
}

function labelMes(dataStr: string): string {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const d = new Date(dataStr + 'T00:00:00')
  return meses[d.getMonth()] + '/' + d.getFullYear()
}