"use client"

import * as React from "react"
import { mroscService } from "@/lib/api/mrosc-service"
import type { Instituicao, ProjetoComInstituicao } from "@/lib/types"

const STORAGE_KEY_INSTITUICAO = "moria_filtro_instituicao_id"
const STORAGE_KEY_PROJETO = "moria_filtro_projeto_id"

export interface FiltroGlobalContextType {
  instituicoes: Instituicao[]
  projetos: ProjetoComInstituicao[]
  instituicaoId: string
  projetoId: string
  setInstituicaoId: (id: string) => void
  setProjetoId: (id: string) => void
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
  setInstituicaoId: () => {},
  setProjetoId: () => {},
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

      if (savedInst) {
        setInstituicaoIdState(savedInst)
      }
      if (savedProj) {
        setProjetoIdState(savedProj)
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

      // Ao mudar ou definir instituição, sempre reseta o projeto para "ALL" (sem cascata acidental)
      setProjetoIdState("ALL")
      try {
        localStorage.setItem(STORAGE_KEY_PROJETO, "ALL")
      } catch {}

      window.dispatchEvent(
        new CustomEvent("moria_filtro_global_changed", {
          detail: { instituicaoId: id, projetoId: "ALL" },
        })
      )
    },
    []
  )

  // 4. Atualizar Projeto fixando no localStorage (SEM CASCATA)
  const setProjetoId = React.useCallback(
    (id: string) => {
      // Regra de isolamento estrito:
      // Ao definir instituição, só permitir selecionar projeto vinculado àquela instituição.
      // Para trocar para projeto de outra instituição, deve-se escolher a outra instituição primeiro.
      if (id !== "ALL") {
        if (instituicaoId === "ALL") {
          // Nenhuma instituição definida: bloquear seleção de projeto individual
          return
        }
        const proj = projetos.find((p) => p.id === id)
        if (!proj || proj.instituicao_id !== instituicaoId) {
          // Projeto pertence a outra instituição: bloquear
          return
        }
      }

      setProjetoIdState(id)
      try {
        localStorage.setItem(STORAGE_KEY_PROJETO, id)
      } catch {}

      // NUNCA alterar instituicaoId aqui (zero cascata reversa)
      window.dispatchEvent(new CustomEvent("moria_filtro_global_changed", { detail: { projetoId: id } }))
    },
    [projetos, instituicaoId]
  )

  // 5. Limpar filtros para "ALL" (Exibir Todos)
  const limparFiltros = React.useCallback(() => {
    setInstituicaoIdState("ALL")
    setProjetoIdState("ALL")
    try {
      localStorage.setItem(STORAGE_KEY_INSTITUICAO, "ALL")
      localStorage.setItem(STORAGE_KEY_PROJETO, "ALL")
    } catch {}
    window.dispatchEvent(new CustomEvent("moria_filtro_global_changed", { detail: { instituicaoId: "ALL", projetoId: "ALL" } }))
  }, [])

  // 6. Projetos disponíveis filtrados estritamente pela instituição ativa
  const projetosDisponiveis = React.useMemo(() => {
    if (instituicaoId === "ALL") return []
    return projetos.filter((p) => p.instituicao_id === instituicaoId)
  }, [projetos, instituicaoId])

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
        setInstituicaoId,
        setProjetoId,
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
