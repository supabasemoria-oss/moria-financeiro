"use client"

import { useEffect, useState, useMemo } from "react"
import {
  FileSpreadsheetIcon,
  FileArchiveIcon,
  DownloadIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { moriaService } from "@/lib/api/moria-service"
import type { Projeto, Rubrica, Despesa } from "@/lib/types"
import { transferegovExporter } from "@/lib/transferegov/exporter"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

export default function PrestacaoContasPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("")
  const [rubricas, setRubricas] = useState<(Rubrica & { despesas?: Despesa[] })[]>([])
  const [despesas, setDespesas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingZip, setExportingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState("")

  useEffect(() => {
    async function fetchProjetos() {
      try {
        const data = await moriaService.getProjetos()
        setProjetos(data)
        if (data.length > 0) {
          setSelectedProjetoId(data[0].id)
        }
      } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar projetos: " + msg)
      }
    }
    fetchProjetos()
  }, [])

  async function loadProjectDetails(projId: string) {
    if (!projId) return
    try {
      setLoading(true)
      const [rbs, dsps] = await Promise.all([
        moriaService.getRubricas(projId),
        moriaService.getDespesas({ projetoId: projId }),
      ])
      setRubricas(rbs)
      setDespesas(dsps)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados do projeto: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjetoId) {
      loadProjectDetails(selectedProjetoId)
    }
  }, [selectedProjetoId])

  const currentProjeto = useMemo(
    () => projetos.find((p) => p.id === selectedProjetoId),
    [projetos, selectedProjetoId]
  )

  const totalAprovado = Number(currentProjeto?.valor_total_aprovado || 0)
  const totalPago = despesas.filter((d) => d.status === "PAGO").reduce((acc, d) => acc + Number(d.valor || 0), 0)
  const totalPendente = despesas.filter((d) => d.status === "PENDENTE").reduce((acc, d) => acc + Number(d.valor || 0), 0)
  const saldoRestante = totalAprovado - totalPago

  const totalComprovantes = despesas.reduce((acc, d) => acc + (d.comprovantes?.length || 0), 0)

  // 1. Exportar Planilha Excel Consolidada
  function handleExportExcel() {
    if (!currentProjeto) {
      toast.error("Selecione um projeto.")
      return
    }

    try {
      transferegovExporter.exportarRelatorioExcel({
        projeto: currentProjeto,
        rubricas,
        despesas,
      })
      toast.success("Relatório financeiro gerado com sucesso!")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao gerar Excel: " + msg)
    }
  }

  // 2. Exportar Lote ZIP com todos os comprovantes
  async function handleExportZip() {
    if (!currentProjeto) {
      toast.error("Selecione um projeto.")
      return
    }

    if (totalComprovantes === 0) {
      toast.warning("Nenhum comprovante anexado nas despesas deste projeto.")
      return
    }

    try {
      setExportingZip(true)
      setZipProgress("Iniciando download dos anexos...")
      const totalArquivos = await transferegovExporter.exportarLoteComprovantesZip(
        currentProjeto,
        despesas,
        (status) => setZipProgress(status)
      )
      toast.success(`Lote .ZIP com ${totalArquivos} comprovante(s) baixado com sucesso!`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao gerar arquivo ZIP: " + msg)
    } finally {
      setExportingZip(false)
      setZipProgress("")
    }
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prestação de Contas & Transferegov</h2>
          <p className="text-sm text-muted-foreground">
            Consolidação contábil, memória de cálculo e lote de comprovantes digitais para o órgão repassador.
          </p>
        </div>

        <div className="w-72">
          <Select
            value={selectedProjetoId}
            onValueChange={(val) => {
              if (val) setSelectedProjetoId(val)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o Projeto..." />
            </SelectTrigger>
            <SelectContent>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Caixa de Ações de Exportação MROSC */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-emerald-600/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheetIcon className="size-5 text-emerald-600" />
              <CardTitle className="text-base font-semibold">Relatório Financeiro Consolidado</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Planilha analítica completa com resumo do termo, plano de trabalho, rubricas orçadas, pagamentos efetuados e saldos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Formato: Microsoft Excel (.XLSX)</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Padrão Transferegov</span>
            </div>
            <Button
              onClick={handleExportExcel}
              disabled={!currentProjeto || loading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white w-full"
            >
              <DownloadIcon className="size-4" />
              Exportar Relatório (.XLSX)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-600/30 bg-blue-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileArchiveIcon className="size-5 text-blue-600" />
              <CardTitle className="text-base font-semibold">Lote de Comprovantes (.ZIP)</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Arquivo compactado com todas as notas fiscais, recibos, comprovantes Pix e folhas, organizados por rubrica.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total de Anexos: {totalComprovantes} arquivo(s)</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">Estrutura em Pastas</span>
            </div>
            <Button
              onClick={handleExportZip}
              disabled={!currentProjeto || totalComprovantes === 0 || exportingZip}
              variant="outline"
              className="gap-2 border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white w-full"
            >
              <DownloadIcon className="size-4" />
              {exportingZip ? (zipProgress || "Gerando ZIP...") : "Baixar Lote Completo (.ZIP)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Resumo da Memória de Cálculo do Projeto */}
      {currentProjeto && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase">Teto Aprovado</CardDescription>
              <CardTitle className="text-xl font-bold">{formatCurrency(totalAprovado)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase">Executado / Pago</CardDescription>
              <CardTitle className="text-xl font-bold text-emerald-600">{formatCurrency(totalPago)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase">Despesas Pendentes</CardDescription>
              <CardTitle className="text-xl font-bold text-amber-600">{formatCurrency(totalPendente)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase">Saldo Devolução / Remanescente</CardDescription>
              <CardTitle className="text-xl font-bold text-purple-600">{formatCurrency(saldoRestante)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tabela de Rubricas e Execução para Conferência */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Conferência das Linhas Orçamentárias</CardTitle>
          <CardDescription className="text-xs">
            Extrato de batimento contábil entre previsão aprovada e pagamentos realizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando demonstrativo...</div>
          ) : rubricas.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma rubrica cadastrada neste projeto.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição da Rubrica</TableHead>
                  <TableHead className="text-right">Valor Orçado</TableHead>
                  <TableHead className="text-right">Total Pago</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-center">% Execução</TableHead>
                  <TableHead className="text-center">Status MROSC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubricas.map((r) => {
                  const gasto = (r.despesas || [])
                    .filter((d) => d.status === "PAGO")
                    .reduce((acc, curr) => acc + Number(curr.valor), 0)
                  const saldo = Number(r.valor_total) - gasto
                  const percent = Number(r.valor_total) > 0 ? (gasto / Number(r.valor_total)) * 100 : 0
                  const isExceeded = gasto > Number(r.valor_total)

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-semibold">{r.codigo_natureza_despesa}</TableCell>
                      <TableCell className="text-xs font-medium">{r.descricao}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(r.valor_total)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-600 font-semibold">{formatCurrency(gasto)}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-semibold ${isExceeded ? "text-destructive" : "text-emerald-600"}`}>
                        {formatCurrency(saldo)}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {percent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        {isExceeded ? (
                          <Badge variant="destructive" className="text-[10px]">Teto Ultrapassado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">Regular</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
