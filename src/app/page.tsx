"use client"

import { useCallback } from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { moriaService } from "@/lib/api/moria-service"
import { useMoriaQuery } from "@/hooks/use-moria-query"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { UploadIcon } from "lucide-react"
import type { RubricaComDespesas, ProjetoComInstituicao } from "@/lib/types"

function DashboardContent() {
  const fetchRubricas = useCallback(
    () => moriaService.getRubricas(""),
    []
  )
  const fetchProjetos = useCallback(
    () => moriaService.getProjetos(),
    []
  )

  const { data: rubricas } = useMoriaQuery<RubricaComDespesas[]>(
    fetchRubricas,
    []
  )
  const { data: projetos } = useMoriaQuery<ProjetoComInstituicao[]>(
    fetchProjetos,
    []
  )

  const tableData = rubricas.map((r, idx) => {
    const proj = projetos.find((p) => p.id === r.projeto_id)
    const totalGasto = r.despesas
      .filter((d) => d.status === "PAGO")
      .reduce((acc, d) => acc + Number(d.valor || 0), 0)

    return {
      id: idx + 1,
      header: `${r.codigo_natureza_despesa} - ${r.descricao}`,
      type: r.tipo,
      status:
        totalGasto >= Number(r.valor_total) ? "Done" : "In Process",
      target: formatCurrency(totalGasto),
      limit: formatCurrency(r.valor_total),
      reviewer: proj?.nome ?? "Moriá Consultoria",
    }
  })

  return (
    <>
      {projetos.length > 0 && (
        <div className="flex items-center justify-between px-4 lg:px-6 -mb-2">
          <p className="text-sm text-muted-foreground">
            {projetos.length} projeto(s) ativo(s)
          </p>
          <ImportarPlanilhaDialog
            projetoId={projetos[0].id}
            trigger={
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <UploadIcon className="size-3.5" />
                Importar Planilha
              </Button>
            }
          />
        </div>
      )}
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={tableData} />
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
