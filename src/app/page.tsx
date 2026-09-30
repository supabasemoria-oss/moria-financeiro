"use client"

import { useCallback } from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { SectionCards } from "@/components/section-cards"
import { CronogramaRapido } from "@/components/cronograma-rapido"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { mroscService } from "@/lib/api/mrosc-service"
import { useMroscQuery } from "@/hooks/use-mrosc-query"
import { Button } from "@/components/ui/button"
import { UploadIcon } from "lucide-react"
import type { ProjetoComInstituicao } from "@/lib/types"

function DashboardContent() {
  const fetchProjetos = useCallback(
    () => mroscService.getProjetos(),
    []
  )

  const { data: projetos } = useMroscQuery<ProjetoComInstituicao[]>(
    fetchProjetos,
    []
  )

  return (
    <>
      <div className="flex items-center justify-between px-4 lg:px-6 -mb-2">
        <p className="text-sm text-muted-foreground">
          {projetos.length > 0
            ? `${projetos.length} projeto(s) cadastrado(s)`
            : "Nenhum projeto encontrado"}
        </p>
        <ImportarPlanilhaDialog
          projetoId={projetos[0]?.id}
          trigger={
            <Button variant="outline" size="sm" className="gap-2 h-8 cursor-pointer">
              <UploadIcon className="size-3.5" />
              Importar Planilha
            </Button>
          }
        />
      </div>
      <SectionCards />
      <CronogramaRapido />
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
