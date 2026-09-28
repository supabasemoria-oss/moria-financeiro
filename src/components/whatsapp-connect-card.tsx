"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  MessageSquareIcon,
  QrCodeIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  SendIcon,
  SaveIcon,
  LogOutIcon,
  PhoneIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { getSettingsAsync, saveSettings } from "@/lib/settings"

export function WhatsAppConnectCard() {
  const [apiUrl, setApiUrl] = useState("")
  const [phone, setPhone] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectedUser, setConnectedUser] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Carregar configuracoes salvas
  useEffect(() => {
    getSettingsAsync().then((s) => {
      setApiUrl(s.whatsapp_api_url || "")
      setPhone(s.whatsapp_phone || "")
      setEnabled(s.whatsapp_enabled ?? false)
    })
  }, [])

  // Verificar status e QR
  const checkStatus = useCallback(async (currentUrl?: string) => {
    const url = (currentUrl ?? apiUrl).trim().replace(/\/+$/, "")
    if (!url) return

    try {
      setChecking(true)
      const res = await fetch(`${url}/qr`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setIsConnected(!!data.connected)
      setConnectedUser(data.user || null)
      if (data.qr) {
        setQrCode(data.qr)
      } else if (data.connected) {
        setQrCode(null)
      }
    } catch {
      // Falha ao conectar na API (servidor desligado ou URL incorreta)
      setIsConnected(false)
    } finally {
      setChecking(false)
    }
  }, [apiUrl])

  // Efeito de polling enquanto desconectado
  useEffect(() => {
    const cleanUrl = apiUrl.trim().replace(/\/+$/, "")
    if (!cleanUrl) return

    // Chamada inicial
    checkStatus(cleanUrl)

    // Polling a cada 5 segundos
    pollingRef.current = setInterval(() => {
      checkStatus(cleanUrl)
    }, 5000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [apiUrl, checkStatus])

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({
        whatsapp_api_url: apiUrl.trim(),
        whatsapp_phone: phone.trim(),
        whatsapp_enabled: enabled,
      })
      toast.success("Configurações do WhatsApp salvas.")
      checkStatus()
    } catch {
      toast.error("Erro ao salvar configurações do WhatsApp.")
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    const cleanUrl = apiUrl.trim().replace(/\/+$/, "")
    const cleanPhone = phone.trim().replace(/\D/g, "")

    if (!cleanUrl) {
      toast.error("Informe a URL da API do WhatsApp.")
      return
    }
    if (!cleanPhone) {
      toast.error("Informe o número de telefone de destino.")
      return
    }
    if (!isConnected) {
      toast.error("WhatsApp não está conectado. Leia o QR Code primeiro.")
      return
    }

    setTesting(true)
    try {
      const res = await fetch(`${cleanUrl}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: cleanPhone,
          message: "🔔 Moriá Financeiro: Teste de conexão do WhatsApp efetuado com sucesso!",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      toast.success("Mensagem de teste enviada com sucesso no WhatsApp!")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao enviar mensagem"
      toast.error("Erro no teste: " + msg)
    } finally {
      setTesting(false)
    }
  }

  async function handleLogout() {
    const cleanUrl = apiUrl.trim().replace(/\/+$/, "")
    if (!cleanUrl) return

    setDisconnecting(true)
    try {
      const res = await fetch(`${cleanUrl}/logout`, { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Sessão desconectada. Gerando novo QR Code...")
      setIsConnected(false)
      setConnectedUser(null)
      setTimeout(() => checkStatus(), 1500)
    } catch {
      toast.error("Erro ao desconectar sessão do WhatsApp.")
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareIcon className="size-5 text-emerald-600" />
            <CardTitle className="text-base font-semibold">
              WhatsApp Notificações (Baileys)
            </CardTitle>
            {isConnected ? (
              <Badge
                variant="outline"
                className="text-[10px] px-2 text-emerald-700 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1"
              >
                <CheckCircle2Icon className="size-3" />
                Conectado {connectedUser ? `(${connectedUser})` : ""}
              </Badge>
            ) : qrCode ? (
              <Badge
                variant="outline"
                className="text-[10px] px-2 text-amber-700 border-amber-500/30 bg-amber-500/10 flex items-center gap-1 animate-pulse"
              >
                <QrCodeIcon className="size-3" />
                Aguardando Leitura
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-2 text-muted-foreground border-border"
              >
                Desconectado
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => checkStatus()}
            disabled={checking || !apiUrl}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCwIcon className={`size-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <CardDescription className="text-xs">
          Envio automático de lembretes de parcelas a vencer diretamente no seu WhatsApp pessoal ou administrativo.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Toggle Ativar Lembretes WhatsApp */}
        <div className="flex items-center space-x-2 rounded-lg border bg-background/50 p-3">
          <Checkbox
            id="whatsapp_enabled"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(Boolean(checked))}
          />
          <div className="grid gap-0.5 leading-none">
            <label
              htmlFor="whatsapp_enabled"
              className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Ativar envio automático de lembretes no WhatsApp
            </label>
            <p className="text-xs text-muted-foreground">
              Dispara mensagens para o número abaixo ao verificar parcelas vencendo ou atrasadas.
            </p>
          </div>
        </div>

        {/* Inputs de Configuração */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="whatsapp_phone" className="text-sm font-medium flex items-center gap-1.5">
              <PhoneIcon className="size-3.5" />
              Telefone de Destino (com DDD)
            </Label>
            <Input
              id="whatsapp_phone"
              type="text"
              placeholder="Ex: 5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Formato internacional com DDI (55) + DDD + Número.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="whatsapp_api_url" className="text-sm font-medium flex items-center gap-1.5">
              <GlobeIcon className="size-3.5" />
              URL da API WhatsApp (Microserviço)
            </Label>
            <Input
              id="whatsapp_api_url"
              type="url"
              placeholder="https://moria-whatsapp.onrender.com"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Endereço do microserviço Baileys hospedado no Render ou local (ex: http://localhost:3001).
            </p>
          </div>
        </div>

        {/* Área de Conexão com QR Code */}
        <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center text-center">
          {isConnected ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="size-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <CheckCircle2Icon className="size-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-base text-foreground">
                  WhatsApp Conectado com Sucesso!
                </h4>
                <p className="text-xs text-muted-foreground">
                  Sessão ativa e pronta para envio de lembretes.
                  {connectedUser ? ` Identificador: +${connectedUser}` : ""}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestSend}
                  disabled={testing || !phone}
                  className="gap-1.5"
                >
                  {testing ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SendIcon className="size-3.5" />
                  )}
                  {testing ? "Enviando..." : "Enviar Mensagem de Teste"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={disconnecting}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  {disconnecting ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <LogOutIcon className="size-3.5" />
                  )}
                  {disconnecting ? "Desconectando..." : "Desconectar"}
                </Button>
              </div>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-3 rounded-lg shadow-sm border">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="size-56 object-contain"
                />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-semibold text-sm text-foreground flex items-center justify-center gap-1.5">
                  <QrCodeIcon className="size-4 text-emerald-600" />
                  Escaneie o QR Code com o WhatsApp
                </h4>
                <ol className="text-xs text-muted-foreground text-left list-decimal list-inside space-y-1 pt-1">
                  <li>Abra o WhatsApp no seu smartphone</li>
                  <li>Acesse <b>Configurações</b> &gt; <b>Aparelhos conectados</b></li>
                  <li>Toque em <b>Conectar um aparelho</b></li>
                  <li>Aponte a câmera para o código acima</li>
                </ol>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <RefreshCwIcon className="size-3 animate-spin text-emerald-600" />
                Atualização em tempo real ativa
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 max-w-sm">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <AlertCircleIcon className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-foreground">
                  Nenhuma sessão ativa detectada
                </h4>
                <p className="text-xs text-muted-foreground">
                  Certifique-se de que a URL do microserviço está configurada e o serviço está online.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkStatus()}
                disabled={checking || !apiUrl}
                className="gap-1.5"
              >
                <RefreshCwIcon className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Conectando..." : "Verificar Conexão"}
              </Button>
            </div>
          )}
        </div>

        {/* Botão Salvar Configurações */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted-foreground">
            🔒 O microserviço Baileys opera em sandbox isolada no Render sem armazenar mensagens.
          </p>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <SaveIcon className="size-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
