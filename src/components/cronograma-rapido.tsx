"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarDaysIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowRightIcon,
  TrendingDownIcon,
  ReceiptIcon,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { mroscService } from "@/lib/api/mrosc-service"
import { useFiltroGlobal } from "@/contexts/filtro-global-context"
import type { ParcelaComRelacoes } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

export function CronogramaRapido() {
  const { instituicaoId, projetoId, projetosDisponiveis } = useFiltroGlobal()
  const [parcelas, setParcelas] = React.useState<ParcelaComRelacoes[]>([])
  const [loading, setLoading] = React.useState(true)

  // 1. Carregar parcelas
  const loadParcelas = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await mroscService.getParcelas()
      setParcelas(data)
    } catch (e) {
      console.error("Erro ao carregar parcelas do cronograma rápido:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadParcelas()
  }, [loadParcelas])

  // 2. Calcular os próximos 3 meses a partir do momento atual
  const mesesTres = React.useMemo(() => {
    const now = new Date()
    const result = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const ym = d.toISOString().slice(0, 7)
      const rawMonth = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(d)
      const year = d.getFullYear()
      const capitalized = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)

      result.push({
        ym,
        label: `${capitalized} de ${year}`,
        isAtual: i === 0,
      })
    }
    return result
  }, [])

  // 3. Filtrar parcelas pelo contexto global (instituição e projeto ativos)
  const parcelasFiltradas = React.useMemo(() => {
    return parcelas.filter((p) => {
      if (projetoId !== "ALL" && p.projeto_id !== projetoId) {
        return false
      }
      if (instituicaoId !== "ALL") {
        const pertenceInst = projetosDisponiveis.some((pr) => pr.id === p.projeto_id)
        if (!pertenceInst) return false
      }
      return true
    })
  }, [parcelas, projetoId, instituicaoId, projetosDisponiveis])

  return (
    <div className="flex flex-col gap-3 px-4 lg:px-6">
      {/* Título da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CalendarDaysIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Cronograma de Desembolso • Próximos 3 Meses
            </h3>
            <p className="text-xs text-muted-foreground">
              Previsão de fluxo de caixa, parcelas a vencer e liquidações programadas.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/orcamento" />}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 w-fit h-8"
        >
          Ver cronograma anual completo
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>

      {/* Grid de 3 Cards Mensais */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Carregando projeção de desembolsos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mesesTres.map((mes) => {
            const parcelasMes = parcelasFiltradas
              .filter((p) => p.data_vencimento && p.data_vencimento.startsWith(mes.ym))
              .sort((a, b) => (a.data_vencimento > b.data_vencimento ? 1 : -1))

            const previsto = parcelasMes.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0)
            const pago = parcelasMes
              .filter((p) => p.status === "PAGO")
              .reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0)
            const aPagar = Math.max(0, previsto - pago)

            return (
              <Card
                key={mes.ym}
                className={`flex flex-col justify-between transition-colors shadow-2xs ${
                  mes.isAtual
                    ? "border-emerald-500/40 bg-linear-to-b from-emerald-500/5 to-card"
                    : "bg-card"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-foreground">
                      {mes.label}
                    </CardTitle>
                    {mes.isAtual ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                      >
                        Mês Vigente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                        {parcelasMes.length} parc.
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {parcelasMes.length === 0
                      ? "Nenhum desembolso previsto"
                      : `${parcelasMes.length} obrigação(ões) programada(s)`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-3">
                  {/* Totais do Mês */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                        Previsto
                      </span>
                      <span className="font-bold text-foreground block text-xs truncate">
                        {formatCurrency(previsto)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                        Pago
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-xs truncate">
                        {formatCurrency(pago)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                        A Pagar
                      </span>
                      <span
                        className={`font-bold block text-xs truncate ${
                          aPagar > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {formatCurrency(aPagar)}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Parcelas */}
                  <div className="space-y-1.5 pt-1">
                    {parcelasMes.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 py-3 text-center italic">
                        Sem desembolsos programados
                      </p>
                    ) : (
                      parcelasMes.slice(0, 3).map((p) => {
                        const dia = p.data_vencimento ? p.data_vencimento.split("-")[2] : "--"
                        const isPago = p.status === "PAGO"
                        const isAtrasado = p.status === "ATRASADO"

                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted/30 text-xs border border-transparent hover:border-muted transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                Dia {dia}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-foreground font-medium text-[11px]">
                                  {p.descricao || p.rubricas_orcamentarias?.descricao || "Parcela"}
                                </p>
                                {p.projetos && projetoId === "ALL" && (
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {p.projetos.nome}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono font-semibold text-[11px] text-foreground">
                                {formatCurrency(p.valor_previsto)}
                              </span>
                              {isPago ? (
                                <CheckCircle2Icon className="size-3 text-emerald-600 dark:text-emerald-400" />
                              ) : isAtrasado ? (
                                <AlertTriangleIcon className="size-3 text-destructive" />
                              ) : (
                                <ClockIcon className="size-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}

                    {parcelasMes.length > 3 && (
                      <p className="text-[11px] text-muted-foreground text-center pt-1">
                        + {parcelasMes.length - 3} outra(s) parcela(s)
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t bg-muted/20 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {aPagar === 0 && previsto > 0 ? "Mês quitado" : "Fluxo ativo"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link
                        href={`/execucao?projetoId=${projetoId !== "ALL" ? projetoId : ""}`}
                      />
                    }
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                  >
                    <ReceiptIcon className="size-3" />
                    Executar
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
