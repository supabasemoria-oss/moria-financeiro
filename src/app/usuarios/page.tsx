"use client"

import * as React from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { UsuariosManager } from "@/components/usuarios-manager"
import { UsersIcon } from "lucide-react"

export default function UsuariosPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-1 mb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UsersIcon className="size-5" />
          Gestão de Usuários
        </h2>
        <p className="text-sm text-muted-foreground">
          Gerenciamento de acessos, administradores e operadores da plataforma.
        </p>
      </div>

      <UsuariosManager />
    </DashboardShell>
  )
}
