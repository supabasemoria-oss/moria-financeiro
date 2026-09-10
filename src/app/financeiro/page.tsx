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
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarFornecedorDialog } from "@/components/dialogs/criar-fornecedor-dialog"
import { CriarProjetoDialog } from "@/components/dialogs/criar-projeto-dialog"
import { CriarRubricaDialog } from "@/components/dialogs/criar-rubrica-dialog"
import { moriaService } from "@/lib/api/moria-service"
import type { Projeto, Rubrica, Fornecedor, Despesa } from "@/lib/types"
import { formatCurrency, formatDate, formatCpfCnpj } from "@/lib/utils"
import { toast } from "sonner"

function FinanceiroContent() {
  const searchParams = useSearchParams()
  const initialProjetoId = searchParams.get("projetoId") || ""

  const [despesas, setDespesas] = useState<(Despesa & { rubricas_orcamentarias?: Rubrica | null; fornecedores?: Fornecedor | null; comprovantes?: any[] })[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [rubricas, setRubricas] = useState<(Rubrica & { despesas?: Despesa[] })[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])

  const [filterProjeto, setFilterProjeto] = useState<string>(initialProjetoId || "ALL")
  const [filterFornecedor, setFilterFornecedor] = useState<string>("ALL")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")

  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openFornecedor, setOpenFornecedor] = useState(false)
  const [openProjeto, setOpenProjeto] = useState(false)
  const [openRubrica, setOpenRubrica] = useState(false)

  // Formulário de Nova Despesa
  const [formData, setFormData] = useState({
    projeto_id: initialProjetoId || "",
    rubrica_id: "",
    fornecedor_id: "",
    descricao: "",
    valor: "",
    data_despesa: new Date().toISOString().split("T")[0],
    numero_documento_fiscal: "",
    status: "PENDENTE" as "PENDENTE" | "PAGO",
  })

  async function loadInitialData() {
    try {
      setLoading(true)
      const [projData, fornData, despData] = await Promise.all([
        moriaService.getProjetos(),
        moriaService.getFornecedores(),
        moriaService.getDespesas(),
      ])
      setProjetos(projData)
      setFornecedores(fornData)
      setDespesas(despData)
      if (projData.length > 0 && !formData.projeto_id) {
        setFormData((prev) => ({ ...prev, projeto_id: projData[0].id }))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // Carregar rubricas quando o projeto do formulário muda
  useEffect(() => {
    async function fetchRubricas() {
      if (formData.projeto_id) {
        try {
          const rbs = await moriaService.getRubricas(formData.projeto_id)
          setRubricas(rbs)
        } catch (e) {
          console.error(e)
        }
      }
    }
    fetchRubricas()
  }, [formData.projeto_id])

  // Carregar lista de despesas com filtros
  async function loadDespesas() {
    try {
      setLoading(true)
      const filters: any = {}
      if (filterProjeto !== "ALL") filters.projetoId = filterProjeto
      if (filterFornecedor !== "ALL") filters.fornecedorId = filterFornecedor
      if (filterStatus !== "ALL") filters.status = filterStatus

      const data = await moriaService.getDespesas(filters)
      setDespesas(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar despesas: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDespesas()
  }, [filterProjeto, filterFornecedor, filterStatus])

  // Informações de saldo em tempo real da rubrica selecionada no modal
  const selectedRubrica = useMemo(
    () => rubricas.find((r) => r.id === formData.rubrica_id),
    [rubricas, formData.rubrica_id]
  )

  const saldoDisponivelRubrica = useMemo(() => {
    if (!selectedRubrica) return 0
    const gasto = (selectedRubrica.despesas || [])
      .filter((d) => d.status !== "CANCELADO")
      .reduce((acc, curr) => acc + Number(curr.valor), 0)
    return Number(selectedRubrica.valor_total) - gasto
  }, [selectedRubrica])

  const valorDigitado = parseFloat(formData.valor.replace(",", ".")) || 0
  const ultrapassaSaldoRubrica = selectedRubrica && valorDigitado > saldoDisponivelRubrica

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.projeto_id || !formData.rubrica_id || !formData.fornecedor_id || !formData.descricao || valorDigitado <= 0) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    if (ultrapassaSaldoRubrica) {
      toast.error(`Bloqueio MROSC: O valor excede o saldo disponível de ${formatCurrency(saldoDisponivelRubrica)} desta rubrica.`)
      return
    }

    try {
      setSaving(true)
      await moriaService.createDespesa({
        projeto_id: formData.projeto_id,
        rubrica_id: formData.rubrica_id,
        fornecedor_id: formData.fornecedor_id,
        descricao: formData.descricao,
        valor: valorDigitado,
        data_despesa: formData.data_despesa,
        numero_documento_fiscal: formData.numero_documento_fiscal || null,
        status: formData.status,
        data_pagamento: formData.status === "PAGO" ? formData.data_despesa : null,
      })
      toast.success("Despesa registrada com sucesso!")
      setFormData({
        ...formData,
        rubrica_id: "",
        fornecedor_id: "",
        descricao: "",
        valor: "",
        numero_documento_fiscal: "",
      })
      setOpen(false)
      loadDespesas()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao salvar despesa: " + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(despesa: Despesa) {
    const novoStatus = despesa.status === "PENDENTE" ? "PAGO" : "PENDENTE"
    try {
      await moriaService.updateDespesa(despesa.id, { status: novoStatus })
      toast.success(`Status atualizado para ${novoStatus === "PAGO" ? "PAGO" : "PENDENTE"}!`)
      loadDespesas()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao atualizar status: " + msg)
    }
  }

  async function handleDelete(id: string) {
    try {
      await moriaService.deleteDespesa(id)
      toast.success("Despesa excluída com sucesso.")
      loadDespesas()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao excluir: " + msg)
    }
  }

  return (
    <>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Execução Financeira & Controle de Saldos</h2>
          <p className="text-sm text-muted-foreground">
            Lançamento diário de despesas vinculadas a rubricas com abatimento automático e auditoria fiscal.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <PlusIcon className="size-4" />
                Lançar Despesa
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[580px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Novo Lançamento de Despesa</DialogTitle>
                <DialogDescription>
                  Selecione obrigatoriamente a rubrica orçamentária para controle de saldo em tempo real.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="projeto_id">Projeto / Termo *</Label>
                    <SelectComCriar
                      id="projeto_id"
                      value={formData.projeto_id}
                      onValueChange={val => setFormData(prev => ({ ...prev, projeto_id: val, rubrica_id: "" }))}
                      opcoes={projetos.map(p => ({ id: p.id, label: p.nome }))}
                      placeholder="Selecione o projeto"
                      labelCriar="Criar novo projeto"
                      onClickCriar={() => setOpenProjeto(true)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="fornecedor_id">Fornecedor / Credor *</Label>
                    <SelectComCriar
                      id="fornecedor_id"
                      value={formData.fornecedor_id}
                      onValueChange={val => setFormData(prev => ({ ...prev, fornecedor_id: val }))}
                      opcoes={fornecedores.map(f => ({ id: f.id, label: f.razao_social_nome }))}
                      placeholder="Selecione o fornecedor"
                      labelCriar="Criar novo fornecedor"
                      onClickCriar={() => setOpenFornecedor(true)}
                    />
                  </div>
                </div>

                {/* Rubrica Orçamentária Obrigatória */}
                <div className="grid gap-2">
                  <Label htmlFor="rubrica_id">Rubrica Orçamentária Vinculada *</Label>
                  <SelectComCriar
                    id="rubrica_id"
                    value={formData.rubrica_id}
                    onValueChange={val => setFormData(prev => ({ ...prev, rubrica_id: val }))}
                    opcoes={rubricas.map(r => ({ id: r.id, label: `${r.codigo_natureza_despesa} - ${r.descricao} (${formatCurrency(r.valor_total)})` }))}
                    placeholder="Selecione a rubrica de despesa..."
                    labelCriar="Criar nova rubrica"
                    onClickCriar={() => setOpenRubrica(true)}
                    disabled={!formData.projeto_id}
                  />
                </div>

                {/* Indicador de Saldo em Tempo Real */}
                {selectedRubrica && (
                  <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${ultrapassaSaldoRubrica ? "bg-destructive/10 border-destructive text-destructive font-medium" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"}`}>
                    <div>
                      <span>Saldo Disponível da Rubrica:</span>
                      <strong className="block text-sm">{formatCurrency(saldoDisponivelRubrica)}</strong>
                    </div>
                    {ultrapassaSaldoRubrica && (
                      <span className="font-semibold text-destructive">Valor excede o saldo!</span>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="descricao">Descrição Detalhada do Gasto *</Label>
                  <Input
                    id="descricao"
                    required
                    placeholder="Ex: Aquisição de resmas de papel A4 para oficinas"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="valor">Valor (R$) *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="data_despesa">Data da Despesa *</Label>
                    <Input
                      id="data_despesa"
                      type="date"
                      required
                      value={formData.data_despesa}
                      onChange={(e) => setFormData({ ...formData, data_despesa: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="numero_documento_fiscal">Nº NF / Recibo</Label>
                    <Input
                      id="numero_documento_fiscal"
                      placeholder="NF 001234"
                      value={formData.numero_documento_fiscal}
                      onChange={(e) => setFormData({ ...formData, numero_documento_fiscal: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Status Inicial</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => {
                      if (val) setFormData((prev) => ({ ...prev, status: val }))
                    }}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">Pendente (Aguardando Pagamento)</SelectItem>
                      <SelectItem value="PAGO">Pago (Efetivado na Conta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
      </div>

      {/* Barra de Filtros Rápidos */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <FilterIcon className="size-3.5" />
              Filtros:
            </div>

            <div className="w-56">
              <Select
                value={filterProjeto}
                onValueChange={(val) => {
                  if (val) setFilterProjeto(val)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filtrar por Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Projetos</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <Select
                value={filterFornecedor}
                onValueChange={(val) => {
                  if (val) setFilterFornecedor(val)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filtrar por Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Fornecedores</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.razao_social_nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Select
                value={filterStatus}
                onValueChange={(val) => {
                  if (val) setFilterStatus(val)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="PENDENTE">Pendentes</SelectItem>
                  <SelectItem value="PAGO">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Lançamentos de Despesas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Despesas e Execução Financeira</CardTitle>
          <CardDescription className="text-xs">
            Registro detalhado dos pagamentos com controle de quitação e comprovantes fiscais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando despesas...</div>
          ) : despesas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ReceiptIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhuma despesa encontrada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Lance as despesas do projeto vinculando às rubricas orçamentárias.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
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
                {despesas.map((despesa) => (
                  <TableRow key={despesa.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(despesa.data_despesa)}
                      {despesa.data_pagamento && (
                        <span className="block text-[10px] text-emerald-600">Pg: {formatDate(despesa.data_pagamento)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {despesa.rubricas_orcamentarias?.codigo_natureza_despesa || "Sem código"}
                      </div>
                      <div className="text-muted-foreground truncate max-w-[180px]">
                        {despesa.rubricas_orcamentarias?.descricao || "Rubrica"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{despesa.fornecedores?.razao_social_nome || "Fornecedor"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{formatCpfCnpj(despesa.fornecedores?.cpf_cnpj)}</div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      <div className="font-medium text-foreground truncate">{despesa.descricao}</div>
                      {despesa.numero_documento_fiscal && (
                        <div className="text-[10px] text-muted-foreground">Doc: {despesa.numero_documento_fiscal}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {formatCurrency(despesa.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(despesa)}
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
                      <Button size="sm" variant="outline" render={<Link href={`/comprovantes?despesaId=${despesa.id}`} />} className="h-7 text-xs gap-1">
                        <FileCheckIcon className="size-3" />
                        <span>{despesa.comprovantes?.length || 0} anexo(s)</span>
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        title="Excluir despesa?"
                        description="A despesa será removida da execução financeira. Esta ação não pode ser desfeita."
                        confirmLabel="Excluir"
                        onConfirm={() => handleDelete(despesa.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            aria-label="Excluir"
                          >
                            <Trash2Icon className="size-4" />
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
    </div>

    {/* Dialogs de criação rápida */}
    <CriarFornecedorDialog
      open={openFornecedor}
      onOpenChange={setOpenFornecedor}
      onCriado={novo => setFornecedores(prev => [...prev, novo])}
    />
    <CriarProjetoDialog
      open={openProjeto}
      onOpenChange={setOpenProjeto}
      onCriado={novo => setProjetos(prev => [...prev, novo as any])}
    />
    <CriarRubricaDialog
      open={openRubrica}
      onOpenChange={setOpenRubrica}
      projetoId={formData.projeto_id}
      onCriado={nova => setRubricas(prev => [...prev, nova as any])}
    />
    </>
  )
}

export default function FinanceiroPage() {
  return (
    <DashboardShell>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando módulo financeiro...</div>}>
        <FinanceiroContent />
      </Suspense>
    </DashboardShell>
  )
}
