"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { moriaService } from "@/lib/api/moria-service"
import { useMoriaQuery } from "@/hooks/use-moria-query"
import type { DespesaComRelacoes } from "@/lib/types"

export const description =
  "Gráfico interativo de execução orçamentária Moriá"

const chartConfig = {
  despesas: {
    label: "Despesas (R$)",
  },
  orcado: {
    label: "Orçado Acumulado (R$)",
    color: "var(--chart-1)",
  },
  executado: {
    label: "Executado / Pago (R$)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function buildChartData(
  despesas: DespesaComRelacoes[]
): { date: string; orcado: number; executado: number }[] {
  const pagos = despesas.filter((d) => d.status === "PAGO")
  if (pagos.length === 0) return []

  const byDate = new Map<
    string,
    { orcado: number; executado: number }
  >()

  for (const d of pagos) {
    const date = d.data_pagamento ?? d.data_despesa
    const entry = byDate.get(date) ?? { orcado: 0, executado: 0 }
    entry.executado += Number(d.valor || 0)
    const rubrica = d.rubricas_orcamentarias
    if (rubrica) {
      entry.orcado += Number(rubrica.valor_total || 0)
    }
    byDate.set(date, entry)
  }

  const sorted = Array.from(byDate.entries()).sort(
    ([a], [b]) => a.localeCompare(b)
  )

  let accOrcado = 0
  let accExecutado = 0
  return sorted.map(([date, { orcado, executado }]) => {
    accOrcado += orcado
    accExecutado += executado
    return { date, orcado: accOrcado, executado: accExecutado }
  })
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  const fetchDespesas = React.useCallback(
    () => moriaService.getDespesas(),
    []
  )
  const { data: despesas } = useMoriaQuery<DespesaComRelacoes[]>(
    fetchDespesas,
    []
  )

  const chartData = React.useMemo(
    () => buildChartData(despesas),
    [despesas]
  )

  const filteredData = React.useMemo(() => {
    if (chartData.length === 0) return []
    const lastDate = new Date(chartData[chartData.length - 1].date)
    let daysToSubtract = 90
    if (timeRange === "30d") daysToSubtract = 30
    else if (timeRange === "7d") daysToSubtract = 7
    const startDate = new Date(lastDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return chartData.filter(
      (item) => new Date(item.date) >= startDate
    )
  }, [chartData, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>
          Execução Financeira & Auditoria de Tetos
        </CardTitle>
        <CardDescription>
          Batimento contábil entre previsão orçamentária e pagamentos
          realizados
        </CardDescription>
        <CardAction>
          {isMobile ? (
            <Select
              value={timeRange}
              onValueChange={(val) => {
                if (val) setTimeRange(val)
              }}
            >
              <SelectTrigger
                className="w-40"
                aria-label="Selecionar período"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">
                  Últimos 3 meses
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Últimos 30 dias
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Últimos 7 dias
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <ToggleGroup
              value={[timeRange]}
              onValueChange={(val: string[]) => {
                if (val && val.length > 0) setTimeRange(val[0])
              }}
              variant="outline"
            >
              <ToggleGroupItem value="90d">
                3 Meses
              </ToggleGroupItem>
              <ToggleGroupItem value="30d">
                30 Dias
              </ToggleGroupItem>
              <ToggleGroupItem value="7d">7 Dias</ToggleGroupItem>
            </ToggleGroup>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            Nenhuma despesa paga registrada para gerar o gráfico.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient
                  id="fillOrcado"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-orcado)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-orcado)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient
                  id="fillExecutado"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-executado)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-executado)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("pt-BR", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString(
                        "pt-BR",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="orcado"
                type="natural"
                fill="url(#fillOrcado)"
                stroke="var(--color-orcado)"
                stackId="a"
              />
              <Area
                dataKey="executado"
                type="natural"
                fill="url(#fillExecutado)"
                stroke="var(--color-executado)"
                stackId="b"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
