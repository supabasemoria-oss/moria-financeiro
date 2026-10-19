"use client"

import { useCallback } from "react"
import { useAuthUser } from "@/hooks/use-auth-user"
import { PERMISSOES_DEFAULT_POR_ROLE, type PermissoesUsuario } from "@/lib/types"

export function usePermissoes() {
  const { usuario, loading } = useAuthUser()

  // Regras de acesso a projetos
  const isAdmin = usuario?.role === "ADMIN"

  const acessoTodosProjetos =
    isAdmin ||
    usuario?.permissoes?.acesso_todos_projetos !== false

  const projetosPermitidos = usuario?.permissoes?.projetos_permitidos || []
  const projsKey = projetosPermitidos.join(",")

  const temAcessoAoProjeto = useCallback(
    (projetoId?: string | null): boolean => {
      if (!projetoId) return true
      if (acessoTodosProjetos) return true
      return projetosPermitidos.includes(projetoId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acessoTodosProjetos, projsKey]
  )

  const pode = useCallback(
    (acao: keyof PermissoesUsuario): boolean => {
      if (!usuario) return false
      if (usuario.role === "ADMIN") return true
      if (usuario.permissoes && typeof usuario.permissoes[acao] === "boolean") {
        return usuario.permissoes[acao]
      }
      const defaults = PERMISSOES_DEFAULT_POR_ROLE[usuario.role]
      if (defaults && typeof defaults[acao] === "boolean") {
        return defaults[acao]
      }
      return false
    },
    [usuario]
  )

  return {
    usuario,
    loading,
    pode,
    isAdmin,
    acessoTodosProjetos,
    projetosPermitidos,
    temAcessoAoProjeto,
  }
}
