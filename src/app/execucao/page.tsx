"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ReceiptIcon,
  PlusIcon,
  Trash2Icon,
  CheckCircle2Icon,
  ClockIcon,
  FilterIcon,
  FileCheckIcon,
  SearchIcon,
  DownloadIcon,
  DollarSignIcon,
  WalletIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CalendarDaysIcon,
  Building2Icon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarFornecedorDialog } from "@/components/dialogs/criar-fornecedor-dialog"
import { CriarProjetoDialog } from "@/components/dialogs/criar-projeto-dialog"
import { CriarRubricaDialog } from "@/components/dialogs/criar-rubrica-dialog"
import { mroscService } from "@/lib/api/mrosc-service"
import type { Projeto, Rubrica, Fornecedor, Despesa, DespesaComRelacoes, ParcelaComRelacoes, ParcelaPagamento } from "@/lib/types"
import { formatCurrency, formatDate, formatCpfCnpj, getTodaySaoPaulo, diasRestantesSaoPaulo } from "@/lib/utils"
import { maskCurrency, parseCurrency } from "@/lib/masks"
import { toast } from "sonner"

function ExecucaoContent() {
  const searchParams = useSearchParams()
  const initialProjetoId = searchParams.get("projetoId") || ""

  // Dados principais
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [rubricas, setRubricas] = useState<(Rubrica & { despesas?: Despesa[] })[]>([])
  const [despesas, setDespesas] = useState<DespesaComRelacoes[]>([])
  const [parcelas, setParcelas] = useState<ParcelaComRelacoes[]>([])

  // Filtros
  const [filterProjeto, setFilterProjeto] = useState<string>(initialProjetoId || "ALL")
  const [filterFornecedor, setFilterFornecedor] = useState<string>("ALL")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("parcelas")

  // Estados de controle
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialogs de criação rápida
  const [openFornecedor, setOpenFornecedor] = useState(false)
  const [openProjeto, setOpenProjeto] = useState(false)
  const [openRubrica, setOpenRubrica] = useState(false)

  // Dialog Nova Despesa
  const [openDespesa, setOpenDespesa] = useState(false)
  const [despesaForm, setDespesaForm] = useState({
    projeto_id: initialProjetoId || "",
    rubrica_id: "",
    fornecedor_id: "",
    descricao: "",
    valor: "",
    data_despesa: getTodaySaoPaulo(),
    numero_documento_fiscal: "",
    status: "PENDENTE" as "PENDENTE" | "PAGO",
  })

  // Dialog Nova Parcela
  const [openNovaParcela, setOpenNovaParcela] = useState(false)
  const [parcelaForm, setParcelaForm] = useState({
    projeto_id: initialProjetoId || "",
    rubrica_id: "",
    descricao: "",
    valor_previsto: "",
    data_vencimento: getTodaySaoPaulo(),
    numero_parcela: "1",
    total_parcelas: "1",
  })

  // Dialog Quitar Parcela
  const [openQuitar, setOpenQuitar] = useState(false)
  const [parcelaParaQuitar, setParcelaParaQuitar] = useState<ParcelaComRelacoes | null>(null)
  const [quitarForm, setQuitarForm] = useState({
    fornecedor_id: "",
    data_pagamento_real: getTodaySaoPaulo(),
    numero_documento_fiscal: "",
    observacoes: "",
  })

  // Carregar dados iniciais
  async function loadData() {
    try {
      setLoading(true)
      const [projData, fornData] = await Promise.all([
        mroscService.getProjetos(),
        mroscService.getFornecedores(),
      ])
      setProjetos(projData)
      setFornecedores(fornData)

      if (projData.length > 0 && !despesaForm.projeto_id) {
        setDespesaForm((prev) => ({ ...prev, projeto_id: projData[0].id }))
        setParcelaForm((prev) => ({ ...prev, projeto_id: projData[0].id }))
      }

      await refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados: " + msg)
    } finally {
      setLoading(false)
    }
  }

  async function refreshMovimentacoes(projId: string, fornId: string, status: string) {
    const despFilters: any = {}
    if (projId !== "ALL") despFilters.projetoId = projId
    if (status !== "ALL" && (status === "PAGO" || status === "PENDENTE")) despFilters.status = status

    const parcFilters: any = {}
    if (projId !== "ALL") parcFilters.projetoId = projId
    if (status !== "ALL") parcFilters.status = status

    const [despData, parcData] = await Promise.all([
      mroscService.getDespesas(despFilters),
      mroscService.getParcelas(parcFilters),
    ])

    // Filtrar despesas por fornecedor se selecionado
    let despFiltradas = despData
    if (fornId !== "ALL") {
      despFiltradas = despData.filter((d) => d.fornecedor_id === fornId)
    }

    setDespesas(despFiltradas)
    setParcelas(parcData)

    // Carregar rubricas do projeto ativo para validações
    const targetProjId = projId !== "ALL" ? projId : (despesaForm.projeto_id || (projetos[0]?.id ?? ""))
    if (targetProjId) {
      try {
        const rbs = await mroscService.getRubricas(targetProjId)
        setRubricas(rbs)
      } catch {}
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
  }, [filterProjeto, filterFornecedor, filterStatus])

  // Carregar rubricas ao mudar projeto do modal de despesa
  useEffect(() => {
    async function fetchRubricas() {
      if (despesaForm.projeto_id) {
        try {
          const rbs = await mroscService.getRubricas(despesaForm.projeto_id)
          setRubricas(rbs)
        } catch (e) {
          console.error(e)
        }
      }
    }
    fetchRubricas()
  }, [despesaForm.projeto_id])

  // Rubrica selecionada e cálculo de saldo para trava MROSC
  const selectedRubrica = useMemo(
    () => rubricas.find((r) => r.id === despesaForm.rubrica_id),
    [rubricas, despesaForm.rubrica_id]
  )

  const saldoDisponivelRubrica = useMemo(() => {
    if (!selectedRubrica) return 0
    const gasto = (selectedRubrica.despesas || [])
      .filter((d) => d.status !== "CANCELADO")
      .reduce((acc, curr) => acc + Number(curr.valor), 0)
    return Number(selectedRubrica.valor_total) - gasto
  }, [selectedRubrica])

  const valorDigitadoDespesa = parseCurrency(despesaForm.valor)
  const ultrapassaSaldoRubrica = selectedRubrica && valorDigitadoDespesa > saldoDisponivelRubrica

  // ==========================================
  // KPIs do Cabeçalho (Holísticos e Dinâmicos)
  // ==========================================
  const kpis = useMemo(() => {
    const projetosConsiderados =
      filterProjeto === "ALL"
        ? projetos
        : projetos.filter((p) => p.id === filterProjeto)

    const totalAprovado = projetosConsiderados.reduce(
      (acc, p) => acc + Number(p.valor_total_aprovado || 0),
      0
    )

    const totalPago = despesas
      .filter((d) => d.status === "PAGO")
      .reduce((acc, d) => acc + Number(d.valor || 0), 0)

    const totalParcelasPendentes = parcelas
      .filter((p) => p.status === "PENDENTE" || p.status === "ATRASADO")
      .reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0)

    const totalDespesasPendentes = despesas
      .filter((d) => d.status === "PENDENTE")
      .reduce((acc, d) => acc + Number(d.valor || 0), 0)

    const totalPendente = totalParcelasPendentes + totalDespesasPendentes
    const saldoRemanescente = totalAprovado - totalPago
    const percentualExecutado = totalAprovado > 0 ? (totalPago / totalAprovado) * 100 : 0

    return {
      totalAprovado,
      totalPago,
      totalPendente,
      saldoRemanescente,
      percentualExecutado,
    }
  }, [projetos, despesas, parcelas, filterProjeto])

  // Filtragem por busca textual
  const parcelasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return parcelas
    const term = searchTerm.toLowerCase()
    return parcelas.filter(
      (p) =>
        p.descricao.toLowerCase().includes(term) ||
        (p.projetos?.nome && p.projetos.nome.toLowerCase().includes(term)) ||
        (p.rubricas_orcamentarias?.descricao && p.rubricas_orcamentarias.descricao.toLowerCase().includes(term))
    )
  }, [parcelas, searchTerm])

  const despesasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return despesas
    const term = searchTerm.toLowerCase()
    return despesas.filter(
      (d) =>
        d.descricao.toLowerCase().includes(term) ||
        (d.numero_documento_fiscal && d.numero_documento_fiscal.toLowerCase().includes(term)) ||
        (d.fornecedores?.razao_social_nome && d.fornecedores.razao_social_nome.toLowerCase().includes(term)) ||
        (d.rubricas_orcamentarias?.descricao && d.rubricas_orcamentarias.descricao.toLowerCase().includes(term))
    )
  }, [despesas, searchTerm])

  // Contagens para as abas
  const parcelasPendentesCount = useMemo(
    () => parcelas.filter((p) => p.status === "PENDENTE" || p.status === "ATRASADO").length,
    [parcelas]
  )

  // ==========================================
  // Handlers de Ações
  // ==========================================

  // Criar Despesa
  async function handleSubmitDespesa(e: React.FormEvent) {
    e.preventDefault()
    if (!despesaForm.projeto_id || !despesaForm.rubrica_id || !despesaForm.fornecedor_id || !despesaForm.descricao || valorDigitadoDespesa <= 0) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    if (ultrapassaSaldoRubrica) {
      toast.error(`Bloqueio MROSC: O valor excede o saldo disponível de ${formatCurrency(saldoDisponivelRubrica)} desta rubrica.`)
      return
    }

    try {
      setSaving(true)
      await mroscService.createDespesa({
        projeto_id: despesaForm.projeto_id,
        rubrica_id: despesaForm.rubrica_id,
        fornecedor_id: despesaForm.fornecedor_id,
        descricao: despesaForm.descricao,
        valor: valorDigitadoDespesa,
        data_despesa: despesaForm.data_despesa,
        numero_documento_fiscal: despesaForm.numero_documento_fiscal || null,
        status: despesaForm.status,
        data_pagamento: despesaForm.status === "PAGO" ? despesaForm.data_despesa : null,
      })
      toast.success("Despesa registrada com sucesso!")
      setDespesaForm({
        ...despesaForm,
        rubrica_id: "",
        fornecedor_id: "",
        descricao: "",
        valor: "",
        numero_documento_fiscal: "",
      })
      setOpenDespesa(false)
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao salvar despesa: " + msg)
    } finally {
      setSaving(false)
    }
  }

  // Criar Nova Parcela
  async function handleSubmitParcela(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseCurrency(parcelaForm.valor_previsto)
    if (!parcelaForm.projeto_id || !parcelaForm.rubrica_id || !parcelaForm.descricao || valor <= 0) {
      toast.error("Preencha os campos obrigatórios da parcela.")
      return
    }

    try {
      setSaving(true)
      await mroscService.createParcela({
        projeto_id: parcelaForm.projeto_id,
        rubrica_id: parcelaForm.rubrica_id,
        descricao: parcelaForm.descricao,
        valor_previsto: valor,
        data_vencimento: parcelaForm.data_vencimento,
        numero_parcela: parseInt(parcelaForm.numero_parcela) || 1,
        total_parcelas: parseInt(parcelaForm.total_parcelas) || 1,
        status: "PENDENTE",
      })
      toast.success("Parcela agendada com sucesso!")
      setParcelaForm({
        ...parcelaForm,
        descricao: "",
        valor_previsto: "",
      })
      setOpenNovaParcela(false)
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao agendar parcela"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Abrir Modal de Quitar Parcela
  function handleAbrirQuitar(parcela: ParcelaComRelacoes) {
    setParcelaParaQuitar(parcela)
    setQuitarForm({
      fornecedor_id: fornecedores[0]?.id || "",
      data_pagamento_real: getTodaySaoPaulo(),
      numero_documento_fiscal: "",
      observacoes: "",
    })
    setOpenQuitar(true)
  }

  // Confirmar Quitação de Parcela (MROSC Liquidação)
  async function handleConfirmarQuitacao() {
    if (!parcelaParaQuitar) return
    if (!quitarForm.fornecedor_id) {
      toast.error("Selecione o credor / fornecedor do pagamento.")
      return
    }

    try {
      setSaving(true)
      await mroscService.executarParcela(parcelaParaQuitar.id, {
        fornecedor_id: quitarForm.fornecedor_id,
        data_pagamento_real: quitarForm.data_pagamento_real,
        numero_documento_fiscal: quitarForm.numero_documento_fiscal || undefined,
        observacoes: quitarForm.observacoes || undefined,
      })
      toast.success("Parcela quitada com sucesso! Despesa registrada no livro caixa.")
      setOpenQuitar(false)
      setParcelaParaQuitar(null)
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao quitar parcela"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Alternar Status de Despesa (PAGO / PENDENTE)
  async function handleToggleStatusDespesa(despesa: Despesa) {
    const novoStatus = despesa.status === "PENDENTE" ? "PAGO" : "PENDENTE"
    try {
      await mroscService.updateDespesa(despesa.id, {
        status: novoStatus,
        data_pagamento: novoStatus === "PAGO" ? getTodaySaoPaulo() : null,
      })
      toast.success(`Status atualizado para ${novoStatus}!`)
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao alterar status"
      toast.error(msg)
    }
  }

  // Excluir Despesa
  async function handleDeleteDespesa(id: string) {
    try {
      await mroscService.deleteDespesa(id)
      toast.success("Despesa excluída com sucesso.")
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir despesa"
      toast.error(msg)
    }
  }

  // Excluir Parcela
  async function handleDeleteParcela(id: string) {
    try {
      await mroscService.deleteParcela(id)
      toast.success("Parcela removida do cronograma.")
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao remover parcela"
      toast.error(msg)
    }
  }

  // Exportar Relatório CSV
  function handleExportarCSV() {
    let rows: string[][] = []

    if (activeTab === "parcelas") {
      rows.push(["TIPO", "DESCRICAO", "PROJETO", "RUBRICA", "VALOR_PREVISTO", "DATA_VENCIMENTO", "STATUS"])
      parcelasFiltradas.forEach((p) => {
        rows.push([
          "Parcela",
          `"${p.descricao.replace(/"/g, '""')}"`,
          `"${(p.projetos?.nome || "").replace(/"/g, '""')}"`,
          `"${(p.rubricas_orcamentarias?.descricao || "").replace(/"/g, '""')}"`,
          String(p.valor_previsto),
          p.data_vencimento,
          p.status,
        ])
      })
    } else {
      rows.push(["DATA_DESPESA", "DATA_PAGAMENTO", "DESCRICAO", "PROJETO", "RUBRICA", "FORNECEDOR", "CNPJ_CPF", "DOC_FISCAL", "VALOR", "STATUS"])
      despesasFiltradas.forEach((d) => {
        rows.push([
          d.data_despesa,
          d.data_pagamento || "",
          `"${d.descricao.replace(/"/g, '""')}"`,
          `"${(d.projetos?.nome || "").replace(/"/g, '""')}"`,
          `"${(d.rubricas_orcamentarias?.descricao || "").replace(/"/g, '""')}"`,
          `"${(d.fornecedores?.razao_social_nome || "").replace(/"/g, '""')}"`,
          `"${d.fornecedores?.cpf_cnpj || ""}"`,
          `"${d.numero_documento_fiscal || ""}"`,
          String(d.valor),
          d.status,
        ])
      })
    }

    const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `moria_execucao_${activeTab}_${getTodaySaoPaulo()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Relatório CSV gerado com sucesso!")
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Execução Financeira
              </h2>
              <Badge variant="outline" className="text-xs bg-muted/60 font-mono">
                MROSC • Lei 13.019
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Controle integrado de contas a pagar, liquidação de obrigações e livro caixa de despesas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarCSV}
              className="gap-1.5 h-9 text-xs"
            >
              <DownloadIcon className="size-3.5" />
              Exportar CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenNovaParcela(true)}
              className="gap-1.5 h-9 text-xs"
            >
              <CalendarDaysIcon className="size-3.5" />
              Nova Parcela
            </Button>

            <Button
              size="sm"
              onClick={() => setOpenDespesa(true)}
              className="gap-1.5 h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <PlusIcon className="size-3.5" />
              Lançar Despesa
            </Button>
          </div>
        </div>

        {/* 4 Cards de KPI no Topo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Orçamento Aprovado */}
          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Orçamento Aprovado
              </CardTitle>
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <WalletIcon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {formatCurrency(kpis.totalAprovado)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {filterProjeto === "ALL" ? `${projetos.length} projeto(s) ativos` : (projetos.find(p => p.id === filterProjeto)?.nome || "Termo de Parceria")}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Total Executado / Pago */}
          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Executado (Pago)
              </CardTitle>
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2Icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(kpis.totalPago)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, kpis.percentualExecutado)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground font-mono">
                  {kpis.percentualExecutado.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Contas a Pagar (Pendente) */}
          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contas a Pagar (Pendente)
              </CardTitle>
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ClockIcon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                {formatCurrency(kpis.totalPendente)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {parcelasPendentesCount} obrigação(ões) aguardando quitação
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Saldo Disponível em Caixa */}
          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saldo Disponível
              </CardTitle>
              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSignIcon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${kpis.saldoRemanescente < 0 ? "text-destructive" : "text-foreground"}`}>
                {formatCurrency(kpis.saldoRemanescente)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Saldo líquido disponível no projeto
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Filtros e Busca */}
        <Card className="shadow-2xs">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <FilterIcon className="size-3.5" />
                  Filtros:
                </div>

                {/* Filtro Projeto */}
                <div className="w-56">
                  <Select value={filterProjeto} onValueChange={(val) => setFilterProjeto(val ?? "ALL")}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Projeto">
                        {(val) => {
                          if (!val || val === "ALL") return "Todos os Projetos"
                          const p = projetos.find((item) => item.id === val)
                          return p?.nome ?? val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Projetos</SelectItem>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Fornecedor */}
                <div className="w-52">
                  <Select value={filterFornecedor} onValueChange={(val) => setFilterFornecedor(val ?? "ALL")}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Fornecedor">
                        {(val) => {
                          if (!val || val === "ALL") return "Todos os Fornecedores"
                          const f = fornecedores.find((item) => item.id === val)
                          return f?.razao_social_nome ?? val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Fornecedores</SelectItem>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.razao_social_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Status */}
                <div className="w-36">
                  <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val ?? "ALL")}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Status">
                        {(val) => {
                          if (!val || val === "ALL") return "Todos os Status"
                          if (val === "PENDENTE") return "Pendentes"
                          if (val === "PAGO") return "Pagos"
                          if (val === "ATRASADO") return "Atrasados"
                          return val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Status</SelectItem>
                      <SelectItem value="PENDENTE">Pendentes</SelectItem>
                      <SelectItem value="PAGO">Pagos</SelectItem>
                      <SelectItem value="ATRASADO">Atrasados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Busca Textual */}
              <div className="relative w-full md:w-64">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar descrição, NF, credor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abas de Execução Financeira */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted p-1 rounded-lg">
            <TabsTrigger value="parcelas" className="gap-2 text-xs">
              <CalendarDaysIcon className="size-3.5" />
              Contas a Pagar (Parcelas)
              {parcelasPendentesCount > 0 && (
                <Badge
                  variant="destructive"
                  className="size-5 rounded-full p-0 flex items-center justify-center text-[10px]"
                >
                  {parcelasPendentesCount}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="despesas" className="gap-2 text-xs">
              <ReceiptIcon className="size-3.5" />
              Despesas Realizadas (Livro Caixa)
              <Badge
                variant="secondary"
                className="size-5 rounded-full p-0 flex items-center justify-center text-[10px]"
              >
                {despesasFiltradas.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ==================================================== */}
          {/* ABA 1: CONTAS A PAGAR / PARCELAS                    */}
          {/* ==================================================== */}
          <TabsContent value="parcelas" className="space-y-4">
            <Card className="shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Cronograma de Parcelas & Obrigações Futuras
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Obrigações programadas para o projeto. Clique em "Quitar" para liquidar o pagamento e vincular o comprovante fiscal.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenNovaParcela(true)}
                    className="gap-1 h-8 text-xs"
                  >
                    <PlusIcon className="size-3.5" />
                    Nova Parcela
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Carregando parcelas do projeto...
                  </div>
                ) : parcelasFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarDaysIcon className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium">Nenhuma parcela encontrada</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Cadastre uma nova parcela para planejar vencimentos ou altere os filtros.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenNovaParcela(true)}
                      className="gap-1.5 text-xs"
                    >
                      <PlusIcon className="size-3.5" />
                      Cadastrar Primeira Parcela
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Parc.</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Descrição da Obrigação</TableHead>
                        <TableHead>Rubrica Orçamentária</TableHead>
                        <TableHead className="text-right">Valor Previsto</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Ação de Liquidação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelasFiltradas.map((parcela) => {
                        const dias = diasRestantesSaoPaulo(parcela.data_vencimento)
                        const atrasado = parcela.status === "ATRASADO" || (parcela.status !== "PAGO" && dias < 0)
                        const venceHoje = dias === 0 && parcela.status !== "PAGO"

                        return (
                          <TableRow key={parcela.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {parcela.numero_parcela}/{parcela.total_parcelas}
                            </TableCell>

                            <TableCell className="text-xs whitespace-nowrap">
                              <div className="font-medium">
                                {formatDate(parcela.data_vencimento)}
                              </div>
                              {atrasado && (
                                <Badge variant="destructive" className="text-[10px] mt-0.5 h-4 px-1.5">
                                  Atrasado ({Math.abs(dias)}d)
                                </Badge>
                              )}
                              {venceHoje && (
                                <Badge className="text-[10px] mt-0.5 h-4 px-1.5 bg-amber-500 text-white">
                                  Vence Hoje
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-xs max-w-[240px]">
                              <div className="font-medium text-foreground truncate">
                                {parcela.descricao}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {parcela.projetos?.nome || "Projeto"}
                              </div>
                            </TableCell>

                            <TableCell className="text-xs max-w-[200px]">
                              <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                {parcela.rubricas_orcamentarias?.codigo_natureza_despesa || "—"}
                              </div>
                              <div className="text-muted-foreground truncate text-[11px]">
                                {parcela.rubricas_orcamentarias?.descricao || "Rubrica"}
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-bold text-foreground font-mono">
                              {formatCurrency(parcela.valor_previsto)}
                            </TableCell>

                            <TableCell className="text-center">
                              {parcela.status === "PAGO" ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                  <CheckCircle2Icon className="size-3 mr-1" />
                                  Pago
                                </Badge>
                              ) : atrasado ? (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangleIcon className="size-3 mr-1" />
                                  Atrasado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                                  <ClockIcon className="size-3 mr-1" />
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {parcela.status !== "PAGO" && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAbrirQuitar(parcela)}
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                                  >
                                    <CheckCircle2Icon className="size-3.5" />
                                    Quitar
                                  </Button>
                                )}

                                <ConfirmDialog
                                  title="Excluir parcela?"
                                  description="Esta parcela será removida do cronograma de pagamentos. Esta ação não pode ser desfeita."
                                  confirmLabel="Excluir"
                                  onConfirm={() => handleDeleteParcela(parcela.id)}
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-destructive hover:bg-destructive/10"
                                      aria-label="Excluir parcela"
                                    >
                                      <Trash2Icon className="size-3.5" />
                                    </Button>
                                  }
                                />
                              </div>
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

          {/* ==================================================== */}
          {/* ABA 2: DESPESAS REALIZADAS (LIVRO CAIXA)            */}
          {/* ==================================================== */}
          <TabsContent value="despesas" className="space-y-4">
            <Card className="shadow-2xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Livro Caixa de Despesas Liquidadas & Documentos Fiscais
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Gastos registrados com vinculação às rubricas, notas fiscais e prestação de contas.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setOpenDespesa(true)}
                    className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <PlusIcon className="size-3.5" />
                    Lançar Despesa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Carregando livro caixa de despesas...
                  </div>
                ) : despesasFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ReceiptIcon className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium">Nenhuma despesa registrada</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Você pode lançar uma despesa direta ou quitar uma parcela do cronograma para registrá-la aqui.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setOpenDespesa(true)}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <PlusIcon className="size-3.5" />
                      Lançar Primeira Despesa
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data do Gasto</TableHead>
                        <TableHead>Rubrica / Natureza</TableHead>
                        <TableHead>Fornecedor / Credor</TableHead>
                        <TableHead>Descrição / Doc Fiscal</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Comprovantes</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despesasFiltradas.map((despesa) => (
                        <TableRow key={despesa.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <div className="font-medium text-foreground">
                              {formatDate(despesa.data_despesa)}
                            </div>
                            {despesa.data_pagamento && (
                              <span className="block text-[10px] text-emerald-600 font-mono">
                                Pg: {formatDate(despesa.data_pagamento)}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs max-w-[180px]">
                            <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                              {despesa.rubricas_orcamentarias?.codigo_natureza_despesa || "—"}
                            </div>
                            <div className="text-muted-foreground truncate text-[11px]">
                              {despesa.rubricas_orcamentarias?.descricao || "Rubrica"}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs max-w-[180px]">
                            <div className="font-medium text-foreground truncate">
                              {despesa.fornecedores?.razao_social_nome || "Fornecedor"}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {formatCpfCnpj(despesa.fornecedores?.cpf_cnpj)}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs max-w-[200px]">
                            <div className="font-medium text-foreground truncate">
                              {despesa.descricao}
                            </div>
                            {despesa.numero_documento_fiscal && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                NF/Doc: {despesa.numero_documento_fiscal}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-bold text-foreground font-mono">
                            {formatCurrency(despesa.valor)}
                          </TableCell>

                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatusDespesa(despesa)}
                              className={`h-7 px-2 text-xs font-medium rounded-full cursor-pointer ${
                                despesa.status === "PAGO"
                                  ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                              }`}
                            >
                              {despesa.status === "PAGO" ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle2Icon className="size-3" />
                                  Pago
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <ClockIcon className="size-3" />
                                  Pendente
                                </div>
                              )}
                            </Button>
                          </TableCell>

                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              render={<Link href={`/comprovantes?despesaId=${despesa.id}`} />}
                              className="h-7 text-xs gap-1"
                            >
                              <FileCheckIcon className="size-3 text-primary" />
                              <span>{despesa.comprovantes?.length || 0} anexo(s)</span>
                            </Button>
                          </TableCell>

                          <TableCell className="text-right">
                            <ConfirmDialog
                              title="Excluir despesa?"
                              description="A despesa será removida da execução financeira. Esta ação não pode ser desfeita."
                              confirmLabel="Excluir"
                              onConfirm={() => handleDeleteDespesa(despesa.id)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:bg-destructive/10"
                                  aria-label="Excluir"
                                >
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================================================== */}
      {/* DIALOG 1: QUITAR PARCELA                            */}
      {/* ==================================================== */}
      <Dialog open={openQuitar} onOpenChange={setOpenQuitar}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Quitar Pagamento da Parcela</DialogTitle>
            <DialogDescription>
              Informe o credor e dados do documento fiscal para liquidar e registrar a despesa no livro caixa.
            </DialogDescription>
          </DialogHeader>

          {parcelaParaQuitar && (
            <div className="bg-muted/50 p-3 rounded-lg border text-xs space-y-1 my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Obrigação:</span>
                <span className="font-semibold text-foreground">{parcelaParaQuitar.descricao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Previsto:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {formatCurrency(parcelaParaQuitar.valor_previsto)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vencimento Original:</span>
                <span>{formatDate(parcelaParaQuitar.data_vencimento)}</span>
              </div>
            </div>
          )}

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="quitar_fornecedor">Fornecedor / Credor Beneficiário *</Label>
              <SelectComCriar
                id="quitar_fornecedor"
                value={quitarForm.fornecedor_id}
                onValueChange={(val) => setQuitarForm((prev) => ({ ...prev, fornecedor_id: val }))}
                opcoes={fornecedores.map((f) => ({ id: f.id, label: f.razao_social_nome }))}
                placeholder="Selecione o credor..."
                labelCriar="Cadastrar novo fornecedor"
                onClickCriar={() => setOpenFornecedor(true)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="quitar_data">Data do Pagamento *</Label>
                <Input
                  id="quitar_data"
                  type="date"
                  value={quitarForm.data_pagamento_real}
                  onChange={(e) => setQuitarForm((prev) => ({ ...prev, data_pagamento_real: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="quitar_doc">Nº Nota Fiscal / Recibo</Label>
                <Input
                  id="quitar_doc"
                  placeholder="Ex: NF 10423"
                  value={quitarForm.numero_documento_fiscal}
                  onChange={(e) => setQuitarForm((prev) => ({ ...prev, numero_documento_fiscal: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="quitar_obs">Observações / Forma de Pagamento</Label>
              <Input
                id="quitar_obs"
                placeholder="Ex: TED / Pix efetuado na conta bancária vinculada"
                value={quitarForm.observacoes}
                onChange={(e) => setQuitarForm((prev) => ({ ...prev, observacoes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenQuitar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarQuitacao}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {saving ? "Registrando..." : "Confirmar Quitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG 2: NOVA PARCELA                              */}
      {/* ==================================================== */}
      <Dialog open={openNovaParcela} onOpenChange={setOpenNovaParcela}>
        <DialogContent className="sm:max-w-[540px]">
          <form onSubmit={handleSubmitParcela}>
            <DialogHeader>
              <DialogTitle>Agendar Nova Parcela de Pagamento</DialogTitle>
              <DialogDescription>
                Crie um novo vencimento planejado vinculado à rubrica orçamentária do projeto.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-3">
              <div className="grid gap-1.5">
                <Label htmlFor="parc_projeto">Projeto / Termo *</Label>
                <SelectComCriar
                  id="parc_projeto"
                  value={parcelaForm.projeto_id}
                  onValueChange={(val) => setParcelaForm((prev) => ({ ...prev, projeto_id: val, rubrica_id: "" }))}
                  opcoes={projetos.map((p) => ({ id: p.id, label: p.nome }))}
                  placeholder="Selecione o projeto"
                  labelCriar="Criar novo projeto"
                  onClickCriar={() => setOpenProjeto(true)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="parc_rubrica">Rubrica Orçamentária *</Label>
                <SelectComCriar
                  id="parc_rubrica"
                  value={parcelaForm.rubrica_id}
                  onValueChange={(val) => setParcelaForm((prev) => ({ ...prev, rubrica_id: val }))}
                  opcoes={rubricas.map((r) => ({
                    id: r.id,
                    label: `${r.codigo_natureza_despesa} - ${r.descricao} (${formatCurrency(r.valor_total)})`,
                  }))}
                  placeholder="Selecione a rubrica..."
                  labelCriar="Criar nova rubrica"
                  onClickCriar={() => setOpenRubrica(true)}
                  disabled={!parcelaForm.projeto_id}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="parc_desc">Descrição da Obrigação *</Label>
                <Input
                  id="parc_desc"
                  required
                  placeholder="Ex: Parcela 01/03 - Assessoria Contábil Mensal"
                  value={parcelaForm.descricao}
                  onChange={(e) => setParcelaForm({ ...parcelaForm, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="parc_valor">Valor Previsto (R$) *</Label>
                  <Input
                    id="parc_valor"
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0,00"
                    value={parcelaForm.valor_previsto}
                    onChange={(e) => setParcelaForm({ ...parcelaForm, valor_previsto: maskCurrency(e.target.value) })}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="parc_data">Vencimento *</Label>
                  <Input
                    id="parc_data"
                    type="date"
                    required
                    value={parcelaForm.data_vencimento}
                    onChange={(e) => setParcelaForm({ ...parcelaForm, data_vencimento: e.target.value })}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="parc_num">Nº Parcela / Total</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="parc_num"
                      type="number"
                      min="1"
                      className="w-16"
                      value={parcelaForm.numero_parcela}
                      onChange={(e) => setParcelaForm({ ...parcelaForm, numero_parcela: e.target.value })}
                    />
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="number"
                      min="1"
                      className="w-16"
                      value={parcelaForm.total_parcelas}
                      onChange={(e) => setParcelaForm({ ...parcelaForm, total_parcelas: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenNovaParcela(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {saving ? "Agendando..." : "Salvar Parcela"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG 3: LANÇAR DESPESA DIRETA                     */}
      {/* ==================================================== */}
      <Dialog open={openDespesa} onOpenChange={setOpenDespesa}>
        <DialogContent className="sm:max-w-[580px]">
          <form onSubmit={handleSubmitDespesa}>
            <DialogHeader>
              <DialogTitle>Novo Lançamento de Despesa</DialogTitle>
              <DialogDescription>
                Selecione obrigatoriamente a rubrica orçamentária para controle de saldo em tempo real.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="desp_projeto">Projeto / Termo *</Label>
                  <SelectComCriar
                    id="desp_projeto"
                    value={despesaForm.projeto_id}
                    onValueChange={(val) => setDespesaForm((prev) => ({ ...prev, projeto_id: val, rubrica_id: "" }))}
                    opcoes={projetos.map((p) => ({ id: p.id, label: p.nome }))}
                    placeholder="Selecione o projeto"
                    labelCriar="Criar novo projeto"
                    onClickCriar={() => setOpenProjeto(true)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="desp_fornecedor">Fornecedor / Credor *</Label>
                  <SelectComCriar
                    id="desp_fornecedor"
                    value={despesaForm.fornecedor_id}
                    onValueChange={(val) => setDespesaForm((prev) => ({ ...prev, fornecedor_id: val }))}
                    opcoes={fornecedores.map((f) => ({ id: f.id, label: f.razao_social_nome }))}
                    placeholder="Selecione o fornecedor"
                    labelCriar="Criar novo fornecedor"
                    onClickCriar={() => setOpenFornecedor(true)}
                  />
                </div>
              </div>

              {/* Rubrica Orçamentária Obrigatória */}
              <div className="grid gap-2">
                <Label htmlFor="desp_rubrica">Rubrica Orçamentária Vinculada *</Label>
                <SelectComCriar
                  id="desp_rubrica"
                  value={despesaForm.rubrica_id}
                  onValueChange={(val) => setDespesaForm((prev) => ({ ...prev, rubrica_id: val }))}
                  opcoes={rubricas.map((r) => ({
                    id: r.id,
                    label: `${r.codigo_natureza_despesa} - ${r.descricao} (${formatCurrency(r.valor_total)})`,
                  }))}
                  placeholder="Selecione a rubrica de despesa..."
                  labelCriar="Criar nova rubrica"
                  onClickCriar={() => setOpenRubrica(true)}
                  disabled={!despesaForm.projeto_id}
                />
              </div>

              {/* Indicador de Saldo em Tempo Real */}
              {selectedRubrica && (
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                    ultrapassaSaldoRubrica
                      ? "bg-destructive/10 border-destructive text-destructive font-medium"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  <div>
                    <span>Saldo Disponível da Rubrica:</span>
                    <strong className="block text-sm font-mono">{formatCurrency(saldoDisponivelRubrica)}</strong>
                  </div>
                  {ultrapassaSaldoRubrica && (
                    <span className="font-semibold text-destructive">Valor excede o saldo!</span>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="desp_desc">Descrição Detalhada do Gasto *</Label>
                <Input
                  id="desp_desc"
                  required
                  placeholder="Ex: Aquisição de resmas de papel A4 para oficinas"
                  value={despesaForm.descricao}
                  onChange={(e) => setDespesaForm({ ...despesaForm, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="desp_valor">Valor (R$) *</Label>
                  <Input
                    id="desp_valor"
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0,00"
                    value={despesaForm.valor}
                    onChange={(e) => setDespesaForm({ ...despesaForm, valor: maskCurrency(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desp_data">Data da Despesa *</Label>
                  <Input
                    id="desp_data"
                    type="date"
                    required
                    value={despesaForm.data_despesa}
                    onChange={(e) => setDespesaForm({ ...despesaForm, data_despesa: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desp_doc">Nº NF / Recibo</Label>
                  <Input
                    id="desp_doc"
                    placeholder="NF 001234"
                    value={despesaForm.numero_documento_fiscal}
                    onChange={(e) => setDespesaForm({ ...despesaForm, numero_documento_fiscal: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="desp_status">Status Inicial</Label>
                <Select
                  value={despesaForm.status}
                  onValueChange={(val: any) => {
                    if (val) setDespesaForm((prev) => ({ ...prev, status: val }))
                  }}
                >
                  <SelectTrigger id="desp_status">
                    <SelectValue>
                      {(val) => {
                        if (val === "PENDENTE") return "Pendente (Aguardando Pagamento)"
                        if (val === "PAGO") return "Pago (Efetivado na Conta)"
                        return val
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTE">Pendente (Aguardando Pagamento)</SelectItem>
                    <SelectItem value="PAGO">Pago (Efetivado na Conta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenDespesa(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || Boolean(ultrapassaSaldoRubrica)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {saving ? "Salvando..." : "Confirmar Lançamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialogs de criação rápida */}
      <CriarFornecedorDialog
        open={openFornecedor}
        onOpenChange={setOpenFornecedor}
        onCriado={(novo) => setFornecedores((prev) => [...prev, novo])}
      />
      <CriarProjetoDialog
        open={openProjeto}
        onOpenChange={setOpenProjeto}
        onCriado={(novo) => setProjetos((prev) => [...prev, novo as any])}
      />
      <CriarRubricaDialog
        open={openRubrica}
        onOpenChange={setOpenRubrica}
        projetoId={despesaForm.projeto_id || parcelaForm.projeto_id}
        onCriado={(nova) => setRubricas((prev) => [...prev, nova as any])}
      />
    </>
  )
}

export default function ExecucaoPage() {
  return (
    <DashboardShell>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando módulo de execução financeira...</div>}>
        <ExecucaoContent />
      </Suspense>
    </DashboardShell>
  )
}
