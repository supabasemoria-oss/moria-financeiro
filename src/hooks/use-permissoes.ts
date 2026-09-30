"use client"

import { useAuthUser } from "@/hooks/use-auth-user"
import { PERMISSOES_DEFAULT_POR_ROLE, type PermissoesUsuario } from "@/lib/types"

export function usePermissoes() {
  const { usuario, loading } = useAuthUser()

  const pode = (acao: keyof PermissoesUsuario): boolean => {
    if (!usuario) return false

    // Administrador tem permissão irrestrita total
    if (usuario.role === "ADMIN") return true

    // Permissões customizadas salvas no perfil do usuário
    if (usuario.permissoes && typeof usuario.permissoes[acao] === "boolean") {
      return usuario.permissoes[acao]
    }

    // Preset padrão do papel do usuário
    const defaults = PERMISSOES_DEFAULT_POR_ROLE[usuario.role]
    if (defaults && typeof defaults[acao] === "boolean") {
      return defaults[acao]
    }

    return false
  }

  return {
    usuario,
    loading,
    pode,
    isAdmin: usuario?.role === "ADMIN",
  }
}
