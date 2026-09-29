"use client"

import { useCallback, useMemo } from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { mroscService } from "@/lib/api/mrosc-service"
import { useMroscQuery } from "@/hooks/use-mrosc-query"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { UploadIcon } from "lucide-react"
import { CalendarioLembretes } from "@/components/calendario-lembretes"
import type { RubricaComDespesas, ProjetoComInstituicao } from "@/lib/types"

function DashboardContent() {
  const { instituicaoId, projetoId } = useFiltroGlobal()

  const fetchRubricas = useCallback(
    () => mroscService.getRubricas(""),
    []
  )
  const fetchProjetos = useCallback(
    () => mroscService.getProjetos(),
    []
  )

  const { data: rubricas } = useMroscQuery<RubricaComDespesas[]>(
    fetchRubricas,
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

  const rubricasFiltradas = useMemo(() => {
    return rubricas.filter((r) => projetosFiltrados.some((p) => p.id === r.projeto_id))
  }, [rubricas, projetosFiltrados])

  const tableData = rubricasFiltradas.map((r, idx) => {
    const proj = projetos.find((p) => p.id === r.projeto_id)
    const totalGasto = (r.despesas || [])
      .filter((d) => d.status === "PAGO")
      .reduce((acc, d) => acc + Number(d.valor || 0), 0)

    return {
      id: idx + 1,
      header: `${r.codigo_natureza_despesa} - ${r.descricao}`,
      type: r.tipo,
      status:
        totalGasto >= Number(r.valor_total) ? "Concluído" : "Em Andamento",
      target: formatCurrency(totalGasto),
      limit: formatCurrency(r.valor_total),
      reviewer: proj?.nome ?? "Moriá Consultoria",
    }
  })

  return (
    <>
      <div className="flex items-center justify-between px-4 lg:px-6 -mb-2">
        <p className="text-sm text-muted-foreground">
          {projetosFiltrados.length > 0 ? `${projetosFiltrados.length} projeto(s) exibido(s)` : "Nenhum projeto encontrado"}
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
      <div className="px-4 lg:px-6">
        <CalendarioLembretes />
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
