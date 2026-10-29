"use client"

import { useEffect, useState, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ReceiptIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
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
  ExternalLinkIcon,
  FileTextIcon,
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
import { Checkbox } from "@/components/ui/checkbox"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarFornecedorDialog } from "@/components/dialogs/criar-fornecedor-dialog"
import { CriarProjetoDialog } from "@/components/dialogs/criar-projeto-dialog"
import { CriarRubricaDialog } from "@/components/dialogs/criar-rubrica-dialog"
import { CampoNotaFiscal } from "@/components/campo-nota-fiscal"
import { mroscService } from "@/lib/api/mrosc-service"
import { usePermissoes } from "@/hooks/use-permissoes"
import type { Projeto, Rubrica, Fornecedor, Despesa, DespesaComRelacoes, ParcelaComRelacoes, ParcelaPagamento, ParcelaPagamentoUpdate } from "@/lib/types"
import { formatCurrency, formatDate, formatCpfCnpj, getTodaySaoPaulo, diasRestantesSaoPaulo } from "@/lib/utils"
import { maskCurrency, parseCurrency } from "@/lib/masks"
import { toast } from "sonner"

function ExecucaoContent() {
  const { pode } = usePermissoes()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjetoId = searchParams.get("projetoId") || searchParams.get("projeto") || ""
  const initialRubricaId = searchParams.get("rubricaId") || searchParams.get("rubrica") || ""
  const initialFornecedorId = searchParams.get("fornecedorId") || searchParams.get("fornecedor") || ""
  const initialStatus = searchParams.get("status") || "ALL"
  const initialParcelaId = searchParams.get("parcelaId") || ""
  const initialTab = searchParams.get("tab") || "parcelas"

  // Dados principais
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [rubricas, setRubricas] = useState<(Rubrica & { despesas?: Despesa[] })[]>([])
  const [despesas, setDespesas] = useState<DespesaComRelacoes[]>([])
  const [parcelas, setParcelas] = useState<ParcelaComRelacoes[]>([])

  // Filtros sincronizados
  const [filterProjeto, setFilterProjeto] = useState<string>(initialProjetoId || "ALL")
  const [filterRubrica, setFilterRubrica] = useState<string>(initialRubricaId || "ALL")
  const [filterFornecedor, setFilterFornecedor] = useState<string>(initialFornecedorId || "ALL")
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus || "ALL")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>(initialTab || "parcelas")
  const openedParcelaRef = useRef<string | null>(null)

  // Sincronizar filtros na URL para persistência ao clicar em Voltar
  function sincronizarURL(novos: {
    projeto?: string
    rubrica?: string
    fornecedor?: string
    status?: string
    tab?: string
  }) {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (novos.projeto !== undefined) {
      if (novos.projeto && novos.projeto !== "ALL") params.set("projetoId", novos.projeto)
      else params.delete("projetoId")
    }
    if (novos.rubrica !== undefined) {
      if (novos.rubrica && novos.rubrica !== "ALL") params.set("rubricaId", novos.rubrica)
      else params.delete("rubricaId")
    }
    if (novos.fornecedor !== undefined) {
      if (novos.fornecedor && novos.fornecedor !== "ALL") params.set("fornecedorId", novos.fornecedor)
      else params.delete("fornecedorId")
    }
    if (novos.status !== undefined) {
      if (novos.status && novos.status !== "ALL") params.set("status", novos.status)
      else params.delete("status")
    }
    if (novos.tab !== undefined) {
      if (novos.tab && novos.tab !== "parcelas") params.set("tab", novos.tab)
      else params.delete("tab")
    }
    const q = params.toString()
    router.replace(q ? `?${q}` : window.location.pathname, { scroll: false })
  }

  function handleLimparFiltros() {
    setFilterProjeto("ALL")
    setFilterRubrica("ALL")
    setFilterFornecedor("ALL")
    setFilterStatus("ALL")
    setSearchTerm("")
    sincronizarURL({ projeto: "ALL", rubrica: "ALL", fornecedor: "ALL", status: "ALL" })
    toast.info("Todos os filtros foram limpos.")
  }

  const temFiltroAtivo =
    filterProjeto !== "ALL" ||
    filterRubrica !== "ALL" ||
    filterFornecedor !== "ALL" ||
    filterStatus !== "ALL" ||
    searchTerm.trim() !== ""

  // Dialog Editar Parcela (Número, Total, Vencimento, Valor, Descrição)
  const [openEditarParcela, setOpenEditarParcela] = useState(false)
  const [parcelaParaEditar, setParcelaParaEditar] = useState<ParcelaComRelacoes | null>(null)
  const [descricaoParcelaEdicao, setDescricaoParcelaEdicao] = useState("")
  const [numeroParcelaEdicao, setNumeroParcelaEdicao] = useState<number>(1)
  const [totalParcelasEdicao, setTotalParcelasEdicao] = useState<number>(1)
  const [dataVencimentoEdicao, setDataVencimentoEdicao] = useState("")
  const [valorPrevistoEdicao, setValorPrevistoEdicao] = useState("")

  function handleAbrirEditarParcela(parcela: ParcelaComRelacoes) {
    setParcelaParaEditar(parcela)
    setDescricaoParcelaEdicao(parcela.descricao || "")
    setNumeroParcelaEdicao(parcela.numero_parcela || 1)
    setTotalParcelasEdicao(parcela.total_parcelas || 1)
    setDataVencimentoEdicao(parcela.data_vencimento || "")
    setValorPrevistoEdicao(maskCurrency(parcela.valor_previsto || 0))
    setOpenEditarParcela(true)
  }

  async function handleSalvarEdicaoParcela() {
    if (!parcelaParaEditar) return
    const novaDescricao = descricaoParcelaEdicao.trim()
    if (!novaDescricao) {
      toast.error("A descrição da parcela não pode ser vazia.")
      return
    }
    const novoValor = parseCurrency(valorPrevistoEdicao)
    if (novoValor <= 0) {
      toast.error("O valor previsto deve ser maior que zero.")
      return
    }
    if (!dataVencimentoEdicao) {
      toast.error("Informe a data de vencimento.")
      return
    }
    if (numeroParcelaEdicao < 1 || totalParcelasEdicao < 1 || numeroParcelaEdicao > totalParcelasEdicao) {
      toast.error("O número da parcela deve ser válido (ex: 1 até total).")
      return
    }

    try {
      setSaving(true)
      const payload: ParcelaPagamentoUpdate = {
        descricao: novaDescricao,
        numero_parcela: numeroParcelaEdicao,
        total_parcelas: totalParcelasEdicao,
        data_vencimento: dataVencimentoEdicao,
        valor_previsto: novoValor,
      }
      await mroscService.updateParcela(parcelaParaEditar.id, payload)
      toast.success("Parcela atualizada com sucesso!")
      setOpenEditarParcela(false)
      setParcelas((prev) =>
        prev.map((p) =>
          p.id === parcelaParaEditar.id
            ? {
                ...p,
                descricao: novaDescricao,
                numero_parcela: numeroParcelaEdicao,
                total_parcelas: totalParcelasEdicao,
                data_vencimento: dataVencimentoEdicao,
                valor_previsto: novoValor,
              }
            : p
        )
      )
      setParcelaParaEditar(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar parcela"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Estados de controle
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialogs de criação rápida
  const [openFornecedor, setOpenFornecedor] = useState(false)
  const [openProjeto, setOpenProjeto] = useState(false)
  const [openRubrica, setOpenRubrica] = useState(false)

  // Dialog Nova Despesa
  const [openDespesa, setOpenDespesa] = useState(false)
  const [arquivoNfDespesa, setArquivoNfDespesa] = useState<File | null>(null)
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

  // Dialog Quitar Parcela (com suporte a múltiplos favorecidos / rateio e RH quantitativo)
  const [openQuitar, setOpenQuitar] = useState(false)
  const [parcelaParaQuitar, setParcelaParaQuitar] = useState<ParcelaComRelacoes | null>(null)
  const [dataPagamentoQuitacao, setDataPagamentoQuitacao] = useState(getTodaySaoPaulo())
  const [itensQuitacao, setItensQuitacao] = useState<
    Array<{
      id: string
      fornecedor_id: string
      valor: string
      numero_documento_fiscal: string
      observacoes: string
      arquivo: File | null
    }>
  >([])

  // Ações em Lote (Batch) de Parcelas
  const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set())
  const [openQuitarLote, setOpenQuitarLote] = useState(false)
  const [openAlterarVencimentoLote, setOpenAlterarVencimentoLote] = useState(false)
  const [dataVencimentoLote, setDataVencimentoLote] = useState(getTodaySaoPaulo())
  const [arquivoNfQuitarLote, setArquivoNfQuitarLote] = useState<File | null>(null)
  const [quitarLoteForm, setQuitarLoteForm] = useState({
    fornecedor_id: "",
    data_pagamento_real: getTodaySaoPaulo(),
    numero_documento_fiscal: "",
    observacoes: "",
  })

  // Dialog Editar Despesa
  const [openEditarDespesa, setOpenEditarDespesa] = useState(false)
  const [despesaParaEditar, setDespesaParaEditar] = useState<DespesaComRelacoes | null>(null)
  const [arquivoNfEditar, setArquivoNfEditar] = useState<File | null>(null)
  const [comprovantesDaDespesaEditar, setComprovantesDaDespesaEditar] = useState<any[]>([])
  const [deletingComprovanteId, setDeletingComprovanteId] = useState<string | null>(null)
  const [editarForm, setEditarForm] = useState({
    projeto_id: "",
    rubrica_id: "",
    fornecedor_id: "",
    descricao: "",
    valor: "",
    data_despesa: getTodaySaoPaulo(),
    data_pagamento: "",
    numero_documento_fiscal: "",
    status: "PENDENTE" as "PENDENTE" | "PAGO" | "CANCELADO",
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

      await refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados: " + msg)
    } finally {
      setLoading(false)
    }
  }

  async function refreshMovimentacoes(
    projId: string = filterProjeto,
    fornId: string = filterFornecedor,
    status: string = filterStatus,
    rubId: string = filterRubrica
  ) {
    const despFilters: any = {}
    if (projId !== "ALL") despFilters.projetoId = projId
    if (rubId !== "ALL") despFilters.rubrica_id = rubId
    if (status !== "ALL" && (status === "PAGO" || status === "PENDENTE")) despFilters.status = status

    const parcFilters: any = {}
    if (projId !== "ALL") parcFilters.projetoId = projId
    if (rubId !== "ALL") parcFilters.rubricaId = rubId
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

    // Carregar rubricas para validações e filtros
    const targetProjId = projId !== "ALL" ? projId : (despesaForm.projeto_id || undefined)
    try {
      const rbs = await mroscService.getRubricas(targetProjId)
      setRubricas(rbs)
    } catch {}
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sincronizar parâmetros de URL (projetoId e rubricaId)
  useEffect(() => {
    const pId = searchParams.get("projetoId")
    const rId = searchParams.get("rubricaId")
    if (pId && pId !== filterProjeto) setFilterProjeto(pId)
    if (rId && rId !== filterRubrica) setFilterRubrica(rId)
  }, [searchParams])


  useEffect(() => {
    refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
  }, [filterProjeto, filterFornecedor, filterStatus, filterRubrica])

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

  // Filtragem por status e busca textual (sem forçamento artificial)
  const parcelasFiltradas = useMemo(() => {
    let list = parcelas

    // Contas a Pagar exibe apenas obrigações a liquidar (pendentes e atrasadas)
    if (filterStatus === "ALL") {
      list = list.filter((p) => p.status !== "PAGO" && p.status !== "CANCELADO")
    } else if (filterStatus === "PENDENTE") {
      list = list.filter((p) => p.status === "PENDENTE")
    } else if (filterStatus === "ATRASADO") {
      list = list.filter((p) => p.status === "ATRASADO")
    } else if (filterStatus === "PAGO") {
      list = list.filter((p) => p.status === "PAGO")
    }

    if (!searchTerm.trim()) return list
    const term = searchTerm.toLowerCase()
    return list.filter(
      (p) =>
        p.descricao.toLowerCase().includes(term) ||
        (p.projetos?.nome && p.projetos.nome.toLowerCase().includes(term)) ||
        (p.rubricas_orcamentarias?.descricao && p.rubricas_orcamentarias.descricao.toLowerCase().includes(term))
    )
  }, [parcelas, filterStatus, searchTerm])

  const despesasFiltradas = useMemo(() => {
    let list = despesas

    if (filterStatus === "PENDENTE") {
      list = list.filter((d) => d.status === "PENDENTE")
    } else if (filterStatus === "PAGO") {
      list = list.filter((d) => d.status === "PAGO")
    }

    if (!searchTerm.trim()) return list
    const term = searchTerm.toLowerCase()
    return list.filter(
      (d) =>
        d.descricao.toLowerCase().includes(term) ||
        (d.numero_documento_fiscal && d.numero_documento_fiscal.toLowerCase().includes(term)) ||
        (d.fornecedores?.razao_social_nome && d.fornecedores.razao_social_nome.toLowerCase().includes(term)) ||
        (d.rubricas_orcamentarias?.descricao && d.rubricas_orcamentarias.descricao.toLowerCase().includes(term))
    )
  }, [despesas, filterStatus, searchTerm])

  // Contagens para as abas
  const parcelasPendentesCount = useMemo(
    () => parcelas.filter((p) => p.status === "PENDENTE" || p.status === "ATRASADO").length,
    [parcelas]
  )

  // Auxiliares de Seleção em Lote
  const isAllSelected = useMemo(
    () => parcelasFiltradas.length > 0 && parcelasFiltradas.every((p) => selectedParcelas.has(p.id)),
    [parcelasFiltradas, selectedParcelas]
  )

  const isSomeSelected = useMemo(
    () => parcelasFiltradas.some((p) => selectedParcelas.has(p.id)) && !isAllSelected,
    [parcelasFiltradas, selectedParcelas, isAllSelected]
  )

  function handleToggleSelectAll() {
    if (isAllSelected) {
      setSelectedParcelas(new Set())
    } else {
      setSelectedParcelas(new Set(parcelasFiltradas.map((p) => p.id)))
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedParcelas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedParcelasObjs = useMemo(
    () => parcelas.filter((p) => selectedParcelas.has(p.id)),
    [parcelas, selectedParcelas]
  )

  const selectedTotalValor = useMemo(
    () => selectedParcelasObjs.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0),
    [selectedParcelasObjs]
  )

  const hasPagasSelected = useMemo(
    () => selectedParcelasObjs.some((p) => p.status === "PAGO"),
    [selectedParcelasObjs]
  )

  const hasPendentesSelected = useMemo(
    () => selectedParcelasObjs.some((p) => p.status !== "PAGO"),
    [selectedParcelasObjs]
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
      }, arquivoNfDespesa)
      toast.success("Despesa e comprovante registrados com sucesso!")
      setDespesaForm({
        ...despesaForm,
        rubrica_id: "",
        fornecedor_id: "",
        descricao: "",
        valor: "",
        numero_documento_fiscal: "",
      })
      setArquivoNfDespesa(null)
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
  async function handleAbrirQuitar(parcela: ParcelaComRelacoes) {
    setParcelaParaQuitar(parcela)
    let currentForns = fornecedores
    if (currentForns.length === 0) {
      try {
        currentForns = await mroscService.getFornecedores()
        setFornecedores(currentForns)
      } catch {}
    }
    setDataPagamentoQuitacao(getTodaySaoPaulo())
    setItensQuitacao([
      {
        id: Math.random().toString(36).substring(2, 9),
        fornecedor_id: currentForns[0]?.id || "",
        valor: maskCurrency(String(Math.round(parcela.valor_previsto * 100))),
        numero_documento_fiscal: "",
        observacoes: "",
        arquivo: null,
      },
    ])
    setOpenQuitar(true)
  }

  function handleAdicionarItemRateio() {
    setItensQuitacao((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        fornecedor_id: fornecedores[0]?.id || "",
        valor: "0,00",
        numero_documento_fiscal: "",
        observacoes: "",
        arquivo: null,
      },
    ])
  }

  function handleRemoverItemRateio(id: string) {
    if (itensQuitacao.length <= 1) {
      toast.info("A parcela deve ter ao menos um pagamento para ser liquidada.")
      return
    }
    setItensQuitacao((prev) => prev.filter((item) => item.id !== id))
  }

  function handleAtualizarItemRateio(
    id: string,
    updates: Partial<{
      fornecedor_id: string
      valor: string
      numero_documento_fiscal: string
      observacoes: string
      arquivo: File | null
    }>
  ) {
    setItensQuitacao((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  // Auto-abrir parcela se parcelaId for fornecido na URL e for realmente pendente
  useEffect(() => {
    if (initialParcelaId && parcelas.length > 0 && openedParcelaRef.current !== initialParcelaId) {
      const target = parcelas.find((p) => p.id === initialParcelaId)
      if (target && target.status !== "PAGO" && target.status !== "CANCELADO") {
        openedParcelaRef.current = initialParcelaId
        handleAbrirQuitar(target)
      }
    }
  }, [initialParcelaId, parcelas])

  // Confirmar Quitação de Parcela (MROSC Liquidação com Rateio / Multi-Credores)
  async function handleConfirmarQuitacao() {
    if (!parcelaParaQuitar || itensQuitacao.length === 0) return

    for (let i = 0; i < itensQuitacao.length; i++) {
      const it = itensQuitacao[i]
      if (!it.fornecedor_id) {
        toast.error(`Selecione o credor / beneficiário do pagamento ${i + 1}.`)
        return
      }
      const val = parseCurrency(it.valor)
      if (val <= 0) {
        toast.error(`Informe um valor maior que zero para o pagamento ${i + 1}.`)
        return
      }
    }

    try {
      setSaving(true)
      const pagamentosPayload = itensQuitacao.map((it) => ({
        fornecedor_id: it.fornecedor_id,
        valor: parseCurrency(it.valor),
        data_pagamento_real: dataPagamentoQuitacao,
        numero_documento_fiscal: it.numero_documento_fiscal || undefined,
        observacoes: it.observacoes || undefined,
        arquivo_nota_fiscal: it.arquivo,
      }))

      await mroscService.executarParcelaRateada(parcelaParaQuitar.id, pagamentosPayload)

      toast.success(
        itensQuitacao.length > 1
          ? `Parcela quitada com sucesso! ${itensQuitacao.length} pagamentos registrados no Livro Caixa.`
          : "Parcela quitada com sucesso! Despesa registrada no Livro Caixa."
      )
      setOpenQuitar(false)
      setParcelaParaQuitar(null)
      setItensQuitacao([])
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao quitar parcela"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Confirmar Quitação em Lote
  async function handleConfirmarQuitacaoLote() {
    const pendentes = selectedParcelasObjs.filter((p) => p.status !== "PAGO")
    if (pendentes.length === 0) return
    if (!quitarLoteForm.fornecedor_id) {
      toast.error("Selecione o credor / fornecedor do pagamento.")
      return
    }

    try {
      setSaving(true)
      for (const parcela of pendentes) {
        await mroscService.executarParcela(parcela.id, {
          fornecedor_id: quitarLoteForm.fornecedor_id,
          data_pagamento_real: quitarLoteForm.data_pagamento_real,
          numero_documento_fiscal: quitarLoteForm.numero_documento_fiscal || undefined,
          observacoes: quitarLoteForm.observacoes || undefined,
          arquivo_nota_fiscal: arquivoNfQuitarLote,
        })
      }
      toast.success(`${pendentes.length} parcela(s) quitada(s) com sucesso em lote!`)
      setOpenQuitarLote(false)
      setSelectedParcelas(new Set())
      setArquivoNfQuitarLote(null)
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao quitar parcelas em lote"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Confirmar Reversão em Lote
  async function handleConfirmarReversaoLote() {
    const pagas = selectedParcelasObjs.filter((p) => p.status === "PAGO")
    if (pagas.length === 0) return

    try {
      setSaving(true)
      for (const parcela of pagas) {
        if (parcela.despesa_id) {
          await mroscService.updateDespesa(parcela.despesa_id, {
            status: "PENDENTE",
            data_pagamento: null,
          })
        }
        await mroscService.updateParcela(parcela.id, {
          status: "PENDENTE",
          data_pagamento_real: null,
        })
      }
      toast.success(`${pagas.length} parcela(s) revertida(s) para Pendente em lote!`)
      setSelectedParcelas(new Set())
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao reverter parcelas em lote"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Confirmar Exclusão em Lote
  async function handleConfirmarExclusaoLote() {
    if (selectedParcelas.size === 0) return

    try {
      setSaving(true)
      for (const id of Array.from(selectedParcelas)) {
        await mroscService.deleteParcela(id)
      }
      toast.success(`${selectedParcelas.size} parcela(s) removida(s) em lote.`)
      setSelectedParcelas(new Set())
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao remover parcelas em lote"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Atalho para adicionar meses ao vencimento em lote (ideal para pausas e retomadas)
  function aplicarAtalhoMesesLote(meses: number) {
    const hoje = new Date()
    hoje.setMonth(hoje.getMonth() + meses)
    const yyyy = hoje.getFullYear()
    const mm = String(hoje.getMonth() + 1).padStart(2, "0")
    const dd = String(hoje.getDate()).padStart(2, "0")
    setDataVencimentoLote(`${yyyy}-${mm}-${dd}`)
  }

  // Confirmar Alteração de Vencimento em Lote
  async function handleConfirmarAlterarVencimentoLote() {
    const pendentes = selectedParcelasObjs.filter((p) => p.status !== "PAGO")
    if (pendentes.length === 0) {
      toast.error("Nenhuma parcela pendente selecionada para alterar vencimento.")
      return
    }
    if (!dataVencimentoLote) {
      toast.error("Informe a nova data de vencimento.")
      return
    }

    try {
      setSaving(true)
      for (const parcela of pendentes) {
        await mroscService.updateParcela(parcela.id, {
          data_vencimento: dataVencimentoLote,
        })
      }
      toast.success(
        `${pendentes.length} parcela(s) tiveram o vencimento atualizado para ${formatDate(dataVencimentoLote)}!`
      )
      setOpenAlterarVencimentoLote(false)
      setSelectedParcelas(new Set())
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao alterar vencimento em lote"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Abrir Modal de Editar Despesa
  async function handleAbrirEditarDespesa(despesa: DespesaComRelacoes) {
    setDespesaParaEditar(despesa)
    setArquivoNfEditar(null)
    setComprovantesDaDespesaEditar(despesa.comprovantes || [])
    setEditarForm({
      projeto_id: despesa.projeto_id,
      rubrica_id: despesa.rubrica_id,
      fornecedor_id: despesa.fornecedor_id || "",
      descricao: despesa.descricao,
      valor: maskCurrency(despesa.valor.toFixed(2)),
      data_despesa: despesa.data_despesa || getTodaySaoPaulo(),
      data_pagamento: despesa.data_pagamento || (despesa.status === "PAGO" ? (despesa.data_despesa || getTodaySaoPaulo()) : ""),
      numero_documento_fiscal: despesa.numero_documento_fiscal || "",
      status: despesa.status,
      observacoes: (despesa as any).observacoes || "",
    })

    if (despesa.projeto_id) {
      try {
        const rbs = await mroscService.getRubricas(despesa.projeto_id)
        setRubricas(rbs)
      } catch (e) {
        console.error("Erro ao carregar rubricas para edição:", e)
      }
    }

    try {
      const comps = await mroscService.getComprovantes(despesa.id)
      setComprovantesDaDespesaEditar(comps || [])
    } catch (e) {
      console.warn("Aviso ao buscar comprovantes da despesa:", e)
    }

    setOpenEditarDespesa(true)
  }

  async function handleViewComprovante(storagePath: string) {
    try {
      const url = await mroscService.getComprovanteUrl(storagePath)
      window.open(url, "_blank")
    } catch {
      const url = mroscService.getComprovantePublicUrl(storagePath)
      window.open(url, "_blank")
    }
  }

  async function handleExcluirComprovanteNaDespesa(comprovanteId: string, storagePath: string, fileName: string) {
    if (!window.confirm(`Tem certeza que deseja excluir o anexo "${fileName}" deste lançamento?\nEsta ação removerá o arquivo permanentemente.`)) {
      return
    }
    try {
      setDeletingComprovanteId(comprovanteId)
      await mroscService.deleteComprovante(comprovanteId, storagePath)
      setComprovantesDaDespesaEditar((prev) => prev.filter((c) => c.id !== comprovanteId))
      setDespesas((prev) =>
        prev.map((d) => {
          if (d.id === despesaParaEditar?.id) {
            const novosComps = (d.comprovantes || []).filter((c) => c.id !== comprovanteId)
            return { ...d, comprovantes: novosComps }
          }
          return d
        })
      )
      toast.success(`Comprovante "${fileName}" removido com sucesso!`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir comprovante"
      toast.error(msg)
    } finally {
      setDeletingComprovanteId(null)
    }
  }

  // Confirmar Edição de Despesa
  async function handleSubmitEditarDespesa(e: React.FormEvent) {
    e.preventDefault()
    if (!despesaParaEditar) return
    const valorNum = parseCurrency(editarForm.valor)
    if (valorNum <= 0) {
      toast.error("O valor da despesa deve ser maior que zero.")
      return
    }
    if (!editarForm.rubrica_id) {
      toast.error("Selecione a rubrica orçamentária vinculada.")
      return
    }

    try {
      setSaving(true)
      await mroscService.updateDespesa(
        despesaParaEditar.id,
        {
          rubrica_id: editarForm.rubrica_id,
          fornecedor_id: editarForm.fornecedor_id || despesaParaEditar.fornecedor_id,
          descricao: editarForm.descricao,
          valor: valorNum,
          data_despesa: editarForm.data_despesa,
          data_pagamento: editarForm.status === "PAGO" ? (editarForm.data_pagamento || editarForm.data_despesa) : null,
          numero_documento_fiscal: editarForm.numero_documento_fiscal || null,
          status: editarForm.status,
          observacoes: editarForm.observacoes || null,
        },
        arquivoNfEditar
      )

      toast.success("Despesa atualizada com sucesso!")
      setOpenEditarDespesa(false)
      setDespesaParaEditar(null)
      setArquivoNfEditar(null)
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar despesa"
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

  // Reverter Liquidação de Parcela
  async function handleReverterParcela(parcela: ParcelaComRelacoes) {
    try {
      setSaving(true)
      if (parcela.despesa_id) {
        await mroscService.updateDespesa(parcela.despesa_id, {
          status: "PENDENTE",
          data_pagamento: null,
        })
      }
      await mroscService.updateParcela(parcela.id, {
        status: "PENDENTE",
        data_pagamento_real: null,
      })
      toast.success("Parcela revertida para Pendente com sucesso!")
      refreshMovimentacoes(filterProjeto, filterFornecedor, filterStatus, filterRubrica)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao reverter parcela"
      toast.error(msg)
    } finally {
      setSaving(false)
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
            {pode("relatorios_exportar") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportarCSV}
                className="gap-1.5 h-9 text-xs"
              >
                <DownloadIcon className="size-3.5" />
                Exportar CSV
              </Button>
            )}

            {pode("despesas_lancar") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenNovaParcela(true)}
                className="gap-1.5 h-9 text-xs"
              >
                <CalendarDaysIcon className="size-3.5" />
                Nova Parcela
              </Button>
            )}

            {pode("despesas_lancar") && (
              <Button
                size="sm"
                onClick={() => setOpenDespesa(true)}
                className="gap-1.5 h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <PlusIcon className="size-3.5" />
                Lançar Despesa
              </Button>
            )}
          </div>
        </div>

        {/* 4 Cards de KPI no Topo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Orçamento Aprovado */}
          <Card className="shadow-2xs min-w-0">
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Orçamento Aprovado
              </CardTitle>
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <WalletIcon className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div
                className="text-lg sm:text-xl xl:text-2xl font-bold tracking-tight tabular-nums text-foreground truncate block"
                title={formatCurrency(kpis.totalAprovado)}
              >
                {formatCurrency(kpis.totalAprovado)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {filterProjeto === "ALL" ? `${projetos.length} projeto(s) ativos` : (projetos.find(p => p.id === filterProjeto)?.nome || "Termo de Parceria")}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Total Executado / Pago */}
          <Card className="shadow-2xs min-w-0">
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Total Executado (Pago)
              </CardTitle>
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2Icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div
                className="text-lg sm:text-xl xl:text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 truncate block"
                title={formatCurrency(kpis.totalPago)}
              >
                {formatCurrency(kpis.totalPago)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, kpis.percentualExecutado)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground font-mono shrink-0">
                  {kpis.percentualExecutado.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Contas a Pagar (Pendente) */}
          <Card className="shadow-2xs min-w-0">
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Contas a Pagar (Pendente)
              </CardTitle>
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <ClockIcon className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div
                className="text-lg sm:text-xl xl:text-2xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400 truncate block"
                title={formatCurrency(kpis.totalPendente)}
              >
                {formatCurrency(kpis.totalPendente)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {parcelasPendentesCount} obrigação(ões) aguardando quitação
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Saldo Disponível em Caixa */}
          <Card className="shadow-2xs min-w-0">
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Saldo Disponível
              </CardTitle>
              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <DollarSignIcon className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div
                className={`text-lg sm:text-xl xl:text-2xl font-bold tracking-tight tabular-nums truncate block ${kpis.saldoRemanescente < 0 ? "text-destructive" : "text-foreground"}`}
                title={formatCurrency(kpis.saldoRemanescente)}
              >
                {formatCurrency(kpis.saldoRemanescente)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
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
                <div className="w-full sm:w-64 md:w-72 max-w-full min-w-0">
                  <Select
                    value={filterProjeto}
                    onValueChange={(val) => {
                      const v = val ?? "ALL"
                      setFilterProjeto(v)
                      sincronizarURL({ projeto: v })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full max-w-full overflow-hidden">
                      <SelectValue placeholder="Projeto">
                        {(val) => {
                          if (!val || val === "ALL") return "Todos os Projetos"
                          const p = projetos.find((item) => item.id === val)
                          const nome = p?.nome ?? val
                          return (
                            <span className="truncate block max-w-[210px] sm:max-w-[220px]" title={nome}>
                              {nome}
                            </span>
                          )
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

                {/* Filtro Rubrica */}
                <div className="w-full sm:w-64 md:w-72 max-w-full min-w-0">
                  <Select
                    value={filterRubrica}
                    onValueChange={(val) => {
                      const v = val ?? "ALL"
                      setFilterRubrica(v)
                      sincronizarURL({ rubrica: v })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full max-w-full overflow-hidden">
                      <SelectValue placeholder="Rubrica">
                        {(val) => {
                          if (!val || val === "ALL") return "Todas as Rubricas"
                          const r = rubricas.find((item) => item.id === val)
                          const texto = r ? `${r.codigo_natureza_despesa} - ${r.descricao}` : val
                          return (
                            <span className="truncate block max-w-[210px] sm:max-w-[220px]" title={texto}>
                              {texto}
                            </span>
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas as Rubricas</SelectItem>
                      {rubricas.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="font-mono text-emerald-600 font-semibold mr-1.5">
                            {r.codigo_natureza_despesa}
                          </span>
                          <span className="truncate max-w-[200px]">{r.descricao}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filterRubrica !== "ALL" && (
                  <Badge
                    variant="secondary"
                    className="h-8 px-2.5 gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-normal shrink-0"
                  >
                    <span>
                      Rubrica:{" "}
                      <strong className="font-semibold">
                        {rubricas.find((r) => r.id === filterRubrica)?.codigo_natureza_despesa || "Ativa"}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterRubrica("ALL")
                        sincronizarURL({ rubrica: "ALL" })
                      }}
                      className="ml-0.5 hover:text-destructive font-bold text-xs"
                      title="Limpar filtro de rubrica"
                    >
                      ×
                    </button>
                  </Badge>
                )}

                {/* Filtro Fornecedor */}
                <div className="w-full sm:w-52 md:w-56 max-w-full min-w-0">
                  <Select
                    value={filterFornecedor}
                    onValueChange={(val) => {
                      const v = val ?? "ALL"
                      setFilterFornecedor(v)
                      sincronizarURL({ fornecedor: v })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full max-w-full overflow-hidden">
                      <SelectValue placeholder="Fornecedor">
                        {(val) => {
                          if (!val || val === "ALL") return "Todos os Fornecedores"
                          const f = fornecedores.find((item) => item.id === val)
                          const nome = f?.razao_social_nome ?? val
                          return (
                            <span className="truncate block max-w-[180px]" title={nome}>
                              {nome}
                            </span>
                          )
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
                <div className="w-full sm:w-44 max-w-full min-w-0">
                  <Select
                    value={filterStatus}
                    onValueChange={(val) => {
                      const v = val ?? "ALL"
                      setFilterStatus(v)
                      sincronizarURL({ status: v })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full max-w-full overflow-hidden">
                      <SelectValue placeholder="Status">
                        {(val) => {
                          if (!val || val === "ALL") return "A Pagar (Pendentes)"
                          if (val === "PENDENTE") return "Apenas Pendentes"
                          if (val === "ATRASADO") return "Apenas Atrasados"
                          if (val === "PAGO") return "Já Pagos / Quitados"
                          if (val === "TODOS") return "Todos os Status"
                          return val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">A Pagar (Pendentes)</SelectItem>
                      <SelectItem value="PENDENTE">Apenas Pendentes</SelectItem>
                      <SelectItem value="ATRASADO">Apenas Atrasados</SelectItem>
                      <SelectItem value="PAGO">Já Pagos / Quitados</SelectItem>
                      <SelectItem value="TODOS">Todos os Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Botão Limpar Filtros */}
                {temFiltroAtivo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLimparFiltros}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1.5 px-2.5 shrink-0"
                    title="Resetar todos os filtros para a exibição padrão"
                  >
                    <FilterIcon className="size-3" />
                    Limpar Filtros
                  </Button>
                )}
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

        {/* Banner Informativo se Projeto Selecionado Não Tiver Ordem de Início */}
        {(() => {
          if (filterProjeto === "ALL") return null
          const pSel = projetos.find((p) => p.id === filterProjeto)
          if (!pSel || pSel.data_ordem_inicio) return null
          return (
            <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold">
                    Projeto em Fase Preparatória (Aguardando Ordem de Início)
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                    O cronograma e as parcelas a pagar deste projeto ficam ocultos no fluxo financeiro até que a <strong>Data da Ordem de Início (Marco Zero Financeiro)</strong> seja formalmente registrada.
                  </p>
                </div>
              </div>
              <Link href="/projetos">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-900 dark:text-amber-100 text-xs shrink-0"
                >
                  Definir Ordem de Início
                </Button>
              </Link>
            </div>
          )
        })()}

        {/* Abas de Execução Financeira */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val)
            sincronizarURL({ tab: val })
          }}
          className="space-y-4"
        >
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
                  {pode("despesas_lancar") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenNovaParcela(true)}
                      className="gap-1 h-8 text-xs"
                    >
                      <PlusIcon className="size-3.5" />
                      Nova Parcela
                    </Button>
                  )}
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
                    {pode("despesas_lancar") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenNovaParcela(true)}
                        className="gap-1.5 text-xs"
                      >
                        <PlusIcon className="size-3.5" />
                        Cadastrar Primeira Parcela
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Barra de Ações em Lote (Batch) */}
                    {selectedParcelas.size > 0 && (
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-xs animate-in fade-in duration-200">
                        <div className="flex items-center gap-2.5">
                          <Badge className="bg-emerald-600 text-white font-mono text-xs">
                            {selectedParcelas.size} selecionada(s)
                          </Badge>
                          <span className="text-xs font-semibold text-foreground font-mono">
                            Total: {formatCurrency(selectedTotalValor)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {pode("despesas_quitar") && hasPendentesSelected && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setQuitarLoteForm({
                                  fornecedor_id: fornecedores[0]?.id || "",
                                  data_pagamento_real: getTodaySaoPaulo(),
                                  numero_documento_fiscal: "",
                                  observacoes: "",
                                })
                                setArquivoNfQuitarLote(null)
                                setOpenQuitarLote(true)
                              }}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-xs"
                            >
                              <CheckCircle2Icon className="size-3.5" />
                              Quitar Selecionadas ({selectedParcelasObjs.filter((p) => p.status !== "PAGO").length})
                            </Button>
                          )}

                          {pode("despesas_lancar") && hasPendentesSelected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDataVencimentoLote(getTodaySaoPaulo())
                                setOpenAlterarVencimentoLote(true)
                              }}
                              className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5 font-medium"
                            >
                              <CalendarDaysIcon className="size-3.5" />
                              Alterar Vencimento ({selectedParcelasObjs.filter((p) => p.status !== "PAGO").length})
                            </Button>
                          )}

                          {pode("despesas_quitar") && hasPagasSelected && (
                            <ConfirmDialog
                              title="Reverter liquidação em lote?"
                              description={`Deseja reverter ${
                                selectedParcelasObjs.filter((p) => p.status === "PAGO").length
                              } parcela(s) quitada(s) para o status Pendente?`}
                              confirmLabel="Reverter em Lote"
                              onConfirm={handleConfirmarReversaoLote}
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5"
                                >
                                  <ClockIcon className="size-3.5" />
                                  Reverter ({selectedParcelasObjs.filter((p) => p.status === "PAGO").length})
                                </Button>
                              }
                            />
                          )}

                          {pode("despesas_excluir") && (
                            <ConfirmDialog
                              title="Excluir parcelas selecionadas?"
                              description={`Esta ação excluirá permanentemente ${selectedParcelas.size} parcela(s) do cronograma.`}
                              confirmLabel="Excluir em Lote"
                              onConfirm={handleConfirmarExclusaoLote}
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                                >
                                  <Trash2Icon className="size-3.5" />
                                  Excluir ({selectedParcelas.size})
                                </Button>
                              }
                            />
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedParcelas(new Set())}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Desmarcar
                          </Button>
                        </div>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={isAllSelected}
                              indeterminate={isSomeSelected}
                              onCheckedChange={handleToggleSelectAll}
                              aria-label="Selecionar todas as parcelas"
                            />
                          </TableHead>
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
                          const isSelected = selectedParcelas.has(parcela.id)

                          return (
                            <TableRow
                              key={parcela.id}
                              className={
                                isSelected
                                  ? "bg-emerald-500/10 dark:bg-emerald-950/20"
                                  : parcela.id === initialParcelaId && parcela.status !== "PAGO"
                                  ? "bg-emerald-500/10 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500"
                                  : ""
                              }
                            >
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleSelect(parcela.id)}
                                  aria-label={`Selecionar parcela ${parcela.numero_parcela}`}
                                />
                              </TableCell>
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
                              <div className="flex items-center gap-1.5 group">
                                <span className="font-medium text-foreground truncate" title={parcela.descricao}>
                                  {parcela.descricao}
                                </span>
                                {pode("despesas_lancar") && (
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirEditarParcela(parcela)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Editar descrição da parcela"
                                  >
                                    <PencilIcon className="size-3" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate" title={parcela.projetos?.nome || ""}>
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
                                {parcela.status !== "PAGO" ? (
                                  pode("despesas_quitar") && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAbrirQuitar(parcela)}
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                                    >
                                      <CheckCircle2Icon className="size-3.5" />
                                      Quitar
                                    </Button>
                                  )
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setActiveTab("despesas")
                                        setSearchTerm(parcela.descricao)
                                      }}
                                      className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1"
                                      title="Ver despesa no Livro Caixa"
                                    >
                                      <ReceiptIcon className="size-3" />
                                      No Caixa
                                    </Button>

                                    {pode("despesas_quitar") && (
                                      <ConfirmDialog
                                        title="Reverter quitação?"
                                        description={`A parcela "${parcela.descricao}" voltará ao status Pendente no cronograma.`}
                                        confirmLabel="Reverter"
                                        onConfirm={() => handleReverterParcela(parcela)}
                                        trigger={
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-amber-600 hover:bg-amber-500/10 gap-1"
                                            title="Reverter para Pendente"
                                          >
                                            <ClockIcon className="size-3" />
                                            Reverter
                                          </Button>
                                        }
                                      />
                                    )}
                                  </>
                                )}

                                {pode("despesas_lancar") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleAbrirEditarParcela(parcela)}
                                    className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Editar descrição da parcela"
                                  >
                                    <PencilIcon className="size-3.5" />
                                  </Button>
                                )}

                                {pode("despesas_excluir") && (
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
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </>
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
                  {pode("despesas_lancar") && (
                    <Button
                      size="sm"
                      onClick={() => setOpenDespesa(true)}
                      className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <PlusIcon className="size-3.5" />
                      Lançar Despesa
                    </Button>
                  )}
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
                    {pode("despesas_lancar") && (
                      <Button
                        size="sm"
                        onClick={() => setOpenDespesa(true)}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <PlusIcon className="size-3.5" />
                        Lançar Primeira Despesa
                      </Button>
                    )}
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
                            <div className="flex items-center justify-end gap-1">
                              {pode("despesas_lancar") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAbrirEditarDespesa(despesa)}
                                  className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                                  title="Editar movimentação"
                                  aria-label="Editar"
                                >
                                  <PencilIcon className="size-3.5" />
                                </Button>
                              )}
                              {pode("despesas_excluir") && (
                                <ConfirmDialog
                                  title="Excluir despesa?"
                                  description="A despesa será removida da execução financeira. Esta ação não pode ser desfeita."
                                  confirmLabel="Excluir"
                                  onConfirm={() => handleDeleteDespesa(despesa.id)}
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-destructive hover:bg-destructive/10 cursor-pointer"
                                      aria-label="Excluir"
                                    >
                                      <Trash2Icon className="size-3.5" />
                                    </Button>
                                  }
                                />
                              )}
                            </div>
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
      {/* DIALOG 0: EDITAR PARCELA DO CRONOGRAMA              */}
      {/* ==================================================== */}
      <Dialog open={openEditarParcela} onOpenChange={setOpenEditarParcela}>
        <DialogContent className="w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Parcela do Cronograma</DialogTitle>
            <DialogDescription>
              Ajuste o número da parcela, vencimento, valor previsto e descrição para alinhar ao plano de trabalho e à ordem de início.
            </DialogDescription>
          </DialogHeader>

          {parcelaParaEditar && (
            <div className="grid gap-3 py-2">
              <div className="bg-muted/40 p-2.5 rounded-md border text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rubrica:</span>
                  <span className="font-semibold text-foreground font-mono truncate max-w-[280px]">
                    {parcelaParaEditar.rubricas_orcamentarias?.codigo_natureza_despesa} - {parcelaParaEditar.rubricas_orcamentarias?.descricao}
                  </span>
                </div>
                {parcelaParaEditar.projetos?.nome && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Projeto:</span>
                    <span className="font-medium text-foreground truncate max-w-[280px]">
                      {parcelaParaEditar.projetos.nome}
                    </span>
                  </div>
                )}
              </div>

              {/* Número da Parcela / Total de Parcelas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="numero_parcela_input">Número da Parcela *</Label>
                  <Input
                    id="numero_parcela_input"
                    type="number"
                    min={1}
                    value={numeroParcelaEdicao}
                    onChange={(e) => setNumeroParcelaEdicao(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Ex: 1, 2, 4 (posição)</p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="total_parcelas_input">Total de Parcelas *</Label>
                  <Input
                    id="total_parcelas_input"
                    type="number"
                    min={1}
                    value={totalParcelasEdicao}
                    onChange={(e) => setTotalParcelasEdicao(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Ex: 8 (total de meses)</p>
                </div>
              </div>

              {/* Data de Vencimento e Valor Previsto */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="data_vencimento_parcela_input">Data de Vencimento *</Label>
                  <Input
                    id="data_vencimento_parcela_input"
                    type="date"
                    value={dataVencimentoEdicao}
                    onChange={(e) => setDataVencimentoEdicao(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="valor_previsto_parcela_input">Valor Previsto (R$) *</Label>
                  <Input
                    id="valor_previsto_parcela_input"
                    value={valorPrevistoEdicao}
                    onChange={(e) => setValorPrevistoEdicao(maskCurrency(e.target.value))}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="grid gap-1.5">
                <Label htmlFor="descricao_parcela_input">Descrição da Obrigação / Parcela *</Label>
                <Input
                  id="descricao_parcela_input"
                  value={descricaoParcelaEdicao}
                  onChange={(e) => setDescricaoParcelaEdicao(e.target.value)}
                  placeholder="Ex: Coordenador Geral - Pagamento Agosto/2026"
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditarParcela(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarEdicaoParcela}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG 1: QUITAR PARCELA (COM RATEIO & MULTI-CREDOR)*/}
      {/* ==================================================== */}
      <Dialog open={openQuitar} onOpenChange={setOpenQuitar}>
        <DialogContent className="w-[95vw] sm:max-w-[620px] max-h-[92vh] overflow-y-auto overflow-x-hidden min-w-0">
          <DialogHeader>
            <DialogTitle>Quitar Pagamento da Parcela</DialogTitle>
            <DialogDescription>
              Informe os credores, valores e documentos fiscais para liquidar e registrar as despesas no Livro Caixa.
            </DialogDescription>
          </DialogHeader>

          {parcelaParaQuitar && (
            <div className="bg-muted/50 p-3 rounded-lg border text-xs space-y-1.5 my-1">
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground shrink-0">Obrigação:</span>
                <span className="font-semibold text-foreground text-right">{parcelaParaQuitar.descricao}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Rubrica Orçamentária:</span>
                <span className="font-mono text-emerald-600 font-semibold">
                  {parcelaParaQuitar.rubricas_orcamentarias?.codigo_natureza_despesa} - {parcelaParaQuitar.rubricas_orcamentarias?.descricao}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valor Previsto Total:</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">
                  {formatCurrency(parcelaParaQuitar.valor_previsto)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Vencimento Original:</span>
                <span>{formatDate(parcelaParaQuitar.data_vencimento)}</span>
              </div>
            </div>
          )}

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="quitar_data_geral">Data do Pagamento *</Label>
              <Input
                id="quitar_data_geral"
                type="date"
                value={dataPagamentoQuitacao}
                onChange={(e) => setDataPagamentoQuitacao(e.target.value)}
              />
            </div>

            {/* Lista de Pagamentos / Rateio por Credor */}
            <div className="space-y-3 mt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Credores / Comprovantes de Liquidação ({itensQuitacao.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAdicionarItemRateio}
                  className="h-7 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                >
                  <PlusIcon className="size-3" />
                  + Adicionar Credor / Recibo
                </Button>
              </div>

              {itensQuitacao.map((item, idx) => (
                <div key={item.id} className="p-3 rounded-lg border bg-card space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="size-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      {itensQuitacao.length > 1 ? `Favorecido ${idx + 1}` : "Favorecido Principal"}
                    </span>
                    {itensQuitacao.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoverItemRateio(item.id)}
                        className="size-6 text-muted-foreground hover:text-destructive"
                        title="Remover este favorecido"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs">Fornecedor / Credor Beneficiário *</Label>
                    <SelectComCriar
                      id={`quitar_forn_${item.id}`}
                      value={item.fornecedor_id}
                      onValueChange={(val) => handleAtualizarItemRateio(item.id, { fornecedor_id: val })}
                      opcoes={fornecedores.map((f) => ({ id: f.id, label: f.razao_social_nome }))}
                      placeholder="Selecione o credor..."
                      labelCriar="Cadastrar novo fornecedor"
                      onClickCriar={() => setOpenFornecedor(true)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Valor deste Pagamento (R$) *</Label>
                      <Input
                        type="text"
                        value={item.valor}
                        onChange={(e) => handleAtualizarItemRateio(item.id, { valor: maskCurrency(e.target.value) })}
                        placeholder="0,00"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Nº Nota Fiscal / Recibo</Label>
                      <Input
                        type="text"
                        value={item.numero_documento_fiscal}
                        onChange={(e) => handleAtualizarItemRateio(item.id, { numero_documento_fiscal: e.target.value })}
                        placeholder="Ex: NF 798 ou Recibo 01"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <CampoNotaFiscal
                    numero={item.numero_documento_fiscal}
                    onNumeroChange={(val) => handleAtualizarItemRateio(item.id, { numero_documento_fiscal: val })}
                    arquivo={item.arquivo}
                    onArquivoChange={(f) => handleAtualizarItemRateio(item.id, { arquivo: f })}
                    labelNumero=""
                    placeholderNumero=""
                    idInput={`quitar_file_${item.id}`}
                  />
                </div>
              ))}
            </div>

            {/* Totalizador de Quitação vs Previsto */}
            {(() => {
              const totalInformado = itensQuitacao.reduce((acc, it) => acc + parseCurrency(it.valor), 0)
              const valorPrevisto = parcelaParaQuitar?.valor_previsto || 0
              const diferenca = valorPrevisto - totalInformado
              const bateu = Math.abs(diferenca) < 0.01

              return (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    bateu
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : diferenca > 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  <div>
                    <span className="font-semibold">Total a Liquidar: </span>
                    <span className="font-mono font-bold text-sm">{formatCurrency(totalInformado)}</span>
                    <span className="text-muted-foreground ml-1">de {formatCurrency(valorPrevisto)}</span>
                  </div>
                  <div className="font-semibold">
                    {bateu ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2Icon className="size-3.5" />
                        Valor 100% Coberto
                      </span>
                    ) : diferenca > 0 ? (
                      <span>Saldo residual: {formatCurrency(diferenca)}</span>
                    ) : (
                      <span>Excede previsto em {formatCurrency(Math.abs(diferenca))}</span>
                    )}
                  </div>
                </div>
              )
            })()}
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
              {saving ? "Registrando..." : `Confirmar Quitação (${itensQuitacao.length} pagamento${itensQuitacao.length > 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG 1.5: QUITAR PARCELAS EM LOTE (BATCH)         */}
      {/* ==================================================== */}
      <Dialog open={openQuitarLote} onOpenChange={setOpenQuitarLote}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-emerald-600" />
              Quitar {selectedParcelasObjs.filter((p) => p.status !== "PAGO").length} Parcela(s) em Lote
            </DialogTitle>
            <DialogDescription>
              Informe o credor e o documento de liquidação para dar baixa em todas as parcelas selecionadas simultaneamente.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 text-xs space-y-1.5 my-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Parcelas Selecionadas:</span>
              <span className="font-semibold text-foreground font-mono">
                {selectedParcelasObjs.filter((p) => p.status !== "PAGO").length} pendente(s)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Valor Total Previsto:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                {formatCurrency(
                  selectedParcelasObjs
                    .filter((p) => p.status !== "PAGO")
                    .reduce((acc, curr) => acc + (curr.valor_previsto || 0), 0)
                )}
              </span>
            </div>
            <div className="max-h-24 overflow-y-auto pt-1 space-y-1 border-t border-emerald-200/60 dark:border-emerald-800/40 text-[11px] text-muted-foreground">
              {selectedParcelasObjs
                .filter((p) => p.status !== "PAGO")
                .map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span className="truncate max-w-[280px]">
                      {p.numero_parcela}/{p.total_parcelas} - {p.descricao}
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(p.valor_previsto)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="quitar_lote_fornecedor">Fornecedor / Credor Beneficiário *</Label>
              <SelectComCriar
                id="quitar_lote_fornecedor"
                value={quitarLoteForm.fornecedor_id}
                onValueChange={(val) => setQuitarLoteForm((prev) => ({ ...prev, fornecedor_id: val }))}
                opcoes={fornecedores.map((f) => ({ id: f.id, label: f.razao_social_nome }))}
                placeholder="Selecione o credor..."
                labelCriar="Cadastrar novo fornecedor"
                onClickCriar={() => setOpenFornecedor(true)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="quitar_lote_data">Data do Pagamento Efetivado *</Label>
              <Input
                id="quitar_lote_data"
                type="date"
                value={quitarLoteForm.data_pagamento_real}
                onChange={(e) =>
                  setQuitarLoteForm((prev) => ({ ...prev, data_pagamento_real: e.target.value }))
                }
              />
            </div>

            <CampoNotaFiscal
              numero={quitarLoteForm.numero_documento_fiscal}
              onNumeroChange={(val) =>
                setQuitarLoteForm((prev) => ({ ...prev, numero_documento_fiscal: val }))
              }
              arquivo={arquivoNfQuitarLote}
              onArquivoChange={setArquivoNfQuitarLote}
              labelNumero="Nº Nota Fiscal / Documento Fiscal em Lote (Opcional)"
              placeholderNumero="Ex: NF 10423"
              idInput="quitar_lote_nf_file"
            />

            <div className="grid gap-1.5">
              <Label htmlFor="quitar_lote_obs">Observações / Comentários</Label>
              <Input
                id="quitar_lote_obs"
                placeholder="Ex: Liquidação conjunta autorizada via TED bancária"
                value={quitarLoteForm.observacoes}
                onChange={(e) =>
                  setQuitarLoteForm((prev) => ({ ...prev, observacoes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenQuitarLote(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarQuitacaoLote}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {saving ? "Processando Lote..." : "Confirmar Quitação em Lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG: ALTERAR VENCIMENTO EM LOTE (RETOMADA/PAUSA) */}
      {/* ==================================================== */}
      <Dialog open={openAlterarVencimentoLote} onOpenChange={setOpenAlterarVencimentoLote}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-primary" />
              Alterar Vencimento em Lote
            </DialogTitle>
            <DialogDescription>
              Defina uma nova data de vencimento para as parcelas pendentes selecionadas. Ideal para reprogramar cronogramas após paralisações ou termos aditivos.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 text-xs space-y-1.5 my-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Parcelas Selecionadas:</span>
              <span className="font-semibold text-foreground font-mono">
                {selectedParcelasObjs.filter((p) => p.status !== "PAGO").length} pendente(s)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Previsto das Parcelas:</span>
              <span className="font-bold text-primary font-mono text-sm">
                {formatCurrency(
                  selectedParcelasObjs
                    .filter((p) => p.status !== "PAGO")
                    .reduce((acc, curr) => acc + (curr.valor_previsto || 0), 0)
                )}
              </span>
            </div>
            <div className="max-h-24 overflow-y-auto pt-1 space-y-1 border-t border-primary/20 text-[11px] text-muted-foreground">
              {selectedParcelasObjs
                .filter((p) => p.status !== "PAGO")
                .map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span className="truncate max-w-[280px]">
                      {p.numero_parcela}/{p.total_parcelas} - {p.descricao}
                    </span>
                    <span className="font-mono text-foreground">
                      Atual: {formatDate(p.data_vencimento)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nova_data_vencimento_lote">Nova Data de Vencimento *</Label>
              <Input
                id="nova_data_vencimento_lote"
                type="date"
                value={dataVencimentoLote}
                onChange={(e) => setDataVencimentoLote(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">Atalhos rápidos de reagendamento:</span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDataVencimentoLote(getTodaySaoPaulo())}
                  className="h-7 text-[11px] px-2"
                >
                  Hoje
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarAtalhoMesesLote(1)}
                  className="h-7 text-[11px] px-2"
                >
                  +1 Mês
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarAtalhoMesesLote(2)}
                  className="h-7 text-[11px] px-2"
                >
                  +2 Meses
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarAtalhoMesesLote(3)}
                  className="h-7 text-[11px] px-2"
                >
                  +3 Meses
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarAtalhoMesesLote(5)}
                  className="h-7 text-[11px] px-2 font-medium text-primary border-primary/40 bg-primary/5"
                >
                  +5 Meses (Retomada)
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAlterarVencimentoLote(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarAlterarVencimentoLote}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? "Atualizando Parcelas..." : "Salvar Vencimento em Lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG: EDITAR DESPESA / EXECUÇÃO                   */}
      {/* ==================================================== */}
      <Dialog open={openEditarDespesa} onOpenChange={setOpenEditarDespesa}>
        <DialogContent className="sm:max-w-[580px]">
          <form onSubmit={handleSubmitEditarDespesa}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PencilIcon className="size-5 text-primary" />
                Editar Lançamento de Execução
              </DialogTitle>
              <DialogDescription>
                Atualize dados cadastrais, datas, comprovantes ou status da despesa.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              {despesaParaEditar?.projetos && (
                <div className="p-2.5 rounded-lg bg-muted/40 text-xs border flex items-center justify-between">
                  <span className="text-muted-foreground">Projeto Vinculado:</span>
                  <strong className="text-foreground font-medium">
                    {despesaParaEditar.projetos.nome}
                  </strong>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="edit_fornecedor">Fornecedor / Credor Beneficiário</Label>
                <SelectComCriar
                  id="edit_fornecedor"
                  value={editarForm.fornecedor_id}
                  onValueChange={(val) => setEditarForm((prev) => ({ ...prev, fornecedor_id: val }))}
                  opcoes={fornecedores.map((f) => ({ id: f.id, label: f.razao_social_nome }))}
                  placeholder="Selecione o fornecedor"
                  labelCriar="Criar novo fornecedor"
                  onClickCriar={() => setOpenFornecedor(true)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_rubrica">Rubrica Orçamentária Vinculada *</Label>
                <SelectComCriar
                  id="edit_rubrica"
                  value={editarForm.rubrica_id}
                  onValueChange={(val) => setEditarForm((prev) => ({ ...prev, rubrica_id: val }))}
                  opcoes={rubricas.map((r) => ({
                    id: r.id,
                    label: `${r.codigo_natureza_despesa} - ${r.descricao} (${formatCurrency(r.valor_total)})`,
                  }))}
                  placeholder="Selecione a rubrica de despesa..."
                  labelCriar="Criar nova rubrica"
                  onClickCriar={() => setOpenRubrica(true)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_desc">Descrição do Gasto *</Label>
                <Input
                  id="edit_desc"
                  required
                  placeholder="Ex: Aquisição de materiais ou serviços..."
                  value={editarForm.descricao}
                  onChange={(e) => setEditarForm((prev) => ({ ...prev, descricao: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit_valor">Valor (R$) *</Label>
                  <Input
                    id="edit_valor"
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0,00"
                    value={editarForm.valor}
                    onChange={(e) => setEditarForm((prev) => ({ ...prev, valor: maskCurrency(e.target.value) }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit_data">Data da Despesa *</Label>
                  <Input
                    id="edit_data"
                    type="date"
                    required
                    value={editarForm.data_despesa}
                    onChange={(e) => setEditarForm((prev) => ({ ...prev, data_despesa: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select
                    value={editarForm.status}
                    onValueChange={(val: any) => {
                      if (val) setEditarForm((prev) => ({ ...prev, status: val }))
                    }}
                  >
                    <SelectTrigger id="edit_status">
                      <SelectValue>
                        {(val) =>
                          val === "PAGO"
                            ? "Pago"
                            : val === "CANCELADO"
                            ? "Cancelado"
                            : "Pendente"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="PAGO">Pago</SelectItem>
                      <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editarForm.status === "PAGO" && (
                <div className="grid gap-2">
                  <Label htmlFor="edit_data_pag">Data do Pagamento Efetivado</Label>
                  <Input
                    id="edit_data_pag"
                    type="date"
                    value={editarForm.data_pagamento}
                    onChange={(e) => setEditarForm((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                  />
                </div>
              )}

              {/* Seção de Comprovantes Já Vinculados */}
              <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <FileTextIcon className="size-3.5 text-emerald-600" />
                    Comprovantes / NFs Vinculadas ({comprovantesDaDespesaEditar.length})
                  </Label>
                  {comprovantesDaDespesaEditar.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Remova notas incorretas individualmente
                    </span>
                  )}
                </div>

                {comprovantesDaDespesaEditar.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-md">
                    Nenhum comprovante anexado a este lançamento.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {comprovantesDaDespesaEditar.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-md border bg-background text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <FileTextIcon className="size-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate text-foreground" title={c.file_name}>
                              {c.file_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.tipo_documento ? c.tipo_documento.replace(/_/g, " ") : "Documento"} • {formatDate(c.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            onClick={() => handleViewComprovante(c.storage_path)}
                          >
                            <ExternalLinkIcon className="size-3" />
                            Abrir
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deletingComprovanteId === c.id}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Excluir comprovante incorreto"
                            onClick={() => handleExcluirComprovanteNaDespesa(c.id, c.storage_path, c.file_name)}
                          >
                            <Trash2Icon className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Anexar Novo Arquivo / Substituição
                </Label>
                <CampoNotaFiscal
                  numero={editarForm.numero_documento_fiscal}
                  onNumeroChange={(val) => setEditarForm((prev) => ({ ...prev, numero_documento_fiscal: val }))}
                  arquivo={arquivoNfEditar}
                  onArquivoChange={setArquivoNfEditar}
                  labelNumero="Nº Nota Fiscal / Documento (Opcional)"
                  placeholderNumero="Ex: NF 10423"
                  idInput="edit_nf_file"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_obs">Observações</Label>
                <Input
                  id="edit_obs"
                  placeholder="Informações complementares sobre a transação..."
                  value={editarForm.observacoes}
                  onChange={(e) => setEditarForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenEditarDespesa(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
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

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <CampoNotaFiscal
                numero={despesaForm.numero_documento_fiscal}
                onNumeroChange={(val) => setDespesaForm({ ...despesaForm, numero_documento_fiscal: val })}
                arquivo={arquivoNfDespesa}
                onArquivoChange={setArquivoNfDespesa}
                labelNumero="Nº Nota Fiscal / Recibo (Opcional)"
                placeholderNumero="Ex: NF 001234"
                idInput="desp_nf_file"
              />

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
