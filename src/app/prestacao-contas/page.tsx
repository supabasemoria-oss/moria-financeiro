"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  FileSpreadsheetIcon,
  FileArchiveIcon,
  DownloadIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  SearchIcon,
  ReceiptIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderArchiveIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mroscService } from "@/lib/api/mrosc-service"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import type { Projeto, Rubrica, DespesaComRelacoes } from "@/lib/types"
import { transferegovExporter } from "@/lib/transferegov/exporter"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

export default function PrestacaoContasPage() {
  const { projetoId, setProjetoId, projetosDisponiveis } = useFiltroGlobal()

  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("")
  const [rubricas, setRubricas] = useState<any[]>([])
  const [despesas, setDespesas] = useState<DespesaComRelacoes[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("demonstrativo")

  // Filtros internos da relação de pagamentos
  const [searchDespesa, setSearchDespesa] = useState("")
  const [filterStatusDespesa, setFilterStatusDespesa] = useState<string>("ALL")
  const [filterRubricaId, setFilterRubricaId] = useState<string>("ALL")

  // Estado de exportação de ZIP
  const [exportingZip, setExportingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState("")

  // Carregar lista de projetos
  useEffect(() => {
    async function fetchProjetos() {
      try {
        const data = await mroscService.getProjetos()
        setProjetos(data)
        // Se houver projeto ativo no filtro global, usar ele; senão, o primeiro do banco
        if (projetoId && projetoId !== "ALL") {
          setSelectedProjetoId(projetoId)
        } else if (data.length > 0) {
          setSelectedProjetoId(data[0].id)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido"
        toast.error("Erro ao carregar projetos: " + msg)
      }
    }
    fetchProjetos()
  }, [projetoId])

  // Sincronizar com mudanças do filtro global
  useEffect(() => {
    if (projetoId && projetoId !== "ALL" && projetoId !== selectedProjetoId) {
      setSelectedProjetoId(projetoId)
    }
  }, [projetoId, selectedProjetoId])

  // Carregar dados analíticos do projeto selecionado
  const loadProjectDetails = useCallback(async (projId: string) => {
    if (!projId) return
    try {
      setLoading(true)
      const [rbs, dsps] = await Promise.all([
        mroscService.getRubricas(projId),
        mroscService.getDespesas({ projetoId: projId }),
      ])
      setRubricas(rbs)
      setDespesas(dsps)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados do projeto: " + msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProjetoId) {
      loadProjectDetails(selectedProjetoId)
    }
  }, [selectedProjetoId, loadProjectDetails])

  const currentProjeto = useMemo(
    () => projetos.find((p) => p.id === selectedProjetoId),
    [projetos, selectedProjetoId]
  )

  // Totais e batimento contábil
  const totalAprovado = Number(currentProjeto?.valor_total_aprovado || 0)
  const totalPago = useMemo(
    () => despesas.filter((d) => d.status === "PAGO").reduce((acc, d) => acc + Number(d.valor || 0), 0),
    [despesas]
  )
  const totalPendente = useMemo(
    () => despesas.filter((d) => d.status === "PENDENTE").reduce((acc, d) => acc + Number(d.valor || 0), 0),
    [despesas]
  )
  const saldoRestante = totalAprovado - totalPago
  const percExecucao = totalAprovado > 0 ? (totalPago / totalAprovado) * 100 : 0

  // Contagem de comprovantes
  const despesasPagas = useMemo(() => despesas.filter((d) => d.status === "PAGO"), [despesas])
  const despesasComComprovante = useMemo(
    () => despesasPagas.filter((d) => d.comprovantes && d.comprovantes.length > 0),
    [despesasPagas]
  )
  const totalComprovantesAnexados = useMemo(
    () => despesas.reduce((acc, d) => acc + (d.comprovantes?.length || 0), 0),
    [despesas]
  )
  const taxaCoberturaComprovantes =
    despesasPagas.length > 0 ? (despesasComComprovante.length / despesasPagas.length) * 100 : 100

  // Despesas filtradas para a Relação de Pagamentos
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      if (filterStatusDespesa !== "ALL" && d.status !== filterStatusDespesa) return false
      if (filterRubricaId !== "ALL" && d.rubrica_id !== filterRubricaId) return false
      if (searchDespesa.trim()) {
        const q = searchDespesa.toLowerCase()
        const desc = (d.descricao || "").toLowerCase()
        const nf = (d.numero_documento_fiscal || "").toLowerCase()
        const credor = (d.fornecedores?.razao_social_nome || "").toLowerCase()
        const rubrica = (d.rubricas_orcamentarias?.descricao || "").toLowerCase()
        if (!desc.includes(q) && !nf.includes(q) && !credor.includes(q) && !rubrica.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [despesas, filterStatusDespesa, filterRubricaId, searchDespesa])

  // Ação 1: Exportar Planilha Excel Consolidada Oficial
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
      toast.success("Relatório financeiro (XLSX) padrão Transferegov gerado com sucesso!")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar Excel"
      toast.error(msg)
    }
  }

  // Ação 2: Exportar Lote ZIP com download real de comprovantes do Supabase
  async function handleExportZip() {
    if (!currentProjeto) {
      toast.error("Selecione um projeto.")
      return
    }

    try {
      setExportingZip(true)
      setZipProgress("Iniciando download dos anexos do Supabase Storage...")
      const totalArquivos = await transferegovExporter.exportarLoteComprovantesZip(
        currentProjeto,
        despesas,
        (status) => setZipProgress(status)
      )
      toast.success(`Dossiê ZIP gerado com ${totalArquivos} comprovante(s) baixado(s)!`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar lote ZIP"
      toast.error(msg)
    } finally {
      setExportingZip(false)
      setZipProgress("")
    }
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Prestação de Contas & Transferegov</h2>
            <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              Lei 13.019/2014 (MROSC)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Relatório de Execução Financeira (REF), batimento de linhas orçamentárias e exportações oficiais.
          </p>
        </div>

        {/* Ações de Topo e Seleção de Projeto */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => setActiveTab("exportar")}
            className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <DownloadIcon className="size-4" />
            Exportações Oficiais
          </Button>

          <div className="w-full sm:w-72">
            <Select
              value={selectedProjetoId}
              onValueChange={(val) => {
                if (val) {
                  setSelectedProjetoId(val)
                  setProjetoId(val)
                }
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o Projeto...">
                  {(val) => {
                    if (!val) return "Selecione o Projeto..."
                    const p = (projetosDisponiveis.length > 0 ? projetosDisponiveis : projetos).find(
                      (item) => item.id === val
                    )
                    return p?.nome ?? val
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(projetosDisponiveis.length > 0 ? projetosDisponiveis : projetos).map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Cards de Métricas e Batimento Financeiro */}
      {currentProjeto && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="shadow-2xs">
            <CardHeader className="pb-1.5 pt-3">
              <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Teto Aprovado (Plano)
              </CardDescription>
              <CardTitle className="text-lg font-bold font-mono text-foreground">
                {formatCurrency(totalAprovado)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 text-[11px] text-muted-foreground">
              Termo: <strong className="font-semibold text-foreground">{currentProjeto.numero_termo || "S/N"}</strong>
            </CardContent>
          </Card>

          <Card className="shadow-2xs border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-1.5 pt-3">
              <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Liquidado / Pago
              </CardDescription>
              <CardTitle className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalPago)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
              {percExecucao.toFixed(1)}% do orçamento liquidado
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="pb-1.5 pt-3">
              <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Despesas Pendentes
              </CardDescription>
              <CardTitle className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(totalPendente)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 text-[11px] text-muted-foreground">
              Aguardando pagamento
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="pb-1.5 pt-3">
              <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Saldo Remanescente
              </CardDescription>
              <CardTitle className={`text-lg font-bold font-mono ${saldoRestante < 0 ? "text-destructive" : "text-foreground"}`}>
                {formatCurrency(saldoRestante)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 text-[11px] text-muted-foreground">
              {saldoRestante >= 0 ? "Disponível / a devolver" : "Déficit / remanejamento"}
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="pb-1.5 pt-3">
              <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Comprovantes Fiscais
              </CardDescription>
              <CardTitle className="text-lg font-bold font-mono text-foreground">
                {despesasComComprovante.length} / {despesasPagas.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 text-[11px]">
              {taxaCoberturaComprovantes >= 100 ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2Icon className="size-3" /> 100% comprovado
                </span>
              ) : (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <AlertTriangleIcon className="size-3" /> {taxaCoberturaComprovantes.toFixed(0)}% anexado
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navegação por Abas Oficiais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="demonstrativo" className="gap-2 text-xs">
            <ShieldCheckIcon className="size-3.5" />
            Demonstrativo Sintético
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-2 text-xs">
            <ReceiptIcon className="size-3.5" />
            Relação de Pagamentos (REF)
            <Badge variant="secondary" className="size-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {despesas.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="plano" className="gap-2 text-xs">
            <FileSpreadsheetIcon className="size-3.5" />
            Plano de Aplicação & Rubricas
            <Badge variant="secondary" className="size-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {rubricas.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="exportar"
            className="gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 shadow-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:border-emerald-700 transition-all"
          >
            <DownloadIcon className="size-3.5 text-emerald-600 dark:text-emerald-300" />
            <span className="font-bold">Exportações Oficiais Transferegov</span>
            <Badge className="ml-0.5 bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950 text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider shadow-xs">
              Dossiê MROSC
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── ABA 1: DEMONSTRATIVO SINTÉTICO ────────────────────────────────── */}
        <TabsContent value="demonstrativo" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Resumo da Parceria */}
            <Card className="lg:col-span-2 shadow-2xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Quadro Geral da Execução da Parceria
                </CardTitle>
                <CardDescription className="text-xs">
                  Batimento consolidado entre recursos pactuados no Termo e liquidações do Livro Caixa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg text-xs border">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Número do Termo</span>
                    <strong className="text-foreground font-mono">{currentProjeto?.numero_termo || "Não cadastrado"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Vigência</span>
                    <span className="font-medium text-foreground">
                      {currentProjeto ? `${formatDate(currentProjeto.data_inicio)} a ${formatDate(currentProjeto.data_fim)}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Status da Parceria</span>
                    <Badge variant="outline" className="text-[10px] capitalize mt-0.5">
                      {currentProjeto?.status || "Em andamento"}
                    </Badge>
                  </div>
                </div>

                {/* Barra de Progresso Físico-Financeiro */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Execução Orçamentária Global</span>
                    <span className="font-mono font-bold text-foreground">{percExecucao.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${percExecucao > 100 ? "bg-destructive" : "bg-emerald-600"}`}
                      style={{ width: `${Math.min(100, percExecucao)}%` }}
                    />
                  </div>
                </div>

                {/* Tabela de Batimento da Receita e Despesa */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Componente Contábil MROSC</TableHead>
                      <TableHead className="text-right text-xs">Valor Previsto (R$)</TableHead>
                      <TableHead className="text-right text-xs">Valor Realizado (R$)</TableHead>
                      <TableHead className="text-right text-xs">Saldo (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs font-medium">1. Recursos do Termo (Repasses)</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(totalAprovado)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-semibold">{formatCurrency(totalAprovado)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">R$ 0,00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">2. Despesas Liquidadas (Livro Caixa)</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(totalAprovado)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-semibold">{formatCurrency(totalPago)}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-bold ${saldoRestante < 0 ? "text-destructive" : "text-foreground"}`}>
                        {formatCurrency(saldoRestante)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">3. Despesas Pendentes de Liquidação</TableCell>
                      <TableCell className="text-right font-mono text-xs">—</TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-600">{formatCurrency(totalPendente)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Checklist de Auditoria MROSC */}
            <Card className="shadow-2xs flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Checklist de Auditoria</CardTitle>
                <CardDescription className="text-xs">
                  Critérios formais para validação do órgão repassador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30 border">
                  {totalPago <= totalAprovado ? (
                    <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-medium">Teto Global da Parceria</strong>
                    <span className="text-muted-foreground text-[11px]">
                      {totalPago <= totalAprovado
                        ? "Total executado dentro do limite aprovado."
                        : "Alerta: total pago ultrapassou o teto aprovado."}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30 border">
                  {taxaCoberturaComprovantes >= 100 ? (
                    <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangleIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-medium">Cobertura de Comprovantes</strong>
                    <span className="text-muted-foreground text-[11px]">
                      {taxaCoberturaComprovantes >= 100
                        ? "Todas as despesas pagas possuem notas fiscais anexadas."
                        : `${despesasPagas.length - despesasComComprovante.length} pagamento(s) pendente(s) de arquivo digital.`}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30 border">
                  <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-medium">Classificação Transferegov</strong>
                    <span className="text-muted-foreground text-[11px]">
                      Rubricas vinculadas a códigos de natureza oficiais (GND3 / GND4).
                    </span>
                  </div>
                </div>
              </CardContent>
              <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("exportar")}
                  className="w-full text-xs gap-1.5"
                >
                  <DownloadIcon className="size-3.5" />
                  Ir para Exportação do Dossiê
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── ABA 2: RELAÇÃO OFICIAL DE PAGAMENTOS (REF) ──────────────────────── */}
        <TabsContent value="pagamentos" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Relação Analítica de Pagamentos Efetuados (REF)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Demonstrativo exigido pelo Transferegov com fornecedor, documento fiscal e comprovação digital.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportExcel}
                  className="gap-1.5 text-xs h-8 shrink-0"
                >
                  <FileSpreadsheetIcon className="size-3.5 text-emerald-600" />
                  Baixar Relação (.XLSX)
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Filtros da Relação */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-40">
                    <Select value={filterStatusDespesa} onValueChange={(val) => setFilterStatusDespesa(val ?? "ALL")}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Status">
                          {(val) => (val === "ALL" ? "Todos os Status" : val === "PAGO" ? "Apenas Pagos" : "Apenas Pendentes")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os Status</SelectItem>
                        <SelectItem value="PAGO">Apenas Pagos (Liquidados)</SelectItem>
                        <SelectItem value="PENDENTE">Apenas Pendentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-52">
                    <Select value={filterRubricaId} onValueChange={(val) => setFilterRubricaId(val ?? "ALL")}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Rubrica">
                          {(val) => {
                            if (!val || val === "ALL") return "Todas as Rubricas"
                            const r = rubricas.find((item) => item.id === val)
                            return r ? `${r.codigo_natureza_despesa} - ${r.descricao}` : val
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas as Rubricas</SelectItem>
                        {rubricas.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">
                            <span className="font-mono text-emerald-600 mr-1.5">{r.codigo_natureza_despesa}</span>
                            <span className="truncate max-w-[180px]">{r.descricao}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar credor, NF, descrição..."
                    value={searchDespesa}
                    onChange={(e) => setSearchDespesa(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              {/* Tabela Oficial do REF */}
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Carregando relação de pagamentos...</div>
              ) : despesasFiltradas.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Nenhum pagamento localizado nos filtros.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Data Liq.</TableHead>
                        <TableHead>Credor / Beneficiário</TableHead>
                        <TableHead>Doc. Fiscal / NF</TableHead>
                        <TableHead>Rubrica Transferegov</TableHead>
                        <TableHead className="text-right">Valor Pago</TableHead>
                        <TableHead className="text-center">Comprovante</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despesasFiltradas.map((d) => {
                        const temComp = d.comprovantes && d.comprovantes.length > 0
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="text-xs whitespace-nowrap font-mono">
                              {d.data_pagamento ? formatDate(d.data_pagamento) : formatDate(d.data_despesa)}
                            </TableCell>

                            <TableCell className="text-xs max-w-[200px]">
                              <div className="font-medium text-foreground truncate">
                                {d.fornecedores?.razao_social_nome || "Não informado"}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {d.fornecedores?.cpf_cnpj || "Sem CPF/CNPJ"}
                              </div>
                            </TableCell>

                            <TableCell className="text-xs max-w-[140px] truncate font-mono">
                              {d.numero_documento_fiscal || "—"}
                            </TableCell>

                            <TableCell className="text-xs max-w-[180px]">
                              <div className="font-mono text-emerald-600 font-semibold text-[11px]">
                                {d.rubricas_orcamentarias?.codigo_natureza_despesa || "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {d.rubricas_orcamentarias?.descricao || "—"}
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-bold font-mono text-xs">
                              {formatCurrency(d.valor)}
                            </TableCell>

                            <TableCell className="text-center">
                              {temComp ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                                  <FileTextIcon className="size-3" />
                                  {d.comprovantes!.length} anexo(s)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {d.status === "PAGO" ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">Liquidado</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA 3: PLANO DE APLICAÇÃO & RUBRICAS ──────────────────────────── */}
        <TabsContent value="plano" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Plano de Trabalho & Limites Orçamentários
              </CardTitle>
              <CardDescription className="text-xs">
                Batimento entre previsão aprovada na proposta do Transferegov e pagamentos realizados por rubrica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Carregando plano de trabalho...</div>
              ) : rubricas.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Nenhuma rubrica cadastrada neste projeto.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Código</TableHead>
                      <TableHead>Descrição da Rubrica</TableHead>
                      <TableHead className="text-right">Teto Aprovado</TableHead>
                      <TableHead className="text-right">Total Pago</TableHead>
                      <TableHead className="text-right">Saldo Disponível</TableHead>
                      <TableHead className="text-center">% Execução</TableHead>
                      <TableHead className="text-center">Situação MROSC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rubricas.map((r) => {
                      const gasto = (r.despesas || [])
                        .filter((d: any) => d.status === "PAGO")
                        .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0)
                      const saldo = Number(r.valor_total) - gasto
                      const percent = Number(r.valor_total) > 0 ? (gasto / Number(r.valor_total)) * 100 : 0
                      const isExceeded = gasto > Number(r.valor_total)

                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs font-semibold text-emerald-600">
                            {r.codigo_natureza_despesa}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <div className="text-foreground">{r.descricao}</div>
                            {r.tipo && <div className="text-[10px] text-muted-foreground uppercase">{r.tipo}</div>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{formatCurrency(r.valor_total)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600 font-semibold">
                            {formatCurrency(gasto)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-xs font-semibold ${
                              isExceeded ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {formatCurrency(saldo)}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full ${isExceeded ? "bg-destructive" : "bg-emerald-600"}`}
                                  style={{ width: `${Math.min(100, percent)}%` }}
                                />
                              </div>
                              <span>{percent.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isExceeded ? (
                              <Badge variant="destructive" className="text-[10px]">Teto Excedido</Badge>
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
        </TabsContent>

        {/* ── ABA 4: EXPORTAÇÕES OFICIAIS TRANSFEREGOV ──────────────────────── */}
        <TabsContent value="exportar" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Card 1: Relatório em Planilha Excel */}
            <Card className="border-emerald-600/30 bg-emerald-500/5 shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheetIcon className="size-5 text-emerald-600" />
                  <CardTitle className="text-base font-semibold">Planilha Analítica Oficial (.XLSX)</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Planilha consolidada com 3 abas oficiais: Demonstrativo Sintético, Plano de Aplicação e Relação de Pagamentos do REF.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="p-2.5 bg-background rounded-lg border text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Projeto:</span>
                    <strong className="text-foreground">{currentProjeto?.nome}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Linhas orçadas:</span>
                    <span>{rubricas.length} rubricas</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Despesas registradas:</span>
                    <span>{despesas.length} lançamentos</span>
                  </div>
                </div>

                <Button
                  onClick={handleExportExcel}
                  disabled={!currentProjeto || loading}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white w-full h-9 text-xs font-medium"
                >
                  <DownloadIcon className="size-4" />
                  Exportar Relatório Excel (.XLSX)
                </Button>
              </CardContent>
            </Card>

            {/* Card 2: Lote Digital de Comprovantes (ZIP) */}
            <Card className="border-blue-600/30 bg-blue-500/5 shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FolderArchiveIcon className="size-5 text-blue-600" />
                  <CardTitle className="text-base font-semibold">Dossiê de Comprovantes Digitais (.ZIP)</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Download em lote dos arquivos binários reais do Supabase Storage, organizados por pasta de rubrica e credor.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="p-2.5 bg-background rounded-lg border text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Total de Anexos no Storage:</span>
                    <strong className="text-foreground">{totalComprovantesAnexados} arquivo(s)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Organização:</span>
                    <span className="text-blue-700 dark:text-blue-400 font-medium">Pastas por Rubrica + CSV</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Índice Oficial:</span>
                    <span>INDICE_OFICIAL_DE_COMPROVANTES.csv</span>
                  </div>
                </div>

                <Button
                  onClick={handleExportZip}
                  disabled={!currentProjeto || totalComprovantesAnexados === 0 || exportingZip}
                  variant="outline"
                  className="gap-2 border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white w-full h-9 text-xs font-medium"
                >
                  <DownloadIcon className="size-4" />
                  {exportingZip ? (zipProgress || "Gerando Dossiê...") : "Baixar Dossiê Completo (.ZIP)"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Orientações para Envio ao Transferegov */}
          <Card className="shadow-2xs bg-muted/20 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileTextIcon className="size-4 text-primary" />
                Guia Rápido de Submissão no Transferegov.br
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                1. <strong>Módulo Execução:</strong> Cadastre cada documento fiscal (NF-e, DANFE, RPA) vinculando ao credor cadastrado e anexando o arquivo correspondente extraído do lote .ZIP.
              </p>
              <p>
                2. <strong>Autorização de Pagamento:</strong> Vincule a ordem bancária (OBTV/TED/Pix) ao documento de liquidação fiscal.
              </p>
              <p>
                3. <strong>Prestação de Contas Final:</strong> Faça upload da planilha <code>.XLSX</code> gerada como anexo comprobatório do Relatório de Execução Financeira (REF) e do Relatório de Cumprimento do Objeto (RCO).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
