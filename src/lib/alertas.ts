import type { Alerta, NivelAlerta, ParcelaPagamento, Projeto } from '@/lib/types'
import { diffDias } from '@/lib/parcelas'

function nivelPorDias(dias: number): NivelAlerta {
  if (dias <= 0) return 'URGENTE'
  if (dias <= 7) return 'ATENCAO'
  return 'INFO'
}

export function calcularAlertasParcelas(
  parcelas: ParcelaPagamento[],
  projetoNomePorId: Record<string, string>
): Alerta[] {
  const lista: Alerta[] = []
  for (const p of parcelas) {
    if (p.status === 'PAGO' || p.status === 'CANCELADO') continue
    const dias = diffDias(p.data_vencimento)
    if (dias > 30) continue
    const tipo = dias < 0 ? 'PARCELA_ATRASADA' : 'PARCELA_VENCENDO'
    const nivel = nivelPorDias(dias)
    const absD = Math.abs(dias)
    let titulo: string
    if (dias < 0) titulo = 'Pagamento atrasado ha ' + absD + (absD !== 1 ? ' dias' : ' dia')
    else if (dias === 0) titulo = 'Pagamento vence hoje'
    else titulo = 'Vence em ' + dias + (dias !== 1 ? ' dias' : ' dia')
    lista.push({ id: 'alerta-parcela-' + p.id, tipo, nivel, titulo,
      descricao: p.descricao, valor: p.valor_previsto,
      data_referencia: p.data_vencimento, dias_restantes: dias,
      referencia_id: p.id, referencia_tipo: 'parcela' as const,
      projeto_nome: projetoNomePorId[p.projeto_id] ?? 'Projeto' })
  }
  return lista
}

export function calcularAlertasVigencia(projetos: Projeto[]): Alerta[] {
  const lista: Alerta[] = []
  for (const proj of projetos) {
    if (proj.status === 'CONCLUIDO' || proj.status === 'CANCELADO') continue
    const dias = diffDias(proj.data_fim)
    if (dias > 30) continue
    const nivel = nivelPorDias(dias)
    const absD = Math.abs(dias)
    let titulo: string
    if (dias < 0) titulo = 'Vigencia expirada ha ' + absD + (absD !== 1 ? ' dias' : ' dia')
    else if (dias === 0) titulo = 'Vigencia encerra hoje - protocolar aditivo!'
    else titulo = 'Vigencia encerra em ' + dias + (dias !== 1 ? ' dias' : ' dia') + ' - solicitar aditivo'
    lista.push({ id: 'alerta-vigencia-' + proj.id, tipo: 'TERMO_ADITIVO' as const,
      nivel, titulo,
      descricao: 'Protocolar pedido de prorrogacao com pelo menos 30 dias de antecedencia (Lei 13.019/2014).',
      valor: null, data_referencia: proj.data_fim, dias_restantes: dias,
      referencia_id: proj.id, referencia_tipo: 'projeto' as const, projeto_nome: proj.nome })
  }
  return lista
}

const ORDEM: Record<NivelAlerta, number> = { URGENTE: 0, ATENCAO: 1, INFO: 2 }

export function calcularTodosAlertas(parcelas: ParcelaPagamento[], projetos: Projeto[]): Alerta[] {
  const nomePorId: Record<string, string> = {}
  for (const p of projetos) nomePorId[p.id] = p.nome
  return [
    ...calcularAlertasParcelas(parcelas, nomePorId),
    ...calcularAlertasVigencia(projetos),
  ].sort((a, b) => {
    const nd = ORDEM[a.nivel] - ORDEM[b.nivel]
    return nd !== 0 ? nd : a.dias_restantes - b.dias_restantes
  })
}