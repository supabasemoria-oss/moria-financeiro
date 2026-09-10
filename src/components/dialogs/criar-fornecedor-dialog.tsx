"use client"
import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { moriaService } from "@/lib/api/moria-service"
import type { Fornecedor } from "@/lib/types"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCriado?: (f: Fornecedor) => void
}

const VAZIO = { razao_social_nome: "", cpf_cnpj: "", tipo_chave_pix: "CNPJ" as const, chave_pix: "", banco: "", agencia: "", conta: "" }

export function CriarFornecedorDialog({ open, onOpenChange, onCriado }: Props) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState(VAZIO)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.razao_social_nome || !form.cpf_cnpj) { toast.error("Preencha Nome e CPF/CNPJ."); return }
    setSaving(true)
    try {
      const novo = await moriaService.createFornecedor({
        razao_social_nome: form.razao_social_nome,
        cpf_cnpj: form.cpf_cnpj,
        tipo_chave_pix: form.tipo_chave_pix || null,
        chave_pix: form.chave_pix || null,
        banco: form.banco || null,
        agencia: form.agencia || null,
        conta: form.conta || null,
      })
      toast.success("Fornecedor cadastrado!")
      setForm(VAZIO)
      onOpenChange(false)
      onCriado?.(novo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cadastrar Fornecedor ou Prestador</DialogTitle>
            <DialogDescription>Dados cadastrais, bancarios e chave Pix para pagamentos do projeto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fn-razao">Razao Social ou Nome Completo *</Label>
              <Input id="fn-razao" required placeholder="Ex: Papelaria Central Ltda" value={form.razao_social_nome} onChange={e => setForm(p => ({ ...p, razao_social_nome: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fn-cpf">CPF ou CNPJ *</Label>
              <Input id="fn-cpf" required placeholder="00.000.000/0000-00" value={form.cpf_cnpj} onChange={e => setForm(p => ({ ...p, cpf_cnpj: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Tipo Chave Pix</Label>
                <Select value={form.tipo_chave_pix} onValueChange={(v: any) => v && setForm(p => ({ ...p, tipo_chave_pix: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="TELEFONE">Telefone</SelectItem>
                    <SelectItem value="ALEATORIA">Aleatoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid col-span-2 gap-2">
                <Label>Chave Pix</Label>
                <Input placeholder="Chave Pix" value={form.chave_pix} onChange={e => setForm(p => ({ ...p, chave_pix: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>Banco</Label><Input placeholder="BB / Itau" value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Agencia</Label><Input placeholder="0000" value={form.agencia} onChange={e => setForm(p => ({ ...p, agencia: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Conta</Label><Input placeholder="00000-0" value={form.conta} onChange={e => setForm(p => ({ ...p, conta: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">{saving ? "Salvando..." : "Salvar Fornecedor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}