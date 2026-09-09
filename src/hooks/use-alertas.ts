"use client"

import { useCallback, useEffect, useState } from "react"
import { moriaService } from "@/lib/api/moria-service"
import { calcularTodosAlertas } from "@/lib/alertas"
import { recalcularStatus } from "@/lib/parcelas"
import type { Alerta } from "@/lib/types"

export function useAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [parcelasRaw, projetos] = await Promise.all([
        moriaService.getParcelas(),
        moriaService.getProjetos(),
      ])
      const parcelas = recalcularStatus(parcelasRaw)
      const result = calcularTodosAlertas(parcelas, projetos)
      setAlertas(result)
    } catch {
      setAlertas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const urgentes = alertas.filter((a) => a.nivel === "URGENTE").length
  const atencao = alertas.filter((a) => a.nivel === "ATENCAO").length
  const total = alertas.length

  return { alertas, loading, refetch, urgentes, atencao, total }
}
