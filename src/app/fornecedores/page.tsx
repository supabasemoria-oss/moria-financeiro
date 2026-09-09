"use client"

import { useEffect, useState } from "react"
import { UsersIcon, PlusIcon, Trash2Icon, CreditCardIcon, LandmarkIcon } from "lucide-react"
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
import { moriaService } from "@/lib/api/moria-service"
import type { Fornecedor } from "@/lib/types"
import { formatCpfCnpj } from "@/lib/utils"
import { toast } from "sonner"

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    razao_social_nome: "",
    cpf_cnpj: "",
    tipo_chave_pix: "CNPJ" as const,
    chave_pix: "",
    banco: "",
    agencia: "",
    conta: "",
  })

  async function loadData() {
    try {
      setLoading(true)
      const data = await moriaService.getFornecedores()
      setFornecedores(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar fornecedores: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.razao_social_nome || !formData.cpf_cnpj) {
      toast.error("Preencha o Nome/Razão Social e o CPF/CNPJ.")
      return
    }

    try {
      setSaving(true)
      await moriaService.createFornecedor({
        razao_social_nome: formData.razao_social_nome,
        cpf_cnpj: formData.cpf_cnpj,
        tipo_chave_pix: formData.tipo_chave_pix || null,
        chave_pix: formData.chave_pix || null,
        banco: formData.banco || null,
        agencia: formData.agencia || null,
        conta: formData.conta || null,
      })
      toast.success("Fornecedor / Prestador cadastrado com sucesso!")
      setFormData({
        razao_social_nome: "",
        cpf_cnpj: "",
        tipo_chave_pix: "CNPJ",
        chave_pix: "",
        banco: "",
        agencia: "",
        conta: "",
      })
      setOpen(false)
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao cadastrar fornecedor: " + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await moriaService.deleteFornecedor(id)
      toast.success("Fornecedor excluído com sucesso.")
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
          <h2 className="text-2xl font-bold tracking-tight">Fornecedores & Prestadores</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro de pessoas físicas e jurídicas para emissão de pagamentos e auditoria fiscal.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <PlusIcon className="size-4" />
                Novo Fornecedor / Prestador
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[520px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Cadastrar Fornecedor ou Prestador</DialogTitle>
                <DialogDescription>
                  Insira os dados cadastrais, bancários e chave Pix para os pagamentos do projeto.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="razao_social_nome">Razão Social ou Nome Completo *</Label>
                  <Input
                    id="razao_social_nome"
                    required
                    placeholder="Ex: Papelaria Central Ltda ou João da Silva"
                    value={formData.razao_social_nome}
                    onChange={(e) => setFormData({ ...formData, razao_social_nome: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cpf_cnpj">CPF ou CNPJ *</Label>
                  <Input
                    id="cpf_cnpj"
                    required
                    placeholder="00.000.000/0000-00 ou 000.000.000-00"
                    value={formData.cpf_cnpj}
                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="tipo_chave_pix">Tipo Chave Pix</Label>
                    <Select
                      value={formData.tipo_chave_pix}
                      onValueChange={(val: any) => {
                        if (val) setFormData((prev) => ({ ...prev, tipo_chave_pix: val }))
                      }}
                    >
                      <SelectTrigger id="tipo_chave_pix">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="EMAIL">E-mail</SelectItem>
                        <SelectItem value="TELEFONE">Telefone</SelectItem>
                        <SelectItem value="ALEATORIA">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid col-span-2 gap-2">
                    <Label htmlFor="chave_pix">Chave Pix</Label>
                    <Input
                      id="chave_pix"
                      placeholder="Chave Pix para transferência"
                      value={formData.chave_pix}
                      onChange={(e) => setFormData({ ...formData, chave_pix: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="banco">Banco</Label>
                    <Input
                      id="banco"
                      placeholder="Ex: BB / Itaú"
                      value={formData.banco}
                      onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="agencia">Agência</Label>
                    <Input
                      id="agencia"
                      placeholder="0000"
                      value={formData.agencia}
                      onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conta">Conta Corrente</Label>
                    <Input
                      id="conta"
                      placeholder="00000-0"
                      value={formData.conta}
                      onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {saving ? "Salvando..." : "Salvar Fornecedor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Fornecedores Homologados</CardTitle>
          <CardDescription className="text-xs">
            Lista de credores aptos a receberem pagamentos das rubricas dos projetos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando fornecedores...</div>
          ) : fornecedores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <UsersIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhum fornecedor cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Cadastre os fornecedores para vincular notas fiscais e comprovantes de pagamento.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor / Prestador</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>Chave Pix</TableHead>
                  <TableHead>Dados Bancários</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.map((forn) => (
                  <TableRow key={forn.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="size-4 text-emerald-600" />
                        <span>{forn.razao_social_nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatCpfCnpj(forn.cpf_cnpj)}</TableCell>
                    <TableCell className="text-xs">
                      {forn.chave_pix ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <CreditCardIcon className="size-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px] uppercase font-normal">{forn.tipo_chave_pix}</Badge>
                          <span>{forn.chave_pix}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {forn.banco || forn.agencia || forn.conta ? (
                        <div className="flex items-center gap-1.5">
                          <LandmarkIcon className="size-3" />
                          <span>{forn.banco || "Banco"} - Ag: {forn.agencia || "-"} / CC: {forn.conta || "-"}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        title="Excluir fornecedor?"
                        description="Despesas vinculadas a este fornecedor impedem a exclusão. Esta ação não pode ser desfeita."
                        confirmLabel="Excluir"
                        onConfirm={() => handleDelete(forn.id)}
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
    </DashboardShell>
  )
}
