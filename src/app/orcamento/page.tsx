"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  CalculatorIcon,
  PlusIcon,
  Trash2Icon,
  AlertTriangleIcon,
  UploadIcon,
  SearchIcon,
  ReceiptIcon,
  CalendarIcon,
  LayoutGridIcon,
  TableIcon,
  SlidersHorizontalIcon,
  CheckCircle2Icon,
  ClockIcon,
  XIcon,
  Building2Icon,
  TrendingUpIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarProjetoDialog } from "@/components/dialogs/criar-projeto-dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { mroscService } from "@/lib/api/mrosc-service"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import type { Projeto, RubricaComDespesas, ParcelaPagamento } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { maskCurrency, parseCurrency } from "@/lib/masks"
import { toast } from "sonner"

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day === 0 ? -6 : 1) - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function formatYearMonth(ym: string): string {
  if (!ym || !ym.includes("-")) return ym
  const [y, m] = ym.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date)
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1).replace(".", "")}/${y.slice(2)}`
}

function OrcamentoContent() {
  const searchParams = useSearchParams()
  const initialProjetoId = searchParams.get("projetoId") || ""

  const {
    projetoId: globalProjetoId,
    instituicaoId: globalInstituicaoId,
    setProjetoId: setGlobalProjetoId,
    projetosDisponiveis,
  } = useFiltroGlobal()

  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>(
    initialProjetoId || globalProjetoId || "ALL"
  )
  const [rubricas, setRubricas] = useState<RubricaComDespesas[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openProjeto, setOpenProjeto] = useState(false)

  // Filtros Avançados
  const [searchTerm, setSearchTerm] = useState("")
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("ALL")
  const [filtroTipo, setFiltroTipo] = useState<string>("ALL")
  const [filtroSaldo, setFiltroSaldo] = useState<string>("ALL")
  const [visaoAtiva, setVisaoAtiva] = useState<"cards" | "grade">("cards")

  // Formulário de Nova Rubrica
  const [formProjetoId, setFormProjetoId] = useState<string>("")
  const [formData, setFormData] = useState({
    tipo: "SERVICO" as const,
    descricao: "",
    codigo_natureza_despesa: "33903501",
    unidade: "UN",
    quantidade: "1",
    valor_unitario: "0,00",
    tipo_pagamento: "UNICO" as "UNICO" | "RECORRENTE" | "PARCELADO",
    frequencia_meses: "1",
    num_parcelas: "1",
    dia_vencimento: "",
  })

  // Carregar Projetos e Rubricas
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true)
        const projData = await mroscService.getProjetos()
        setProjetos(projData)

        const projId = initialProjetoId || globalProjetoId || "ALL"
        setSelectedProjetoId(projId)
        const rubData = await mroscService.getRubricas(projId === "ALL" ? undefined : projId)
        setRubricas(rubData)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido"
        toast.error("Erro ao carregar dados: " + msg)
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [initialProjetoId])

  // Sincronizar com filtro de projeto global do topo do sistema
  useEffect(() => {
    if (globalProjetoId && globalProjetoId !== selectedProjetoId) {
      setSelectedProjetoId(globalProjetoId)
      loadRubricas(globalProjetoId)
    }
  }, [globalProjetoId])

  // Carregar Rubricas do serviço
  async function loadRubricas(projId: string) {
    try {
      setLoading(true)
      const data = await mroscService.getRubricas(projId === "ALL" ? undefined : projId)
      setRubricas(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar rubricas: " + msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleProjectChange(projId: string) {
    setSelectedProjetoId(projId)
    setGlobalProjetoId(projId)
    loadRubricas(projId)
  }

  const currentProjeto = useMemo(() => {
    if (selectedProjetoId === "ALL") {
      const somaTeto = projetosDisponiveis.reduce((acc, p) => acc + Number(p.valor_total_aprovado || 0), 0)
      return {
        id: "ALL",
        nome: globalInstituicaoId !== "ALL" ? "Projetos da Instituição Selecionada" : "Todas as Parcerias (Consolidado)",
        valor_total_aprovado: somaTeto,
      } as Projeto
    }
    return projetos.find((p) => p.id === selectedProjetoId) || projetos[0]
  }, [projetos, projetosDisponiveis, selectedProjetoId, globalInstituicaoId])

  // Cálculos automáticos do formulário
  const formQtd = parseFloat(formData.quantidade.replace(",", ".")) || 0
  const formVlUnit = parseCurrency(formData.valor_unitario)
  const formTotalPrevisto = formQtd * formVlUnit

  // Cálculos consolidados da planilha atual
  const totalOrcadoRubricas = rubricas.reduce((acc, r) => acc + Number(r.valor_total || 0), 0)
  const tetoAprovadoProjeto = Number(currentProjeto?.valor_total_aprovado || 0)
  const saldoOrcamentoProjeto = tetoAprovadoProjeto - totalOrcadoRubricas
  const ultrapassouTetoProjeto = totalOrcadoRubricas > tetoAprovadoProjeto

  // Meses únicos para o cronograma
  const currentYearMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const nextYearMonth = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 7)
  }, [])
  const weekRange = useMemo(() => getWeekRange(), [])

  const mesesDisponiveis = useMemo(() => {
    const setMeses = new Set<string>()
    rubricas.forEach((r) => {
      r.parcelas_pagamento?.forEach((p) => {
        if (p.data_vencimento && p.data_vencimento.length >= 7) {
          setMeses.add(p.data_vencimento.slice(0, 7))
        }
      })
    })
    if (setMeses.size === 0) {
      const now = new Date()
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
        setMeses.add(d.toISOString().slice(0, 7))
      }
    }
    return Array.from(setMeses).sort()
  }, [rubricas])

  // Filtro de Rubricas
  const filteredRubricas = useMemo(() => {
    return rubricas.filter((rubrica) => {
      // 1. Busca textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const match =
          rubrica.descricao?.toLowerCase().includes(term) ||
          rubrica.codigo_natureza_despesa?.toLowerCase().includes(term) ||
          rubrica.tipo?.toLowerCase().includes(term) ||
          rubrica.projetos?.nome?.toLowerCase().includes(term)
        if (!match) return false
      }

      // 2. Filtro de Tipo
      if (filtroTipo !== "ALL" && rubrica.tipo !== filtroTipo) {
        return false
      }

      // 3. Filtro de Saldo / Execução
      const totalGasto = (rubrica.despesas || [])
        .filter((d) => d.status === "PAGO")
        .reduce((acc, curr) => acc + Number(curr.valor), 0)
      const saldo = Number(rubrica.valor_total || 0) - totalGasto

      if (filtroSaldo === "DISPONIVEL" && saldo <= 0) return false
      if (filtroSaldo === "EM_EXECUCAO" && !(totalGasto > 0 && saldo > 0)) return false
      if (filtroSaldo === "NAO_INICIADO" && totalGasto > 0) return false
      if (filtroSaldo === "ESGOTADO" && !(saldo <= 0 && totalGasto > 0)) return false
      if (filtroSaldo === "ESTOURADO" && saldo >= 0) return false

      // 4. Filtro de Instituição Global (quando Projeto for ALL)
      if (globalInstituicaoId !== "ALL" && selectedProjetoId === "ALL") {
        const proj = projetos.find((p) => p.id === rubrica.projeto_id)
        if (proj && proj.instituicao_id !== globalInstituicaoId) return false
      }

      // 5. Filtro de Período Temporal
      if (filtroPeriodo !== "ALL") {
        const parcelas = rubrica.parcelas_pagamento || []
        if (parcelas.length === 0) return false

        const hasMatch = parcelas.some((p) => {
          if (!p.data_vencimento) return false
          if (filtroPeriodo === "ESTA_SEMANA") {
            const dt = new Date(p.data_vencimento + "T12:00:00")
            return dt >= weekRange.start && dt <= weekRange.end
          }
          if (filtroPeriodo === "ESTE_MES") {
            return p.data_vencimento.startsWith(currentYearMonth)
          }
          if (filtroPeriodo === "PROXIMO_MES") {
            return p.data_vencimento.startsWith(nextYearMonth)
          }
          return p.data_vencimento.startsWith(filtroPeriodo)
        })
        if (!hasMatch) return false
      }

      return true
    })
  }, [rubricas, searchTerm, filtroTipo, filtroSaldo, filtroPeriodo, globalInstituicaoId, selectedProjetoId, projetos, weekRange, currentYearMonth, nextYearMonth])

  // Desembolso no Período Selecionado
  const { totalPrevistoPeriodo, totalPagoPeriodo, qtdParcelasPeriodo } = useMemo(() => {
    if (filtroPeriodo === "ALL") {
      return { totalPrevistoPeriodo: 0, totalPagoPeriodo: 0, qtdParcelasPeriodo: 0 }
    }
    let previsto = 0
    let pago = 0
    let count = 0

    filteredRubricas.forEach((r) => {
      ;(r.parcelas_pagamento || []).forEach((p) => {
        if (!p.data_vencimento) return
        let match = false
        if (filtroPeriodo === "ESTA_SEMANA") {
          const dt = new Date(p.data_vencimento + "T12:00:00")
          match = dt >= weekRange.start && dt <= weekRange.end
        } else if (filtroPeriodo === "ESTE_MES") {
          match = p.data_vencimento.startsWith(currentYearMonth)
        } else if (filtroPeriodo === "PROXIMO_MES") {
          match = p.data_vencimento.startsWith(nextYearMonth)
        } else {
          match = p.data_vencimento.startsWith(filtroPeriodo)
        }

        if (match) {
          count++
          previsto += Number(p.valor_previsto || 0)
          if (p.status === "PAGO") {
            pago += Number(p.valor_previsto || 0)
          }
        }
      })
    })

    return { totalPrevistoPeriodo: previsto, totalPagoPeriodo: pago, qtdParcelasPeriodo: count }
  }, [filteredRubricas, filtroPeriodo, weekRange, currentYearMonth, nextYearMonth])

  const hasFiltrosAtivos =
    searchTerm.trim() !== "" || filtroPeriodo !== "ALL" || filtroTipo !== "ALL" || filtroSaldo !== "ALL"

  function limparFiltros() {
    setSearchTerm("")
    setFiltroPeriodo("ALL")
    setFiltroTipo("ALL")
    setFiltroSaldo("ALL")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const projDestino = selectedProjetoId === "ALL" ? formProjetoId : selectedProjetoId

    if (!projDestino) {
      toast.error("Selecione um projeto específico para cadastrar a rubrica.")
      return
    }

    if (!formData.descricao || !formData.codigo_natureza_despesa || formQtd <= 0 || formVlUnit < 0) {
      toast.error("Preencha todos os campos obrigatórios corretamente.")
      return
    }

    // Trava de Teto Visual
    if (totalOrcadoRubricas + formTotalPrevisto > tetoAprovadoProjeto) {
      const ultrapassaEm = totalOrcadoRubricas + formTotalPrevisto - tetoAprovadoProjeto
      toast.warning(
        `Alerta de Teto: Este item fará o plano de trabalho ultrapassar o teto em ${formatCurrency(ultrapassaEm)}.`
      )
    }

    try {
      setSaving(true)
      await mroscService.createRubrica({
        projeto_id: projDestino,
        tipo: formData.tipo,
        descricao: formData.descricao,
        codigo_natureza_despesa: formData.codigo_natureza_despesa,
        unidade: formData.unidade || "UN",
        quantidade: formQtd,
        valor_unitario: formVlUnit,
        tipo_pagamento: formData.tipo_pagamento,
        frequencia_meses: formData.tipo_pagamento === "RECORRENTE" ? parseInt(formData.frequencia_meses) || 1 : null,
        num_parcelas: formData.tipo_pagamento !== "UNICO" ? parseInt(formData.num_parcelas) || 1 : null,
        dia_vencimento: formData.dia_vencimento ? parseInt(formData.dia_vencimento) : null,
      })
      toast.success("Rubrica orçamentária cadastrada com sucesso!")
      setFormData({
        tipo: "SERVICO",
        descricao: "",
        codigo_natureza_despesa: "33903501",
        unidade: "UN",
        quantidade: "1",
        valor_unitario: "0,00",
        tipo_pagamento: "UNICO",
        frequencia_meses: "1",
        num_parcelas: "1",
        dia_vencimento: "",
      })
      setOpen(false)
      loadRubricas(selectedProjetoId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao salvar rubrica: " + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await mroscService.deleteRubrica(id)
      toast.success("Rubrica removida.")
      loadRubricas(selectedProjetoId)
    } catch {
      toast.error("Não é possível excluir: existem despesas vinculadas a esta rubrica.")
    }
  }

  const opcoesSelectProjeto = useMemo(
    () => [
      { id: "ALL", label: "Todos os Projetos (Consolidado)" },
      ...projetosDisponiveis.map((p) => ({ id: p.id, label: p.nome })),
    ],
    [projetosDisponiveis]
  )

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Previsão Orçamentária & Cronograma</h2>
            <p className="text-sm text-muted-foreground">
              {selectedProjetoId === "ALL"
                ? "Visão consolidada do plano de aplicação e fluxo mensal de todas as parcerias ativas."
                : `Plano de Trabalho e desembolsos programados: ${currentProjeto?.nome || ""}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Projeto Ativo */}
            <div className="w-80">
              <SelectComCriar
                value={selectedProjetoId}
                onValueChange={(val) => {
                  if (val) handleProjectChange(val)
                }}
                opcoes={opcoesSelectProjeto}
                placeholder="Selecione o Projeto..."
                labelCriar="Criar novo projeto"
                onClickCriar={() => setOpenProjeto(true)}
              />
            </div>

            {/* Alternador de Visão Cards / Grade */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={visaoAtiva === "cards" ? "secondary" : "ghost"}
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => setVisaoAtiva("cards")}
              >
                <LayoutGridIcon className="size-3.5" />
                Cards
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visaoAtiva === "grade" ? "secondary" : "ghost"}
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => setVisaoAtiva("grade")}
              >
                <TableIcon className="size-3.5" />
                Cronograma Mensal
              </Button>
            </div>

            {/* Ações: Nova Rubrica / Importar */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button
                    onClick={() => {
                      if (selectedProjetoId !== "ALL") {
                        setFormProjetoId(selectedProjetoId)
                      } else if (projetos.length > 0) {
                        setFormProjetoId(projetos[0].id)
                      }
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <PlusIcon className="size-4" />
                    Nova Rubrica
                  </Button>
                }
              />

              {selectedProjetoId !== "ALL" && (
                <ImportarPlanilhaDialog
                  projetoId={selectedProjetoId}
                  onImportado={() => loadRubricas(selectedProjetoId)}
                  trigger={
                    <Button variant="outline" className="gap-2">
                      <UploadIcon className="size-4" />
                      Importar Planilha
                    </Button>
                  }
                />
              )}

              <DialogContent className="sm:max-w-[560px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Adicionar Item ao Plano de Trabalho</DialogTitle>
                    <DialogDescription>
                      Cadastre a rubrica com a natureza de despesa correspondente e regras de desembolso.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    {/* Seletor de Projeto se estiver na visão consolidada */}
                    {selectedProjetoId === "ALL" && (
                      <div className="grid gap-2">
                        <Label htmlFor="form-projeto">Projeto de Destino *</Label>
                        <Select value={formProjetoId} onValueChange={(v) => v && setFormProjetoId(v)}>
                          <SelectTrigger id="form-projeto">
                            <SelectValue placeholder="Selecione o projeto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {projetos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="tipo">Tipo de Despesa *</Label>
                        <Select
                          value={formData.tipo}
                          onValueChange={(val: any) => {
                            if (val) setFormData((prev) => ({ ...prev, tipo: val }))
                          }}
                        >
                          <SelectTrigger id="tipo">
                            <SelectValue>
                              {(val) => {
                                const labels: Record<string, string> = {
                                  SERVICO: "SERVIÇO (PF / PJ)",
                                  MATERIAL: "MATERIAL DE CONSUMO",
                                  LOCACAO: "LOCAÇÃO DE BENS/ESPAÇOS",
                                  RH: "RECURSOS HUMANOS (CLT/BOLSA)",
                                  OUTROS: "OUTROS",
                                }
                                return val && labels[val] ? labels[val] : val
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SERVICO">SERVIÇO (PF / PJ)</SelectItem>
                            <SelectItem value="MATERIAL">MATERIAL DE CONSUMO</SelectItem>
                            <SelectItem value="LOCACAO">LOCAÇÃO DE BENS/ESPAÇOS</SelectItem>
                            <SelectItem value="RH">RECURSOS HUMANOS (CLT/BOLSA)</SelectItem>
                            <SelectItem value="OUTROS">OUTROS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="codigo_natureza_despesa">Código Natureza (Transferegov) *</Label>
                        <Input
                          id="codigo_natureza_despesa"
                          required
                          placeholder="Ex: 33903501 ou 33903000"
                          value={formData.codigo_natureza_despesa}
                          onChange={(e) => setFormData({ ...formData, codigo_natureza_despesa: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="descricao">Descrição do Item / Objeto do Gasto *</Label>
                      <Input
                        id="descricao"
                        required
                        placeholder="Ex: Coordenação Geral do Projeto"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="unidade">Unidade</Label>
                        <Input
                          id="unidade"
                          placeholder="UN, MÊS, HORA, KG"
                          value={formData.unidade}
                          onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="quantidade">Quantidade *</Label>
                        <Input
                          id="quantidade"
                          type="number"
                          step="0.01"
                          required
                          value={formData.quantidade}
                          onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="valor_unitario">Valor Unitário (R$) *</Label>
                        <Input
                          id="valor_unitario"
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          required
                          value={formData.valor_unitario}
                          onChange={(e) => setFormData({ ...formData, valor_unitario: maskCurrency(e.target.value) })}
                        />
                      </div>
                    </div>

                    {/* Tipo de Pagamento */}
                    <div className="grid gap-2">
                      <Label>Tipo de Pagamento</Label>
                      <Select
                        value={formData.tipo_pagamento}
                        onValueChange={(v: string | null) =>
                          setFormData((f) => ({
                            ...f,
                            tipo_pagamento: (v ?? "UNICO") as "UNICO" | "RECORRENTE" | "PARCELADO",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(val) => {
                              const labels: Record<string, string> = {
                                UNICO: "Pagamento Único",
                                RECORRENTE: "Recorrente (ex: mensal)",
                                PARCELADO: "Parcelado (ex: 3x)",
                              }
                              return val && labels[val] ? labels[val] : val
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNICO">Pagamento Único</SelectItem>
                          <SelectItem value="RECORRENTE">Recorrente (ex: mensal)</SelectItem>
                          <SelectItem value="PARCELADO">Parcelado (ex: 3x)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.tipo_pagamento !== "UNICO" && (
                      <div className="grid grid-cols-3 gap-3">
                        {formData.tipo_pagamento === "RECORRENTE" && (
                          <div className="grid gap-2">
                            <Label htmlFor="frequencia_meses">Frequência (meses)</Label>
                            <Input
                              id="frequencia_meses"
                              type="number"
                              min="1"
                              value={formData.frequencia_meses}
                              onChange={(e) => setFormData({ ...formData, frequencia_meses: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="grid gap-2">
                          <Label htmlFor="num_parcelas">Nº de Parcelas</Label>
                          <Input
                            id="num_parcelas"
                            type="number"
                            min="1"
                            value={formData.num_parcelas}
                            onChange={(e) => setFormData({ ...formData, num_parcelas: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="dia_vencimento">Dia Vencimento</Label>
                          <Input
                            id="dia_vencimento"
                            type="number"
                            min="1"
                            max="31"
                            placeholder="Ex: 5"
                            value={formData.dia_vencimento}
                            onChange={(e) => setFormData({ ...formData, dia_vencimento: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Cálculo Automático Visual */}
                    <div className="rounded-lg bg-muted/60 p-3 flex items-center justify-between border">
                      <div>
                        <span className="text-xs text-muted-foreground">Valor Total Calculado:</span>
                        <div className="text-lg font-bold text-foreground">
                          {formatCurrency(formTotalPrevisto)}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formQtd} {formData.unidade} × {formatCurrency(formVlUnit)}
                      </span>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      {saving ? "Salvando..." : "Salvar Rubrica"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cards de Métricas Superiores */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription className="text-xs font-semibold uppercase">
                  {selectedProjetoId === "ALL" ? "Teto Global Aprovado" : "Teto Aprovado no Termo"}
                </CardDescription>
                <Building2Icon className="size-4 text-muted-foreground/60" />
              </div>
              <CardTitle className="text-xl font-bold">{formatCurrency(tetoAprovadoProjeto)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {selectedProjetoId === "ALL"
                  ? `Soma dos tetos de ${projetos.length} parceria(s)`
                  : "Limite pactuado com o poder público"}
              </p>
            </CardContent>
          </Card>

          <Card className={ultrapassouTetoProjeto ? "border-destructive bg-destructive/5" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription className="text-xs font-semibold uppercase">Total Orçado em Rubricas</CardDescription>
                <TrendingUpIcon className="size-4 text-muted-foreground/60" />
              </div>
              <CardTitle className={`text-xl font-bold ${ultrapassouTetoProjeto ? "text-destructive" : ""}`}>
                {formatCurrency(totalOrcadoRubricas)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {rubricas.length} itens cadastrados no plano de trabalho
              </p>
            </CardContent>
          </Card>

          <Card className={saldoOrcamentoProjeto < 0 ? "border-destructive bg-destructive/5" : "border-emerald-500/30"}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription className="text-xs font-semibold uppercase">Margem / Saldo Não Alocado</CardDescription>
                <CalculatorIcon className="size-4 text-emerald-600/70" />
              </div>
              <CardTitle className={`text-xl font-bold ${saldoOrcamentoProjeto < 0 ? "text-destructive" : "text-emerald-600"}`}>
                {formatCurrency(saldoOrcamentoProjeto)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {saldoOrcamentoProjeto < 0
                  ? "Déficit acima do limite autorizado"
                  : "Disponível para novos lançamentos"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Card Adicional de Desembolso no Período Filtrado */}
        {filtroPeriodo !== "ALL" && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <CalendarIcon className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Desembolso Programado no Período Selecionado
                </h4>
                <p className="text-xs text-muted-foreground">
                  {qtdParcelasPeriodo} parcela(s) vencendo neste intervalo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Previsto
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatCurrency(totalPrevistoPeriodo)}
                </span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Já Pago
                </span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalPagoPeriodo)}
                </span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-medium">
                  A Pagar
                </span>
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(Math.max(0, totalPrevistoPeriodo - totalPagoPeriodo))}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Alerta Visual de Trava de Teto */}
        {ultrapassouTetoProjeto && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="size-4" />
            <AlertTitle>Trava de Teto Ultrapassada!</AlertTitle>
            <AlertDescription>
              A soma das rubricas cadastradas ultrapassa o teto do projeto em{" "}
              <strong>{formatCurrency(Math.abs(saldoOrcamentoProjeto))}</strong>. Ajuste os valores unitários ou quantidades para adequar à legislação MROSC.
            </AlertDescription>
          </Alert>
        )}

        {/* BARRA DE FILTROS E PESQUISA */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Busca Textual */}
            <div className="relative lg:col-span-2">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, natureza, tipo ou projeto..."
                className="pl-8 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>

            {/* 2. Filtro Temporal (Cronograma) */}
            <div>
              <Select value={filtroPeriodo} onValueChange={(v) => v && setFiltroPeriodo(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <CalendarIcon className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Período / Vencimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Períodos</SelectItem>
                  <SelectItem value="ESTA_SEMANA">⚡ Esta Semana</SelectItem>
                  <SelectItem value="ESTE_MES">📅 Este Mês</SelectItem>
                  <SelectItem value="PROXIMO_MES">⏩ Próximo Mês</SelectItem>
                  {mesesDisponiveis.map((ym) => (
                    <SelectItem key={ym} value={ym}>
                      🗓️ {formatYearMonth(ym)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Filtro de Natureza / Tipo MROSC */}
            <div>
              <Select value={filtroTipo} onValueChange={(v) => v && setFiltroTipo(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SlidersHorizontalIcon className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Tipo de Despesa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Tipos MROSC</SelectItem>
                  <SelectItem value="RH">Recursos Humanos (RH / CLT / Bolsas)</SelectItem>
                  <SelectItem value="SERVICO">Serviço de Terceiros (PF / PJ)</SelectItem>
                  <SelectItem value="MATERIAL">Material de Consumo</SelectItem>
                  <SelectItem value="LOCACAO">Locação de Bens / Espaços</SelectItem>
                  <SelectItem value="OUTROS">Outros / Encargos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Filtro de Situação / Saldo */}
            <div>
              <Select value={filtroSaldo} onValueChange={(v) => v && setFiltroSaldo(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <CheckCircle2Icon className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Situação da Execução" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Situações</SelectItem>
                  <SelectItem value="DISPONIVEL">Com Saldo Disponível</SelectItem>
                  <SelectItem value="EM_EXECUCAO">Em Execução (Pago &gt; 0)</SelectItem>
                  <SelectItem value="NAO_INICIADO">Não Iniciada (0% pago)</SelectItem>
                  <SelectItem value="ESGOTADO">100% Executada</SelectItem>
                  <SelectItem value="ESTOURADO">Estourada / Déficit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha de Status de Filtros e Limpeza */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span>
                Exibindo <strong>{filteredRubricas.length}</strong> de <strong>{rubricas.length}</strong> itens
              </span>

              {hasFiltrosAtivos && (
                <div className="flex flex-wrap items-center gap-1 ml-2">
                  {filtroPeriodo !== "ALL" && (
                    <Badge variant="secondary" className="text-[11px] gap-1 h-5 px-1.5">
                      Período:{" "}
                      {filtroPeriodo === "ESTA_SEMANA"
                        ? "Esta Semana"
                        : filtroPeriodo === "ESTE_MES"
                        ? "Este Mês"
                        : filtroPeriodo === "PROXIMO_MES"
                        ? "Próximo Mês"
                        : formatYearMonth(filtroPeriodo)}
                      <XIcon className="size-3 cursor-pointer" onClick={() => setFiltroPeriodo("ALL")} />
                    </Badge>
                  )}
                  {filtroTipo !== "ALL" && (
                    <Badge variant="secondary" className="text-[11px] gap-1 h-5 px-1.5">
                      Tipo: {filtroTipo}
                      <XIcon className="size-3 cursor-pointer" onClick={() => setFiltroTipo("ALL")} />
                    </Badge>
                  )}
                  {filtroSaldo !== "ALL" && (
                    <Badge variant="secondary" className="text-[11px] gap-1 h-5 px-1.5">
                      Situação: {filtroSaldo}
                      <XIcon className="size-3 cursor-pointer" onClick={() => setFiltroSaldo("ALL")} />
                    </Badge>
                  )}
                  {searchTerm && (
                    <Badge variant="secondary" className="text-[11px] gap-1 h-5 px-1.5">
                      Busca: &quot;{searchTerm}&quot;
                      <XIcon className="size-3 cursor-pointer" onClick={() => setSearchTerm("")} />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {hasFiltrosAtivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Limpar todos os filtros
              </Button>
            )}
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL: CARDS OU GRADE MENSAL */}
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Carregando plano orçamentário...</div>
        ) : filteredRubricas.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <CalculatorIcon className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Nenhum item orçamentário corresponde aos filtros</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {hasFiltrosAtivos
                ? "Tente ajustar os filtros ou redefinir para visualizar todos os itens."
                : "Adicione as rubricas ou importe uma planilha orçamentária do projeto."}
            </p>
            {hasFiltrosAtivos ? (
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            ) : selectedProjetoId !== "ALL" ? (
              <Button
                size="sm"
                onClick={() => setOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
              >
                <PlusIcon className="size-4" />
                Cadastrar Rubrica
              </Button>
            ) : null}
          </Card>
        ) : visaoAtiva === "cards" ? (
          /* ================================================================= */
          /* VISÃO 1: CARDS DETALHADOS DO PLANO DE TRABALHO                     */
          /* ================================================================= */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRubricas.map((rubrica) => {
              const totalGasto = (rubrica.despesas || [])
                .filter((d) => d.status === "PAGO")
                .reduce((acc, curr) => acc + Number(curr.valor), 0)
              const saldoItem = Number(rubrica.valor_total) - totalGasto
              const percentGasto =
                Number(rubrica.valor_total) > 0 ? (totalGasto / Number(rubrica.valor_total)) * 100 : 0

              // Próxima parcela a vencer
              const parcelasPendentes = (rubrica.parcelas_pagamento || []).filter(
                (p) => p.status !== "PAGO" && p.status !== "CANCELADO"
              )
              const proximaParcela = parcelasPendentes[0]

              return (
                <Card
                  key={rubrica.id}
                  className="flex flex-col justify-between hover:border-emerald-500/50 transition-colors shadow-2xs"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase font-medium">
                          {rubrica.tipo}
                        </Badge>
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {rubrica.codigo_natureza_despesa}
                        </span>
                        {selectedProjetoId === "ALL" && rubrica.projetos && (
                          <Badge variant="secondary" className="text-[10px] font-normal truncate max-w-[140px]">
                            {rubrica.projetos.nome}
                          </Badge>
                        )}
                      </div>

                      <ConfirmDialog
                        title="Remover rubrica?"
                        description="A rubrica será removida do plano de trabalho. Esta ação não pode ser desfeita."
                        confirmLabel="Excluir"
                        onConfirm={() => handleDelete(rubrica.id)}
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
                    </div>

                    <CardTitle className="text-base font-semibold leading-snug mt-2 line-clamp-2">
                      {rubrica.descricao}
                    </CardTitle>

                    <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1">
                      <span className="font-medium text-foreground">
                        {rubrica.quantidade} {rubrica.unidade}
                      </span>
                      <span>×</span>
                      <span>{formatCurrency(rubrica.valor_unitario)}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3 text-xs">
                    {/* Valores Consolidados */}
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase">Previsto</span>
                        <span className="font-bold text-foreground block text-xs">
                          {formatCurrency(rubrica.valor_total)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase">Pago</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 block text-xs">
                          {formatCurrency(totalGasto)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase">Saldo</span>
                        <span
                          className={`font-bold block text-xs ${
                            saldoItem < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrency(saldoItem)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Execução Financeira</span>
                        <span className="font-medium text-foreground">{percentGasto.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percentGasto > 100
                              ? "bg-destructive"
                              : percentGasto > 80
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(percentGasto, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Indicador de Desembolso / Parcelas */}
                    {rubrica.parcelas_pagamento && rubrica.parcelas_pagamento.length > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="size-3 text-muted-foreground" />
                          {rubrica.parcelas_pagamento.length} desembolso(s)
                        </span>
                        {proximaParcela && (
                          <span className="text-[10px] font-mono">
                            Próx: {formatCurrency(proximaParcela.valor_previsto)} em{" "}
                            {proximaParcela.data_vencimento
                              ? proximaParcela.data_vencimento.split("-").reverse().join("/")
                              : "-"}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-2 border-t flex items-center justify-between gap-2 bg-muted/20 text-xs">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {rubrica.tipo_pagamento === "UNICO"
                        ? "Pagamento Único"
                        : rubrica.tipo_pagamento === "PARCELADO"
                        ? `${rubrica.num_parcelas ?? 1}x parcelado`
                        : `Recorrente (${rubrica.frequencia_meses ?? 1}m)`}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link
                          href={`/execucao?projetoId=${rubrica.projeto_id || selectedProjetoId}&rubricaId=${
                            rubrica.id
                          }`}
                        />
                      }
                      className="h-7 text-xs gap-1"
                    >
                      <ReceiptIcon className="size-3" />
                      Execução
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        ) : (
          /* ================================================================= */
          /* VISÃO 2: GRADE MENSAL DE DESEMBOLSO (CRONOGRAMA DO MROSC)         */
          /* ================================================================= */
          <div className="rounded-xl border bg-card shadow-2xs overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">Cronograma de Desembolso Mensal</h3>
                <p className="text-xs text-muted-foreground">
                  Projeção mês a mês dos pagamentos programados por item do Plano de Trabalho.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono w-fit">
                {mesesDisponiveis.length} meses projetados
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <Table className="text-xs min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[300px] sticky left-0 bg-muted/90 backdrop-blur-xs font-semibold">
                      Rubrica / Objeto do Gasto
                    </TableHead>
                    {selectedProjetoId === "ALL" && (
                      <TableHead className="w-[140px] font-semibold">Projeto</TableHead>
                    )}
                    <TableHead className="w-[80px] font-semibold">Tipo</TableHead>

                    {/* Colunas dos Meses */}
                    {mesesDisponiveis.map((ym) => (
                      <TableHead key={ym} className="text-center font-semibold min-w-[100px]">
                        {formatYearMonth(ym)}
                      </TableHead>
                    ))}

                    <TableHead className="text-right font-semibold min-w-[110px]">Total Previsto</TableHead>
                    <TableHead className="text-right font-semibold min-w-[110px]">Total Pago</TableHead>
                    <TableHead className="text-right font-semibold min-w-[110px]">Saldo</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRubricas.map((rubrica) => {
                    const totalGasto = (rubrica.despesas || [])
                      .filter((d) => d.status === "PAGO")
                      .reduce((acc, curr) => acc + Number(curr.valor), 0)
                    const saldo = Number(rubrica.valor_total || 0) - totalGasto

                    return (
                      <TableRow key={rubrica.id} className="hover:bg-muted/30">
                        {/* Identificação da Rubrica */}
                        <TableCell className="sticky left-0 bg-card hover:bg-muted/30 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-foreground line-clamp-1">
                              {rubrica.descricao}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {rubrica.codigo_natureza_despesa} • {rubrica.quantidade} {rubrica.unidade}
                            </span>
                          </div>
                        </TableCell>

                        {selectedProjetoId === "ALL" && (
                          <TableCell className="text-muted-foreground truncate max-w-[130px]">
                            {rubrica.projetos?.nome || "-"}
                          </TableCell>
                        )}

                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {rubrica.tipo}
                          </Badge>
                        </TableCell>

                        {/* Células de cada Mês */}
                        {mesesDisponiveis.map((ym) => {
                          const parcelasMes = (rubrica.parcelas_pagamento || []).filter(
                            (p) => p.data_vencimento && p.data_vencimento.startsWith(ym)
                          )

                          if (parcelasMes.length === 0) {
                            return (
                              <TableCell key={ym} className="text-center text-muted-foreground/30">
                                -
                              </TableCell>
                            )
                          }

                          const valorMes = parcelasMes.reduce(
                            (acc, p) => acc + Number(p.valor_previsto || 0),
                            0
                          )
                          const todasPagas = parcelasMes.every((p) => p.status === "PAGO")
                          const temAtrasada = parcelasMes.some((p) => p.status === "ATRASADO")

                          return (
                            <TableCell key={ym} className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-mono font-medium">{formatCurrency(valorMes)}</span>
                                {todasPagas ? (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ✓ Pago
                                  </span>
                                ) : temAtrasada ? (
                                  <span className="text-[9px] text-destructive font-semibold">
                                    Atrasada
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-muted-foreground">
                                    {parcelasMes.length > 1 ? `${parcelasMes.length} parc.` : "Previsto"}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )
                        })}

                        {/* Totais da Rubrica */}
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(rubrica.valor_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatCurrency(totalGasto)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-semibold ${
                            saldo < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrency(saldo)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>

                {/* Rodapé: Total Geral por Mês (Fluxo Mensal MROSC) */}
                <TableFooter className="bg-muted/80 font-semibold border-t-2">
                  <TableRow>
                    <TableCell className="sticky left-0 bg-muted font-bold">
                      Desembolso Geral Previsto
                    </TableCell>
                    {selectedProjetoId === "ALL" && <TableCell>-</TableCell>}
                    <TableCell>-</TableCell>

                    {mesesDisponiveis.map((ym) => {
                      const totalMes = filteredRubricas.reduce((acc, r) => {
                        const parc = (r.parcelas_pagamento || []).filter(
                          (p) => p.data_vencimento && p.data_vencimento.startsWith(ym)
                        )
                        return acc + parc.reduce((pAcc, p) => pAcc + Number(p.valor_previsto || 0), 0)
                      }, 0)

                      return (
                        <TableCell key={ym} className="text-center font-mono font-bold text-foreground">
                          {formatCurrency(totalMes)}
                        </TableCell>
                      )
                    })}

                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(filteredRubricas.reduce((acc, r) => acc + Number(r.valor_total || 0), 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(
                        filteredRubricas.reduce((acc, r) => {
                          const pg = (r.despesas || [])
                            .filter((d) => d.status === "PAGO")
                            .reduce((dAcc, d) => dAcc + Number(d.valor), 0)
                          return acc + pg
                        }, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(
                        filteredRubricas.reduce((acc, r) => {
                          const pg = (r.despesas || [])
                            .filter((d) => d.status === "PAGO")
                            .reduce((dAcc, d) => dAcc + Number(d.valor), 0)
                          return acc + (Number(r.valor_total || 0) - pg)
                        }, 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        )}
      </div>

      <CriarProjetoDialog
        open={openProjeto}
        onOpenChange={setOpenProjeto}
        onCriado={(novo) => {
          setProjetos((prev) => [...prev, novo as any])
          handleProjectChange(novo.id)
        }}
      />
    </>
  )
}

export default function OrcamentoPage() {
  return (
    <DashboardShell>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando previsão orçamentária...</div>}>
        <OrcamentoContent />
      </Suspense>
    </DashboardShell>
  )
}
