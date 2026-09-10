"use client"
import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { moriaService } from "@/lib/api/moria-service"
import type { Rubrica } from "@/lib/types"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  projetoId: string
  onCriado?: (r: Rubrica) => void
}

const VAZIO = { tipo: "SERVICO" as const, descricao: "", codigo_natureza_despesa: "33903501", unidade: "UN", quantidade: "1", valor_unitario: "0", tipo_pagamento: "UNICO" as "UNICO"|"RECORRENTE"|"PARCELADO", frequencia_meses: "1", num_parcelas: "1", dia_vencimento: "" }

export function CriarRubricaDialog({ open, onOpenChange, projetoId, onCriado }: Props) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState(VAZIO)

  const qtd = parseFloat(form.quantidade) || 0
  const vlUnit = parseFloat(form.valor_unitario) || 0
  const total = qtd * vlUnit

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projetoId) { toast.error("Selecione um projeto primeiro."); return }
    if (!form.descricao || !form.codigo_natureza_despesa || qtd <= 0) { toast.error("Preencha os campos obrigatorios."); return }
    setSaving(true)
    try {
      const nova = await moriaService.createRubrica({
        projeto_id: projetoId, tipo: form.tipo, descricao: form.descricao,
        codigo_natureza_despesa: form.codigo_natureza_despesa, unidade: form.unidade || "UN",
        quantidade: qtd, valor_unitario: vlUnit, tipo_pagamento: form.tipo_pagamento,
        frequencia_meses: form.tipo_pagamento === "RECORRENTE" ? parseInt(form.frequencia_meses) || 1 : null,
        num_parcelas: form.tipo_pagamento !== "UNICO" ? parseInt(form.num_parcelas) || 1 : null,
        dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      })
      toast.success("Rubrica cadastrada!")
      setForm(VAZIO)
      onOpenChange(false)
      onCriado?.(nova)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Plano de Trabalho</DialogTitle>
            <DialogDescription>Cadastre a rubrica com natureza de despesa e valor unitario.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo de Despesa *</Label>
                <Select value={form.tipo} onValueChange={(v: any) => v && setForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICO">SERVICO (PF / PJ)</SelectItem>
                    <SelectItem value="MATERIAL">MATERIAL DE CONSUMO</SelectItem>
                    <SelectItem value="LOCACAO">LOCACAO DE BENS</SelectItem>
                    <SelectItem value="RH">RECURSOS HUMANOS</SelectItem>
                    <SelectItem value="OUTROS">OUTROS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Codigo Natureza (Transferegov) *</Label>
                <Input required placeholder="33903501" value={form.codigo_natureza_despesa} onChange={e => setForm(p => ({ ...p, codigo_natureza_despesa: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descricao do Item *</Label>
              <Input required placeholder="Ex: Assessoria Juridica em MROSC" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>Unidade</Label><Input placeholder="UN, MES, HORA" value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Quantidade *</Label><Input type="number" step="0.01" required value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Valor Unitario (R$) *</Label><Input type="number" step="0.01" required value={form.valor_unitario} onChange={e => setForm(p => ({ ...p, valor_unitario: e.target.value }))} /></div>
            </div>
            {total > 0 && <p className="text-xs text-muted-foreground">Total previsto: <strong>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>}
            <div className="grid gap-2">
              <Label>Tipo de Pagamento</Label>
              <Select value={form.tipo_pagamento} onValueChange={(v: any) => v && setForm(p => ({ ...p, tipo_pagamento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNICO">Pagamento Unico</SelectItem>
                  <SelectItem value="RECORRENTE">Recorrente (ex: mensal)</SelectItem>
                  <SelectItem value="PARCELADO">Parcelado (ex: 3x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo_pagamento !== "UNICO" && (
              <div className="grid grid-cols-3 gap-3">
                {form.tipo_pagamento === "RECORRENTE" && <div className="grid gap-2"><Label>Frequencia (meses)</Label><Input type="number" min="1" value={form.frequencia_meses} onChange={e => setForm(p => ({ ...p, frequencia_meses: e.target.value }))} /></div>}
                <div className="grid gap-2"><Label>No Parcelas</Label><Input type="number" min="1" value={form.num_parcelas} onChange={e => setForm(p => ({ ...p, num_parcelas: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" placeholder="5" value={form.dia_vencimento} onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))} /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">{saving ? "Salvando..." : "Salvar Rubrica"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}