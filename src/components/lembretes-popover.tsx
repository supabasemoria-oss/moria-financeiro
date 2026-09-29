"use client"

import * as React from "react"
import Link from "next/link"
import {
  BellIcon,
  AlertTriangleIcon,
  ClockIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  CalendarIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useParcelas } from "@/hooks/use-parcelas"
import { mroscService } from "@/lib/api/mrosc-service"
import { formatDate, formatCurrency, getTodaySaoPaulo, diasRestantesSaoPaulo } from "@/lib/utils"
import type { LembreteAvulso, ParcelaComRelacoes } from "@/lib/types"

export function LembretesPopover() {
  const [open, setOpen] = React.useState(false)
  const [lembretesAvulsos, setLembretesAvulsos] = React.useState<LembreteAvulso[]>([])
  const [loadingLembretes, setLoadingLembretes] = React.useState(false)

  const { data: parcelas, loading: loadingParcelas, refetch } = useParcelas({ proximosDias: 30 })

  const carregarLembretes = React.useCallback(async () => {
    try {
      setLoadingLembretes(true)
      const data = await mroscService.getLembretesAvulsos()
      setLembretesAvulsos(data.filter((l) => l.status === "PENDENTE"))
    } catch {
      setLembretesAvulsos([])
    } finally {
      setLoadingLembretes(false)
    }
  }, [])

  React.useEffect(() => {
    carregarLembretes()
  }, [carregarLembretes])

  const hoje = getTodaySaoPaulo()

  // Agrupamentos
  const atrasadas = React.useMemo(
    () => parcelas.filter((p) => p.status === "ATRASADO"),
    [parcelas]
  )

  const deHoje = React.useMemo(
    () => parcelas.filter((p) => p.data_vencimento === hoje && p.status !== "PAGO"),
    [parcelas, hoje]
  )

  const proximosDias = React.useMemo(
    () =>
      parcelas.filter((p) => {
        const d = diasRestantesSaoPaulo(p.data_vencimento)
        return d > 0 && d <= 7 && p.status !== "PAGO"
      }),
    [parcelas]
  )

  const totalPendentes =
    atrasadas.length + deHoje.length + proximosDias.length + lembretesAvulsos.length

  const temUrgente = atrasadas.length > 0 || deHoje.length > 0

  const handleRecarregar = () => {
    refetch()
    carregarLembretes()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex items-center justify-center size-9 rounded-full border border-border/60 bg-background hover:bg-muted/60 text-foreground transition-colors cursor-pointer"
        title="Ver lembretes e alertas de pagamentos"
      >
        <BellIcon className="size-4 text-foreground" />
        {totalPendentes > 0 && (
          <>
            {temUrgente && (
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-3 bg-red-500" />
              </span>
            )}
            <span
              className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs ${
                temUrgente ? "bg-red-600" : "bg-amber-600"
              }`}
            >
              {totalPendentes > 9 ? "9+" : totalPendentes}
            </span>
          </>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-xl border-border/80 bg-background overflow-hidden"
      >
        {/* Header do Popover */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BellIcon className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-xs leading-none text-foreground">
                Lembretes & Alertas
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalPendentes === 0
                  ? "Nenhuma pendência para hoje"
                  : `${totalPendentes} item(ns) requer atenção`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleRecarregar}
              title="Atualizar lista"
            >
              <RefreshCwIcon
                className={`size-3.5 ${
                  loadingParcelas || loadingLembretes ? "animate-spin" : ""
                }`}
              />
            </Button>
            {totalPendentes > 0 && (
              <Badge
                variant={temUrgente ? "destructive" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-5 font-semibold"
              >
                {totalPendentes}
              </Badge>
            )}
          </div>
        </div>

        {/* Lista de itens com scroll */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
          {totalPendentes === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
                <CheckCircle2Icon className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">Tudo em dia!</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nenhum pagamento ou lembrete pendente nos próximos 7 dias.
              </p>
            </div>
          ) : (
            <>
              {/* Parcelas Atrasadas */}
              {atrasadas.map((p) => (
                <div
                  key={`atrasada-${p.id}`}
                  className="group flex flex-col gap-1 rounded-md p-2 text-xs transition-colors hover:bg-red-50/60 dark:hover:bg-red-950/20 border border-red-200/50 bg-red-50/30 dark:bg-red-950/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1 truncate">
                      <AlertTriangleIcon className="size-3 shrink-0" />
                      {p.descricao}
                    </span>
                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0 font-medium">
                      Atrasado
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{p.projetos?.nome ?? "Sem projeto"}</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Number(p.valor_previsto))}
                    </span>
                  </div>
                </div>
              ))}

              {/* Parcelas Vencendo Hoje */}
              {deHoje.map((p) => (
                <div
                  key={`hoje-${p.id}`}
                  className="group flex flex-col gap-1 rounded-md p-2 text-xs transition-colors hover:bg-amber-50/60 dark:hover:bg-amber-950/20 border border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 truncate">
                      <ClockIcon className="size-3 shrink-0 text-amber-600" />
                      {p.descricao}
                    </span>
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] px-1 py-0 h-4 shrink-0 font-medium">
                      Vence Hoje
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{p.projetos?.nome ?? "Sem projeto"}</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Number(p.valor_previsto))}
                    </span>
                  </div>
                </div>
              ))}

              {/* Parcelas Próximos 7 Dias */}
              {proximosDias.map((p) => (
                <div
                  key={`prox-${p.id}`}
                  className="group flex flex-col gap-1 rounded-md p-2 text-xs transition-colors hover:bg-muted/50 border border-border/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">{p.descricao}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {formatDate(p.data_vencimento)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{p.projetos?.nome ?? "Sem projeto"}</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Number(p.valor_previsto))}
                    </span>
                  </div>
                </div>
              ))}

              {/* Lembretes Avulsos */}
              {lembretesAvulsos.map((l) => (
                <div
                  key={`avulso-${l.id}`}
                  className="group flex flex-col gap-1 rounded-md p-2 text-xs transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border border-blue-200/40 bg-blue-50/20 dark:bg-blue-950/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-blue-950 dark:text-blue-200 flex items-center gap-1 truncate">
                      <CalendarIcon className="size-3 text-blue-600 shrink-0" />
                      {l.titulo}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 text-blue-700 dark:text-blue-300 border-blue-300">
                      Lembrete
                    </Badge>
                  </div>
                  {l.descricao && (
                    <p className="text-[11px] text-muted-foreground truncate">{l.descricao}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-0.5">
                    <span>Vencimento: {formatDate(l.data_vencimento)}</span>
                    {l.valor && (
                      <span className="font-semibold text-foreground">
                        {formatCurrency(Number(l.valor))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer com link para página de lembretes */}
        <div className="border-t bg-muted/20 px-3 py-2 flex items-center justify-between text-xs">
          <Link
            href="/lembretes"
            onClick={() => setOpen(false)}
            className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-primary hover:underline"
          >
            <span>Ver painel completo de lembretes</span>
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
