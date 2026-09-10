"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FolderKanbanIcon, PlusIcon, Trash2Icon, CalculatorIcon, ReceiptIcon, CalendarIcon, Building2Icon, AlertTriangleIcon, PlusCircleIcon } from "lucide-react"
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
import type { Projeto, Instituicao, TermoAditivo } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<(Projeto & { instituicoes?: Instituicao | null })[]>([])
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aditivoOpen, setAditivoOpen] = useState(false)
  const [aditivoProjeto, setAditivoProjeto] = useState<Projeto | null>(null)
  const [aditivoForm, setAditivoForm] = useState({ data_fim_nova: "", motivo: "" })
  const [termosMap, setTermosMap] = useState<Record<string, TermoAditivo[]>>({})

  const [formData, setFormData] = useState({
    nome: "",
    instituicao_id: "",
    numero_termo: "",
    data_inicio: "",
    data_fim: "",
    valor_total_aprovado: "",
    status: "EM_ANDAMENTO" as const,
  })

  const [openNovaInst, setOpenNovaInst] = useState(false)
  const [savingInst, setSavingInst] = useState(false)
  const [formInst, setFormInst] = useState({ razao_social: "", cnpj: "", email: "", telefone: "", endereco: "" })

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
      await Promise.all(projData.map(async (p) => {
        map[p.id] = await moriaService.getTermosAditivos(p.id)
      }))
      setTermosMap(map)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar projetos: " + msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegistrarAditivo() {
    if (!aditivoProjeto || !aditivoForm.data_fim_nova) return
    setSaving(true)
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
      setSaving(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
      if (nova?.id) setFormData((prev) => ({ ...prev, instituicao_id: nova.id }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar proponente")
    } finally {
      setSavingInst(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nome || !formData.instituicao_id || !formData.data_inicio || !formData.data_fim || !formData.valor_total_aprovado) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    try {
      setSaving(true)
      await moriaService.createProjeto({
        nome: formData.nome,
        instituicao_id: formData.instituicao_id,
        numero_termo: formData.numero_termo || null,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        valor_total_aprovado: parseFloat(formData.valor_total_aprovado.replace(",", ".")),
        status: formData.status,
      })
      toast.success("Projeto / Termo cadastrado com sucesso!")
      setFormData({
        nome: "",
        instituicao_id: "",
        numero_termo: "",
        data_inicio: "",
        data_fim: "",
        valor_total_aprovado: "",
        status: "EM_ANDAMENTO",
      })
      setOpen(false)
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao cadastrar projeto: " + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await moriaService.deleteProjeto(id)
      toast.success("Projeto excluído com sucesso.")
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao excluir: " + msg)
    }
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projetos & Termos de Parceria</h2>
          <p className="text-sm text-muted-foreground">
            Gestão de termos de fomento, colaboração e acordos de cooperação (MROSC).
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <PlusIcon className="size-4" />
                Novo Projeto / Termo
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[550px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Projeto MROSC</DialogTitle>
                <DialogDescription>
                  Defina a instituição proponente, vigência do convênio e teto orçamentário aprovado.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="instituicao_id">Instituição Proponente (OSC) *</Label>
                  <Select
                    value={formData.instituicao_id}
                    onValueChange={(val) => {
                      if (val) setFormData((prev) => ({ ...prev, instituicao_id: val }))
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

                  {/* Botão de criar nova proponente */}
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
                            className="h-8 text-sm"
                            placeholder="Ex: Instituto Esperança Viva"
                            value={formInst.razao_social}
                            onChange={(e) => setFormInst((p) => ({ ...p, razao_social: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">CNPJ *</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="00.000.000/0001-00"
                            value={formInst.cnpj}
                            onChange={(e) => setFormInst((p) => ({ ...p, cnpj: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="(00) 0000-0000"
                            value={formInst.telefone}
                            onChange={(e) => setFormInst((p) => ({ ...p, telefone: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-2 grid gap-1">
                          <Label className="text-xs">E-mail</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="contato@instituicao.org.br"
                            value={formInst.email}
                            onChange={(e) => setFormInst((p) => ({ ...p, email: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpenNovaInst(false)}>
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500" onClick={handleSalvarInstituicao} disabled={savingInst}>
                          {savingInst ? "Salvando..." : "Salvar proponente"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome do Projeto *</Label>
                  <Input
                    id="nome"
                    required
                    placeholder="Ex: Projeto Inclusão Digital 2026"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="numero_termo">Nº Termo / Convênio</Label>
                    <Input
                      id="numero_termo"
                      placeholder="Ex: TF nº 012/2026"
                      value={formData.numero_termo}
                      onChange={(e) => setFormData({ ...formData, numero_termo: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="valor_total_aprovado">Valor Total Aprovado (R$) *</Label>
                    <Input
                      id="valor_total_aprovado"
                      required
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.valor_total_aprovado}
                      onChange={(e) => setFormData({ ...formData, valor_total_aprovado: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="data_inicio">Data Início de Vigência *</Label>
                    <Input
                      id="data_inicio"
                      type="date"
                      required
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="data_fim">Data Fim de Vigência *</Label>
                    <Input
                      id="data_fim"
                      type="date"
                      required
                      value={formData.data_fim}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Status do Projeto</Label>
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
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {saving ? "Salvando..." : "Salvar Projeto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Termos e Projetos Ativos</CardTitle>
          <CardDescription className="text-xs">
            Lista de parcerias com teto orçamentário aprovado e período de execução.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando projetos...</div>
          ) : projetos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FolderKanbanIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhum projeto cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Cadastre um projeto para estruturar o plano de trabalho e lançar rubricas.
              </p>
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
                {projetos.map((proj) => (
                  <TableRow key={proj.id}>
                    <TableCell className="font-medium">
                      <div className="font-semibold text-foreground">{proj.nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {proj.numero_termo || "Sem número de termo"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Building2Icon className="size-3 text-emerald-600" />
                        <span>{proj.instituicoes?.razao_social || "Instituição não vinculada"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(() => {
                        const dias = diffDias(proj.data_fim)
                        const alerta = dias <= 30 && proj.status !== "CONCLUIDO" && proj.status !== "CANCELADO"
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="size-3" />
                              <span>{formatDate(proj.data_inicio)} até {formatDate(proj.data_fim)}</span>
                            </div>
                            {alerta && (
                              <Badge variant="destructive" className="text-xs w-fit gap-1">
                                <AlertTriangleIcon className="size-3" />
                                {dias <= 0 ? "Expirado" : `${dias}d restantes`}
                              </Badge>
                            )}
                            {(termosMap[proj.id]?.length ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground">{termosMap[proj.id].length} aditivo(s)</span>
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(proj.valor_total_aprovado)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs font-normal">
                        {proj.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" render={<Link href={`/orcamento?projetoId=${proj.id}`} />} className="h-7 text-xs gap-1">
                          <CalculatorIcon className="size-3" />
                          Orçamento
                        </Button>
                        <Button size="sm" variant="outline" render={<Link href={`/financeiro?projetoId=${proj.id}`} />} className="h-7 text-xs gap-1">
                          <ReceiptIcon className="size-3" />
                          Despesas
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <Button variant="outline" onClick={() => setAditivoOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleRegistrarAditivo}
              disabled={saving || !aditivoForm.data_fim_nova}
            >
              {saving ? "Salvando..." : "Registrar Aditivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
