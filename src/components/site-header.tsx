"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { ShieldCheckIcon } from "lucide-react"

import { RelogioHeader } from "@/components/relogio-header"
import { LembretesPopover } from "@/components/lembretes-popover"
import { FiltroGlobalHeader } from "@/components/filtro-global-header"

const titleMap: Record<string, string> = {
  "/": "Painel de Controle e Auditoria",
  "/instituicoes": "Instituições (OSCs / ONGs)",
  "/projetos": "Projetos e Termos de Parceria",
  "/fornecedores": "Fornecedores e Prestadores de Serviço",
  "/orcamento": "Previsão Orçamentária e Travas de Teto",
  "/execucao": "Execução Financeira e Controle de Saldo",
  "/financeiro": "Execução Financeira e Controle de Saldo",
  "/comprovantes": "Upload e Tipificação de Comprovantes",
  "/prestacao-contas": "Prestação de Contas e Transferegov",
  "/lembretes": "Lembretes & Agenda de Pagamentos",
  "/configuracoes": "Configurações do Sistema",
}

export function SiteHeader() {
  const pathname = usePathname()
  const pageTitle = titleMap[pathname] || "Moriá Consultoria"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b px-3 sm:px-4 lg:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) bg-background/95 backdrop-blur-sm sticky top-0 z-10 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground md:text-base hidden sm:inline-block">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Filtro Global do Topo: Instituição & Projeto */}
      <div className="flex items-center">
        <FiltroGlobalHeader />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Relógio digital no fuso de São Paulo */}
        <div className="hidden lg:block">
          <RelogioHeader />
        </div>

        {/* Sininho com popover de lembretes ativos */}
        <LembretesPopover />

        <Badge variant="outline" className="hidden xl:flex items-center gap-1.5 text-xs font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
          <ShieldCheckIcon className="size-3.5 text-emerald-600" />
          MROSC Ativo
        </Badge>
      </div>
    </header>
  )
}
