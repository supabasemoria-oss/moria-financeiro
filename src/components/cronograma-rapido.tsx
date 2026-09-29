"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowRightIcon,
  ReceiptIcon,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarFornecedorDialog } from "@/components/dialogs/criar-fornecedor-dialog"
import { CampoNotaFiscal } from "@/components/campo-nota-fiscal"
import { mroscService } from "@/lib/api/mrosc-service"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import type { ParcelaComRelacoes, Fornecedor } from "@/lib/types"
import { formatCurrency, formatDate, getTodaySaoPaulo } from "@/lib/utils"
import { toast } from "sonner"

export function CronogramaRapido() {
  const { instituicaoId, projetoId, projetosDisponiveis } = useFiltroGlobal()
  const [parcelas, setParcelas] = React.useState<ParcelaComRelacoes[]>([])
  const [loading, setLoading] = React.useState(true)

  // Estados do Modal de Quitação Rápida Individual
  const [openQuitar, setOpenQuitar] = React.useState(false)
  const [parcelaParaQuitar, setParcelaParaQuitar] = React.useState<ParcelaComRelacoes | null>(null)
  const [fornecedores, setFornecedores] = React.useState<Fornecedor[]>([])
  const [openFornecedor, setOpenFornecedor] = React.useState(false)
  const [savingQuitacao, setSavingQuitacao] = React.useState(false)
  const [arquivoNf, setArquivoNf] = React.useState<File | null>(null)
  const [quitarForm, setQuitarForm] = React.useState({
    fornecedor_id: "",
    data_pagamento_real: getTodaySaoPaulo(),
    numero_documento_fiscal: "",
    observacoes: "",
  })

  // Estados de Seleção e Ações em Lote (Batch)
  const [selectedParcelas, setSelectedParcelas] = React.useState<Set<string>>(new Set())
  const [openQuitarLote, setOpenQuitarLote] = React.useState(false)
  const [quitarLoteForm, setQuitarLoteForm] = React.useState({
    fornecedor_id: "",
    data_pagamento_real: getTodaySaoPaulo(),
    numero_documento_fiscal: "",
    observacoes: "",
  })
  const [arquivoNfLote, setArquivoNfLote] = React.useState<File | null>(null)
  const [savingQuitacaoLote, setSavingQuitacaoLote] = React.useState(false)

  // 1. Carregar parcelas
  const loadParcelas = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await mroscService.getParcelas()
      setParcelas(data)
    } catch (e) {
      console.error("Erro ao carregar parcelas do cronograma rápido:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadParcelas()
  }, [loadParcelas])

  // Abrir Modal de Quitar
  const handleAbrirQuitar = React.useCallback(async (parcela: ParcelaComRelacoes) => {
    setParcelaParaQuitar(parcela)
    setArquivoNf(null)
    try {
      const forns = await mroscService.getFornecedores()
      setFornecedores(forns)
      setQuitarForm({
        fornecedor_id: forns[0]?.id || "",
        data_pagamento_real: getTodaySaoPaulo(),
        numero_documento_fiscal: "",
        observacoes: "",
      })
    } catch (e) {
      console.error("Erro ao carregar fornecedores:", e)
    }
    setOpenQuitar(true)
  }, [])

  // Confirmar Quitação
  async function handleConfirmarQuitacao(e: React.FormEvent) {
    e.preventDefault()
    if (!parcelaParaQuitar) return
    if (!quitarForm.fornecedor_id) {
      toast.error("Selecione o credor / fornecedor do pagamento.")
      return
    }

    try {
      setSavingQuitacao(true)
      await mroscService.executarParcela(parcelaParaQuitar.id, {
        fornecedor_id: quitarForm.fornecedor_id,
        data_pagamento_real: quitarForm.data_pagamento_real,
        numero_documento_fiscal: quitarForm.numero_documento_fiscal || undefined,
        observacoes: quitarForm.observacoes || undefined,
        arquivo_nota_fiscal: arquivoNf,
      })
      toast.success("Parcela quitada com sucesso! Despesa e comprovante registrados.")
      setOpenQuitar(false)
      setParcelaParaQuitar(null)
      setArquivoNf(null)
      loadParcelas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao quitar parcela"
      toast.error(msg)
    } finally {
      setSavingQuitacao(false)
    }
  }

  // 2. Calcular os próximos 3 meses a partir do momento atual
  const mesesTres = React.useMemo(() => {
    const now = new Date()
    const result = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const ym = d.toISOString().slice(0, 7)
      const rawMonth = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(d)
      const year = d.getFullYear()
      const capitalized = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)

      result.push({
        ym,
        label: `${capitalized} de ${year}`,
        isAtual: i === 0,
      })
    }
    return result
  }, [])

  // 3. Filtrar parcelas pelo contexto global (instituição e projeto ativos)
  const parcelasFiltradas = React.useMemo(() => {
    return parcelas.filter((p) => {
      if (projetoId !== "ALL" && p.projeto_id !== projetoId) {
        return false
      }
      if (instituicaoId !== "ALL") {
        const pertenceInst = projetosDisponiveis.some((pr) => pr.id === p.projeto_id)
        if (!pertenceInst) return false
      }
      return true
    })
  }, [parcelas, projetoId, instituicaoId, projetosDisponiveis])

  // Ações de Seleção Múltipla (Batch)
  const handleToggleSelect = React.useCallback((id: string) => {
    setSelectedParcelas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedParcelasObjs = React.useMemo(() => {
    return parcelasFiltradas.filter((p) => selectedParcelas.has(p.id))
  }, [parcelasFiltradas, selectedParcelas])

  const selectedTotalValor = React.useMemo(() => {
    return selectedParcelasObjs.reduce((acc, p) => acc + (p.valor_previsto || 0), 0)
  }, [selectedParcelasObjs])

  const handleAbrirQuitarLote = React.useCallback(async () => {
    const pendentes = selectedParcelasObjs.filter((p) => p.status !== "PAGO")
    if (pendentes.length === 0) return
    setArquivoNfLote(null)
    try {
      const forns = await mroscService.getFornecedores()
      setFornecedores(forns)
      setQuitarLoteForm({
        fornecedor_id: forns[0]?.id || "",
        data_pagamento_real: getTodaySaoPaulo(),
        numero_documento_fiscal: "",
        observacoes: "",
      })
    } catch (e) {
      console.error("Erro ao carregar fornecedores:", e)
    }
    setOpenQuitarLote(true)
  }, [selectedParcelasObjs])

  async function handleConfirmarQuitacaoLote(e: React.FormEvent) {
    e.preventDefault()
    const pendentes = selectedParcelasObjs.filter((p) => p.status !== "PAGO")
    if (pendentes.length === 0) return
    if (!quitarLoteForm.fornecedor_id) {
      toast.error("Selecione o credor / fornecedor do pagamento.")
      return
    }

    try {
      setSavingQuitacaoLote(true)
      for (const parcela of pendentes) {
        await mroscService.executarParcela(parcela.id, {
          fornecedor_id: quitarLoteForm.fornecedor_id,
          data_pagamento_real: quitarLoteForm.data_pagamento_real,
          numero_documento_fiscal: quitarLoteForm.numero_documento_fiscal || undefined,
          observacoes: quitarLoteForm.observacoes || undefined,
          arquivo_nota_fiscal: arquivoNfLote,
        })
      }
      toast.success(`${pendentes.length} parcela(s) quitada(s) com sucesso em lote!`)
      setOpenQuitarLote(false)
      setSelectedParcelas(new Set())
      setArquivoNfLote(null)
      loadParcelas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao quitar parcelas em lote"
      toast.error(msg)
    } finally {
      setSavingQuitacaoLote(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 lg:px-6">
      {/* Título da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CalendarDaysIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Cronograma de Desembolso • Próximos 3 Meses
            </h3>
            <p className="text-xs text-muted-foreground">
              Previsão de fluxo de caixa, parcelas a vencer e liquidações programadas.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/orcamento" />}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 w-fit h-8"
        >
          Ver cronograma anual completo
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>

      {/* Barra de Ações em Lote (Batch) */}
      {selectedParcelas.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <Badge className="bg-emerald-600 text-white font-mono text-xs">
              {selectedParcelas.size} selecionada(s)
            </Badge>
            <span className="text-xs font-semibold text-foreground font-mono">
              Total: {formatCurrency(selectedTotalValor)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAbrirQuitarLote}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-xs"
            >
              <CheckCircle2Icon className="size-3.5" />
              Quitar Selecionadas ({selectedParcelasObjs.filter((p) => p.status !== "PAGO").length})
            </Button>
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

      {/* Grid de 3 Cards Mensais */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Carregando projeção de desembolsos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mesesTres.map((mes) => {
            const parcelasMes = parcelasFiltradas
              .filter((p) => p.data_vencimento && p.data_vencimento.startsWith(mes.ym))
              .sort((a, b) => (a.data_vencimento > b.data_vencimento ? 1 : -1))

            const previsto = parcelasMes.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0)
            const pago = parcelasMes
              .filter((p) => p.status === "PAGO")
              .reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0)
            const aPagar = Math.max(0, previsto - pago)

            return (
              <Card
                key={mes.ym}
                className={`flex flex-col justify-between transition-colors shadow-2xs ${
                  mes.isAtual
                    ? "border-emerald-500/40 bg-linear-to-b from-emerald-500/5 to-card"
                    : "bg-card"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-foreground">
                      {mes.label}
                    </CardTitle>
                    {mes.isAtual ? (
                      <div className="flex items-center gap-1.5">
                        {parcelasMes.filter((p) => p.status !== "PAGO").length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const pendentes = parcelasMes.filter((p) => p.status !== "PAGO")
                              const allSelected = pendentes.every((p) => selectedParcelas.has(p.id))
                              setSelectedParcelas((prev) => {
                                const next = new Set(prev)
                                if (allSelected) {
                                  pendentes.forEach((p) => next.delete(p.id))
                                } else {
                                  pendentes.forEach((p) => next.add(p.id))
                                }
                                return next
                              })
                            }}
                            className="h-6 text-[10px] px-1.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          >
                            {parcelasMes.filter((p) => p.status !== "PAGO").every((p) => selectedParcelas.has(p.id))
                              ? "Desmarcar mês"
                              : "Selecionar mês"}
                          </Button>
                        )}
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                        >
                          Mês Vigente
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {parcelasMes.filter((p) => p.status !== "PAGO").length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const pendentes = parcelasMes.filter((p) => p.status !== "PAGO")
                              const allSelected = pendentes.every((p) => selectedParcelas.has(p.id))
                              setSelectedParcelas((prev) => {
                                const next = new Set(prev)
                                if (allSelected) {
                                  pendentes.forEach((p) => next.delete(p.id))
                                } else {
                                  pendentes.forEach((p) => next.add(p.id))
                                }
                                return next
                              })
                            }}
                            className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                          >
                            {parcelasMes.filter((p) => p.status !== "PAGO").every((p) => selectedParcelas.has(p.id))
                              ? "Desmarcar mês"
                              : "Selecionar mês"}
                          </Button>
                        )}
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                          {parcelasMes.length} parc.
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {parcelasMes.length === 0
                      ? "Nenhum desembolso previsto"
                      : `${parcelasMes.length} obrigação(ões) programada(s)`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-3">
                  {/* Totais do Mês */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                        Previsto
                      </span>
                      <span className="font-bold text-foreground block text-xs truncate">
                        {formatCurrency(previsto)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                        Pago
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-xs truncate">
                        {formatCurrency(pago)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                        A Pagar
                      </span>
                      <span
                        className={`font-bold block text-xs truncate ${
                          aPagar > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {formatCurrency(aPagar)}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Parcelas */}
                  <div className="space-y-1.5 pt-1">
                    {parcelasMes.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 py-3 text-center italic">
                        Sem desembolsos programados
                      </p>
                    ) : (
                      parcelasMes.slice(0, 3).map((p) => {
                        const dia = p.data_vencimento ? p.data_vencimento.split("-")[2] : "--"
                        const isPago = p.status === "PAGO"
                        const isAtrasado = p.status === "ATRASADO"
                        const isSelected = selectedParcelas.has(p.id)

                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded-md text-xs border transition-colors ${
                              isSelected
                                ? "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/30"
                                : "hover:bg-muted/30 border-transparent hover:border-muted"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {!isPago && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleSelect(p.id)}
                                  aria-label={`Selecionar ${p.descricao}`}
                                  className="size-3.5 shrink-0"
                                />
                              )}
                              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                Dia {dia}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-foreground font-medium text-[11px]">
                                  {p.descricao || p.rubricas_orcamentarias?.descricao || "Parcela"}
                                </p>
                                {p.projetos && projetoId === "ALL" && (
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {p.projetos.nome}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-semibold text-[11px] text-foreground">
                                {formatCurrency(p.valor_previsto)}
                              </span>
                              {isPago ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 font-medium border-emerald-500/20"
                                >
                                  <CheckCircle2Icon className="size-3" />
                                  Pago
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {isAtrasado && (
                                    <span title="Vencido">
                                      <AlertTriangleIcon className="size-3 text-destructive shrink-0" />
                                    </span>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAbrirQuitar(p)}
                                    className="h-6 text-[10px] px-2 gap-1 font-medium text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/60 shadow-none cursor-pointer"
                                  >
                                    <ReceiptIcon className="size-3" />
                                    Executar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}

                    {parcelasMes.length > 3 && (
                      <p className="text-[11px] text-muted-foreground text-center pt-1">
                        + {parcelasMes.length - 3} outra(s) parcela(s)
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t bg-muted/20 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {aPagar === 0 && previsto > 0 ? "Mês quitado" : "Fluxo ativo"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link
                        href={`/execucao?projetoId=${projetoId !== "ALL" ? projetoId : ""}`}
                      />
                    }
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                  >
                    Ver execuções
                    <ArrowRightIcon className="size-3" />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* ==================================================== */}
      {/* DIALOG: EXECUTAR / QUITAR PARCELA                    */}
      {/* ==================================================== */}
      <Dialog open={openQuitar} onOpenChange={setOpenQuitar}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleConfirmarQuitacao}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ReceiptIcon className="size-5 text-emerald-600" />
                Executar / Quitar Parcela
              </DialogTitle>
              <DialogDescription>
                Registrar pagamento da obrigação e gerar lançamento de despesa no Livro Caixa MROSC.
              </DialogDescription>
            </DialogHeader>

            {parcelaParaQuitar && (
              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 my-3 border">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Obrigação:</span>
                  <span className="text-foreground">
                    {parcelaParaQuitar.descricao || "Parcela de Desembolso"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Previsto:</span>
                  <strong className="text-emerald-600 font-mono text-sm">
                    {formatCurrency(parcelaParaQuitar.valor_previsto)}
                  </strong>
                </div>
                {parcelaParaQuitar.projetos && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projeto:</span>
                    <span>{parcelaParaQuitar.projetos.nome}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento Original:</span>
                  <span>{formatDate(parcelaParaQuitar.data_vencimento)}</span>
                </div>
              </div>
            )}

            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="quitar_fornecedor" className="text-xs">
                  Fornecedor / Credor Beneficiário *
                </Label>
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

              <div className="grid gap-1.5">
                <Label htmlFor="quitar_data" className="text-xs">
                  Data do Pagamento *
                </Label>
                <Input
                  id="quitar_data"
                  type="date"
                  required
                  value={quitarForm.data_pagamento_real}
                  onChange={(e) => setQuitarForm((prev) => ({ ...prev, data_pagamento_real: e.target.value }))}
                />
              </div>

              <CampoNotaFiscal
                numero={quitarForm.numero_documento_fiscal}
                onNumeroChange={(val) => setQuitarForm((prev) => ({ ...prev, numero_documento_fiscal: val }))}
                arquivo={arquivoNf}
                onArquivoChange={setArquivoNf}
                labelNumero="Nº Nota Fiscal / Documento (Opcional)"
                placeholderNumero="Ex: NF 10423"
              />

              <div className="grid gap-1.5">
                <Label htmlFor="quitar_obs" className="text-xs">
                  Observações / Forma de Pagamento
                </Label>
                <Input
                  id="quitar_obs"
                  placeholder="Ex: TED / Pix efetuado na conta bancária vinculada"
                  value={quitarForm.observacoes}
                  onChange={(e) => setQuitarForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpenQuitar(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingQuitacao}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {savingQuitacao ? "Registrando..." : "Confirmar Quitação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* DIALOG: QUITAR EM LOTE (CRONOGRAMA RÁPIDO)          */}
      {/* ==================================================== */}
      <Dialog open={openQuitarLote} onOpenChange={setOpenQuitarLote}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleConfirmarQuitacaoLote}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="size-5 text-emerald-600" />
                Quitar {selectedParcelasObjs.filter((p) => p.status !== "PAGO").length} Parcela(s) em Lote
              </DialogTitle>
              <DialogDescription>
                Informe o credor e o comprovante para liquidar os desembolsos selecionados conjuntamente.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 text-xs space-y-1 my-2">
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
            </div>

            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="quitar_lote_cr_fornecedor" className="text-xs">
                  Fornecedor / Credor Beneficiário *
                </Label>
                <SelectComCriar
                  id="quitar_lote_cr_fornecedor"
                  value={quitarLoteForm.fornecedor_id}
                  onValueChange={(val) => setQuitarLoteForm((prev) => ({ ...prev, fornecedor_id: val }))}
                  opcoes={fornecedores.map((f) => ({ id: f.id, label: f.razao_social_nome }))}
                  placeholder="Selecione o credor..."
                  labelCriar="Cadastrar novo fornecedor"
                  onClickCriar={() => setOpenFornecedor(true)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="quitar_lote_cr_data" className="text-xs">
                  Data do Pagamento Efetivado *
                </Label>
                <Input
                  id="quitar_lote_cr_data"
                  type="date"
                  required
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
                arquivo={arquivoNfLote}
                onArquivoChange={setArquivoNfLote}
                labelNumero="Nº Nota Fiscal / Documento em Lote (Opcional)"
                placeholderNumero="Ex: NF 10423"
              />

              <div className="grid gap-1.5">
                <Label htmlFor="quitar_lote_cr_obs" className="text-xs">
                  Observações / Forma de Pagamento
                </Label>
                <Input
                  id="quitar_lote_cr_obs"
                  placeholder="Ex: TED / Pix efetuado na conta bancária vinculada"
                  value={quitarLoteForm.observacoes}
                  onChange={(e) =>
                    setQuitarLoteForm((prev) => ({ ...prev, observacoes: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpenQuitarLote(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingQuitacaoLote}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {savingQuitacaoLote ? "Registrando Lote..." : "Confirmar Quitação em Lote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para cadastrar novo fornecedor caso não exista */}
      <CriarFornecedorDialog
        open={openFornecedor}
        onOpenChange={setOpenFornecedor}
        onCriado={(novo) => {
          setFornecedores((prev) => [...prev, novo])
          setQuitarForm((prev) => ({ ...prev, fornecedor_id: novo.id }))
        }}
      />
    </div>
  )
}

