"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  CalculatorIcon,
  PlusIcon,
  Trash2Icon,
  AlertTriangleIcon,
  UploadIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarProjetoDialog } from "@/components/dialogs/criar-projeto-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { moriaService } from "@/lib/api/moria-service"
import type { Projeto, Rubrica, Despesa } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

function OrcamentoContent() {
  const searchParams = useSearchParams()
  const initialProjetoId = searchParams.get("projetoId") || "proj-001"

  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>(initialProjetoId)
  const [rubricas, setRubricas] = useState<(Rubrica & { despesas?: Despesa[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openProjeto, setOpenProjeto] = useState(false)

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
      const ultrapassaEm = (totalOrcadoRubricas + formTotalPrevisto) - tetoAprovadoProjeto
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
              onValueChange={val => { if (val) handleProjectChange(val) }}
              opcoes={projetos.map(p => ({ id: p.id, label: p.nome }))}
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
                          <SelectValue />
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
                        setFormData((f) => ({ ...f, tipo_pagamento: (v ?? "UNICO") as "UNICO" | "RECORRENTE" | "PARCELADO" }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Planilha de Rubricas Orçamentárias</CardTitle>
          <CardDescription className="text-xs">
            Itens previstos no plano de trabalho com controle de limites e códigos de natureza de despesa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando rubricas do projeto...</div>
          ) : !selectedProjetoId ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Selecione um projeto acima.</div>
          ) : rubricas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CalculatorIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhuma rubrica cadastrada neste projeto</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Adicione os itens e natureza de despesa para iniciar os lançamentos financeiros.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Natureza</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição da Rubrica</TableHead>
                  <TableHead className="text-center">Unid.</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor Unitário</TableHead>
                  <TableHead className="text-right">Valor Total Previsto</TableHead>
                  <TableHead className="text-right">Executado (Pago)</TableHead>
                  <TableHead className="text-right">Saldo Disponível</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubricas.map((rubrica) => {
                  const totalGasto = (rubrica.despesas || [])
                    .filter((d) => d.status === "PAGO")
                    .reduce((acc, curr) => acc + Number(curr.valor), 0)
                  const saldoItem = Number(rubrica.valor_total) - totalGasto
                  const percentGasto = Number(rubrica.valor_total) > 0 ? (totalGasto / Number(rubrica.valor_total)) * 100 : 0

                  return (
                    <TableRow key={rubrica.id}>
                      <TableCell className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {rubrica.codigo_natureza_despesa}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-normal">
                          {rubrica.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[240px] truncate">
                        {rubrica.descricao}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {rubrica.unidade}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {rubrica.quantidade}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(rubrica.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatCurrency(rubrica.valor_total)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {formatCurrency(totalGasto)}
                        <span className="block text-[10px] text-muted-foreground">({percentGasto.toFixed(1)}%)</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(saldoItem)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          title="Remover rubrica?"
                          description="A rubrica será removida do plano de trabalho. Esta ação não pode ser desfeita."
                          confirmLabel="Excluir"
                          onConfirm={() => handleDelete(rubrica.id)}
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
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    <CriarProjetoDialog
      open={openProjeto}
      onOpenChange={setOpenProjeto}
      onCriado={novo => {
        setProjetos(prev => [...prev, novo as any])
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
