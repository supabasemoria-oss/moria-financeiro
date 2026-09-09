"use client"

import { useEffect, useState } from "react"
import { Building2Icon, PlusIcon, Trash2Icon, MailIcon, PhoneIcon, MapPinIcon } from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { moriaService } from "@/lib/api/moria-service"
import type { Instituicao } from "@/lib/types"
import { formatCpfCnpj } from "@/lib/utils"
import { toast } from "sonner"

export default function InstituicoesPage() {
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    razao_social: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
  })

  async function loadData() {
    try {
      setLoading(true)
      const data = await moriaService.getInstituicoes()
      setInstituicoes(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar instituições: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.razao_social || !formData.cnpj) {
      toast.error("Preencha a Razão Social e o CNPJ.")
      return
    }

    try {
      setSaving(true)
      await moriaService.createInstituicao(formData)
      toast.success("Instituição (OSC) cadastrada com sucesso!")
      setFormData({ razao_social: "", cnpj: "", email: "", telefone: "", endereco: "" })
      setOpen(false)
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao cadastrar instituição: " + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await moriaService.deleteInstituicao(id)
      toast.success("Instituição excluída com sucesso.")
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
          <h2 className="text-2xl font-bold tracking-tight">Instituições (OSCs / ONGs)</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro base das organizações da sociedade civil atendidas pela Moriá.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <PlusIcon className="size-4" />
                Nova OSC / Instituição
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Instituição (OSC)</DialogTitle>
                <DialogDescription>
                  Insira os dados cadastrais da organização para vincular aos projetos MROSC.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="razao_social">Razão Social / Nome da Entidade *</Label>
                  <Input
                    id="razao_social"
                    required
                    placeholder="Ex: Instituto Esperança e Vida"
                    value={formData.razao_social}
                    onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    required
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail Institucional</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contato@osc.org.br"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      placeholder="(11) 99999-9999"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="endereco">Endereço Completo</Label>
                  <Input
                    id="endereco"
                    placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {saving ? "Salvando..." : "Salvar Instituição"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">OSCs Cadastradas</CardTitle>
          <CardDescription className="text-xs">
            Lista completa de entidades parceiras sob gestão do MROSC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando dados...</div>
          ) : instituicoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Building2Icon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhuma instituição cadastrada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Clique no botão acima para adicionar a primeira OSC parceira.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instituicoes.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2Icon className="size-4 text-emerald-600" />
                        <span>{inst.razao_social}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatCpfCnpj(inst.cnpj)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inst.email && (
                        <div className="flex items-center gap-1.5">
                          <MailIcon className="size-3" />
                          <span>{inst.email}</span>
                        </div>
                      )}
                      {inst.telefone && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <PhoneIcon className="size-3" />
                          <span>{inst.telefone}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {inst.endereco ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPinIcon className="size-3 shrink-0" />
                          <span className="truncate">{inst.endereco}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                        description="Todos os projetos vinculados serão removidos. Esta ação não pode ser desfeita."
                        confirmLabel="Excluir"
                        onConfirm={() => handleDelete(inst.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
