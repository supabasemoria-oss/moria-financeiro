"use client"
import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moriaService } from "@/lib/api/moria-service"
import type { Instituicao } from "@/lib/types"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCriado?: (i: Instituicao) => void
}

const VAZIO = { razao_social: "", cnpj: "", email: "", telefone: "", endereco: "" }

export function CriarInstituicaoDialog({ open, onOpenChange, onCriado }: Props) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState(VAZIO)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.razao_social || !form.cnpj) { toast.error("Preencha Razao Social e CNPJ."); return }
    setSaving(true)
    try {
      const nova = await moriaService.createInstituicao({
        razao_social: form.razao_social, cnpj: form.cnpj,
        email: form.email || null, telefone: form.telefone || null, endereco: form.endereco || null,
      })
      toast.success("Instituicao cadastrada!")
      setForm(VAZIO)
      onOpenChange(false)
      onCriado?.(nova)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cadastrar Instituicao (OSC)</DialogTitle>
            <DialogDescription>Dados cadastrais da organizacao para vincular aos projetos MROSC.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="in-razao">Razao Social *</Label>
              <Input id="in-razao" required placeholder="Ex: Instituto Esperanca Viva" value={form.razao_social} onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="in-cnpj">CNPJ *</Label>
              <Input id="in-cnpj" required placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>E-mail</Label><Input placeholder="contato@osc.org.br" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Telefone</Label><Input placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Endereco</Label>
              <Input placeholder="Rua, Numero, Cidade - UF" value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">{saving ? "Salvando..." : "Salvar Instituicao"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}