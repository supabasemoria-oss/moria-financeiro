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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  ChevronDownIcon,
} from "lucide-react"
import type { ParcelaComRelacoes, Projeto, TipoRubrica } from "@/lib/types"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { formatDate, getTodaySaoPaulo, diasRestantesSaoPaulo } from "@/lib/utils"
import { RelogioHeader } from "@/components/relogio-header"
import { LembretesPopover } from "@/components/lembretes-popover"

// ---------------------------------------------------------------------------
// Helpers & Macro-Categorias
// ---------------------------------------------------------------------------
function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const diasRestantes = diasRestantesSaoPaulo

// Macro-Categorias oficiais do MROSC
const MACRO_CATEGORIAS: { id: TipoRubrica; label: string; icon: string }[] = [
  { id: "MATERIAL", label: "Compra de Materiais", icon: "📦" },
  { id: "SERVICO", label: "Serviços de Terceiros", icon: "🛠️" },
  { id: "RH", label: "Recursos Humanos (RH)", icon: "👥" },
  { id: "LOCACAO", label: "Locações", icon: "🏢" },
  { id: "OUTROS", label: "Outros / Encargos", icon: "📑" },
]

// Tipos de Filtro Rápido de Período
type FiltroPeriodo = "todos" | "atrasados3d" | "vencidos" | "hoje" | "semana" | "mes"

// ---------------------------------------------------------------------------
// GrupoSection — lista parcelas por grupo em grid compacto de 2 colunas
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
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {titulo}
          <span className="text-[11px] font-normal text-muted-foreground/80">({parcelas.length})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 min-w-0">
        {parcelas.map((p) => {
          const dias = diasRestantes(p.data_vencimento)
          const atrasado = p.status === "ATRASADO" || dias < 0
          const isSelected = selectedParcelas?.has(p.id) || false
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-lg border p-2.5 transition-all text-xs shadow-2xs min-w-0 ${
                isSelected
                  ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/40"
                  : atrasado
                  ? "bg-white dark:bg-card border-rose-200/80 hover:border-rose-300 dark:border-rose-900/50"
                  : "bg-white dark:bg-card border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {onToggleSelect && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(p.id)}
                    aria-label={`Selecionar ${p.descricao}`}
                    className="size-4 shrink-0"
                  />
                )}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-semibold text-xs text-foreground truncate" title={p.descricao}>
                    {p.descricao}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {p.projetos?.nome ?? "Sem projeto"}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        atrasado
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                          : dias === 0
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {atrasado
                        ? `Atrasado ${Math.abs(dias)}d`
                        : dias === 0
                        ? "Hoje"
                        : formatDate(p.data_vencimento)}
                    </span>
                    <span className="text-xs font-bold font-mono text-foreground">
                      {formatBRL(p.valor_previsto)}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onExecutar(p)}
                className="ml-2 h-7 px-2.5 text-[11px] font-medium border border-border rounded-md hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 dark:hover:bg-sky-950/50 shrink-0 transition-colors"
                title="Registrar pagamento individual"
              >
                Quitar
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function LembretesPage() {
  const { temAcessoAoProjeto } = usePermissoes()
  const [filtroProjeto, setFiltroProjeto] = useState<string>("")
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<TipoRubrica>>(new Set())
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

  // Alternar seleção de uma macro-categoria
  const toggleCategoria = (tipo: TipoRubrica) => {
    setCategoriasSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
  }

  const limparCategorias = () => {
    setCategoriasSelecionadas(new Set())
  }

  // Contadores por macro-categoria (baseados em todas as parcelas do projeto ativo)
  const contadoresCategoria = useMemo(() => {
    const counts: Record<TipoRubrica, number> = {
      MATERIAL: 0,
      SERVICO: 0,
      RH: 0,
      LOCACAO: 0,
      OUTROS: 0,
    }
    parcelas.forEach((p) => {
      if (p.status === "PAGO") return
      const tipo = (p.rubricas_orcamentarias?.tipo as TipoRubrica) || "OUTROS"
      if (counts[tipo] !== undefined) {
        counts[tipo]++
      } else {
        counts.OUTROS++
      }
    })
    return counts
  }, [parcelas])

  // Parcelas considerando as macro-categorias selecionadas (se nenhuma selecionada, considera todas)
  const parcelasBase = useMemo(() => {
    if (categoriasSelecionadas.size === 0) return parcelas
    return parcelas.filter((p) => {
      const tipo = (p.rubricas_orcamentarias?.tipo as TipoRubrica) || "OUTROS"
      return categoriasSelecionadas.has(tipo)
    })
  }, [parcelas, categoriasSelecionadas])

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

  // Contadores para os botões de filtro baseados nas parcelas (respeitando as categorias se filtradas)
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

  const resetFiltros = () => {
    setFiltroProjeto("")
    limparCategorias()
    setDataInicio("")
    setDataFim("")
    setFiltroPeriodo("todos")
    setSelectedParcelas(new Set())
  }

  const temFiltroAtivo = !!(
    filtroProjeto ||
    categoriasSelecionadas.size > 0 ||
    dataInicio ||
    dataFim ||
    filtroPeriodo !== "todos"
  )

  const textoFiltroAtivo = useMemo(() => {
    const partes: string[] = []

    if (categoriasSelecionadas.size > 0) {
      const nomesCat = Array.from(categoriasSelecionadas)
        .map((id) => MACRO_CATEGORIAS.find((c) => c.id === id)?.label || id)
        .join(", ")
      partes.push(`Categorias: ${nomesCat}`)
    }

    if (dataInicio || dataFim) {
      partes.push(`Período: ${dataInicio ? formatDate(dataInicio) : "início"} até ${dataFim ? formatDate(dataFim) : "fim"}`)
    } else if (filtroPeriodo !== "todos") {
      const map: Record<FiltroPeriodo, string> = {
        todos: "Todos",
        atrasados3d: "Atrasados (+3 dias)",
        vencidos: "Todos Vencidos",
        hoje: "Vencem Hoje",
        semana: "Esta Semana",
        mes: "Próximos 30 dias",
      }
      partes.push(`Prazo: ${map[filtroPeriodo]}`)
    }

    if (partes.length === 0) return "Todos os pagamentos"
    return partes.join(" · ")
  }, [categoriasSelecionadas, filtroPeriodo, dataInicio, dataFim])

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
      <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
        <header className="flex h-14 items-center gap-2 border-b px-4 min-w-0 overflow-x-auto sm:overflow-visible">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
          <BellIcon className="size-4 text-muted-foreground shrink-0" />
          <h1 className="font-semibold text-sm truncate">Lembretes & Agenda de Pagamentos</h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
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

        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 min-w-0 max-w-full">
          {/* Topo: Disparo de Resumo WhatsApp */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Agenda de Parcelas e Obrigações</h2>
              <p className="text-xs text-muted-foreground">Acompanhe os prazos de liquidação e execute pagamentos</p>
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

          {/* TOOLBAR MINIMALISTA DE FILTROS (2 LINHAS COMPACTAS E RESPONSIVAS) */}
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs space-y-2.5 min-w-0 max-w-full">
            {/* LINHA 1: SEGMENTED CONTROL DE PRAZOS + AÇÕES RÁPIDAS */}
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              {/* Segmented Control / Pílulas de Seleção de Prazo */}
              <div className="flex flex-wrap items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo("todos")
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "todos"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <span>Todos</span>
                  <span className="text-[10px] font-mono opacity-80">{contadores.total}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo((f) => (f === "atrasados3d" ? "todos" : "atrasados3d"))
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "atrasados3d"
                      ? "bg-rose-500 text-white shadow-2xs font-semibold"
                      : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  }`}
                  title="Filtrar parcelas pendentes com mais de 3 dias de atraso"
                >
                  <span>🔴 Atrasados (+3d)</span>
                  <span className="text-[10px] font-mono opacity-80">{contadores.atrasados3d}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo((f) => (f === "vencidos" ? "todos" : "vencidos"))
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "vencidos"
                      ? "bg-amber-500 text-white shadow-2xs font-semibold"
                      : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                  title="Filtrar todas as parcelas já vencidas"
                >
                  <span>⚠️ Vencidos</span>
                  <span className="text-[10px] font-mono opacity-80">{contadores.vencidos}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo((f) => (f === "hoje" ? "todos" : "hoje"))
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "hoje"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                  title="Filtrar parcelas que vencem hoje"
                >
                  <span>📅 Hoje</span>
                  <span className="text-[10px] font-mono opacity-80">{contadores.hoje}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo((f) => (f === "semana" ? "todos" : "semana"))
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "semana"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                  title="Filtrar parcelas dos próximos 7 dias"
                >
                  <span>📆 Esta Semana</span>
                  <span className="text-[10px] font-mono opacity-80">{contadores.semana}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataInicio("")
                    setDataFim("")
                    setFiltroPeriodo((f) => (f === "mes" ? "todos" : "mes"))
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !dataInicio && !dataFim && filtroPeriodo === "mes"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                  title="Filtrar parcelas dos próximos 30 dias"
                >
                  <span>🗓️ 30 dias</span>
                  <span className="text-[10px] font-mono opacity-80">{contadores.mes}</span>
                </button>
              </div>

              {/* Botões Limpar Filtros e Marcar Todas */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {temFiltroAtivo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetFiltros}
                    className="h-7 px-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10 gap-1"
                  >
                    <XIcon className="size-3.5" />
                    Limpar Filtros
                  </Button>
                )}

                {parcelasVisiveisPendentes.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleSelectVisiveis}
                    className="h-7 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 border-emerald-200 dark:border-emerald-800 gap-1.5 shadow-2xs"
                  >
                    <CheckIcon className="size-3.5 text-emerald-600" />
                    {todasVisiveisSelecionadas ? "Desmarcar do Filtro" : "Marcar Todas do Filtro"}
                  </Button>
                )}
              </div>
            </div>

            {/* LINHA 2: DROPDOWNS E FILTROS DE ESCOPO EM UMA ÚNICA FAIXA AREJADA */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/50 text-xs min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {/* Dropdown Projeto Compacto */}
                <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-2.5 py-1">
                  <span className="text-muted-foreground text-xs font-medium shrink-0">Projeto:</span>
                  <select
                    value={filtroProjeto}
                    onChange={(e) => setFiltroProjeto(e.target.value)}
                    className="bg-transparent font-medium text-foreground text-xs focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
                  >
                    <option value="" className="bg-background text-foreground">Todos os Projetos</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id} className="bg-background text-foreground">
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Popover Multiselect de Macro-Categorias */}
                <Popover>
                  <PopoverTrigger className="flex items-center gap-1.5 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg px-2.5 py-1 text-xs text-foreground transition-colors cursor-pointer shrink-0">
                    <span className="text-muted-foreground">Categorias:</span>
                    <span className="font-semibold text-foreground">
                      {categoriasSelecionadas.size === 0
                        ? "Todas"
                        : `${categoriasSelecionadas.size} selecionada(s)`}
                    </span>
                    <ChevronDownIcon className="size-3 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border px-1 font-semibold text-muted-foreground">
                      <span>Filtrar Categorias</span>
                      {categoriasSelecionadas.size > 0 ? (
                        <button
                          type="button"
                          onClick={limparCategorias}
                          className="text-[11px] text-primary hover:underline font-normal"
                        >
                          Marcar Todas
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-normal">Todas ativas</span>
                      )}
                    </div>

                    {MACRO_CATEGORIAS.map((cat) => {
                      const isChecked = categoriasSelecionadas.has(cat.id)
                      const count = contadoresCategoria[cat.id] || 0
                      return (
                        <label
                          key={cat.id}
                          className="flex items-center justify-between p-1.5 hover:bg-muted rounded-md cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCategoria(cat.id)}
                              className="size-3.5"
                            />
                            <span className="truncate">{cat.icon} {cat.label}</span>
                          </div>
                          <span className="font-mono text-muted-foreground text-[11px] ml-2 shrink-0">
                            {count}
                          </span>
                        </label>
                      )
                    })}
                  </PopoverContent>
                </Popover>

                {/* Intervalo de Datas Compacto De / Até */}
                <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-2 py-0.5 shrink-0">
                  <span className="text-muted-foreground text-[11px]">De</span>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value)
                      if (e.target.value) setFiltroPeriodo("todos")
                    }}
                    className="bg-transparent text-foreground text-xs focus:outline-none w-28"
                  />
                  <span className="text-muted-foreground text-[11px]">Até</span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => {
                      setDataFim(e.target.value)
                      if (e.target.value) setFiltroPeriodo("todos")
                    }}
                    className="bg-transparent text-foreground text-xs focus:outline-none w-28"
                  />
                  {(dataInicio || dataFim) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDataInicio("")
                        setDataFim("")
                      }}
                      className="text-muted-foreground hover:text-destructive text-xs p-0.5 ml-0.5"
                      title="Limpar datas"
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Indicador de Status Discreto */}
              <span className="text-[11px] text-muted-foreground font-medium truncate max-w-full sm:max-w-xs shrink-0" title={textoFiltroAtivo}>
                Exibindo: <strong className="text-foreground">{textoFiltroAtivo}</strong>
              </span>
            </div>
          </div>

          {/* Barra de Ações em Lote (Resumo e Execução) */}
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

          {/* Conteúdo principal de Parcelas */}
          {loading && <p className="text-muted-foreground text-sm">Carregando parcelas...</p>}
          {!loading && (
            <div className="space-y-6">
              {/* Alertas de Vigência de Termo Aditivo (se houver) */}
              {vigencia.length > 0 && (
                <Card className="border-orange-200 bg-orange-50/70">
                  <CardHeader className="py-2.5 px-4">
                    <CardTitle className="text-xs font-bold text-orange-700 flex items-center gap-1.5">
                      <span>⏰</span> Alertas de Vigência — Termo Aditivo ({vigencia.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {vigencia.map((a) => (
                      <div key={a.id} className="rounded-md border border-orange-200 bg-white p-2.5 text-xs">
                        <p className="font-semibold text-foreground truncate">{a.projeto_nome}</p>
                        <p className="text-[11px] text-orange-700 font-medium">{a.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{a.descricao}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-1">Vigência até: {formatDate(a.data_referencia)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Seções de Parcelas em Grid de 2 Colunas */}
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
