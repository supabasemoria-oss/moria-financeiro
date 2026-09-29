"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  FolderKanbanIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CalculatorIcon,
  ReceiptIcon,
  CalendarIcon,
  Building2Icon,
  AlertTriangleIcon,
  PlusCircleIcon,
  SearchIcon,
  DollarSignIcon,
  ClockIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { moriaService } from "@/lib/api/moria-service"
import { diffDias } from "@/lib/parcelas"
import type { Projeto, Instituicao, TermoAditivo, StatusProjeto } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_LABELS: Record<StatusProjeto, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PLANEJAMENTO: { label: "Planejamento", variant: "secondary" },
  EM_ANDAMENTO: { label: "Em Andamento", variant: "default" },
  PRESTACAO_CONTAS: { label: "Prestação de Contas", variant: "outline" },
  CONCLUIDO: { label: "Concluído", variant: "outline" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<(Projeto & { instituicoes?: Instituicao | null })[]>([])
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([])
  const [loading, setLoading] = useState(true)
  const [termosMap, setTermosMap] = useState<Record<string, TermoAditivo[]>>({})

  // Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("TODOS")

  // Modal Novo Projeto
  const [openCreate, setOpenCreate] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    nome: "",
    instituicao_id: "",
    numero_termo: "",
    data_inicio: "",
    data_fim: "",
    valor_total_aprovado: "",
    status: "EM_ANDAMENTO" as StatusProjeto,
  })

  // Modal Nova OSC rápida (dentro do criar)
  const [openNovaInst, setOpenNovaInst] = useState(false)
  const [savingInst, setSavingInst] = useState(false)
  const [formInst, setFormInst] = useState({ razao_social: "", cnpj: "", email: "", telefone: "", endereco: "" })

  // Modal Editar Projeto
  const [openEdit, setOpenEdit] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    nome: "",
    instituicao_id: "",
    numero_termo: "",
    data_inicio: "",
    data_fim: "",
    valor_total_aprovado: "",
    status: "EM_ANDAMENTO" as StatusProjeto,
  })

  // Modal Termo Aditivo
  const [aditivoOpen, setAditivoOpen] = useState(false)
  const [aditivoProjeto, setAditivoProjeto] = useState<Projeto | null>(null)
  const [aditivoForm, setAditivoForm] = useState({ data_fim_nova: "", motivo: "" })
  const [savingAditivo, setSavingAditivo] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const [projData, instData] = await Promise.all([
        moriaService.getProjetos(),
        moriaService.getInstituicoes(),
      ])
      setProjetos(projData)
      setInstituicoes(instData)

      // Carregar termos aditivos de cada projeto
      const map: Record<string, TermoAditivo[]> = {}
      await Promise.all(
        projData.map(async (p) => {
          map[p.id] = await moriaService.getTermosAditivos(p.id)
        })
      )
      setTermosMap(map)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar projetos: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // KPIs
  const kpis = useMemo(() => {
    const total = projetos.length
    const emAndamento = projetos.filter((p) => p.status === "EM_ANDAMENTO").length
    const orcamentoTotal = projetos.reduce((acc, p) => acc + (p.valor_total_aprovado || 0), 0)
    const vencendo30d = projetos.filter((p) => {
      if (p.status === "CONCLUIDO" || p.status === "CANCELADO") return false
      const dias = diffDias(p.data_fim)
      return dias <= 30
    }).length

    return { total, emAndamento, orcamentoTotal, vencendo30d }
  }, [projetos])

  // Filtragem
  const filteredProjetos = useMemo(() => {
    return projetos.filter((proj) => {
      const matchesStatus = filterStatus === "TODOS" || proj.status === filterStatus
      if (!matchesStatus) return false

      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase().trim()
      const matchNome = proj.nome?.toLowerCase().includes(term)
      const matchTermo = proj.numero_termo?.toLowerCase().includes(term)
      const matchOsc = proj.instituicoes?.razao_social?.toLowerCase().includes(term)
      return Boolean(matchNome || matchTermo || matchOsc)
    })
  }, [projetos, searchTerm, filterStatus])

  // Criar Projeto
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (
      !createFormData.nome.trim() ||
      !createFormData.instituicao_id ||
      !createFormData.data_inicio ||
      !createFormData.data_fim ||
      !createFormData.valor_total_aprovado
    ) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    try {
      setSavingCreate(true)
      await moriaService.createProjeto({
        nome: createFormData.nome.trim(),
        instituicao_id: createFormData.instituicao_id,
        numero_termo: createFormData.numero_termo.trim() || null,
        data_inicio: createFormData.data_inicio,
        data_fim: createFormData.data_fim,
        valor_total_aprovado: parseFloat(createFormData.valor_total_aprovado.replace(",", ".")),
        status: createFormData.status,
      })
      toast.success("Projeto / Termo cadastrado com sucesso!")
      setCreateFormData({
        nome: "",
        instituicao_id: "",
        numero_termo: "",
        data_inicio: "",
        data_fim: "",
        valor_total_aprovado: "",
        status: "EM_ANDAMENTO",
      })
      setOpenCreate(false)
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao cadastrar projeto: " + msg)
    } finally {
      setSavingCreate(false)
    }
  }

  // Criar OSC Rápida
  async function handleSalvarInstituicao() {
    if (!formInst.razao_social || !formInst.cnpj) {
      toast.error("Razão social e CNPJ são obrigatórios.")
      return
    }
    setSavingInst(true)
    try {
      const nova = await moriaService.createInstituicao({
        razao_social: formInst.razao_social,
        cnpj: formInst.cnpj,
        email: formInst.email || null,
        telefone: formInst.telefone || null,
        endereco: formInst.endereco || null,
      })
      toast.success("Proponente criada com sucesso!")
      setOpenNovaInst(false)
      setFormInst({ razao_social: "", cnpj: "", email: "", telefone: "", endereco: "" })
      const instData = await moriaService.getInstituicoes()
      setInstituicoes(instData)
      if (nova?.id) {
        setCreateFormData((prev) => ({ ...prev, instituicao_id: nova.id }))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar proponente")
    } finally {
      setSavingInst(false)
    }
  }

  // Abrir Modal de Edição
  function handleOpenEdit(proj: Projeto) {
    setEditingId(proj.id)
    setEditFormData({
      nome: proj.nome || "",
      instituicao_id: proj.instituicao_id || "",
      numero_termo: proj.numero_termo || "",
      data_inicio: proj.data_inicio || "",
      data_fim: proj.data_fim || "",
      valor_total_aprovado: proj.valor_total_aprovado ? String(proj.valor_total_aprovado) : "",
      status: (proj.status as StatusProjeto) || "EM_ANDAMENTO",
    })
    setOpenEdit(true)
  }

  // Salvar Edição
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return

    if (
      !editFormData.nome.trim() ||
      !editFormData.instituicao_id ||
      !editFormData.data_inicio ||
      !editFormData.data_fim ||
      !editFormData.valor_total_aprovado
    ) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    try {
      setSavingEdit(true)
      await moriaService.updateProjeto(editingId, {
        nome: editFormData.nome.trim(),
        instituicao_id: editFormData.instituicao_id,
        numero_termo: editFormData.numero_termo.trim() || null,
        data_inicio: editFormData.data_inicio,
        data_fim: editFormData.data_fim,
        valor_total_aprovado: parseFloat(editFormData.valor_total_aprovado.replace(",", ".")),
        status: editFormData.status,
      })
      toast.success("Projeto atualizado com sucesso!")
      setOpenEdit(false)
      setEditingId(null)
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao atualizar projeto: " + msg)
    } finally {
      setSavingEdit(false)
    }
  }

  // Deletar Projeto
  async function handleDelete(id: string) {
    try {
      await moriaService.deleteProjeto(id)
      toast.success("Projeto excluído com sucesso.")
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao excluir: " + msg)
    }
  }

  // Registrar Termo Aditivo
  async function handleRegistrarAditivo() {
    if (!aditivoProjeto || !aditivoForm.data_fim_nova) return
    setSavingAditivo(true)
    try {
      const termos = termosMap[aditivoProjeto.id] ?? []
      await moriaService.createTermoAditivo({
        projeto_id: aditivoProjeto.id,
        numero_aditivo: termos.length + 1,
        data_fim_anterior: aditivoProjeto.data_fim,
        data_fim_nova: aditivoForm.data_fim_nova,
        motivo: aditivoForm.motivo || undefined,
      })
      toast.success("Termo aditivo registrado!")
      setAditivoOpen(false)
      setAditivoProjeto(null)
      setAditivoForm({ data_fim_nova: "", motivo: "" })
      await loadData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar aditivo")
    } finally {
      setSavingAditivo(false)
    }
  }

  return (
    <DashboardShell>
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projetos & Termos de Parceria</h2>
          <p className="text-sm text-muted-foreground">
            Gestão de termos de fomento, colaboração e acordos de cooperação (MROSC - Lei 13.019/2014).
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <PlusIcon className="size-4" />
                Novo Projeto / Termo
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[550px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Projeto MROSC</DialogTitle>
                <DialogDescription>
                  Defina a instituição proponente, vigência do convênio e teto orçamentário aprovado.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid gap-2">
                  <Label htmlFor="instituicao_id">Instituição Proponente (OSC) *</Label>
                  <Select
                    value={createFormData.instituicao_id}
                    onValueChange={(val) => {
                      if (val) setCreateFormData((prev) => ({ ...prev, instituicao_id: val }))
                    }}
                  >
                    <SelectTrigger id="instituicao_id">
                      <SelectValue placeholder="Selecione a OSC vinculada..." />
                    </SelectTrigger>
                    <SelectContent>
                      {instituicoes.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.razao_social} ({i.cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!openNovaInst ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setOpenNovaInst(true)}
                        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-500 w-fit"
                      >
                        <PlusCircleIcon className="size-3.5" />
                        {instituicoes.length === 0 ? "Criar aqui (rápido)" : "Cadastrar nova proponente"}
                      </button>
                      {instituicoes.length === 0 && (
                        <Link
                          href="/instituicoes"
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                        >
                          ou ir para o cadastro completo
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 grid gap-3">
                      <p className="text-xs font-medium text-emerald-700">Nova Instituição Proponente</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 grid gap-1">
                          <Label className="text-xs">Razão Social *</Label>
                          <Input
                            placeholder="Ex: Instituto Esperança e Vida"
                            value={formInst.razao_social}
                            onChange={(e) => setFormInst((f) => ({ ...f, razao_social: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">CNPJ *</Label>
                          <Input
                            placeholder="00.000.000/0000-00"
                            value={formInst.cnpj}
                            onChange={(e) => setFormInst((f) => ({ ...f, cnpj: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            placeholder="(11) 99999-9999"
                            value={formInst.telefone}
                            onChange={(e) => setFormInst((f) => ({ ...f, telefone: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-2 grid gap-1">
                          <Label className="text-xs">E-mail</Label>
                          <Input
                            placeholder="contato@osc.org.br"
                            value={formInst.email}
                            onChange={(e) => setFormInst((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOpenNovaInst(false)}
                          className="text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingInst}
                          onClick={handleSalvarInstituicao}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                        >
                          {savingInst ? "Salvando..." : "Salvar Proponente"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome do Projeto / Parceria *</Label>
                  <Input
                    id="nome"
                    required
                    placeholder="Ex: Projeto Viva Criança 2026"
                    value={createFormData.nome}
                    onChange={(e) => setCreateFormData({ ...createFormData, nome: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="numero_termo">Número do Termo</Label>
                    <Input
                      id="numero_termo"
                      placeholder="Ex: TF 001/2026"
                      value={createFormData.numero_termo}
                      onChange={(e) => setCreateFormData({ ...createFormData, numero_termo: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="valor_total_aprovado">Teto Orçamentário (R$) *</Label>
                    <Input
                      id="valor_total_aprovado"
                      required
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={createFormData.valor_total_aprovado}
                      onChange={(e) => setCreateFormData({ ...createFormData, valor_total_aprovado: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="data_inicio">Início de Vigência *</Label>
                    <Input
                      id="data_inicio"
                      required
                      type="date"
                      value={createFormData.data_inicio}
                      onChange={(e) => setCreateFormData({ ...createFormData, data_inicio: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="data_fim">Fim de Vigência *</Label>
                    <Input
                      id="data_fim"
                      required
                      type="date"
                      value={createFormData.data_fim}
                      onChange={(e) => setCreateFormData({ ...createFormData, data_fim: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Status do Projeto</Label>
                  <Select
                    value={createFormData.status}
                    onValueChange={(val: any) => {
                      if (val) setCreateFormData((prev) => ({ ...prev, status: val }))
                    }}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLANEJAMENTO">Planejamento</SelectItem>
                      <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                      <SelectItem value="PRESTACAO_CONTAS">Prestação de Contas</SelectItem>
                      <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                      <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {savingCreate ? "Salvando..." : "Salvar Projeto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de KPI */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Projetos</CardTitle>
            <FolderKanbanIcon className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Termos registrados no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <ClockIcon className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.emAndamento}</div>
            <p className="text-xs text-muted-foreground mt-1">Parcerias em fase de execução</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orçamento Aprovado</CardTitle>
            <DollarSignIcon className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.orcamentoTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Teto total sob gestão MROSC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vigência Crítica (≤30d)</CardTitle>
            <AlertTriangleIcon className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.vencendo30d}</div>
            <p className="text-xs text-muted-foreground mt-1">Projetos próximos do término</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Projetos com Busca e Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Termos e Projetos</CardTitle>
              <CardDescription className="text-xs">
                Lista de parcerias com teto orçamentário aprovado, vigência e navegação modular.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar projeto, termo ou OSC..."
                  className="pl-8 h-9 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "TODOS")}>
                <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os Status</SelectItem>
                  <SelectItem value="PLANEJAMENTO">Planejamento</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                  <SelectItem value="PRESTACAO_CONTAS">Prestação de Contas</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando projetos...</div>
          ) : filteredProjetos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FolderKanbanIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                {searchTerm || filterStatus !== "TODOS"
                  ? "Nenhum projeto encontrado com os filtros aplicados"
                  : "Nenhum projeto cadastrado"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {searchTerm || filterStatus !== "TODOS"
                  ? "Tente ajustar os critérios de busca."
                  : "Cadastre um projeto para estruturar o plano de trabalho e lançar rubricas."}
              </p>
              {(searchTerm || filterStatus !== "TODOS") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("TODOS")
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto & Termo</TableHead>
                  <TableHead>OSC / Instituição</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Teto Aprovado</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Módulos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjetos.map((proj) => {
                  const statusInfo = STATUS_LABELS[proj.status as StatusProjeto] || {
                    label: proj.status,
                    variant: "outline",
                  }

                  return (
                    <TableRow key={proj.id}>
                      <TableCell className="font-medium">
                        <div className="font-semibold text-foreground">{proj.nome}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {proj.numero_termo || "Sem número de termo"}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Building2Icon className="size-3 text-emerald-600 shrink-0" />
                          <span>{proj.instituicoes?.razao_social || "Instituição não vinculada"}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {(() => {
                          const dias = diffDias(proj.data_fim)
                          const alerta =
                            dias <= 30 && proj.status !== "CONCLUIDO" && proj.status !== "CANCELADO"
                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon className="size-3 shrink-0" />
                                <span>
                                  {formatDate(proj.data_inicio)} até {formatDate(proj.data_fim)}
                                </span>
                              </div>
                              {alerta && (
                                <Badge variant="destructive" className="text-xs w-fit gap-1">
                                  <AlertTriangleIcon className="size-3" />
                                  {dias <= 0 ? "Expirado" : `${dias}d restantes`}
                                </Badge>
                              )}
                              {(termosMap[proj.id]?.length ?? 0) > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {termosMap[proj.id].length} aditivo(s)
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </TableCell>

                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(proj.valor_total_aprovado)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant={statusInfo.variant} className="text-xs font-normal">
                          {statusInfo.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            render={<Link href={`/orcamento?projetoId=${proj.id}`} />}
                            className="h-7 text-xs gap-1"
                          >
                            <CalculatorIcon className="size-3" />
                            Orçamento
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            render={<Link href={`/execucao?projetoId=${proj.id}`} />}
                            className="h-7 text-xs gap-1"
                          >
                            <ReceiptIcon className="size-3" />
                            Execução
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              setAditivoProjeto(proj)
                              setAditivoForm({ data_fim_nova: "", motivo: "" })
                              setAditivoOpen(true)
                            }}
                          >
                            <PlusCircleIcon className="size-3" />
                            Aditivo
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label={`Editar ${proj.nome}`}
                            onClick={() => handleOpenEdit(proj)}
                          >
                            <PencilIcon className="size-4" />
                          </Button>

                          <ConfirmDialog
                            title="Excluir projeto?"
                            description="Todas as rubricas, despesas e comprovantes vinculados serão removidos. Esta ação não pode ser desfeita."
                            confirmLabel="Excluir"
                            onConfirm={() => handleDelete(proj.id)}
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

      {/* Modal Editar Projeto */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-[550px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Editar Projeto MROSC</DialogTitle>
              <DialogDescription>
                Atualize os dados cadastrais, teto orçamentário aprovado ou status da parceria.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid gap-2">
                <Label htmlFor="edit_instituicao_id">Instituição Proponente (OSC) *</Label>
                <Select
                  value={editFormData.instituicao_id}
                  onValueChange={(val) => {
                    if (val) setEditFormData((prev) => ({ ...prev, instituicao_id: val }))
                  }}
                >
                  <SelectTrigger id="edit_instituicao_id">
                    <SelectValue placeholder="Selecione a OSC vinculada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instituicoes.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.razao_social} ({i.cnpj})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_nome">Nome do Projeto / Parceria *</Label>
                <Input
                  id="edit_nome"
                  required
                  placeholder="Ex: Projeto Viva Criança 2026"
                  value={editFormData.nome}
                  onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit_numero_termo">Número do Termo</Label>
                  <Input
                    id="edit_numero_termo"
                    placeholder="Ex: TF 001/2026"
                    value={editFormData.numero_termo}
                    onChange={(e) => setEditFormData({ ...editFormData, numero_termo: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_valor_total_aprovado">Teto Orçamentário (R$) *</Label>
                  <Input
                    id="edit_valor_total_aprovado"
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={editFormData.valor_total_aprovado}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, valor_total_aprovado: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit_data_inicio">Início de Vigência *</Label>
                  <Input
                    id="edit_data_inicio"
                    required
                    type="date"
                    value={editFormData.data_inicio}
                    onChange={(e) => setEditFormData({ ...editFormData, data_inicio: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_data_fim">Fim de Vigência *</Label>
                  <Input
                    id="edit_data_fim"
                    required
                    type="date"
                    value={editFormData.data_fim}
                    onChange={(e) => setEditFormData({ ...editFormData, data_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_status">Status do Projeto</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(val: any) => {
                    if (val) setEditFormData((prev) => ({ ...prev, status: val }))
                  }}
                >
                  <SelectTrigger id="edit_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANEJAMENTO">Planejamento</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                    <SelectItem value="PRESTACAO_CONTAS">Prestação de Contas</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenEdit(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEdit} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {savingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Termo Aditivo */}
      <Dialog open={aditivoOpen} onOpenChange={(o) => !o && setAditivoOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Termo Aditivo</DialogTitle>
            <DialogDescription>
              {aditivoProjeto?.nome} — vigência atual até {aditivoProjeto ? formatDate(aditivoProjeto.data_fim) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="data_fim_nova">Nova Data de Fim de Vigência *</Label>
              <Input
                id="data_fim_nova"
                type="date"
                value={aditivoForm.data_fim_nova}
                onChange={(e) => setAditivoForm((f) => ({ ...f, data_fim_nova: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="motivo">Motivo / Justificativa</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo do aditivo..."
                value={aditivoForm.motivo}
                onChange={(e) => setAditivoForm((f) => ({ ...f, motivo: e.target.value }))}
              />
            </div>
            {(termosMap[aditivoProjeto?.id ?? ""]?.length ?? 0) > 0 && (
              <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                <p className="font-medium">Histórico de aditivos:</p>
                {termosMap[aditivoProjeto!.id].map((t) => (
                  <p key={t.id} className="text-muted-foreground">
                    Aditivo {t.numero_aditivo}: até {formatDate(t.data_fim_nova)}
                    {t.motivo ? ` — ${t.motivo}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAditivoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarAditivo}
              disabled={savingAditivo || !aditivoForm.data_fim_nova}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {savingAditivo ? "Salvando..." : "Registrar Aditivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
