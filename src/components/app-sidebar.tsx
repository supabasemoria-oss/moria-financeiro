"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Building2Icon,
  FolderKanbanIcon,
  UsersIcon,
  CalculatorIcon,
  ReceiptIcon,
  FileCheckIcon,
  FileSpreadsheetIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  BellIcon,
} from "lucide-react"
import { useAlertas } from "@/hooks/use-alertas"
import { useSystemSettings } from "@/contexts/system-context"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navPrincipal = [
  {
    title: "Visão Geral",
    url: "/",
    icon: <LayoutDashboardIcon className="size-4" />,
  },
]

const navCadastros = [
  {
    title: "Instituições (OSCs)",
    url: "/instituicoes",
    icon: <Building2Icon className="size-4" />,
  },
  {
    title: "Projetos & Termos",
    url: "/projetos",
    icon: <FolderKanbanIcon className="size-4" />,
  },
  {
    title: "Fornecedores & Prestadores",
    url: "/fornecedores",
    icon: <UsersIcon className="size-4" />,
  },
]

const navOperacional = [
  {
    title: "Previsão Orçamentária",
    url: "/orcamento",
    icon: <CalculatorIcon className="size-4" />,
    badge: "Travas",
  },
  {
    title: "Execução Financeira",
    url: "/execucao",
    icon: <ReceiptIcon className="size-4" />,
  },
]

const navDocumental = [
  {
    title: "Comprovantes & Anexos",
    url: "/comprovantes",
    icon: <FileCheckIcon className="size-4" />,
  },
  {
    title: "Transferegov & Lotes",
    url: "/prestacao-contas",
    icon: <FileSpreadsheetIcon className="size-4" />,
    badge: "MROSC",
  },
]

const navAdmin = [
  {
    title: "Usuários",
    url: "/usuarios",
    icon: <UsersIcon className="size-4" />,
  },
  {
    title: "Configurações",
    url: "/configuracoes",
    icon: <SettingsIcon className="size-4" />,
  },
]

const currentUser = {
  name: "Administrador",
  email: "admin@mrosc.org.br",
  avatar: "/logo-symbol.png",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { urgentes, atencao } = useAlertas()
  const { settings } = useSystemSettings()
  const badgeCount = urgentes + atencao

  const nomeSistema = settings?.nome_sistema || "MROSC Gestão"
  const subtituloSistema = settings?.subtitulo_sistema || "MROSC • Lei 13.019"
  const logoSistema = settings?.logo_url || "/logo-symbol.png"

  const navOperacionalComBadge = [
    {
      title: "Previsão Orçamentária",
      url: "/orcamento",
      icon: <CalculatorIcon className="size-4" />,
      badge: "Travas",
    },
    {
      title: "Execução Financeira",
      url: "/execucao",
      icon: <ReceiptIcon className="size-4" />,
    },
    {
      title: "Lembretes & Agenda",
      url: "/lembretes",
      icon: <BellIcon className="size-4" />,
      badge: badgeCount > 0 ? String(badgeCount) : undefined,
      badgeVariant: urgentes > 0 ? "destructive" : "warning",
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground py-2"
            >
              <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg bg-background border p-1 shadow-2xs overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSistema}
                  alt={nomeSistema}
                  className="size-7 object-contain rounded"
                  onError={(e) => {
                    // Fallback se imagem quebrar
                    (e.target as HTMLImageElement).src = "/logo-symbol.png"
                  }}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-wide text-foreground">{nomeSistema}</span>
                <span className="truncate text-xs text-muted-foreground">{subtituloSistema}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navPrincipal} />
        <NavMain label="Cadastros Base" items={navCadastros} />
        <NavMain label="Orçamento & Finanças" items={navOperacionalComBadge} />
        <NavMain label="Prestação de Contas" items={navDocumental} />
        <NavMain label="Sistema" items={navAdmin} />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
