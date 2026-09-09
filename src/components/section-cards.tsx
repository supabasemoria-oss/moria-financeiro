"use client"

import { useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TrendingUpIcon,
  ShieldCheckIcon,
  FolderKanbanIcon,
  DollarSignIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { moriaService } from "@/lib/api/moria-service"
import { formatCurrency } from "@/lib/utils"
import { calcularTotalPago, calcularTotalPendente } from "@/lib/calculos"
import { useMoriaQuery } from "@/hooks/use-moria-query"
import type { Projeto, Despesa } from "@/lib/types"

export function SectionCards() {
  const fetchProjetos = useCallback(
    () => moriaService.getProjetos(),
    []
  )
  const fetchDespesas = useCallback(
    () => moriaService.getDespesas(),
    []
  )

  const { data: projetos } = useMoriaQuery<Projeto[]>(
    fetchProjetos,
    []
  )
  const { data: despesas } = useMoriaQuery<Despesa[]>(
    fetchDespesas,
    []
  )

  const tetoTotal = projetos.reduce(
    (acc, p) => acc + Number(p.valor_total_aprovado || 0),
    0
  )
  const totalPago = calcularTotalPago(despesas)
  const totalPendente = calcularTotalPendente(despesas)
  const saldoRemanescente = tetoTotal - totalPago
  const percentExecutado =
    tetoTotal > 0 ? ((totalPago / tetoTotal) * 100).toFixed(1) : "0.0"

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card items-stretch">
      <Card className="@container/card flex flex-col justify-between h-full">
        <CardHeader className="flex flex-col justify-between h-[108px] p-4 pb-2">
          <div className="flex items-center justify-between gap-2 w-full h-6">
            <CardDescription className="text-xs font-medium text-muted-foreground truncate">
              Teto Total Aprovado
            </CardDescription>
            <CardAction className="shrink-0">
              <Badge
                variant="outline"
                className="gap-1 font-medium text-[11px] px-2 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                <TrendingUpIcon className="size-3 text-emerald-600" />
                MROSC
              </Badge>
            </CardAction>
          </div>
          <CardTitle className="text-2xl font-bold tabular-nums tracking-tight text-foreground truncate">
            {formatCurrency(tetoTotal)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-col items-start justify-center gap-1 p-4 pt-3 text-xs h-[72px] border-t bg-muted/20">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Planos de trabalho aprovados
            <ShieldCheckIcon className="size-3.5 text-emerald-600 shrink-0" />
          </div>
          <div className="text-muted-foreground truncate w-full">
            Limite pactuado em convênios
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card flex flex-col justify-between h-full">
        <CardHeader className="flex flex-col justify-between h-[108px] p-4 pb-2">
          <div className="flex items-center justify-between gap-2 w-full h-6">
            <CardDescription className="text-xs font-medium text-muted-foreground truncate">
              Projetos & Termos
            </CardDescription>
            <CardAction className="shrink-0">
              <Badge variant="outline" className="gap-1 font-medium text-[11px] px-2">
                <FolderKanbanIcon className="size-3 text-blue-500" />
                {projetos.length} OSCs
              </Badge>
            </CardAction>
          </div>
          <CardTitle className="text-2xl font-bold tabular-nums tracking-tight text-foreground truncate">
            {projetos.length}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-col items-start justify-center gap-1 p-4 pt-3 text-xs h-[72px] border-t bg-muted/20">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Termos em execução
            <FolderKanbanIcon className="size-3.5 text-blue-500 shrink-0" />
          </div>
          <div className="text-muted-foreground truncate w-full">
            Entidades parceiras cadastradas
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card flex flex-col justify-between h-full">
        <CardHeader className="flex flex-col justify-between h-[108px] p-4 pb-2">
          <div className="flex items-center justify-between gap-2 w-full h-6">
            <CardDescription className="text-xs font-medium text-muted-foreground truncate">
              Executado / Pago
            </CardDescription>
            <CardAction className="shrink-0">
              <Badge
                variant="outline"
                className="gap-1 font-medium text-[11px] px-2 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                <CheckCircle2Icon className="size-3 text-emerald-600" />
                {percentExecutado}%
              </Badge>
            </CardAction>
          </div>
          <CardTitle className="text-2xl font-bold tabular-nums tracking-tight text-foreground truncate">
            {formatCurrency(totalPago)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-col items-start justify-center gap-1 p-4 pt-3 text-xs h-[72px] border-t bg-muted/20">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Despesas quitadas
            <CheckCircle2Icon className="size-3.5 text-emerald-600 shrink-0" />
          </div>
          <div className="text-muted-foreground truncate w-full">
            {formatCurrency(totalPendente)} em aprovação
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card flex flex-col justify-between h-full">
        <CardHeader className="flex flex-col justify-between h-[108px] p-4 pb-2">
          <div className="flex items-center justify-between gap-2 w-full h-6">
            <CardDescription className="text-xs font-medium text-muted-foreground truncate">
              Saldo Disponível
            </CardDescription>
            <CardAction className="shrink-0">
              <Badge
                variant="outline"
                className="gap-1 font-medium text-[11px] px-2 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                <DollarSignIcon className="size-3 text-emerald-600" />
                Regular
              </Badge>
            </CardAction>
          </div>
          <CardTitle className="text-2xl font-bold tabular-nums tracking-tight text-foreground truncate">
            {formatCurrency(saldoRemanescente)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-col items-start justify-center gap-1 p-4 pt-3 text-xs h-[72px] border-t bg-muted/20">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Saldo sob controle MROSC
            <TrendingUpIcon className="size-3.5 text-emerald-600 shrink-0" />
          </div>
          <div className="text-muted-foreground truncate w-full">
            Sem extrapolação de teto
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
