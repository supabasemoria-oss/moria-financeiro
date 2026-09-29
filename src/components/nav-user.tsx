"use client"

import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import {
  EllipsisVerticalIcon,
  SettingsIcon,
  UsersIcon,
  LogOutIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { signOut } from "@/app/login/actions"
import { useAuthUser } from "@/hooks/use-auth-user"
import type { RoleUsuario } from "@/lib/types"

function getInitials(name: string): string {
  if (!name) return "US"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const ROLE_LABELS: Record<RoleUsuario, { label: string; icon: React.ReactNode }> = {
  ADMIN: {
    label: "Administrador",
    icon: <ShieldCheckIcon className="size-3 mr-1 text-primary" />,
  },
  OPERADOR: {
    label: "Operador",
    icon: <ShieldIcon className="size-3 mr-1 text-muted-foreground" />,
  },
  CONSULTA: {
    label: "Consulta",
    icon: <ShieldAlertIcon className="size-3 mr-1 text-muted-foreground" />,
  },
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { usuario, loading } = useAuthUser()

  const nome = usuario?.nome || "Usuário"
  const email = usuario?.email || "sessao@mrosc.org.br"
  const role = usuario?.role || "ADMIN"
  const cargo = usuario?.cargo
  const initials = getInitials(nome)
  const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.ADMIN

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted cursor-pointer" />
            }
          >
            <Avatar className="size-8 rounded-lg bg-primary/10 border text-primary font-semibold text-xs flex items-center justify-center">
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                {loading ? "..." : initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium text-foreground">{nome}</span>
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                  <Avatar className="size-9 rounded-lg bg-primary/10 border text-primary font-semibold text-xs flex items-center justify-center">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-foreground">{nome}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal inline-flex items-center">
                        {roleInfo.icon}
                        {roleInfo.label}
                      </Badge>
                      {cargo && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          • {cargo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/usuarios" />}>
                <UsersIcon className="size-4 mr-2" />
                Usuários & Permissões
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/configuracoes" />}>
                <SettingsIcon className="size-4 mr-2" />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOutIcon className="size-4 mr-2" />
              Sair da Conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
