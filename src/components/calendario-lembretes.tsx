"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon, ClockIcon, CalendarClockIcon, ArrowRightIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useParcelas } from "@/hooks/use-parcelas"
import { useAlertas } from "@/hooks/use-alertas"

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]
const MESES = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

export function CalendarioLembretes() {
  const { data: parcelas } = useParcelas({ proximosDias: 90 })
  const { alertas } = useAlertas()

  const hoje = new Date()
  const [mes, setMes] = React.useState(hoje.getMonth())
  const [ano, setAno] = React.useState(hoje.getFullYear())
  const [diaSelecionado, setDiaSelecionado] = React.useState<string | null>(null)

  // Indexar parcelas por data yyyy-mm-dd
  const parcelasPorDia = React.useMemo(() => {
    const map: Record<string, typeof parcelas> = {}
    for (const p of parcelas) {
      const d = p.data_vencimento.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(p)
    }
    return map
  }, [parcelas])

  // Indexar alertas por data (usa data_vencimento das parcelas associadas)
  const alertasPorDia = React.useMemo(() => {
    const map: Record<string, typeof alertas> = {}
    for (const a of alertas) {
      if (!a.referencia_id) continue
      const parcela = parcelas.find(p => p.id === a.referencia_id)
      if (!parcela) continue
      const d = parcela.data_vencimento.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(a)
    }
    return map
  }, [alertas, parcelas])

  // Gerar dias do mes
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

  const diaHojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`

  const itemsSelecionados = diaSelecionado ? (parcelasPorDia[diaSelecionado] ?? []) : []

  function navMes(delta: number) {
    const novoMes = mes + delta
    if (novoMes < 0) { setMes(11); setAno(a => a - 1) }
    else if (novoMes > 11) { setMes(0); setAno(a => a + 1) }
    else setMes(novoMes)
    setDiaSelecionado(null)
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-emerald-600" />
          Calend?rio de Lembretes
        </CardTitle>
        <Link href="/lembretes">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
            Ver todos <ArrowRightIcon className="size-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Calendario */}
        <div>
          {/* Cabecalho mes */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(-1)}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-sm font-semibold">{MESES[mes]} {ano}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(1)}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
            ))}
          </div>

          {/* Celulas */}
          <div className="grid grid-cols-7 gap-0.5">
            {celulas.map((dia, idx) => {
              if (!dia) return <div key={idx} />
              const iso = isoData(dia)
              const temParcela = !!parcelasPorDia[iso]?.length
              const temUrgente = parcelasPorDia[iso]?.some(p => p.status === "ATRASADO" || p.status === "PENDENTE") && alertasPorDia[iso]?.some(a => a.nivel === "URGENTE")
              const isHoje = iso === diaHojeStr
              const isSelecionado = iso === diaSelecionado

              return (
                <button
                  key={idx}
                  onClick={() => setDiaSelecionado(isSelecionado ? null : iso)}
                  className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition-colors
                    ${isSelecionado ? "bg-emerald-600 text-white" : isHoje ? "bg-muted font-bold" : "hover:bg-muted/60"}
                    ${temParcela && !isSelecionado ? "font-medium" : ""}
                  `}
                >
                  {dia}
                  {temParcela && (
                    <span className={`absolute bottom-0.5 size-1 rounded-full ${temUrgente ? "bg-red-500" : isSelecionado ? "bg-white" : "bg-emerald-500"}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" /> Parcela pendente</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 inline-block" /> Urgente / Atrasado</span>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="border-l pl-4">
          {diaSelecionado ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {new Date(diaSelecionado + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {itemsSelecionados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma parcela neste dia.</p>
              ) : (
                itemsSelecionados.map(p => {
                  const atrasado = p.status === "ATRASADO"
                  return (
                    <div key={p.id} className={`rounded-lg border p-2.5 ${atrasado ? "border-red-200 bg-red-50" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-medium leading-snug line-clamp-2">{p.descricao}</span>
                        {atrasado ? <AlertTriangleIcon className="size-3.5 text-red-500 shrink-0 mt-0.5" /> : <ClockIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.projetos?.nome ?? "?"}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge variant={atrasado ? "destructive" : "outline"} className="text-xs h-4 px-1">
                          {p.status}
                        </Badge>
                        <span className="text-xs font-semibold">{fmtBRL(p.valor_previsto)}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <Link href="/lembretes" className="text-xs text-emerald-600 hover:underline mt-1">
                Executar parcelas ?
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
              <CalendarClockIcon className="size-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Clique em um dia com<br />marcador para ver as parcelas</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
