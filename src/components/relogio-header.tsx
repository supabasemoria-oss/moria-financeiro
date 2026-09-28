"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

export function RelogioHeader() {
  const [mounted, setMounted] = React.useState(false)
  const [hora, setHora] = React.useState("")
  const [dataExtenso, setDataExtenso] = React.useState("")

  React.useEffect(() => {
    setMounted(true)

    const atualizar = () => {
      const agora = new Date()

      const fmtHora = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(agora)

      const fmtData = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(agora)

      setHora(fmtHora)
      setDataExtenso(fmtData.replace(".", ""))
    }

    atualizar()
    const timer = setInterval(atualizar, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!mounted) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 text-xs text-muted-foreground border border-border/50">
        <ClockIcon className="size-3.5 text-muted-foreground animate-pulse" />
        <span>--:--:--</span>
      </div>
    )
  }

  return (
    <div
      className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/40 border border-border/60 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
      title="Horário Oficial de Brasília / São Paulo"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ClockIcon className="size-3.5 text-primary/70" />
        <span className="capitalize">{dataExtenso}</span>
      </div>
      <span className="text-muted-foreground/40 font-light">|</span>
      <span className="font-mono tracking-tight font-semibold text-foreground">{hora}</span>
      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded leading-none">
        SP
      </span>
    </div>
  )
}
