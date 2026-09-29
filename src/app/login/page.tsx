"use client"

import { useState, useTransition } from "react"
import { signIn } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSystemSettings } from "@/contexts/system-context"

export default function LoginPage() {
  const { settings } = useSystemSettings()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const nomeSistema = settings?.nome_sistema || "MROSC Gestão"
  const logoSistema = settings?.logo_url || "/logo.png"

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-20 rounded-2xl bg-background border p-2 flex items-center justify-center shadow-xs overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSistema}
              alt={nomeSistema}
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo.png"
              }}
            />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{nomeSistema}</h1>
          <p className="text-sm text-muted-foreground">
            Acesso restrito a administradores e operadores
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@moria.org.br"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
