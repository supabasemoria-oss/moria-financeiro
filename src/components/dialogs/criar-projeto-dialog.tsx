"use client"
import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircleIcon } from "lucide-react"
import { moriaService } from "@/lib/api/moria-service"
import type { Projeto, Instituicao } from "@/lib/types"
import { toast } from "sonner"
import { CriarInstituicaoDialog } from "./criar-instituicao-dialog"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCriado?: (p: Projeto) => void
}

const VAZIO = { nome: "", instituicao_id: "", numero_termo: "", data_inicio: "", data_fim: "", valor_total_aprovado: "", status: "EM_ANDAMENTO" as const }

export function CriarProjetoDialog({ open, onOpenChange, onCriado }: Props) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState(VAZIO)
  const [instituicoes, setInstituicoes] = React.useState<Instituicao[]>([])
  const [openInst, setOpenInst] = React.useState(false)

  React.useEffect(() => {
    if (open) moriaService.getInstituicoes().then(setInstituicoes).catch(() => {})
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.instituicao_id || !form.data_inicio || !form.data_fim || !form.valor_total_aprovado) {
      toast.error("Preencha todos os campos obrigatorios."); return
    }
    setSaving(true)
    try {
      const novo = await moriaService.createProjeto({
        nome: form.nome, instituicao_id: form.instituicao_id,
        numero_termo: form.numero_termo || null,
        data_inicio: form.data_inicio, data_fim: form.data_fim,
        valor_total_aprovado: parseFloat(form.valor_total_aprovado.replace(",", ".")),
        status: form.status,
      })
      toast.success("Projeto cadastrado!")
      setForm(VAZIO)
      onOpenChange(false)
      onCriado?.(novo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    } finally { setSaving(false) }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Projeto MROSC</DialogTitle>
              <DialogDescription>Defina a instituicao proponente, vigencia e teto orcamentario aprovado.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="pj-inst">Instituicao Proponente (OSC) *</Label>
                <Select value={form.instituicao_id} onValueChange={v => v && setForm(p => ({ ...p, instituicao_id: v }))}>
                  <SelectTrigger id="pj-inst"><SelectValue placeholder="Selecione a OSC..." /></SelectTrigger>
                  <SelectContent>
                    {instituicoes.map(i => <SelectItem key={i.id} value={i.id}>{i.razao_social} ({i.cnpj})</SelectItem>)}
                  </SelectContent>
                </Select>
                <button type="button" onClick={() => setOpenInst(true)} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-500 w-fit">
                  <PlusCircleIcon className="size-3.5" />
                  {instituicoes.length === 0 ? "Nenhuma proponente — criar agora" : "Cadastrar nova proponente"}
                </button>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pj-nome">Nome do Projeto *</Label>
                <Input id="pj-nome" required placeholder="Ex: Projeto Inclusao Digital 2026" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>No Termo / Convenio</Label><Input placeholder="TF no 012/2026" value={form.numero_termo} onChange={e => setForm(p => ({ ...p, numero_termo: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Valor Total Aprovado (R$) *</Label><Input required type="number" step="0.01" placeholder="0,00" value={form.valor_total_aprovado} onChange={e => setForm(p => ({ ...p, valor_total_aprovado: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Data Inicio *</Label><Input required type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Data Fim *</Label><Input required type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} /></div>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => v && setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluido</SelectItem>
                    <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">{saving ? "Salvando..." : "Salvar Projeto"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CriarInstituicaoDialog open={openInst} onOpenChange={setOpenInst} onCriado={nova => {
        setInstituicoes(prev => [...prev, nova])
        setForm(p => ({ ...p, instituicao_id: nova.id }))
      }} />
    </>
  )
}