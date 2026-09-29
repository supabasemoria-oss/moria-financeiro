"use client"

import * as React from "react"
import { Building2Icon, FolderKanbanIcon, XIcon } from "lucide-react"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export function FiltroGlobalHeader() {
  const {
    instituicoes,
    projetosDisponiveis,
    instituicaoId,
    projetoId,
    setInstituicaoId,
    setProjetoId,
    limparFiltros,
  } = useFiltroGlobal()

  const temFiltroAtivo = instituicaoId !== "ALL" || projetoId !== "ALL"

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
                if (!val || val === "ALL") return "🏢 Todas Instituições"
                const inst = instituicoes.find((i) => i.id === val)
                return inst ? inst.razao_social : "🏢 Todas Instituições"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="max-w-[280px]">
            <SelectItem value="ALL" className="text-xs font-medium">
              🏢 Todas as Instituições
            </SelectItem>
            {instituicoes.map((inst) => (
              <SelectItem key={inst.id} value={inst.id} className="text-xs">
                {inst.razao_social}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. Seletor de Projeto */}
      <div className="w-[140px] sm:w-[180px] lg:w-[220px]">
        <Select
          value={projetoId}
          onValueChange={(val) => {
            if (val) setProjetoId(val)
          }}
        >
          <SelectTrigger className="h-8 text-xs font-medium bg-muted/40 hover:bg-muted/70 border-muted-foreground/20 px-2.5">
            <FolderKanbanIcon className="size-3.5 mr-1 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Todos os Projetos">
              {(val: string | null) => {
                if (!val || val === "ALL") return "📂 Todos os Projetos"
                const proj = projetosDisponiveis.find((p) => p.id === val)
                return proj ? proj.nome : "📂 Todos os Projetos"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="max-w-[320px]">
            <SelectItem value="ALL" className="text-xs font-medium">
              📂 Todos os Projetos
            </SelectItem>
            {projetosDisponiveis.map((proj) => (
              <SelectItem key={proj.id} value={proj.id} className="text-xs">
                {proj.nome}
              </SelectItem>
            ))}
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
