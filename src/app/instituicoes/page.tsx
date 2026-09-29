"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  Building2Icon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  SearchIcon,
  FolderKanbanIcon,
  DollarSignIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { mroscService } from "@/lib/api/mrosc-service"
import type { Instituicao, ProjetoComInstituicao } from "@/lib/types"
import { formatCpfCnpj, formatCurrency } from "@/lib/utils"
import { maskCnpj, maskTelefone } from "@/lib/masks"
import { toast } from "sonner"

export default function InstituicoesPage() {
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([])
  const [projetos, setProjetos] = useState<ProjetoComInstituicao[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Modal Novo
  const [openCreate, setOpenCreate] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    razao_social: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
  })

  // Modal Editar
  const [openEdit, setOpenEdit] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    razao_social: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
  })

  async function loadData() {
    try {
      setLoading(true)
      const [instData, projData] = await Promise.all([
        mroscService.getInstituicoes(),
        mroscService.getProjetos(),
      ])
      setInstituicoes(instData)
      setProjetos(projData)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem
  const filteredInstituicoes = useMemo(() => {
    if (!searchTerm.trim()) return instituicoes
    const term = searchTerm.toLowerCase().trim()
    return instituicoes.filter((inst) => {
      const nomeMatch = inst.razao_social?.toLowerCase().includes(term)
      const cnpjMatch = inst.cnpj?.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
      const emailMatch = inst.email?.toLowerCase().includes(term)
      return Boolean(nomeMatch || cnpjMatch || emailMatch)
    })
  }, [instituicoes, searchTerm])

  // KPIs
  const kpis = useMemo(() => {
    const totalOscs = instituicoes.length
    const totalProjetos = projetos.length
    const orcamentoTotal = projetos.reduce((acc, p) => acc + (p.valor_total_aprovado || 0), 0)
    return { totalOscs, totalProjetos, orcamentoTotal }
  }, [instituicoes, projetos])

  // Handlers Create
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createFormData.razao_social.trim() || !createFormData.cnpj.trim()) {
      toast.error("Preencha a Razão Social e o CNPJ.")
      return
    }

    try {
      setSavingCreate(true)
      await mroscService.createInstituicao({
        razao_social: createFormData.razao_social.trim(),
        cnpj: createFormData.cnpj.trim(),
        email: createFormData.email.trim() || null,
        telefone: createFormData.telefone.trim() || null,
        endereco: createFormData.endereco.trim() || null,
      })
      toast.success("Instituição (OSC) cadastrada com sucesso!")
      setCreateFormData({ razao_social: "", cnpj: "", email: "", telefone: "", endereco: "" })
      setOpenCreate(false)
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao cadastrar instituição: " + msg)
    } finally {
      setSavingCreate(false)
    }
  }

  // Handlers Edit
  function handleOpenEdit(inst: Instituicao) {
    setEditingId(inst.id)
    setEditFormData({
      razao_social: inst.razao_social || "",
      cnpj: inst.cnpj ? maskCnpj(inst.cnpj) : "",
      email: inst.email || "",
      telefone: inst.telefone ? maskTelefone(inst.telefone) : "",
      endereco: inst.endereco || "",
    })
    setOpenEdit(true)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return

    if (!editFormData.razao_social.trim() || !editFormData.cnpj.trim()) {
      toast.error("Preencha a Razão Social e o CNPJ.")
      return
    }

    try {
      setSavingEdit(true)
      await mroscService.updateInstituicao(editingId, {
        razao_social: editFormData.razao_social.trim(),
        cnpj: editFormData.cnpj.trim(),
        email: editFormData.email.trim() || null,
        telefone: editFormData.telefone.trim() || null,
        endereco: editFormData.endereco.trim() || null,
      })
      toast.success("Instituição atualizada com sucesso!")
      setOpenEdit(false)
      setEditingId(null)
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao atualizar: " + msg)
    } finally {
      setSavingEdit(false)
    }
  }

  // Handler Delete
  async function handleDelete(id: string) {
    try {
      await mroscService.deleteInstituicao(id)
      toast.success("Instituição excluída com sucesso.")
      await loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao excluir: " + msg)
    }
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Instituições (OSCs / Entidades Parceiras)</h2>
          <p className="text-sm text-muted-foreground">
            Gestão cadastral das organizações da sociedade civil atendidas pelo Moriá no MROSC.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <PlusIcon className="size-4" />
                Nova OSC / Instituição
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Instituição (OSC)</DialogTitle>
                <DialogDescription>
                  Insira os dados cadastrais da organização para vincular aos projetos MROSC.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="create_razao_social">Razão Social / Nome da Entidade *</Label>
                  <Input
                    id="create_razao_social"
                    required
                    placeholder="Ex: Instituto Esperança e Vida"
                    value={createFormData.razao_social}
                    onChange={(e) => setCreateFormData({ ...createFormData, razao_social: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="create_cnpj">CNPJ *</Label>
                  <Input
                    id="create_cnpj"
                    required
                    placeholder="00.000.000/0000-00"
                    value={createFormData.cnpj}
                    onChange={(e) => setCreateFormData({ ...createFormData, cnpj: maskCnpj(e.target.value) })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="create_email">E-mail Institucional</Label>
                    <Input
                      id="create_email"
                      type="email"
                      placeholder="contato@osc.org.br"
                      value={createFormData.email}
                      onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="create_telefone">Telefone</Label>
                    <Input
                      id="create_telefone"
                      placeholder="(11) 99999-9999"
                      value={createFormData.telefone}
                      onChange={(e) => setCreateFormData({ ...createFormData, telefone: maskTelefone(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="create_endereco">Endereço Completo</Label>
                  <Input
                    id="create_endereco"
                    placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                    value={createFormData.endereco}
                    onChange={(e) => setCreateFormData({ ...createFormData, endereco: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {savingCreate ? "Salvando..." : "Salvar Instituição"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de KPI */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OSCs Cadastradas</CardTitle>
            <Building2Icon className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalOscs}</div>
            <p className="text-xs text-muted-foreground mt-1">Entidades parceiras registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projetos Vinculados</CardTitle>
            <FolderKanbanIcon className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalProjetos}</div>
            <p className="text-xs text-muted-foreground mt-1">Termos de fomento / parceria ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recursos MROSC Gerenciados</CardTitle>
            <DollarSignIcon className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.orcamentoTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Orçamento global sob gestão</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela e Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">OSCs Cadastradas</CardTitle>
              <CardDescription className="text-xs">
                Lista de entidades com gestão completa de dados e parcerias.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar OSC ou CNPJ..."
                className="pl-8 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando dados...</div>
          ) : filteredInstituicoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Building2Icon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                {searchTerm ? "Nenhuma instituição encontrada com o filtro aplicado" : "Nenhuma instituição cadastrada"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {searchTerm ? "Tente outro termo de busca." : "Clique no botão acima para adicionar a primeira OSC parceira."}
              </p>
              {searchTerm && (
                <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Projetos MROSC</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstituicoes.map((inst) => {
                  const instProjetos = projetos.filter((p) => p.instituicao_id === inst.id)

                  return (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2Icon className="size-4 text-emerald-600 shrink-0" />
                          <span>{inst.razao_social}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatCpfCnpj(inst.cnpj)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inst.email && (
                          <div className="flex items-center gap-1.5">
                            <MailIcon className="size-3 shrink-0" />
                            <span>{inst.email}</span>
                          </div>
                        )}
                        {inst.telefone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <PhoneIcon className="size-3 shrink-0" />
                            <span>{inst.telefone}</span>
                          </div>
                        )}
                        {!inst.email && !inst.telefone && "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {inst.endereco ? (
                          <div className="flex items-center gap-1.5 truncate" title={inst.endereco}>
                            <MapPinIcon className="size-3 shrink-0" />
                            <span className="truncate">{inst.endereco}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {instProjetos.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="font-normal text-xs gap-1">
                              <FolderKanbanIcon className="size-3 text-blue-600" />
                              {instProjetos.length} {instProjetos.length === 1 ? "projeto" : "projetos"}
                            </Badge>
                            <Link
                              href="/projetos"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Ver projetos"
                            >
                              <ExternalLinkIcon className="size-3.5" />
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label={`Editar ${inst.razao_social}`}
                            onClick={() => handleOpenEdit(inst)}
                          >
                            <PencilIcon className="size-4" />
                          </Button>

                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                aria-label={`Excluir ${inst.razao_social}`}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            }
                            title="Excluir instituição?"
                            description="Todos os projetos e dados vinculados a esta instituição poderão ser afetados. Esta ação não pode ser desfeita."
                            confirmLabel="Excluir"
                            onConfirm={() => handleDelete(inst.id)}
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

      {/* Dialog Editar */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Editar Instituição (OSC)</DialogTitle>
              <DialogDescription>
                Atualize as informações cadastrais da organização parceira.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_razao_social">Razão Social / Nome da Entidade *</Label>
                <Input
                  id="edit_razao_social"
                  required
                  placeholder="Ex: Instituto Esperança e Vida"
                  value={editFormData.razao_social}
                  onChange={(e) => setEditFormData({ ...editFormData, razao_social: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_cnpj">CNPJ *</Label>
                <Input
                  id="edit_cnpj"
                  required
                  placeholder="00.000.000/0000-00"
                  value={editFormData.cnpj}
                  onChange={(e) => setEditFormData({ ...editFormData, cnpj: maskCnpj(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit_email">E-mail Institucional</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    placeholder="contato@osc.org.br"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_telefone">Telefone</Label>
                  <Input
                    id="edit_telefone"
                    placeholder="(11) 99999-9999"
                    value={editFormData.telefone}
                    onChange={(e) => setEditFormData({ ...editFormData, telefone: maskTelefone(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_endereco">Endereço Completo</Label>
                <Input
                  id="edit_endereco"
                  placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                  value={editFormData.endereco}
                  onChange={(e) => setEditFormData({ ...editFormData, endereco: e.target.value })}
                />
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
    </DashboardShell>
  )
}
