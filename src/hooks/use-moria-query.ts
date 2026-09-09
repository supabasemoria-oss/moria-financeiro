"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface QueryState<T> {
  data: T
  loading: boolean
  error: string | null
}

interface QueryOptions {
  enabled?: boolean
}

export function useMoriaQuery<T>(
  fetchFn: () => Promise<T>,
  initialData: T,
  options?: QueryOptions
) {
  const [state, setState] = useState<QueryState<T>>({
    data: initialData,
    loading: options?.enabled !== false,
    error: null,
  })
  const mountedRef = useRef(true)

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchFn()
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null })
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro desconhecido"
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }))
      }
    }
  }, [fetchFn])

  useEffect(() => {
    mountedRef.current = true
    if (options?.enabled !== false) {
      refetch()
    }
    return () => {
      mountedRef.current = false
    }
  }, [refetch, options?.enabled])

  return { ...state, refetch }
}
