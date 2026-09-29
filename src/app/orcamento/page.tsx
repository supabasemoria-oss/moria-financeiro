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
import { moriaService } from "@/lib/api/moria-service"
import type { Projeto, Rubrica, Despesa } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

function OrcamentoContent() {
  const searchParams = useSearchParams()
  const initialProjetoId = searchParams.get("projetoId") || ""

  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>(initialProjetoId)
  const [rubricas, setRubricas] = useState<(Rubrica & { despesas?: Despesa[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openProjeto, setOpenProjeto] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Formulário de Nova Rubrica
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
        const projData = await moriaService.getProjetos()
        setProjetos(projData)
        const projId = initialProjetoId || (projData.length > 0 ? projData[0].id : "")
        setSelectedProjetoId(projId)
        if (projId) {
          const rubData = await moriaService.getRubricas(projId)
          setRubricas(rubData)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido"
        toast.error("Erro ao carregar dados: " + msg)
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [initialProjetoId])

  // Carregar Rubricas do serviço
  async function loadRubricas(projId: string) {
    try {
      setLoading(true)
      const data = await moriaService.getRubricas(projId)
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
    loadRubricas(projId)
  }

  const currentProjeto = useMemo(
    () => projetos.find((p) => p.id === selectedProjetoId) || projetos[0],
    [projetos, selectedProjetoId]
  )

  // Cálculos automáticos do formulário
  const formQtd = parseFloat(formData.quantidade.replace(",", ".")) || 0
  const formVlUnit = parseFloat(formData.valor_unitario.replace(",", ".")) || 0
  const formTotalPrevisto = formQtd * formVlUnit

  // Cálculos consolidados da planilha
  const totalOrcadoRubricas = rubricas.reduce((acc, r) => acc + Number(r.valor_total || 0), 0)
  const tetoAprovadoProjeto = Number(currentProjeto?.valor_total_aprovado || 0)
  const saldoOrcamentoProjeto = tetoAprovadoProjeto - totalOrcadoRubricas
  const ultrapassouTetoProjeto = totalOrcadoRubricas > tetoAprovadoProjeto

  // Filtro de Rubricas
  const filteredRubricas = useMemo(() => {
    if (!searchTerm.trim()) return rubricas
    const term = searchTerm.toLowerCase().trim()
    return rubricas.filter(
      (r) =>
        r.descricao?.toLowerCase().includes(term) ||
        r.codigo_natureza_despesa?.toLowerCase().includes(term) ||
        r.tipo?.toLowerCase().includes(term)
    )
  }, [rubricas, searchTerm])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProjetoId) {
      toast.error("Selecione um projeto antes de cadastrar a rubrica.")
      return
    }

    if (!formData.descricao || !formData.codigo_natureza_despesa || formQtd <= 0 || formVlUnit < 0) {
      toast.error("Preencha todos os campos obrigatórios corretamente.")
      return
    }

    // Trava de Teto Visual / Regra de Negócio Moriá
    if (totalOrcadoRubricas + formTotalPrevisto > tetoAprovadoProjeto) {
      const ultrapassaEm = totalOrcadoRubricas + formTotalPrevisto - tetoAprovadoProjeto
      toast.warning(
        `Alerta de Teto: Este item fará o plano de trabalho ultrapassar o teto do projeto em ${formatCurrency(ultrapassaEm)}.`
      )
    }

    try {
      setSaving(true)
      await moriaService.createRubrica({
        projeto_id: selectedProjetoId,
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
      handleProjectChange(selectedProjetoId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao salvar rubrica: " + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await moriaService.deleteRubrica(id)
      toast.success("Rubrica removida.")
      handleProjectChange(selectedProjetoId)
    } catch (e: unknown) {
      toast.error("Não é possível excluir: existem despesas vinculadas a esta rubrica.")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Previsão Orçamentária & Travas de Teto</h2>
            <p className="text-sm text-muted-foreground">
              Estruturação do Plano de Aplicação por natureza de despesa e controle de limites aprovados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Projeto Ativo */}
            <div className="w-72">
              <SelectComCriar
                value={selectedProjetoId}
                onValueChange={(val) => {
                  if (val) handleProjectChange(val)
                }}
                opcoes={projetos.map((p) => ({ id: p.id, label: p.nome }))}
                placeholder="Selecione o Projeto..."
                labelCriar="Criar novo projeto"
                onClickCriar={() => setOpenProjeto(true)}
              />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button disabled={!selectedProjetoId} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                    <PlusIcon className="size-4" />
                    Nova Rubrica / Item
                  </Button>
                }
              />

              {selectedProjetoId && (
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
                      Cadastre a rubrica com a natureza de despesa correspondente e o valor unitário.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
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
                                return (val && labels[val]) ? labels[val] : val
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
                        placeholder="Ex: Assessoria Jurídica Especializada em MROSC"
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
                          type="number"
                          step="0.01"
                          required
                          value={formData.valor_unitario}
                          onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
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
                              return (val && labels[val]) ? labels[val] : val
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
                        {formQtd} {formData.unidade} x {formatCurrency(formVlUnit)}
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

        {/* Cards de Resumo e Travas de Teto */}
        {currentProjeto && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase">Teto Aprovado no Termo</CardDescription>
                <CardTitle className="text-xl font-bold">{formatCurrency(tetoAprovadoProjeto)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Limite financeiro pactuado com o poder público</p>
              </CardContent>
            </Card>

            <Card className={ultrapassouTetoProjeto ? "border-destructive bg-destructive/5" : ""}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase">Total Orçado em Rubricas</CardDescription>
                <CardTitle className={`text-xl font-bold ${ultrapassouTetoProjeto ? "text-destructive" : ""}`}>
                  {formatCurrency(totalOrcadoRubricas)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Soma de todos os itens do plano de trabalho</p>
              </CardContent>
            </Card>

            <Card className={saldoOrcamentoProjeto < 0 ? "border-destructive bg-destructive/5" : "border-emerald-500/30"}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase">Margem / Saldo Não Alocado</CardDescription>
                <CardTitle className={`text-xl font-bold ${saldoOrcamentoProjeto < 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {formatCurrency(saldoOrcamentoProjeto)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Valor restante para atingir o teto de 100%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerta Visual de Trava de Teto */}
        {ultrapassouTetoProjeto && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="size-4" />
            <AlertTitle>Trava de Teto Ultrapassada!</AlertTitle>
            <AlertDescription>
              A soma das rubricas cadastradas ultrapassa o teto aprovado do projeto em{" "}
              <strong>{formatCurrency(Math.abs(saldoOrcamentoProjeto))}</strong>. Ajuste os valores unitários ou quantidades para adequar à legislação MROSC.
            </AlertDescription>
          </Alert>
        )}

        {/* Barra de Filtros e Busca de Rubricas */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border">
          <div>
            <h3 className="text-base font-semibold">Rubricas Orçamentárias</h3>
            <p className="text-xs text-muted-foreground">
              {filteredRubricas.length} de {rubricas.length} itens previstos no plano de trabalho
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, natureza ou tipo..."
              className="pl-8 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Grid de Cards de Rubricas */}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando rubricas do projeto...</div>
        ) : !selectedProjetoId ? (
          <Card className="py-12 text-center text-sm text-muted-foreground">
            Selecione um projeto acima para visualizar e gerenciar suas rubricas.
          </Card>
        ) : filteredRubricas.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <CalculatorIcon className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">
              {searchTerm ? "Nenhuma rubrica encontrada para esta busca" : "Nenhuma rubrica cadastrada neste projeto"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {searchTerm
                ? "Tente outro termo de busca ou limpe o campo."
                : "Adicione os itens e natureza de despesa para iniciar os lançamentos financeiros."}
            </p>
            {searchTerm && (
              <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                Limpar busca
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRubricas.map((rubrica) => {
              const totalGasto = (rubrica.despesas || [])
                .filter((d) => d.status === "PAGO")
                .reduce((acc, curr) => acc + Number(curr.valor), 0)
              const saldoItem = Number(rubrica.valor_total) - totalGasto
              const percentGasto =
                Number(rubrica.valor_total) > 0 ? (totalGasto / Number(rubrica.valor_total)) * 100 : 0

              return (
                <Card
                  key={rubrica.id}
                  className="flex flex-col justify-between hover:border-emerald-500/50 transition-colors shadow-xs"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase font-medium">
                          {rubrica.tipo}
                        </Badge>
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {rubrica.codigo_natureza_despesa}
                        </span>
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

                    <CardTitle className="text-base font-semibold leading-snug mt-1.5 line-clamp-2">
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
                            saldoItem < 0
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrency(saldoItem)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Execução</span>
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
                          href={`/execucao?projetoId=${selectedProjetoId}&rubricaId=${rubrica.id}`}
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
