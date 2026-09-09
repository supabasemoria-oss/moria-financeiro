import type { Despesa, Rubrica, RubricaComDespesas } from "@/lib/types"

export function calcularTotalPago(despesas: Despesa[]): number {
  return despesas
    .filter((d) => d.status === "PAGO")
    .reduce((acc, d) => acc + Number(d.valor || 0), 0)
}

export function calcularTotalPendente(despesas: Despesa[]): number {
  return despesas
    .filter((d) => d.status === "PENDENTE")
    .reduce((acc, d) => acc + Number(d.valor || 0), 0)
}

export function calcularSaldoRubrica(
  rubrica: RubricaComDespesas
): {
  totalGasto: number
  saldo: number
  percentual: number
  ultrapassou: boolean
} {
  const totalGasto = calcularTotalPago(rubrica.despesas)
  const valorTotal = Number(rubrica.valor_total || 0)
  const saldo = valorTotal - totalGasto
  const percentual =
    valorTotal > 0 ? (totalGasto / valorTotal) * 100 : 0
  return {
    totalGasto,
    saldo,
    percentual,
    ultrapassou: totalGasto > valorTotal,
  }
}

export function calcularTotalOrcado(
  rubricas: Rubrica[]
): number {
  return rubricas.reduce(
    (acc, r) => acc + Number(r.valor_total || 0),
    0
  )
}

export function calcularSaldoProjeto(
  tetoAprovado: number,
  rubricas: RubricaComDespesas[]
): {
  totalOrcado: number
  totalPago: number
  totalPendente: number
  saldoOrcamento: number
  saldoExecucao: number
  ultrapassouTeto: boolean
} {
  const totalOrcado = calcularTotalOrcado(rubricas)
  const todasDespesas = rubricas.flatMap((r) => r.despesas)
  const totalPago = calcularTotalPago(todasDespesas)
  const totalPendente = calcularTotalPendente(todasDespesas)

  return {
    totalOrcado,
    totalPago,
    totalPendente,
    saldoOrcamento: tetoAprovado - totalOrcado,
    saldoExecucao: tetoAprovado - totalPago,
    ultrapassouTeto: totalOrcado > tetoAprovado,
  }
}
