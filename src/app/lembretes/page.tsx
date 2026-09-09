"use client"

import { useState } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useParcelas } from "@/hooks/use-parcelas"
import { useAlertas } from "@/hooks/use-alertas"
import { moriaService } from "@/lib/api/moria-service"
import { toast } from "sonner"
import { BellIcon, AlertTriangleIcon, CalendarClockIcon, CheckCircleIcon, ClockIcon } from "lucide-react"
import type { ParcelaComRelacoes } from "@/lib/types"

const NIVEL_CONFIG = {
  URGENTE: { color: "bg-red-50 border-red-200", badge: "destructive", icon: AlertTriangleIcon },
  ATENCAO: { color: "bg-amber-50 border-amber-200", badge: "outline", icon: ClockIcon },
  INFO: { color: "bg-blue-50 border-blue-200", badge: "secondary", icon: CalendarClockIcon },
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR")
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function GrupoSection({ titulo, parcelas, onExecutar }: {
  titulo: string
  parcelas: ParcelaComRelacoes[]
  onExecutar: (p: ParcelaComRelacoes) => void
}) {
  if (parcelas.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{titulo}</h3>
      {parcelas.map((p) => {
        const diasAbs = Math.abs(
          Math.round((new Date(p.data_vencimento + "T00:00:00").getTime() - new Date().setHours(0,0,0,0)) / 86400000)
        )
        const atrasado = p.status === "ATRASADO"
        return (
          <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 ${atrasado ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-sm truncate">{p.descricao}</span>
              <span className="text-xs text-muted-foreground">{p.projetos?.nome ?? "—"}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={atrasado ? "destructive" : "outline"} className="text-xs">
                  {atrasado ? `Atrasado ${diasAbs}d` : formatDate(p.data_vencimento)}
                </Badge>
                <span className="text-xs font-semibold">{formatBRL(p.valor_previsto)}</span>
              </div>
            </div>
            <Button size="sm" onClick={() => onExecutar(p)} className="ml-3 shrink-0">
              <CheckCircleIcon className="size-4 mr-1" /> Executar
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export default function LembretesPage() {
  const { data: parcelas, loading, refetch } = useParcelas({ proximosDias: 60 })
  const { alertas, urgentes, atencao } = useAlertas()
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaComRelacoes | null>(null)
  const [fornecedores, setFornecedores] = useState<Awaited<ReturnType<typeof moriaService.getFornecedores>>>([])
  const [form, setForm] = useState({ fornecedor_id: "", data_pagamento_real: "", numero_documento_fiscal: "" })
  const [salvando, setSalvando] = useState(false)

  async function abrirModal(p: ParcelaComRelacoes) {
    const forns = await moriaService.getFornecedores()
    setFornecedores(forns)
    setForm({ fornecedor_id: "", data_pagamento_real: new Date().toISOString().split("T")[0], numero_documento_fiscal: "" })
    setParcelaSelecionada(p)
  }

  async function executar() {
    if (!parcelaSelecionada || !form.fornecedor_id || !form.data_pagamento_real) return
    setSalvando(true)
    try {
      await moriaService.executarParcela(parcelaSelecionada.id, {
        fornecedor_id: form.fornecedor_id,
        data_pagamento_real: form.data_pagamento_real,
        numero_documento_fiscal: form.numero_documento_fiscal || undefined,
      })
      toast.success("Pagamento registrado com sucesso!")
      setParcelaSelecionada(null)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar")
    } finally {
      setSalvando(false)
    }
  }

  const atrasadas = parcelas.filter((p) => p.status === "ATRASADO")
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const deHoje = parcelas.filter((p) => {
    const d = new Date(p.data_vencimento + "T00:00:00"); d.setHours(0,0,0,0)
    return d.getTime() === hoje.getTime() && p.status !== "PAGO"
  })
  const proximos7 = parcelas.filter((p) => {
    const d = new Date(p.data_vencimento + "T00:00:00"); d.setHours(0,0,0,0)
    const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000)
    return dias > 0 && dias <= 7 && p.status !== "PAGO"
  })
  const proximos30 = parcelas.filter((p) => {
    const d = new Date(p.data_vencimento + "T00:00:00"); d.setHours(0,0,0,0)
    const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000)
    return dias > 7 && dias <= 30 && p.status !== "PAGO"
  })
  const vigencia = alertas.filter((a) => a.tipo === "TERMO_ADITIVO")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <BellIcon className="size-4 text-muted-foreground" />
          <h1 className="font-semibold text-sm">Lembretes & Agenda de Pagamentos</h1>
          {(urgentes + atencao) > 0 && (
            <Badge variant="destructive" className="ml-auto">{urgentes + atencao} pendentes</Badge>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Cards resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Atrasados</p>
                <p className="text-2xl font-bold text-red-600">{atrasadas.length}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Vencem hoje</p>
                <p className="text-2xl font-bold text-amber-600">{deHoje.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Próx. 7 dias</p>
                <p className="text-2xl font-bold">{proximos7.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Alertas vigência</p>
                <p className="text-2xl font-bold text-orange-500">{vigencia.length}</p>
              </CardContent>
            </Card>
          </div>

          {loading && <p className="text-muted-foreground text-sm">Carregando...</p>}

          {!loading && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <GrupoSection titulo="⚠️ Atrasados" parcelas={atrasadas} onExecutar={abrirModal} />
                <GrupoSection titulo="📅 Vencem hoje" parcelas={deHoje} onExecutar={abrirModal} />
                <GrupoSection titulo="📆 Próximos 7 dias" parcelas={proximos7} onExecutar={abrirModal} />
                <GrupoSection titulo="🗓️ Próximos 30 dias" parcelas={proximos30} onExecutar={abrirModal} />
                {atrasadas.length + deHoje.length + proximos7.length + proximos30.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhum pagamento pendente nos próximos 30 dias.</p>
                )}
              </div>

              {/* Alertas de vigência */}
              {vigencia.length > 0 && (
                <Card className="border-orange-200 bg-orange-50 h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700">⏰ Alertas de Vigência — Termo Aditivo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {vigencia.map((a) => (
                      <div key={a.id} className="rounded-md border border-orange-200 bg-white p-3">
                        <p className="font-medium text-sm">{a.projeto_nome}</p>
                        <p className="text-xs text-orange-700 font-semibold mt-0.5">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                        <p className="text-xs text-muted-foreground">Vigência até: {formatDate(a.data_referencia)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Modal executar pagamento */}
        <Dialog open={!!parcelaSelecionada} onOpenChange={(o) => !o && setParcelaSelecionada(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {parcelaSelecionada && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">{parcelaSelecionada.descricao}</p>
                  <p className="text-muted-foreground">{formatBRL(parcelaSelecionada.valor_previsto)} · Vencimento: {formatDate(parcelaSelecionada.data_vencimento)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor / Prestador *</Label>
                  <Select onValueChange={(v: string | null) => setForm((f) => ({ ...f, fornecedor_id: v ?? "" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.razao_social_nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de Pagamento *</Label>
                  <Input type="date" value={form.data_pagamento_real} onChange={(e) => setForm((f) => ({ ...f, data_pagamento_real: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nº Documento Fiscal</Label>
                  <Input placeholder="NF / RPA / Recibo..." value={form.numero_documento_fiscal} onChange={(e) => setForm((f) => ({ ...f, numero_documento_fiscal: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setParcelaSelecionada(null)}>Cancelar</Button>
                  <Button onClick={executar} disabled={salvando || !form.fornecedor_id || !form.data_pagamento_real}>
                    {salvando ? "Salvando..." : "Confirmar Pagamento"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
