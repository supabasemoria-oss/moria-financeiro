import type { Rubrica, ParcelaPagamento } from '@/lib/types'
import { getTodaySaoPaulo } from '@/lib/utils'

function hoje(): Date {
  const hojeStr = getTodaySaoPaulo()
  return new Date(hojeStr + 'T00:00:00')
}

export function diffDias(dataStr: string): number {
  const alvo = new Date(dataStr.split('T')[0] + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje().getTime()) / 86400000)
}

function calcularDataVencimento(dataInicioStr: string, idx: number, freqMeses: number, diaVenc: number | null): string {
  const [bAno, bMes, bDia] = dataInicioStr.split('T')[0].split('-').map(Number)
  const base = new Date(bAno, bMes - 1, bDia)
  const mesAlvo = base.getMonth() + idx * freqMeses
  const data = new Date(base.getFullYear(), mesAlvo, diaVenc ?? base.getDate())
  if (data.getMonth() !== ((mesAlvo % 12) + 12) % 12) data.setDate(0)
  const ano = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${ano}-${m}-${d}`
}

export function gerarParcelas(rubrica: Rubrica, dataInicioProjeto: string): Omit<ParcelaPagamento, 'id' | 'created_at' | 'updated_at'>[] {
  // Rubricas sob demanda (materiais, bens, compras eventuais) não geram parcelas antecipadas no calendário
  if (rubrica.sob_demanda) {
    return []
  }

  // A data base é a data de início da rubrica (quando definida) ou a data de início do projeto
  const dataBase = rubrica.data_inicio || dataInicioProjeto
  const tipoPag = rubrica.tipo_pagamento ?? 'UNICO'

  if (tipoPag === 'UNICO') {
    const d = diaParaData(dataBase, rubrica.dia_vencimento)
    return [{ rubrica_id: rubrica.id, projeto_id: rubrica.projeto_id, numero_parcela: 1, total_parcelas: 1,
      descricao: rubrica.descricao + ' - Pagamento único', valor_previsto: rubrica.valor_total,
      data_vencimento: d, data_pagamento_real: null, status: statusInicial(d), despesa_id: null }]
  }
  const numMeses = rubrica.num_parcelas ?? 1
  const freq = rubrica.frequencia_meses ?? 1
  const qtd = Math.max(1, Math.round(rubrica.quantidade || 1))

  // Caso com múltiplos postos/vagas (ex: 4 assistentes, 16 auxiliares operacionais)
  // Gera parcelas individuais por vaga/profissional a cada mês (Opção 1)
  if (qtd > 1) {
    const totalParcelas = qtd * numMeses
    const vlUnit = rubrica.valor_unitario > 0
      ? rubrica.valor_unitario
      : Math.round((rubrica.valor_total / totalParcelas) * 100) / 100

    let somaAcumulada = 0
    const parcelas: Omit<ParcelaPagamento, 'id' | 'created_at' | 'updated_at'>[] = []

    for (let m = 0; m < numMeses; m++) {
      const d = calcularDataVencimento(dataBase, m, freq, rubrica.dia_vencimento)
      const mesFormatado = labelMes(d)

      for (let v = 1; v <= qtd; v++) {
        const numSeq = m * qtd + v
        const isUltima = numSeq === totalParcelas
        const valorPrevisto = isUltima
          ? Math.round((rubrica.valor_total - somaAcumulada) * 100) / 100
          : vlUnit
        somaAcumulada += valorPrevisto

        const label = tipoPag === 'PARCELADO'
          ? `${rubrica.descricao} (Vaga ${v}/${qtd}) - Parcela ${m + 1}/${numMeses}`
          : `${rubrica.descricao} (Vaga ${v}/${qtd}) - ${mesFormatado}`

        parcelas.push({
          rubrica_id: rubrica.id,
          projeto_id: rubrica.projeto_id,
          numero_parcela: numSeq,
          total_parcelas: totalParcelas,
          descricao: label,
          valor_previsto: valorPrevisto,
          data_vencimento: d,
          data_pagamento_real: null,
          status: statusInicial(d),
          despesa_id: null,
        })
      }
    }
    return parcelas
  }

  // Caso rubrica de posto único (qtd === 1, ex: Coordenador Geral, Assessoria Contábil)
  const vlUnit = Math.round((rubrica.valor_total / numMeses) * 100) / 100
  let somaAcumulada = 0

  return Array.from({ length: numMeses }, (_, i) => {
    const d = calcularDataVencimento(dataBase, i, freq, rubrica.dia_vencimento)
    const isUltima = i === numMeses - 1
    const valorPrevisto = isUltima
      ? Math.round((rubrica.valor_total - somaAcumulada) * 100) / 100
      : vlUnit
    somaAcumulada += valorPrevisto

    const label = tipoPag === 'PARCELADO'
      ? `${rubrica.descricao} - Parcela ${i + 1}/${numMeses}`
      : `${rubrica.descricao} - ${labelMes(d)}`

    return {
      rubrica_id: rubrica.id,
      projeto_id: rubrica.projeto_id,
      numero_parcela: i + 1,
      total_parcelas: numMeses,
      descricao: label,
      valor_previsto: valorPrevisto,
      data_vencimento: d,
      data_pagamento_real: null,
      status: statusInicial(d),
      despesa_id: null,
    }
  })
}

export function recalcularStatus<T extends ParcelaPagamento>(parcelas: T[]): T[] {
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