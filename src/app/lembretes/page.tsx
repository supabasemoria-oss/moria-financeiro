"use client"

import { useState, useCallback, useEffect } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarFornecedorDialog } from "@/components/dialogs/criar-fornecedor-dialog"
import { useParcelas } from "@/hooks/use-parcelas"
import { useAlertas } from "@/hooks/use-alertas"
import { moriaService } from "@/lib/api/moria-service"
import { toast } from "sonner"
import {
  BellIcon, AlertTriangleIcon, CalendarClockIcon,
  CheckCircleIcon, ClockIcon, PlusIcon, TrashIcon, CheckIcon, BellOffIcon,
  SunIcon, MoonIcon, Loader2Icon,
} from "lucide-react"
import type { ParcelaComRelacoes, LembreteAvulso, Projeto } from "@/lib/types"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { formatDate, getTodaySaoPaulo, diasRestantesSaoPaulo } from "@/lib/utils"
import { RelogioHeader } from "@/components/relogio-header"
import { LembretesPopover } from "@/components/lembretes-popover"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const diasRestantes = diasRestantesSaoPaulo

// ---------------------------------------------------------------------------
// GrupoSection — lista parcelas por grupo
// ---------------------------------------------------------------------------
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
        const dias = diasRestantes(p.data_vencimento)
        const atrasado = p.status === "ATRASADO"
        return (
          <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 ${atrasado ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-sm truncate">{p.descricao}</span>
              <span className="text-xs text-muted-foreground">{p.projetos?.nome ?? "—"}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={atrasado ? "destructive" : "outline"} className="text-xs">
                  {atrasado ? `Atrasado ${Math.abs(dias)}d` : formatDate(p.data_vencimento)}
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

// ---------------------------------------------------------------------------
// LembreteCard
// ---------------------------------------------------------------------------
function LembreteCard({ lembrete, onConcluir, onExcluir }: {
  lembrete: LembreteAvulso
  onConcluir: (id: string) => void
  onExcluir: (id: string) => void
}) {
  const dias = diasRestantes(lembrete.data_vencimento)
  const atrasado = dias < 0 && lembrete.status === "PENDENTE"
  const concluido = lembrete.status === "CONCLUIDO"
  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${concluido ? "opacity-60 bg-muted/40" : atrasado ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`font-medium text-sm truncate ${concluido ? "line-through" : ""}`}>{lembrete.titulo}</span>
        {lembrete.descricao && <span className="text-xs text-muted-foreground truncate">{lembrete.descricao}</span>}
        {lembrete.projetos && <span className="text-xs text-muted-foreground">{lembrete.projetos.nome}</span>}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={concluido ? "secondary" : atrasado ? "destructive" : "outline"} className="text-xs">
            {concluido ? "Concluído" : atrasado ? `Atrasado ${Math.abs(dias)}d` : formatDate(lembrete.data_vencimento)}
          </Badge>
          {lembrete.valor && <span className="text-xs font-semibold">{formatBRL(lembrete.valor)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 ml-3 shrink-0">
        {!concluido && (
          <Button size="sm" variant="ghost" onClick={() => onConcluir(lembrete.id)} title="Marcar como concluído">
            <CheckIcon className="size-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onExcluir(lembrete.id)} className="text-destructive hover:text-destructive" title="Excluir">
          <TrashIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function LembretesPage() {
  const [filtroProjeto, setFiltroProjeto] = useState<string>("")
  const { data: parcelas, loading, refetch } = useParcelas({
    proximosDias: 60,
    projetoId: filtroProjeto || undefined,
  })
  const { alertas, urgentes, atencao } = useAlertas()
  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, isSupported: pushSupported } = usePushNotifications()

  // Projetos para filtro
  const [projetos, setProjetos] = useState<Projeto[]>([])
  useEffect(() => {
    moriaService.getProjetos().then(setProjetos).catch(() => {})
  }, [])

  // Executar parcela
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaComRelacoes | null>(null)
  const [fornecedores, setFornecedores] = useState<Awaited<ReturnType<typeof moriaService.getFornecedores>>>([])
  const [formExec, setFormExec] = useState({ fornecedor_id: "", data_pagamento_real: "", numero_documento_fiscal: "" })
  const [salvando, setSalvando] = useState(false)
  const [openFornecedor, setOpenFornecedor] = useState(false)

  async function abrirModal(p: ParcelaComRelacoes) {
    const forns = await moriaService.getFornecedores()
    setFornecedores(forns)
    setFormExec({ fornecedor_id: "", data_pagamento_real: getTodaySaoPaulo(), numero_documento_fiscal: "" })
    setParcelaSelecionada(p)
  }

  async function executar() {
    if (!parcelaSelecionada || !formExec.fornecedor_id || !formExec.data_pagamento_real) return
    setSalvando(true)
    try {
      await moriaService.executarParcela(parcelaSelecionada.id, {
        fornecedor_id: formExec.fornecedor_id,
        data_pagamento_real: formExec.data_pagamento_real,
        numero_documento_fiscal: formExec.numero_documento_fiscal || undefined,
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

  // Lembretes avulsos
  const [lembretes, setLembretes] = useState<LembreteAvulso[]>([])
  const [loadingLembretes, setLoadingLembretes] = useState(true)
  const [openNovoLembrete, setOpenNovoLembrete] = useState(false)
  const [formLembrete, setFormLembrete] = useState({
    titulo: "", descricao: "", data_vencimento: "", projeto_id: "",
    valor: "", notificar_email: false, email_destino: "",
  })
  const [salvandoLembrete, setSavingLembrete] = useState(false)
  const [sendingType, setSendingType] = useState<string | null>(null)

  async function handleSendSummary(type: "morning" | "evening") {
    setSendingType(type)
    try {
      const res = await fetch(`/api/push/send?type=${type}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.whatsappError) throw new Error(data.whatsappError)
      const label = type === "morning" ? "Resumo de hoje" : "Resumo de amanhã"
      toast.success(`${label} enviado com sucesso via WhatsApp!`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao enviar"
      toast.error("Erro ao enviar: " + msg)
    } finally {
      setSendingType(null)
    }
  }

  const carregarLembretes = useCallback(async () => {
    setLoadingLembretes(true)
    try {
      const data = await moriaService.getLembretesAvulsos(filtroProjeto || undefined)
      setLembretes(data)
    } catch {
      // tabela pode não existir ainda — silencioso
    } finally {
      setLoadingLembretes(false)
    }
  }, [filtroProjeto])

  useEffect(() => { carregarLembretes() }, [carregarLembretes])

  async function salvarLembrete() {
    if (!formLembrete.titulo || !formLembrete.data_vencimento) {
      toast.error("Título e data são obrigatórios")
      return
    }
    setSavingLembrete(true)
    try {
      await moriaService.createLembreteAvulso({
        titulo: formLembrete.titulo,
        descricao: formLembrete.descricao || null,
        data_vencimento: formLembrete.data_vencimento,
        projeto_id: formLembrete.projeto_id || null,
        valor: formLembrete.valor ? Number(formLembrete.valor) : null,
        notificar_email: formLembrete.notificar_email,
        email_destino: formLembrete.email_destino || null,
      })
      toast.success("Lembrete criado!")
      setOpenNovoLembrete(false)
      setFormLembrete({ titulo: "", descricao: "", data_vencimento: "", projeto_id: "", valor: "", notificar_email: false, email_destino: "" })
      carregarLembretes()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar lembrete")
    } finally {
      setSavingLembrete(false)
    }
  }

  async function concluirLembrete(id: string) {
    try {
      await moriaService.updateLembreteAvulso(id, { status: "CONCLUIDO" })
      setLembretes(prev => prev.map(l => l.id === id ? { ...l, status: "CONCLUIDO" } : l))
      toast.success("Lembrete concluído!")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro")
    }
  }

  async function excluirLembrete(id: string) {
    try {
      await moriaService.deleteLembreteAvulso(id)
      setLembretes(prev => prev.filter(l => l.id !== id))
      toast.success("Lembrete excluído.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro")
    }
  }

  // Agrupamentos de parcelas
  const hoje = getTodaySaoPaulo()
  const atrasadas = parcelas.filter(p => p.status === "ATRASADO")
  const deHoje = parcelas.filter(p => p.data_vencimento === hoje && p.status !== "PAGO")
  const proximos7 = parcelas.filter(p => {
    const dias = diasRestantesSaoPaulo(p.data_vencimento)
    return dias > 0 && dias <= 7 && p.status !== "PAGO"
  })
  const proximos30 = parcelas.filter(p => {
    const dias = diasRestantesSaoPaulo(p.data_vencimento)
    return dias > 7 && dias <= 30 && p.status !== "PAGO"
  })
  const vigencia = alertas.filter(a => a.tipo === "TERMO_ADITIVO")

  // Lembretes avulsos pendentes/atrasados
  const lembretesPendentes = lembretes.filter(l => l.status === "PENDENTE" && diasRestantesSaoPaulo(l.data_vencimento) >= 0)
  const lembretesAtrasados = lembretes.filter(l => l.status === "PENDENTE" && diasRestantesSaoPaulo(l.data_vencimento) < 0)
  const lembretesConcluidos = lembretes.filter(l => l.status === "CONCLUIDO")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <BellIcon className="size-4 text-muted-foreground" />
          <h1 className="font-semibold text-sm">Lembretes & Agenda de Pagamentos</h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <RelogioHeader />
            <LembretesPopover />
            {pushSupported && (
              <Button
                size="sm"
                variant={pushStatus === "granted" ? "secondary" : "outline"}
                onClick={pushStatus === "granted" ? pushUnsubscribe : pushSubscribe}
                className="gap-1.5 text-xs"
                title={pushStatus === "granted" ? "Desativar notificações push" : "Ativar notificações push"}
              >
                {pushStatus === "granted" ? (
                  <><BellOffIcon className="size-3.5" /> Notificações ativas</>
                ) : (
                  <><BellIcon className="size-3.5" /> Ativar notificações</>
                )}
              </Button>
            )}
            {(urgentes + atencao) > 0 && (
              <Badge variant="destructive">{urgentes + atencao} pendentes</Badge>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* Filtro por projeto */}
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm text-muted-foreground shrink-0">Filtrar por projeto:</Label>
            <div className="w-72">
              <Select value={filtroProjeto} onValueChange={(v: string | null) => setFiltroProjeto(v === "todos" || !v ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos os projetos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os projetos</SelectItem>
                  {projetos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Parcelas atrasadas</p>
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
                <p className="text-xs text-muted-foreground">Lembretes avulsos</p>
                <p className="text-2xl font-bold">{lembretesAtrasados.length + lembretesPendentes.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Alertas vigência</p>
                <p className="text-2xl font-bold text-orange-500">{vigencia.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="parcelas">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="parcelas">
                  Parcelas
                  {(atrasadas.length + deHoje.length + proximos7.length) > 0 && (
                    <Badge variant="destructive" className="ml-1.5 size-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                      {atrasadas.length + deHoje.length + proximos7.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="lembretes">
                  Lembretes
                  {(lembretesAtrasados.length + lembretesPendentes.length) > 0 && (
                    <Badge variant="secondary" className="ml-1.5 size-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                      {lembretesAtrasados.length + lembretesPendentes.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendSummary("morning")}
                  disabled={sendingType !== null}
                  className="gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                  title="Disparar resumo das contas que vencem hoje via WhatsApp"
                >
                  {sendingType === "morning" ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SunIcon className="size-3.5 text-amber-500" />
                  )}
                  {sendingType === "morning" ? "Enviando..." : "Enviar Resumo de Hoje"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendSummary("evening")}
                  disabled={sendingType !== null}
                  className="gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                  title="Disparar resumo antecipado do dia seguinte via WhatsApp"
                >
                  {sendingType === "evening" ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <MoonIcon className="size-3.5 text-indigo-500" />
                  )}
                  {sendingType === "evening" ? "Enviando..." : "Enviar Resumo de Amanhã"}
                </Button>

                <Button size="sm" onClick={() => setOpenNovoLembrete(true)}>
                  <PlusIcon className="size-4 mr-1" /> Novo Lembrete
                </Button>
              </div>
            </div>

            {/* Tab Parcelas */}
            <TabsContent value="parcelas" className="mt-4">
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

                  {vigencia.length > 0 && (
                    <Card className="border-orange-200 bg-orange-50 h-fit">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-orange-700">⏰ Alertas de Vigência — Termo Aditivo</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {vigencia.map(a => (
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
            </TabsContent>

            {/* Tab Lembretes avulsos */}
            <TabsContent value="lembretes" className="mt-4">
              {loadingLembretes && <p className="text-muted-foreground text-sm">Carregando lembretes...</p>}
              {!loadingLembretes && (
                <div className="space-y-6">
                  {lembretesAtrasados.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">⚠️ Atrasados</h3>
                      {lembretesAtrasados.map(l => (
                        <LembreteCard key={l.id} lembrete={l} onConcluir={concluirLembrete} onExcluir={excluirLembrete} />
                      ))}
                    </div>
                  )}
                  {lembretesPendentes.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">📋 Pendentes</h3>
                      {lembretesPendentes.map(l => (
                        <LembreteCard key={l.id} lembrete={l} onConcluir={concluirLembrete} onExcluir={excluirLembrete} />
                      ))}
                    </div>
                  )}
                  {lembretesConcluidos.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">✅ Concluídos</h3>
                      {lembretesConcluidos.map(l => (
                        <LembreteCard key={l.id} lembrete={l} onConcluir={concluirLembrete} onExcluir={excluirLembrete} />
                      ))}
                    </div>
                  )}
                  {lembretes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                      <BellIcon className="size-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Nenhum lembrete avulso criado ainda.</p>
                      <Button size="sm" onClick={() => setOpenNovoLembrete(true)}>
                        <PlusIcon className="size-4 mr-1" /> Criar primeiro lembrete
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Modal executar pagamento */}
        <Dialog open={!!parcelaSelecionada} onOpenChange={o => !o && setParcelaSelecionada(null)}>
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
                  <SelectComCriar
                    value={formExec.fornecedor_id}
                    onValueChange={v => setFormExec(f => ({ ...f, fornecedor_id: v }))}
                    opcoes={fornecedores.map(f => ({ id: f.id, label: f.razao_social_nome }))}
                    placeholder="Selecionar..."
                    labelCriar="Criar novo fornecedor"
                    onClickCriar={() => setOpenFornecedor(true)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Pagamento *</Label>
                  <Input type="date" value={formExec.data_pagamento_real} onChange={e => setFormExec(f => ({ ...f, data_pagamento_real: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nº Documento Fiscal</Label>
                  <Input placeholder="NF / RPA / Recibo..." value={formExec.numero_documento_fiscal} onChange={e => setFormExec(f => ({ ...f, numero_documento_fiscal: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setParcelaSelecionada(null)}>Cancelar</Button>
                  <Button onClick={executar} disabled={salvando || !formExec.fornecedor_id || !formExec.data_pagamento_real}>
                    {salvando ? "Salvando..." : "Confirmar Pagamento"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal novo lembrete */}
        <Dialog open={openNovoLembrete} onOpenChange={setOpenNovoLembrete}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Novo Lembrete</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input placeholder="Ex: Renovar contrato, Entregar relatório..." value={formLembrete.titulo} onChange={e => setFormLembrete(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea placeholder="Detalhes adicionais..." value={formLembrete.descricao} onChange={e => setFormLembrete(f => ({ ...f, descricao: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data de Vencimento *</Label>
                  <Input type="date" value={formLembrete.data_vencimento} onChange={e => setFormLembrete(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Valor (opcional)</Label>
                  <Input type="number" placeholder="0,00" value={formLembrete.valor} onChange={e => setFormLembrete(f => ({ ...f, valor: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Projeto (opcional)</Label>
                <Select value={formLembrete.projeto_id} onValueChange={(v: string | null) => setFormLembrete(f => ({ ...f, projeto_id: v === "nenhum" || !v ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {projetos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formLembrete.notificar_email}
                    onChange={e => setFormLembrete(f => ({ ...f, notificar_email: e.target.checked }))}
                    className="size-4 rounded"
                  />
                  Notificar por e-mail
                </Label>
                {formLembrete.notificar_email && (
                  <Input type="email" placeholder="email@exemplo.com" value={formLembrete.email_destino} onChange={e => setFormLembrete(f => ({ ...f, email_destino: e.target.value }))} />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNovoLembrete(false)}>Cancelar</Button>
              <Button onClick={salvarLembrete} disabled={salvandoLembrete}>
                {salvandoLembrete ? "Salvando..." : "Criar Lembrete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CriarFornecedorDialog
          open={openFornecedor}
          onOpenChange={setOpenFornecedor}
          onCriado={novo => setFornecedores(prev => [...prev, novo])}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
