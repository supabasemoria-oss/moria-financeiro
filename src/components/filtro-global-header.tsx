"use client"

import * as React from "react"
import { Building2Icon, FolderKanbanIcon, XIcon, InfoIcon, ChevronDownIcon } from "lucide-react"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function FiltroGlobalHeader() {
  const {
    instituicoes,
    projetos,
    projetosDisponiveis,
    instituicaoId,
    projetoId,
    projetosIds,
    opcaoFiltro,
    setInstituicaoId,
    setProjetosIds,
    limparFiltros,
  } = useFiltroGlobal()

  const [popoverOpen, setPopoverOpen] = React.useState(false)

  const temFiltroAtivo = instituicaoId !== "ALL" || projetosIds.length > 0 || projetoId !== "ALL"
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

  // Handler para alternar seleção de um projeto específico (Opção 3)
  const handleToggleProjeto = (id: string) => {
    if (projetosIds.includes(id)) {
      setProjetosIds(projetosIds.filter((pId) => pId !== id))
    } else {
      setProjetosIds([...projetosIds, id])
    }
  }

  // Handler para marcar todos os projetos da instituição ativa (Opção 2)
  const handleSelecionarTodosDaInstituicao = () => {
    setProjetosIds([])
  }

  // Handler para marcar todos os projetos explicitamente
  const handleMarcarTodosProjetos = () => {
    setProjetosIds(projetosDisponiveis.map((p) => p.id))
  }

  // Rótulo dinâmico para o botão de projetos
  const labelProjetos = React.useMemo(() => {
    if (opcaoFiltro === 1) {
      return "Todos os Projetos"
    }
    if (opcaoFiltro === 2) {
      return "Todos os Projetos"
    }
    if (projetosIds.length === 1) {
      const p = projetosDisponiveis.find((item) => item.id === projetosIds[0])
      return p ? p.nome : "1 projeto selecionado"
    }
    return `${projetosIds.length} projetos selecionados`
  }, [opcaoFiltro, projetosIds, projetosDisponiveis])

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 1. Seletor de Instituição */}
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
            {/* Cabeçalho explicativo */}
            <div className="px-2.5 py-1.5 border-b border-border/50 bg-muted/20">
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <Building2Icon className="size-3 text-emerald-600 dark:text-emerald-400" />
                Instituição
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Defina a instituição para habilitar a escolha dos seus projetos.
              </p>
            </div>

            <SelectItem value="ALL" className="text-xs font-medium py-1.5">
              <div className="flex flex-col">
                <span className="font-semibold">Todas as Instituições</span>
                <span className="text-[10px] text-muted-foreground">Opção 1: exibe todos os projetos</span>
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

            <div className="px-2.5 py-1.5 border-t border-border/50 text-[10px] text-muted-foreground bg-muted/10 leading-tight">
              💡 Para trocar para projetos de outra instituição, selecione a outra instituição aqui primeiro.
            </div>
          </SelectContent>
        </Select>
      </div>

      {/* 2. Seletor de Projetos com Suporte a Multi-Select (Opções 1, 2 e 3) */}
      <div className="w-[140px] sm:w-[180px] lg:w-[230px]">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            type="button"
            className={`flex w-full h-8 items-center justify-between gap-1.5 rounded-lg border text-xs px-2.5 transition-colors cursor-pointer select-none text-left ${
              opcaoFiltro === 1
                ? "bg-muted/40 hover:bg-muted/70 border-muted-foreground/20 text-muted-foreground"
                : opcaoFiltro === 2
                ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 font-medium"
                : "bg-emerald-600 text-white font-semibold border-emerald-700 shadow-xs"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {opcaoFiltro === 1 ? (
                <FolderKanbanIcon className="size-3.5 text-muted-foreground shrink-0" />
              ) : (
                <FolderKanbanIcon className={`size-3.5 shrink-0 ${opcaoFiltro === 3 ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`} />
              )}
              <span className="truncate">{labelProjetos}</span>
            </div>
            <ChevronDownIcon className="size-3.5 opacity-70 shrink-0" />
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[300px] sm:w-[350px] p-0 overflow-hidden shadow-lg border">
            {opcaoFiltro === 1 ? (
              /* Informação quando Opção 1 está ativa */
              <div className="p-3 text-center space-y-2">
                <div className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto">
                  <FolderKanbanIcon className="size-4" />
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] font-semibold border-muted-foreground/30 text-muted-foreground mb-1">
                    Opção 1 de Filtro
                  </Badge>
                  <p className="text-xs font-semibold text-foreground">
                    Instituição: Todas | Projetos: Todos
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Nesta opção, todos os projetos de todas as instituições são exibidos simultaneamente.
                  </p>
                </div>
                <div className="text-[10px] bg-muted/60 rounded p-2 text-muted-foreground border border-border/50 text-left space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <InfoIcon className="size-3 text-emerald-600" />
                    Como filtrar projetos específicos?
                  </p>
                  <p>
                    Para selecionar todos os projetos de uma instituição (<strong>Opção 2</strong>) ou escolher projetos individuais por checkboxes (<strong>Opção 3</strong>), selecione a instituição no filtro ao lado primeiro.
                  </p>
                </div>
              </div>
            ) : (
              /* Painel de seleção de projetos da instituição ativa (Opção 2 e Opção 3) */
              <div className="flex flex-col">
                {/* Cabeçalho da Instituição */}
                <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-950/25 border-b border-border/60">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 truncate flex items-center gap-1.5">
                      <Building2Icon className="size-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{instituicaoAtiva?.razao_social}</span>
                    </p>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold shrink-0">
                      {projetosDisponiveis.length} {projetosDisponiveis.length === 1 ? "projeto" : "projetos"}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                    {opcaoFiltro === 2
                      ? "Opção 2 ativa: Exibindo todos os projetos desta instituição."
                      : `Opção 3 ativa: ${projetosIds.length} projeto(s) selecionado(s).`}
                  </p>
                </div>

                {/* Opção Rápida: Todos da Instituição (Opção 2) */}
                <div className="p-2 border-b border-border/40 bg-muted/15 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSelecionarTodosDaInstituicao}
                    className={`flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded cursor-pointer transition-colors ${
                      opcaoFiltro === 2
                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={opcaoFiltro === 2}
                      onCheckedChange={() => handleSelecionarTodosDaInstituicao()}
                    />
                    <span>Todos os projetos desta instituição (Opção 2)</span>
                  </button>
                </div>

                {/* Lista de Projetos com Checkboxes (Opção 3) */}
                <div className="max-h-[220px] overflow-y-auto p-1.5 space-y-1">
                  {projetosDisponiveis.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-3">
                      Nenhum projeto cadastrado para esta instituição.
                    </p>
                  ) : (
                    projetosDisponiveis.map((proj) => {
                      const isSelected = projetosIds.includes(proj.id)
                      return (
                        <div
                          key={proj.id}
                          onClick={() => handleToggleProjeto(proj.id)}
                          className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors text-xs select-none ${
                            isSelected
                              ? "bg-emerald-500/15 text-foreground font-medium border border-emerald-500/30"
                              : "hover:bg-muted/60 text-muted-foreground border border-transparent"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleProjeto(proj.id)}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-foreground font-medium leading-snug">{proj.nome}</span>
                            {proj.numero_termo && (
                              <span className="text-[10px] text-muted-foreground">
                                Termo nº {proj.numero_termo}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Barra de Ações Rápidas */}
                <div className="p-2 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleMarcarTodosProjetos}
                      className="h-6 px-1.5 text-[10px]"
                    >
                      Marcar todos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelecionarTodosDaInstituicao}
                      className="h-6 px-1.5 text-[10px]"
                    >
                      Todos da OSC
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPopoverOpen(false)}
                    className="h-6 px-2 text-[10px] font-semibold"
                  >
                    Fechar
                  </Button>
                </div>

                {/* Rodapé Informativo */}
                <div className="px-2.5 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground bg-muted/10 leading-tight">
                  🔒 Para acessar projetos de outra instituição, altere a instituição no filtro ao lado primeiro.
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* 3. Botão rápido para Exibir Todos (Opção 1) quando houver filtro fixado */}
      {temFiltroAtivo && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={limparFiltros}
          title="Exibir todos (Opção 1: Todas as Instituições + Todos os Projetos)"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <XIcon className="size-3.5" />
          <span className="hidden xl:inline text-[11px]">Todos</span>
        </Button>
      )}
    </div>
  )
}
