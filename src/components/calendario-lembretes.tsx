"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  ClockIcon,
  CalendarClockIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useParcelas } from "@/hooks/use-parcelas"
import { useAlertas } from "@/hooks/use-alertas"
import { mroscService } from "@/lib/api/mrosc-service"
import { getTodaySaoPaulo, formatCurrency, TIMEZONE_SP } from "@/lib/utils"
import type { LembreteAvulso, ParcelaComRelacoes } from "@/lib/types"

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

export function CalendarioLembretes() {
  const { data: parcelas } = useParcelas()
  const { alertas } = useAlertas()
  const [lembretesAvulsos, setLembretesAvulsos] = React.useState<LembreteAvulso[]>([])

  const diaHojeStr = getTodaySaoPaulo()
  const [anoHoje, mesHoje] = diaHojeStr.split("-").map(Number)
  const [mes, setMes] = React.useState(mesHoje - 1)
  const [ano, setAno] = React.useState(anoHoje)
  const [diaSelecionado, setDiaSelecionado] = React.useState<string | null>(null)

  // Carregar lembretes avulsos
  React.useEffect(() => {
    let active = true
    mroscService
      .getLembretesAvulsos()
      .then((data) => {
        if (active) setLembretesAvulsos(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Indexar parcelas por data yyyy-mm-dd
  const parcelasPorDia = React.useMemo(() => {
    const map: Record<string, ParcelaComRelacoes[]> = {}
    for (const p of parcelas) {
      const d = p.data_vencimento?.slice(0, 10)
      if (!d) continue
      if (!map[d]) map[d] = []
      map[d].push(p)
    }
    return map
  }, [parcelas])

  // Indexar lembretes avulsos por data yyyy-mm-dd
  const lembretesPorDia = React.useMemo(() => {
    const map: Record<string, LembreteAvulso[]> = {}
    for (const l of lembretesAvulsos) {
      const d = l.data_vencimento?.slice(0, 10)
      if (!d) continue
      if (!map[d]) map[d] = []
      map[d].push(l)
    }
    return map
  }, [lembretesAvulsos])

  // Indexar alertas por data
  const alertasPorDia = React.useMemo(() => {
    const map: Record<string, typeof alertas> = {}
    for (const a of alertas) {
      if (!a.referencia_id) continue
      const parcela = parcelas.find((p) => p.id === a.referencia_id)
      if (!parcela) continue
      const d = parcela.data_vencimento?.slice(0, 10)
      if (!d) continue
      if (!map[d]) map[d] = []
      map[d].push(a)
    }
    return map
  }, [alertas, parcelas])

  // Gerar dias do mês
  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0)
  const offsetInicio = primeiroDia.getDay()
  const totalCelulas = offsetInicio + ultimoDia.getDate()
  const totalSemanas = Math.ceil(totalCelulas / 7)
  const celulas: (number | null)[] = Array(totalSemanas * 7).fill(null)
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    celulas[offsetInicio + d - 1] = d
  }

  function isoData(dia: number) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
  }

  const parcelasDia = diaSelecionado ? (parcelasPorDia[diaSelecionado] ?? []) : []
  const lembretesDia = diaSelecionado ? (lembretesPorDia[diaSelecionado] ?? []) : []
  const totalItensDia = parcelasDia.length + lembretesDia.length

  function navMes(delta: number) {
    const novoMes = mes + delta
    if (novoMes < 0) {
      setMes(11)
      setAno((a) => a - 1)
    } else if (novoMes > 11) {
      setMes(0)
      setAno((a) => a + 1)
    } else {
      setMes(novoMes)
    }
    setDiaSelecionado(null)
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-emerald-600" />
          Calendário de Lembretes
        </CardTitle>
        <Link href="/lembretes">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
            Ver todos <ArrowRightIcon className="size-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Calendário */}
        <div>
          {/* Cabeçalho do mês */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(-1)}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-sm font-semibold">
              {MESES[mes]} {ano}
            </span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(1)}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Células */}
          <div className="grid grid-cols-7 gap-0.5">
            {celulas.map((dia, idx) => {
              if (!dia) return <div key={idx} />
              const iso = isoData(dia)
              const hasParcelas = !!parcelasPorDia[iso]?.length
              const hasLembretes = !!lembretesPorDia[iso]?.length
              const temItem = hasParcelas || hasLembretes

              const temUrgente =
                (parcelasPorDia[iso]?.some((p) => p.status === "ATRASADO") ||
                  alertasPorDia[iso]?.some((a) => a.nivel === "URGENTE") ||
                  lembretesPorDia[iso]?.some((l) => l.status === "PENDENTE" && iso < diaHojeStr)) ??
                false

              const isHoje = iso === diaHojeStr
              const isSelecionado = iso === diaSelecionado

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDiaSelecionado(isSelecionado ? null : iso)}
                  className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition-colors
                    ${isSelecionado ? "bg-emerald-600 text-white font-bold" : isHoje ? "bg-muted border border-emerald-500 font-bold" : "hover:bg-muted/60"}
                    ${temItem && !isSelecionado ? "font-medium" : ""}
                  `}
                >
                  {dia}
                  {temItem && (
                    <span
                      className={`absolute bottom-0.5 size-1.5 rounded-full ${
                        temUrgente ? "bg-red-500" : isSelecionado ? "bg-white" : "bg-emerald-500"
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Previsto / Em aberto
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-red-500 inline-block" /> Atrasado / Urgente
            </span>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-4">
          {diaSelecionado ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {new Intl.DateTimeFormat("pt-BR", {
                  timeZone: TIMEZONE_SP,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(diaSelecionado + "T12:00:00"))}
              </p>
              {totalItensDia === 0 ? (
                <p className="text-xs text-muted-foreground py-4">Nenhum compromisso ou parcela neste dia.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {/* Parcelas */}
                  {parcelasDia.map((p) => {
                    const atrasado = p.status === "ATRASADO"
                    return (
                      <div
                        key={`parc-${p.id}`}
                        className={`rounded-lg border p-2.5 ${atrasado ? "border-red-200 bg-red-50/50" : "border-border"}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-medium leading-snug line-clamp-2">{p.descricao}</span>
                          {atrasado ? (
                            <AlertTriangleIcon className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                          ) : (
                            <ClockIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {p.projetos?.nome ?? "Sem projeto vinculado"}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <Badge variant={atrasado ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                            {p.status}
                          </Badge>
                          <span className="text-xs font-semibold">{formatCurrency(p.valor_previsto)}</span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Lembretes Avulsos */}
                  {lembretesDia.map((l) => {
                    const concluido = l.status === "CONCLUIDO"
                    return (
                      <div key={`lemb-${l.id}`} className="rounded-lg border border-border p-2.5 bg-muted/20">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-medium leading-snug line-clamp-2">{l.titulo}</span>
                          {concluido ? (
                            <CheckCircle2Icon className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <ClockIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                        </div>
                        {l.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{l.descricao}</p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {l.status}
                          </Badge>
                          {l.valor ? (
                            <span className="text-xs font-semibold">{formatCurrency(l.valor)}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Lembrete</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <Link href="/lembretes" className="text-xs text-emerald-600 hover:underline mt-2 flex items-center gap-1 font-medium">
                Gerenciar parcelas e lembretes <ArrowRightIcon className="size-3" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
              <CalendarClockIcon className="size-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                Clique em um dia com marcador
                <br />
                para ver os compromissos
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
