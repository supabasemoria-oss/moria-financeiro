"use client"

import { useCallback, useMemo } from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { SectionCards } from "@/components/section-cards"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { mroscService } from "@/lib/api/mrosc-service"
import { useMroscQuery } from "@/hooks/use-mrosc-query"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import { Button } from "@/components/ui/button"
import { UploadIcon } from "lucide-react"
import type { ProjetoComInstituicao } from "@/lib/types"

function DashboardContent() {
  const { instituicaoId, projetoId } = useFiltroGlobal()

  const fetchProjetos = useCallback(
    () => mroscService.getProjetos(),
    []
  )

  const { data: projetos } = useMroscQuery<ProjetoComInstituicao[]>(
    fetchProjetos,
    []
  )

  const projetosFiltrados = useMemo(() => {
    if (projetoId !== "ALL") {
      return projetos.filter((p) => p.id === projetoId)
    }
    if (instituicaoId !== "ALL") {
      return projetos.filter((p) => p.instituicao_id === instituicaoId)
    }
    return projetos
  }, [projetos, instituicaoId, projetoId])

  return (
    <>
      <div className="flex items-center justify-between px-4 lg:px-6 -mb-2">
        <p className="text-sm text-muted-foreground">
          {projetosFiltrados.length > 0
            ? `${projetosFiltrados.length} projeto(s) exibido(s)`
            : "Nenhum projeto encontrado"}
        </p>
        <ImportarPlanilhaDialog
          projetoId={projetosFiltrados[0]?.id || projetos[0]?.id}
          trigger={
            <Button variant="outline" size="sm" className="gap-2 h-8 cursor-pointer">
              <UploadIcon className="size-3.5" />
              Importar Planilha
            </Button>
          }
        />
      </div>
      <SectionCards />
    </>
  )
}

export default function Page() {
  return (
    <DashboardShell>
      <DashboardContent />
    </DashboardShell>
  )
}
