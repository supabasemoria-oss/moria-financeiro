"use client"

import * as React from "react"
import { Building2Icon, FolderKanbanIcon, XIcon, LockIcon, InfoIcon } from "lucide-react"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export function FiltroGlobalHeader() {
  const {
    instituicoes,
    projetos,
    projetosDisponiveis,
    instituicaoId,
    projetoId,
    setInstituicaoId,
    setProjetoId,
    limparFiltros,
  } = useFiltroGlobal()

  const temFiltroAtivo = instituicaoId !== "ALL" || projetoId !== "ALL"
  const instituicaoAtiva = instituicoes.find((i) => i.id === instituicaoId)

  // Mapeamento de contagem de projetos por instituição
  const projetosPorInstituicao = React.useMemo(() => {
    const map: Record<string, number> = {}
    projetos.forEach((p) => {
      if (p.instituicao_id) {
        map[p.instituicao_id] = (map[p.instituicao_id] || 0) + 1
      }
    })
    return map
  }, [projetos])

  // Projetos que pertencem a outras instituições (para exibir bloqueados quando houver instituição ativa)
  const outrosProjetos = React.useMemo(() => {
    if (instituicaoId === "ALL") return []
    return projetos.filter((p) => p.instituicao_id !== instituicaoId)
  }, [projetos, instituicaoId])

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 1. Seletor de Instituição (Hierarquia 1) */}
      <div className="w-[140px] sm:w-[180px] lg:w-[210px]">
        <Select
          value={instituicaoId}
          onValueChange={(val) => {
            if (val) setInstituicaoId(val)
          }}
        >
          <SelectTrigger className="h-8 text-xs font-medium bg-muted/40 hover:bg-muted/70 border-muted-foreground/20 px-2.5">
            <Building2Icon className="size-3.5 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Todas as Instituições">
              {(val: string | null) => {
                if (!val || val === "ALL") return "Todas as Instituições"
                const inst = instituicoes.find((i) => i.id === val)
                return inst ? inst.razao_social : "Todas as Instituições"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="w-[280px] sm:w-[320px]">
            {/* Cabeçalho informativo da Instituição */}
            <div className="px-2.5 py-1.5 border-b border-border/50 bg-muted/20">
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <Building2Icon className="size-3 text-emerald-600 dark:text-emerald-400" />
                1º Passo: Definir Instituição
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Libera a seleção exclusiva dos projetos vinculados a ela.
              </p>
            </div>

            <SelectItem value="ALL" className="text-xs font-medium py-1.5">
              <div className="flex flex-col">
                <span>Todas as Instituições</span>
                <span className="text-[10px] text-muted-foreground">Visão geral consolidada</span>
              </div>
            </SelectItem>

            <SelectSeparator />

            {instituicoes.map((inst) => {
              const qtd = projetosPorInstituicao[inst.id] || 0
              return (
                <SelectItem key={inst.id} value={inst.id} className="text-xs py-1.5">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{inst.razao_social}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {qtd} {qtd === 1 ? "projeto vinculado" : "projetos vinculados"}
                    </span>
                  </div>
                </SelectItem>
              )
            })}

            <div className="px-2.5 py-1.5 border-t border-border/50 text-[10px] text-muted-foreground/80 bg-muted/10">
              ℹ️ Sem cascata: selecione a instituição antes de escolher um projeto.
            </div>
          </SelectContent>
        </Select>
      </div>

      {/* 2. Seletor de Projeto (Hierarquia 2 - restrito à instituição definida) */}
      <div className="w-[140px] sm:w-[180px] lg:w-[220px]">
        <Select
          value={projetoId}
          onValueChange={(val) => {
            if (val) setProjetoId(val)
          }}
        >
          <SelectTrigger
            className={`h-8 text-xs font-medium px-2.5 transition-colors ${
              instituicaoId === "ALL"
                ? "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground"
                : "bg-muted/40 hover:bg-muted/70 border-muted-foreground/20"
            }`}
          >
            {instituicaoId === "ALL" ? (
              <LockIcon className="size-3.5 mr-1 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <FolderKanbanIcon className="size-3.5 mr-1 text-muted-foreground shrink-0" />
            )}
            <SelectValue placeholder="Selecione a instituição...">
              {(val: string | null) => {
                if (instituicaoId === "ALL") return "Defina a instituição primeiro"
                if (!val || val === "ALL") return `Todos (${instituicaoAtiva?.razao_social ?? "OSC"})`
                const proj = projetosDisponiveis.find((p) => p.id === val)
                return proj ? proj.nome : `Todos (${instituicaoAtiva?.razao_social ?? "OSC"})`
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="w-[300px] sm:w-[350px]">
            {instituicaoId === "ALL" ? (
              /* Caso A: Nenhuma instituição definida -> Alerta explicativo */
              <div className="p-3 text-center space-y-1.5">
                <div className="inline-flex size-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto mb-0.5">
                  <LockIcon className="size-3.5" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Seleção de Projeto Bloqueada
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Para selecionar um projeto, você deve escolher uma instituição no filtro ao lado primeiro.
                </p>
                <div className="text-[10px] bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded px-2 py-1 font-medium border border-amber-500/20">
                  Regra: projetos são vinculados estritamente à sua OSC proponente.
                </div>
                <SelectItem value="ALL" className="text-xs font-medium py-1.5 mt-2 justify-center">
                  Todos os Projetos (Visualização Geral)
                </SelectItem>
              </div>
            ) : (
              /* Caso B: Instituição definida -> Apenas projetos vinculados */
              <>
                <div className="px-2.5 py-1.5 border-b border-border/50 bg-emerald-500/10 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 truncate">
                      <FolderKanbanIcon className="size-3 shrink-0" />
                      <span className="truncate">{instituicaoAtiva?.razao_social}</span>
                    </p>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold px-1.5 py-0.2 rounded-full shrink-0">
                      {projetosDisponiveis.length} {projetosDisponiveis.length === 1 ? "projeto" : "projetos"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Mostrando apenas projetos vinculados a esta instituição.
                  </p>
                </div>

                <SelectItem value="ALL" className="text-xs font-medium py-1.5">
                  <div className="flex flex-col">
                    <span>Todos os Projetos desta Instituição</span>
                    <span className="text-[10px] text-muted-foreground">Consolidado da OSC</span>
                  </div>
                </SelectItem>

                <SelectSeparator />

                {projetosDisponiveis.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id} className="text-xs py-1.5">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{proj.nome}</span>
                      {proj.numero_termo && (
                        <span className="text-[10px] text-muted-foreground">
                          Termo nº {proj.numero_termo}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}

                {projetosDisponiveis.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                    Nenhum projeto cadastrado para esta instituição.
                  </div>
                )}

                {/* Seção com projetos de outras instituições bloqueados e informativos */}
                {outrosProjetos.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2.5 py-2 bg-amber-500/10 dark:bg-amber-950/30 border-y border-amber-500/20">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        <LockIcon className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Outras Instituições (Bloqueado)</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        Para trocar para um projeto de outra instituição, você deve escolher a outra instituição no filtro ao lado primeiro.
                      </p>
                    </div>

                    {outrosProjetos.map((op) => {
                      const nomeInst =
                        instituicoes.find((i) => i.id === op.instituicao_id)?.razao_social || "Outra OSC"
                      return (
                        <SelectItem
                          key={op.id}
                          value={op.id}
                          disabled={true}
                          className="text-xs opacity-50 cursor-not-allowed py-1"
                        >
                          <div className="flex items-center gap-1.5 text-muted-foreground w-full">
                            <LockIcon className="size-3 text-muted-foreground/60 shrink-0" />
                            <span className="truncate">{op.nome}</span>
                            <span className="text-[9px] text-muted-foreground/80 italic ml-auto truncate shrink-0">
                              ({nomeInst})
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </>
                )}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Botão rápido para Exibir Todos quando houver filtro fixado */}
      {temFiltroAtivo && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={limparFiltros}
          title="Exibir todos (limpar fixação)"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <XIcon className="size-3.5" />
          <span className="hidden xl:inline text-[11px]">Todos</span>
        </Button>
      )}
    </div>
  )
}
