"use client"

import { useCallback, useEffect, useState } from "react"
import { mroscService } from "@/lib/api/mrosc-service"
import { calcularTodosAlertas } from "@/lib/alertas"
import { recalcularStatus } from "@/lib/parcelas"
import { usePermissoes } from "@/hooks/use-permissoes"
import type { Alerta } from "@/lib/types"

export function useAlertas() {
  const { temAcessoAoProjeto } = usePermissoes()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [parcelasRaw, projetosRaw] = await Promise.all([
        mroscService.getParcelas(),
        mroscService.getProjetos(),
      ])
      const projetos = projetosRaw.filter((p) => temAcessoAoProjeto(p.id))
      const parcelas = recalcularStatus(parcelasRaw).filter((p) => temAcessoAoProjeto(p.projeto_id))
      const result = calcularTodosAlertas(parcelas, projetos)
      setAlertas(result)
    } catch {
      setAlertas([])
    } finally {
      setLoading(false)
    }
  }, [temAcessoAoProjeto])

  useEffect(() => {
    refetch()
  }, [refetch])

  const urgentes = alertas.filter((a) => a.nivel === "URGENTE").length
  const atencao = alertas.filter((a) => a.nivel === "ATENCAO").length
  const total = alertas.length

  return { alertas, loading, refetch, urgentes, atencao, total }
}
