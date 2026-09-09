"use client"

import { useCallback, useEffect, useState } from "react"
import { moriaService } from "@/lib/api/moria-service"
import type { ParcelaComRelacoes, ParcelaFilters } from "@/lib/types"

export function useParcelas(filters?: ParcelaFilters) {
  const [data, setData] = useState<ParcelaComRelacoes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await moriaService.getParcelas(filters)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.projetoId, filters?.rubricaId, filters?.status, filters?.proximosDias])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
