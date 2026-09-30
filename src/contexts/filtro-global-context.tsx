"use client"

import * as React from "react"
import { mroscService } from "@/lib/api/mrosc-service"
import type { Instituicao, ProjetoComInstituicao } from "@/lib/types"

const STORAGE_KEY_INSTITUICAO = "moria_filtro_instituicao_id"
const STORAGE_KEY_PROJETO = "moria_filtro_projeto_id"
const STORAGE_KEY_PROJETOS_IDS = "moria_filtro_projetos_ids"

export interface FiltroGlobalContextType {
  instituicoes: Instituicao[]
  projetos: ProjetoComInstituicao[]
  instituicaoId: string
  projetoId: string
  projetosIds: string[]
  opcaoFiltro: 1 | 2 | 3
  setInstituicaoId: (id: string) => void
  setProjetoId: (id: string) => void
  setProjetosIds: (ids: string[]) => void
  projetoPertenceAoFiltro: (targetProjetoId: string) => boolean
  limparFiltros: () => void
  projetosDisponiveis: ProjetoComInstituicao[]
  instituicaoAtiva: Instituicao | null
  projetoAtivo: ProjetoComInstituicao | null
  loadingFiltros: boolean
  recarregarFiltros: () => Promise<void>
}

const FiltroGlobalContext = React.createContext<FiltroGlobalContextType>({
  instituicoes: [],
  projetos: [],
  instituicaoId: "ALL",
  projetoId: "ALL",
  projetosIds: [],
  opcaoFiltro: 1,
  setInstituicaoId: () => {},
  setProjetoId: () => {},
  setProjetosIds: () => {},
  projetoPertenceAoFiltro: () => true,
  limparFiltros: () => {},
  projetosDisponiveis: [],
  instituicaoAtiva: null,
  projetoAtivo: null,
  loadingFiltros: true,
  recarregarFiltros: async () => {},
})

export function FiltroGlobalProvider({ children }: { children: React.ReactNode }) {
  const [instituicoes, setInstituicoes] = React.useState<Instituicao[]>([])
  const [projetos, setProjetos] = React.useState<ProjetoComInstituicao[]>([])
  const [instituicaoId, setInstituicaoIdState] = React.useState<string>("ALL")
  const [projetoId, setProjetoIdState] = React.useState<string>("ALL")
  const [projetosIds, setProjetosIdsState] = React.useState<string[]>([])
  const [loadingFiltros, setLoadingFiltros] = React.useState(true)

  // 1. Carregar lista de instituições e projetos do banco
  const recarregarFiltros = React.useCallback(async () => {
    try {
      setLoadingFiltros(true)
      const [instList, projList] = await Promise.all([
        mroscService.getInstituicoes(),
        mroscService.getProjetos(),
      ])
      setInstituicoes(instList)
      setProjetos(projList)
    } catch (e) {
      console.error("Erro ao carregar dados do filtro global:", e)
    } finally {
      setLoadingFiltros(false)
    }
  }, [])

  // 2. Inicialização: default "ALL", recupera localStorage se o usuário fixou anteriormente
  React.useEffect(() => {
    recarregarFiltros()

    try {
      const savedInst = localStorage.getItem(STORAGE_KEY_INSTITUICAO)
      const savedProj = localStorage.getItem(STORAGE_KEY_PROJETO)
      const savedProjsIds = localStorage.getItem(STORAGE_KEY_PROJETOS_IDS)

      if (savedInst) {
        setInstituicaoIdState(savedInst)
      }
      if (savedProj) {
        setProjetoIdState(savedProj)
      }
      if (savedProjsIds) {
        try {
          const parsed = JSON.parse(savedProjsIds)
          if (Array.isArray(parsed)) {
            setProjetosIdsState(parsed)
          }
        } catch {}
      }
    } catch {
      // Falha silenciosa no acesso ao localStorage
    }
  }, [recarregarFiltros])

  // 3. Atualizar Instituição fixando no localStorage
  const setInstituicaoId = React.useCallback(
    (id: string) => {
      setInstituicaoIdState(id)
      try {
        localStorage.setItem(STORAGE_KEY_INSTITUICAO, id)
      } catch {}

      // Ao mudar ou definir instituição, sempre reseta a seleção de projetos (Opção 2: todos da instituição)
      setProjetoIdState("ALL")
      setProjetosIdsState([])
      try {
        localStorage.setItem(STORAGE_KEY_PROJETO, "ALL")
        localStorage.setItem(STORAGE_KEY_PROJETOS_IDS, JSON.stringify([]))
      } catch {}

      window.dispatchEvent(
        new CustomEvent("moria_filtro_global_changed", {
          detail: { instituicaoId: id, projetoId: "ALL", projetosIds: [] },
        })
      )
    },
    []
  )

  // 4. Atualizar lista de Projetos Selecionados (Suporta Opção 2 e Opção 3)
  const setProjetosIds = React.useCallback(
    (ids: string[]) => {
      // Se nenhuma instituição estiver definida, projetos fica em todos (Opção 1)
      if (instituicaoId === "ALL") {
        setProjetosIdsState([])
        setProjetoIdState("ALL")
        try {
          localStorage.setItem(STORAGE_KEY_PROJETO, "ALL")
          localStorage.setItem(STORAGE_KEY_PROJETOS_IDS, JSON.stringify([]))
        } catch {}
        return
      }

      // Filtrar apenas IDs válidos que pertencem à instituição ativa
      const idsValidos = ids.filter((id) => {
        const p = projetos.find((proj) => proj.id === id)
        return p && p.instituicao_id === instituicaoId
      })

      setProjetosIdsState(idsValidos)

      const compatProjetoId = idsValidos.length === 1 ? idsValidos[0] : "ALL"
      setProjetoIdState(compatProjetoId)

      try {
        localStorage.setItem(STORAGE_KEY_PROJETOS_IDS, JSON.stringify(idsValidos))
        localStorage.setItem(STORAGE_KEY_PROJETO, compatProjetoId)
      } catch {}

      window.dispatchEvent(
        new CustomEvent("moria_filtro_global_changed", {
          detail: { instituicaoId, projetoId: compatProjetoId, projetosIds: idsValidos },
        })
      )
    },
    [instituicaoId, projetos]
  )

  // 5. Atualizar Projeto individual (compatibilidade retroativa)
  const setProjetoId = React.useCallback(
    (id: string) => {
      if (id === "ALL") {
        setProjetosIds([])
      } else {
        setProjetosIds([id])
      }
    },
    [setProjetosIds]
  )

  // 6. Limpar filtros para Opção 1 (Instituição: todas / Projetos: todos)
  const limparFiltros = React.useCallback(() => {
    setInstituicaoIdState("ALL")
    setProjetoIdState("ALL")
    setProjetosIdsState([])
    try {
      localStorage.setItem(STORAGE_KEY_INSTITUICAO, "ALL")
      localStorage.setItem(STORAGE_KEY_PROJETO, "ALL")
      localStorage.setItem(STORAGE_KEY_PROJETOS_IDS, JSON.stringify([]))
    } catch {}
    window.dispatchEvent(
      new CustomEvent("moria_filtro_global_changed", {
        detail: { instituicaoId: "ALL", projetoId: "ALL", projetosIds: [] },
      })
    )
  }, [])

  // 7. Opção de combinação ativa: 1, 2 ou 3
  // Opção 1: Instituição: todas / projetos: todos
  // Opção 2: Instituição: 1 / projetos: todos da instituição 1
  // Opção 3: Instituição: 1 / projetos: quaisquer projetos selecionados relacionados à instituição 1
  const opcaoFiltro: 1 | 2 | 3 = React.useMemo(() => {
    if (instituicaoId === "ALL") return 1
    if (projetosIds.length === 0) return 2
    return 3
  }, [instituicaoId, projetosIds])

  // 8. Projetos disponíveis filtrados estritamente pela instituição ativa
  const projetosDisponiveis = React.useMemo(() => {
    if (instituicaoId === "ALL") return []
    return projetos.filter((p) => p.instituicao_id === instituicaoId)
  }, [projetos, instituicaoId])

  // 9. Função helper para verificar se um projeto pertence ao filtro ativo
  const projetoPertenceAoFiltro = React.useCallback(
    (targetProjetoId: string): boolean => {
      // Opção 1: Instituição todas -> todos projetos permitidos
      if (instituicaoId === "ALL") {
        return true
      }

      const p = projetos.find((item) => item.id === targetProjetoId)
      if (!p || p.instituicao_id !== instituicaoId) {
        return false
      }

      // Opção 3: projetos selecionados da instituição
      if (projetosIds.length > 0) {
        return projetosIds.includes(targetProjetoId)
      }

      // Opção 2: todos os projetos da instituição
      return true
    },
    [instituicaoId, projetos, projetosIds]
  )

  const instituicaoAtiva = React.useMemo(
    () => instituicoes.find((i) => i.id === instituicaoId) || null,
    [instituicoes, instituicaoId]
  )

  const projetoAtivo = React.useMemo(
    () => projetos.find((p) => p.id === projetoId) || null,
    [projetos, projetoId]
  )

  return (
    <FiltroGlobalContext.Provider
      value={{
        instituicoes,
        projetos,
        instituicaoId,
        projetoId,
        projetosIds,
        opcaoFiltro,
        setInstituicaoId,
        setProjetoId,
        setProjetosIds,
        projetoPertenceAoFiltro,
        limparFiltros,
        projetosDisponiveis,
        instituicaoAtiva,
        projetoAtivo,
        loadingFiltros,
        recarregarFiltros,
      }}
    >
      {children}
    </FiltroGlobalContext.Provider>
  )
}

export function useFiltroGlobal() {
  const ctx = React.useContext(FiltroGlobalContext)
  if (!ctx) {
    throw new Error("useFiltroGlobal deve ser utilizado dentro de um FiltroGlobalProvider")
  }
  return ctx
}
