"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Usuario } from "@/lib/types"

export function useAuthUser() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) {
            setUsuario(null)
            setLoading(false)
          }
          return
        }

        // Consultar tabela de usuarios no Supabase
        const { data, error } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", user.id)
          .single()

        if (mounted) {
          if (data && !error) {
            setUsuario(data as Usuario)
          } else {
            setUsuario({
              id: user.id,
              email: user.email || "",
              nome: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
              cargo: user.user_metadata?.cargo || null,
              role: (user.user_metadata?.role as any) || "ADMIN",
              telefone: user.user_metadata?.telefone || null,
              ativo: true,
              created_at: user.created_at,
              updated_at: user.created_at,
            })
          }
        }
      } catch {
        if (mounted) setUsuario(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { usuario, loading }
}
