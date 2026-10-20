"use client"

import { useState, useEffect, useMemo } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { SelectComCriar } from "@/components/select-com-criar"
import { CriarFornecedorDialog } from "@/components/dialogs/criar-fornecedor-dialog"
import { CampoNotaFiscal } from "@/components/campo-nota-fiscal"
import { useParcelas } from "@/hooks/use-parcelas"
import { useAlertas } from "@/hooks/use-alertas"
import { usePermissoes } from "@/hooks/use-permissoes"
import { mroscService } from "@/lib/api/mrosc-service"
import { toast } from "sonner"
import {
  BellIcon,
  CheckCircleIcon,
  CheckIcon,
  BellOffIcon,
  SunIcon,
  MoonIcon,
  Loader2Icon,
  FilterIcon,
  CalendarIcon,
  XIcon,
} from "lucide-react"
import type { ParcelaComRelacoes, Projeto } from "@/lib/types"
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

// Tipos de Filtro Rápido de Período
type FiltroPeriodo = "todos" | "atrasados3d" | "vencidos" | "hoje" | "semana" | "mes"

// ---------------------------------------------------------------------------
// GrupoSection — lista parcelas por grupo com suporte a seleção múltipla
// ---------------------------------------------------------------------------
function GrupoSection({
  titulo,
  parcelas,
  onExecutar,
  selectedParcelas,
  onToggleSelect,
}: {
  titulo: string
  parcelas: ParcelaComRelacoes[]
  onExecutar: (p: ParcelaComRelacoes) => void
  selectedParcelas?: Set<string>
  onToggleSelect?: (id: string) => void
}) {
  if (parcelas.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{titulo}</h3>
      {parcelas.map((p) => {
        const dias = diasRestantes(p.data_vencimento)
        const atrasado = p.status === "ATRASADO" || dias < 0
        const isSelected = selectedParcelas?.has(p.id) || false
        return (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              isSelected
                ? "bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/30"
                : atrasado
                ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {onToggleSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(p.id)}
                  aria-label={`Selecionar ${p.descricao}`}
                />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-sm truncate">{p.descricao}</span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{p.projetos?.nome ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={atrasado ? "destructive" : "outline"} className="text-xs">
                    {atrasado ? `Atrasado ${Math.abs(dias)}d` : formatDate(p.data_vencimento)}
                  </Badge>
                  <span className="text-xs font-semibold">{formatBRL(p.valor_previsto)}</span>
                </div>
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
// Página principal
// ---------------------------------------------------------------------------
export default function LembretesPage() {
  const { temAcessoAoProjeto } = usePermissoes()
  const [filtroProjeto, setFiltroProjeto] = useState<string>("")
  const [filtroRubrica, setFiltroRubrica] = useState<string>("")
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("todos")
  const [dataInicio, setDataInicio] = useState<string>("")
  const [dataFim, setDataFim] = useState<string>("")

  const { data: rawParcelas, loading, refetch } = useParcelas({
    proximosDias: 365,
    projetoId: filtroProjeto || undefined,
  })
  const { alertas, urgentes, atencao } = useAlertas()
  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, isSupported: pushSupported } = usePushNotifications()

  // Parcelas filtradas por permissão de acesso
  const parcelas = useMemo(() => {
    return rawParcelas.filter((p) => temAcessoAoProjeto(p.projeto_id))
  }, [rawParcelas, temAcessoAoProjeto])

  // Opções de rubricas/categorias disponíveis
  const rubricasDisponiveis = useMemo(() => {
    const map = new Map<string, { id: string; tipo: string; descricao: string }>()
    parcelas.forEach((p) => {
      if (p.rubricas_orcamentarias) {
        const r = p.rubricas_orcamentarias
        if (!map.has(r.id)) {
          map.set(r.id, {
            id: r.id,
            tipo: r.tipo || "",
            descricao: r.descricao,
          })
        }
      }
    })
    return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao))
  }, [parcelas])

  // Parcelas considerando o filtro de rubrica / categoria
  const parcelasBase = useMemo(() => {
    if (!filtroRubrica) return parcelas
    return parcelas.filter((p) => p.rubrica_id === filtroRubrica)
  }, [parcelas, filtroRubrica])

  // Projetos para filtro
  const [projetosRaw, setProjetosRaw] = useState<Projeto[]>([])
  useEffect(() => {
    mroscService.getProjetos().then(setProjetosRaw).catch(() => {})
  }, [])

  const projetos = useMemo(() => {
    return projetosRaw.filter((p) => temAcessoAoProjeto(p.id))
  }, [projetosRaw, temAcessoAoProjeto])

  // Executar parcela individual
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaComRelacoes | null>(null)
  const [fornecedores, setFornecedores] = useState<Awaited<ReturnType<typeof mroscService.getFornecedores>>>([])
  const [formExec, setFormExec] = useState({ fornecedor_id: "", data_pagamento_real: "", numero_documento_fiscal: "" })
  const [arquivoNf, setArquivoNf] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [openFornecedor, setOpenFornecedor] = useState(false)

  // Seleção e Execução em Lote (Batch)
  const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set())
  const [openExecLote, setOpenExecLote] = useState(false)
  const [formExecLote, setFormExecLote] = useState({ fornecedor_id: "", data_pagamento_real: "", numero_documento_fiscal: "" })
  const [arquivoNfLote, setArquivoNfLote] = useState<File | null>(null)
  const [salvandoLote, setSalvandoLote] = useState(false)
  const [sendingType, setSendingType] = useState<string | null>(null)

  const toggleSelectParcela = (id: string) => {
    setSelectedParcelas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Contadores para os botões de filtro baseados nas parcelas (respeitando a rubrica se filtrada)
  const contadores = useMemo(() => {
    const hojeStr = getTodaySaoPaulo()
    let atrasados3d = 0
    let vencidos = 0
    let hoje = 0
    let semana = 0
    let mes = 0

    parcelasBase.forEach((p) => {
      if (p.status === "PAGO") return
      const dias = diasRestantesSaoPaulo(p.data_vencimento)
      if (dias <= -3) atrasados3d++
      if (dias < 0 || p.status === "ATRASADO") vencidos++
      if (p.data_vencimento === hojeStr) hoje++
      if (dias >= 0 && dias <= 7) semana++
      if (dias >= 0 && dias <= 30) mes++
    })

    const totalPendentes = parcelasBase.filter((p) => p.status !== "PAGO").length
    return { atrasados3d, vencidos, hoje, semana, mes, total: totalPendentes }
  }, [parcelasBase])

  // Parcelas filtradas pelo filtro rápido de período ou range de datas ativo
  const parcelasExibidas = useMemo(() => {
    // Se o usuário selecionou um range de datas específico (De/Até)
    if (dataInicio || dataFim) {
      return parcelasBase.filter((p) => {
        const v = p.data_vencimento?.slice(0, 10)
        if (dataInicio && v < dataInicio) return false
        if (dataFim && v > dataFim) return false
        return true
      })
    }

    if (filtroPeriodo === "todos") return parcelasBase
    const hojeStr = getTodaySaoPaulo()
    return parcelasBase.filter((p) => {
      if (p.status === "PAGO") return false
      const dias = diasRestantesSaoPaulo(p.data_vencimento)
      if (filtroPeriodo === "atrasados3d") return dias <= -3
      if (filtroPeriodo === "vencidos") return dias < 0 || p.status === "ATRASADO"
      if (filtroPeriodo === "hoje") return p.data_vencimento === hojeStr
      if (filtroPeriodo === "semana") return dias >= 0 && dias <= 7
      if (filtroPeriodo === "mes") return dias >= 0 && dias <= 30
      return true
    })
  }, [parcelasBase, filtroPeriodo, dataInicio, dataFim])

  // Parcelas pendentes da visualização atual
  const parcelasVisiveisPendentes = useMemo(() => {
    return parcelasExibidas.filter((p) => p.status !== "PAGO")
  }, [parcelasExibidas])

  // Verifica se todas as pendentes visíveis estão selecionadas
  const todasVisiveisSelecionadas = useMemo(() => {
    if (parcelasVisiveisPendentes.length === 0) return false
    return parcelasVisiveisPendentes.every((p) => selectedParcelas.has(p.id))
  }, [parcelasVisiveisPendentes, selectedParcelas])

  const toggleSelectVisiveis = () => {
    if (todasVisiveisSelecionadas) {
      setSelectedParcelas((prev) => {
        const next = new Set(prev)
        parcelasVisiveisPendentes.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelectedParcelas((prev) => {
        const next = new Set(prev)
        parcelasVisiveisPendentes.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  const selectedParcelasObjs = parcelas.filter((p) => selectedParcelas.has(p.id))
  const totalValorLote = selectedParcelasObjs.reduce((acc, p) => acc + (p.valor_previsto || 0), 0)

  async function abrirModalLote() {
    const forns = await mroscService.getFornecedores()
    setFornecedores(forns)
    setFormExecLote({ fornecedor_id: forns[0]?.id || "", data_pagamento_real: getTodaySaoPaulo(), numero_documento_fiscal: "" })
    setArquivoNfLote(null)
    setOpenExecLote(true)
  }

  async function executarLote() {
    if (selectedParcelasObjs.length === 0 || !formExecLote.fornecedor_id || !formExecLote.data_pagamento_real) return
    setSalvandoLote(true)
    try {
      for (const p of selectedParcelasObjs) {
        await mroscService.executarParcela(p.id, {
          fornecedor_id: formExecLote.fornecedor_id,
          data_pagamento_real: formExecLote.data_pagamento_real,
          numero_documento_fiscal: formExecLote.numero_documento_fiscal || undefined,
          arquivo_nota_fiscal: arquivoNfLote,
        })
      }
      toast.success(`${selectedParcelasObjs.length} pagamento(s) registrado(s) com sucesso em lote!`)
      setOpenExecLote(false)
      setSelectedParcelas(new Set())
      setArquivoNfLote(null)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar em lote")
    } finally {
      setSalvandoLote(false)
    }
  }

  async function abrirModal(p: ParcelaComRelacoes) {
    const forns = await mroscService.getFornecedores()
    setFornecedores(forns)
    setFormExec({ fornecedor_id: "", data_pagamento_real: getTodaySaoPaulo(), numero_documento_fiscal: "" })
    setArquivoNf(null)
    setParcelaSelecionada(p)
  }

  async function executar() {
    if (!parcelaSelecionada || !formExec.fornecedor_id || !formExec.data_pagamento_real) return
    setSalvando(true)
    try {
      await mroscService.executarParcela(parcelaSelecionada.id, {
        fornecedor_id: formExec.fornecedor_id,
        data_pagamento_real: formExec.data_pagamento_real,
        numero_documento_fiscal: formExec.numero_documento_fiscal || undefined,
        arquivo_nota_fiscal: arquivoNf,
      })
      toast.success("Pagamento registrado com sucesso!")
      setParcelaSelecionada(null)
      setArquivoNf(null)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar")
    } finally {
      setSalvando(false)
    }
  }

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

  // Agrupamentos baseados nas parcelas filtradas para exibição
  const hoje = getTodaySaoPaulo()
  const atrasadas = parcelasExibidas.filter(p => p.status === "ATRASADO" || (diasRestantesSaoPaulo(p.data_vencimento) < 0 && p.status !== "PAGO"))
  const deHoje = parcelasExibidas.filter(p => p.data_vencimento === hoje && p.status !== "PAGO")
  const proximos7 = parcelasExibidas.filter(p => {
    const dias = diasRestantesSaoPaulo(p.data_vencimento)
    return dias > 0 && dias <= 7 && p.status !== "PAGO"
  })
  const proximos30 = parcelasExibidas.filter(p => {
    const dias = diasRestantesSaoPaulo(p.data_vencimento)
    return dias > 7 && dias <= 30 && p.status !== "PAGO"
  })
  const vigencia = alertas.filter(a => a.tipo === "TERMO_ADITIVO")

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
          {/* Topo: Filtro por projeto, Categoria/Rubrica e Disparo de Resumo WhatsApp */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtro por projeto */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0 font-medium">Projeto:</Label>
                <div className="w-56">
                  <Select
                    value={filtroProjeto}
                    onValueChange={(v: string | null) => {
                      setFiltroProjeto(v === "todos" || !v ? "" : v)
                      setFiltroRubrica("")
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos os projetos">
                        {(val) => {
                          if (!val || val === "todos") return "Todos os projetos"
                          const p = projetos.find((item) => item.id === val)
                          return p?.nome ?? val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os projetos</SelectItem>
                      {projetos.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filtro por Categoria / Rubrica */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0 font-medium">Categoria / Rubrica:</Label>
                <div className="w-64">
                  <Select
                    value={filtroRubrica}
                    onValueChange={(v: string | null) => setFiltroRubrica(v === "todas" || !v ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas as categorias">
                        {(val) => {
                          if (!val || val === "todas") return "Todas as categorias"
                          const r = rubricasDisponiveis.find((item) => item.id === val)
                          return r ? `${r.tipo ? `[${r.tipo}] ` : ""}${r.descricao}` : val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias / rubricas</SelectItem>
                      {rubricasDisponiveis.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.tipo ? `[${r.tipo}] ` : ""}{r.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filtroRubrica && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFiltroRubrica("")}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Limpar filtro de categoria"
                >
                  <XIcon className="size-3 mr-1" />
                  Limpar categoria
                </Button>
              )}
            </div>

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
            </div>
          </div>

          {/* Cards resumo de Parcelas */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card
              className={`border-red-200 bg-red-50 cursor-pointer transition-all hover:ring-2 hover:ring-red-400 ${filtroPeriodo === "vencidos" ? "ring-2 ring-red-500" : ""}`}
              onClick={() => setFiltroPeriodo(f => f === "vencidos" ? "todos" : "vencidos")}
              title="Clique para filtrar apenas parcelas atrasadas"
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Parcelas atrasadas</p>
                <p className="text-2xl font-bold text-red-600">{contadores.vencidos}</p>
              </CardContent>
            </Card>

            <Card
              className={`border-amber-200 bg-amber-50 cursor-pointer transition-all hover:ring-2 hover:ring-amber-400 ${filtroPeriodo === "hoje" ? "ring-2 ring-amber-500" : ""}`}
              onClick={() => setFiltroPeriodo(f => f === "hoje" ? "todos" : "hoje")}
              title="Clique para filtrar apenas parcelas que vencem hoje"
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Vencem hoje</p>
                <p className="text-2xl font-bold text-amber-600">{contadores.hoje}</p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/40 ${filtroPeriodo === "semana" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFiltroPeriodo(f => f === "semana" ? "todos" : "semana")}
              title="Clique para filtrar parcelas dos próximos 7 dias"
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Esta semana (7 dias)</p>
                <p className="text-2xl font-bold text-foreground">{contadores.semana}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Alertas vigência</p>
                <p className="text-2xl font-bold text-orange-500">{vigencia.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Ações em Lote */}
          {selectedParcelas.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <Badge className="bg-emerald-600 text-white font-mono text-xs">
                  {selectedParcelas.size} selecionada(s)
                </Badge>
                <span className="text-xs font-semibold text-foreground font-mono">
                  Total: {formatBRL(totalValorLote)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={abrirModalLote}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-xs"
                >
                  <CheckCircleIcon className="size-3.5" />
                  Executar / Quitar Selecionadas ({selectedParcelas.size})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedParcelas(new Set())}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Desmarcar
                </Button>
              </div>
            </div>
          )}

          {/* Barra de Filtros Rápidos por Período e Range de Datas */}
          <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border bg-muted/20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                  <FilterIcon className="size-3" />
                  Filtrar por Período:
                </span>

                <Button
                  size="sm"
                  variant={!dataInicio && !dataFim && filtroPeriodo === "todos" ? "default" : "outline"}
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo("todos")
                  }}
                  className="text-xs h-7 px-2.5 gap-1.5"
                >
                  Todos
                  <Badge variant={!dataInicio && !dataFim && filtroPeriodo === "todos" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded">
                    {contadores.total}
                  </Badge>
                </Button>

                <Button
                  size="sm"
                  variant={!dataInicio && !dataFim && filtroPeriodo === "atrasados3d" ? "destructive" : "outline"}
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo(f => f === "atrasados3d" ? "todos" : "atrasados3d")
                  }}
                  className={`text-xs h-7 px-2.5 gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "atrasados3d"
                      ? ""
                      : "border-red-300 dark:border-red-900 text-red-600 hover:bg-red-500/10"
                  }`}
                  title="Filtrar parcelas pendentes com mais de 3 dias de atraso"
                >
                  🔴 Atrasados (+3 dias)
                  <Badge variant={!dataInicio && !dataFim && filtroPeriodo === "atrasados3d" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded">
                    {contadores.atrasados3d}
                  </Badge>
                </Button>

                <Button
                  size="sm"
                  variant={!dataInicio && !dataFim && filtroPeriodo === "vencidos" ? "destructive" : "outline"}
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo(f => f === "vencidos" ? "todos" : "vencidos")
                  }}
                  className={`text-xs h-7 px-2.5 gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "vencidos"
                      ? ""
                      : "border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                  title="Filtrar todas as parcelas já vencidas"
                >
                  ⚠️ Todos Vencidos
                  <Badge variant={!dataInicio && !dataFim && filtroPeriodo === "vencidos" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded">
                    {contadores.vencidos}
                  </Badge>
                </Button>

                <Button
                  size="sm"
                  variant={!dataInicio && !dataFim && filtroPeriodo === "hoje" ? "default" : "outline"}
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo(f => f === "hoje" ? "todos" : "hoje")
                  }}
                  className="text-xs h-7 px-2.5 gap-1.5"
                  title="Filtrar parcelas que vencem hoje"
                >
                  📅 Vencem Hoje
                  <Badge variant={!dataInicio && !dataFim && filtroPeriodo === "hoje" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded">
                    {contadores.hoje}
                  </Badge>
                </Button>

                <Button
                  size="sm"
                  variant={!dataInicio && !dataFim && filtroPeriodo === "semana" ? "default" : "outline"}
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo(f => f === "semana" ? "todos" : "semana")
                  }}
                  className="text-xs h-7 px-2.5 gap-1.5"
                  title="Filtrar parcelas dos próximos 7 dias"
                >
                  📆 Esta Semana
                  <Badge variant={!dataInicio && !dataFim && filtroPeriodo === "semana" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded">
                    {contadores.semana}
                  </Badge>
                </Button>

                <Button
                  size="sm"
                  variant={!dataInicio && !dataFim && filtroPeriodo === "mes" ? "default" : "outline"}
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo(f => f === "mes" ? "todos" : "mes")
                  }}
                  className="text-xs h-7 px-2.5 gap-1.5"
                  title="Filtrar parcelas dos próximos 30 dias"
                >
                  🗓️ Próximos 30 dias
                  <Badge variant={!dataInicio && !dataFim && filtroPeriodo === "mes" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded">
                    {contadores.mes}
                  </Badge>
                </Button>
              </div>

              {/* Marcar todas as parcelas filtradas */}
              <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                {parcelasVisiveisPendentes.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleSelectVisiveis}
                    className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <CheckIcon className="size-3 text-emerald-600" />
                    {todasVisiveisSelecionadas ? "Desmarcar do Filtro" : "Marcar Todas do Filtro"}
                  </Button>
                )}
              </div>
            </div>

            {/* Linha de Range de Datas Customizado */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1 mr-1">
                <CalendarIcon className="size-3.5 text-primary" />
                Intervalo personalizado:
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">De</span>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-7 w-36 text-xs bg-background"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Até</span>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-7 w-36 text-xs bg-background"
                />
              </div>

              {(dataInicio || dataFim) && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] h-6 bg-primary/10 text-primary border-primary/30">
                    {parcelasExibidas.length} parcela(s) no intervalo
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDataInicio("")
                      setDataFim("")
                    }}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                    title="Limpar intervalo de datas"
                  >
                    <XIcon className="size-3" />
                    Limpar datas
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo principal de Parcelas */}
          {loading && <p className="text-muted-foreground text-sm">Carregando parcelas...</p>}
          {!loading && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                {/* Se houver intervalo personalizado, exibe diretamente as parcelas do período */}
                {(dataInicio || dataFim) ? (
                  <GrupoSection
                    titulo={`🗓️ Parcelas no Período (${dataInicio ? formatDate(dataInicio) : "início"} até ${dataFim ? formatDate(dataFim) : "fim"})`}
                    parcelas={parcelasExibidas}
                    onExecutar={abrirModal}
                    selectedParcelas={selectedParcelas}
                    onToggleSelect={toggleSelectParcela}
                  />
                ) : (
                  <>
                    <GrupoSection
                      titulo={filtroPeriodo === "atrasados3d" ? "🔴 Atrasados (+3 dias)" : "⚠️ Atrasados"}
                      parcelas={atrasadas}
                      onExecutar={abrirModal}
                      selectedParcelas={selectedParcelas}
                      onToggleSelect={toggleSelectParcela}
                    />
                    <GrupoSection
                      titulo="📅 Vencem hoje"
                      parcelas={deHoje}
                      onExecutar={abrirModal}
                      selectedParcelas={selectedParcelas}
                      onToggleSelect={toggleSelectParcela}
                    />
                    <GrupoSection
                      titulo="📆 Próximos 7 dias"
                      parcelas={proximos7}
                      onExecutar={abrirModal}
                      selectedParcelas={selectedParcelas}
                      onToggleSelect={toggleSelectParcela}
                    />
                    <GrupoSection
                      titulo="🗓️ Próximos 30 dias"
                      parcelas={proximos30}
                      onExecutar={abrirModal}
                      selectedParcelas={selectedParcelas}
                      onToggleSelect={toggleSelectParcela}
                    />
                  </>
                )}

                {parcelasExibidas.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2 rounded-lg border border-dashed bg-muted/10 p-6">
                    <p className="text-sm font-medium text-foreground">Nenhuma parcela encontrada.</p>
                    <p className="text-xs text-muted-foreground">
                      {dataInicio || dataFim
                        ? "Não há contas com vencimento no intervalo selecionado."
                        : filtroPeriodo !== "todos"
                        ? "Não há contas em aberto para o período selecionado. Tente clicar em 'Todos'."
                        : "Não há contas em aberto para o projeto selecionado."}
                    </p>
                    {(dataInicio || dataFim || filtroPeriodo !== "todos") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDataInicio("")
                          setDataFim("")
                          setFiltroPeriodo("todos")
                        }}
                        className="mt-2 text-xs"
                      >
                        Ver Todas as Parcelas
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Coluna da direita: Alertas de Vigência de Termo Aditivo */}
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
        </div>

        {/* Modal executar pagamento individual */}
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
                <CampoNotaFiscal
                  numero={formExec.numero_documento_fiscal}
                  onNumeroChange={v => setFormExec(f => ({ ...f, numero_documento_fiscal: v }))}
                  arquivo={arquivoNf}
                  onArquivoChange={setArquivoNf}
                  labelNumero="Nº Documento Fiscal / Recibo (Opcional)"
                  placeholderNumero="NF / RPA / Recibo..."
                  idInput="lembrete_nf_file"
                />
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

        {/* Modal executar em lote */}
        <Dialog open={openExecLote} onOpenChange={setOpenExecLote}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircleIcon className="size-5 text-emerald-600" />
                Registrar Pagamento em Lote ({selectedParcelasObjs.length})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelas Selecionadas:</span>
                  <span className="font-semibold text-foreground font-mono">{selectedParcelasObjs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total Previsto:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">{formatBRL(totalValorLote)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor / Prestador *</Label>
                <SelectComCriar
                  value={formExecLote.fornecedor_id}
                  onValueChange={v => setFormExecLote(f => ({ ...f, fornecedor_id: v }))}
                  opcoes={fornecedores.map(f => ({ id: f.id, label: f.razao_social_nome }))}
                  placeholder="Selecionar..."
                  labelCriar="Criar novo fornecedor"
                  onClickCriar={() => setOpenFornecedor(true)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Pagamento *</Label>
                <Input
                  type="date"
                  value={formExecLote.data_pagamento_real}
                  onChange={e => setFormExecLote(f => ({ ...f, data_pagamento_real: e.target.value }))}
                />
              </div>

              <CampoNotaFiscal
                numero={formExecLote.numero_documento_fiscal}
                onNumeroChange={v => setFormExecLote(f => ({ ...f, numero_documento_fiscal: v }))}
                arquivo={arquivoNfLote}
                onArquivoChange={setArquivoNfLote}
                labelNumero="Nº Documento Fiscal / Recibo em Lote (Opcional)"
                placeholderNumero="NF / RPA / Recibo..."
                idInput="lembrete_lote_nf_file"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpenExecLote(false)}>Cancelar</Button>
                <Button
                  onClick={executarLote}
                  disabled={salvandoLote || !formExecLote.fornecedor_id || !formExecLote.data_pagamento_real}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {salvandoLote ? "Salvando Lote..." : "Confirmar Pagamento em Lote"}
                </Button>
              </div>
            </div>
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
