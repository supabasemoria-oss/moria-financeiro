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

  // Regras de acesso a projetos
  const isAdmin = usuario?.role === "ADMIN"

  const acessoTodosProjetos =
    isAdmin ||
    usuario?.permissoes?.acesso_todos_projetos !== false

  const projetosPermitidos: string[] =
    usuario?.permissoes?.projetos_permitidos || []

  const temAcessoAoProjeto = (projetoId?: string | null): boolean => {
    if (!projetoId) return true
    if (acessoTodosProjetos) return true
    return projetosPermitidos.includes(projetoId)
  }

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
