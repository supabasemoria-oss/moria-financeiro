"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  MessageSquareIcon,
  QrCodeIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  SendIcon,
  SaveIcon,
  LogOutIcon,
  PhoneIcon,
  GlobeIcon,
  Loader2Icon,
  Edit2Icon,
  CheckIcon,
  RotateCcwIcon,
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

const DEFAULT_API_URL = "https://moria-whatsapp.onrender.com"

export function WhatsAppConnectCard() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [phone, setPhone] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectedUser, setConnectedUser] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Carregar configuracoes salvas
  useEffect(() => {
    getSettingsAsync().then((s) => {
      if (s.whatsapp_api_url && s.whatsapp_api_url.trim()) {
        setApiUrl(s.whatsapp_api_url.trim())
      }
      setPhone(s.whatsapp_phone || "")
      setEnabled(s.whatsapp_enabled ?? false)
    })
  }, [])

  // Buscar status e QR Code
  const fetchStatusAndQr = useCallback(async (targetUrl?: string) => {
    const url = (targetUrl ?? apiUrl).trim().replace(/\/+$/, "")
    if (!url) return

    try {
      const res = await fetch(`${url}/qr`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const connected = Boolean(data.connected)
      setIsConnected(connected)
      setConnectedUser(data.user || null)

      if (connected) {
        setQrCode(null)
      } else if (data.qr) {
        setQrCode(data.qr)
      }
    } catch {
      // Se falhar (ex: serviço acordando), manter tentativa
    } finally {
      setLoadingQr(false)
    }
  }, [apiUrl])

  // Polling contínuo para manter QR Code vivo na tela o tempo todo
  useEffect(() => {
    const url = apiUrl.trim().replace(/\/+$/, "")
    if (!url) return

    // Busca imediata
    fetchStatusAndQr(url)

    // Polling a cada 4 segundos
    pollingRef.current = setInterval(() => {
      fetchStatusAndQr(url)
    }, 4000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [apiUrl, fetchStatusAndQr])

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({
        whatsapp_api_url: apiUrl.trim(),
        whatsapp_phone: phone.trim(),
        whatsapp_enabled: enabled,
      })
      toast.success("Configurações do WhatsApp salvas.")
      setIsEditingUrl(false)
      fetchStatusAndQr()
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
      toast.error("Informe o telefone de destino para o teste.")
      return
    }
    if (!isConnected) {
      toast.error("WhatsApp não está conectado. Escaneie o QR Code primeiro.")
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
      setQrCode(null)
      setLoadingQr(true)
      setTimeout(() => fetchStatusAndQr(), 1500)
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
                QR Code Pronto para Leitura
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-2 text-muted-foreground border-border"
              >
                {loadingQr ? "Iniciando Serviço..." : "Aguardando Sessão"}
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoadingQr(true)
              fetchStatusAndQr()
            }}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCwIcon className={`size-3.5 mr-1 ${loadingQr ? "animate-spin" : ""}`} />
            Atualizar QR
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
          {/* Telefone */}
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
              Formato com DDI (55) + DDD + Número. Exemplo: <code>5511999998888</code>
            </p>
          </div>

          {/* URL da API com botão de Editar */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp_api_url" className="text-sm font-medium flex items-center gap-1.5">
                <GlobeIcon className="size-3.5" />
                URL da API WhatsApp
              </Label>
              {isEditingUrl ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setApiUrl(DEFAULT_API_URL)
                      toast.info("URL restaurada para o padrão.")
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mr-2"
                  >
                    <RotateCcwIcon className="size-3" />
                    Restaurar Padrão
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingUrl(false)}
                    className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    <CheckIcon className="size-3 mr-1" />
                    Concluir
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingUrl(true)}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Edit2Icon className="size-3 mr-1" />
                  Editar
                </Button>
              )}
            </div>

            <Input
              id="whatsapp_api_url"
              type="url"
              value={apiUrl}
              disabled={!isEditingUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className={`font-mono text-sm ${!isEditingUrl ? "bg-muted/40 cursor-default" : ""}`}
            />
            <p className="text-[11px] text-muted-foreground">
              {isEditingUrl
                ? "Altere a URL caso utilize um servidor WhatsApp próprio."
                : "URL padrão gerenciada no Render. Clique em Editar para alterar."}
            </p>
          </div>
        </div>

        {/* Área de Conexão com QR Code Permanente */}
        <div className="rounded-xl border bg-card p-6 flex flex-col items-center justify-center text-center">
          {isConnected ? (
            <div className="flex flex-col items-center gap-3 py-2">
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

              <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
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
                  {disconnecting ? "Desconectando..." : "Desconectar Sessão"}
                </Button>
              </div>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-xl shadow-md border border-emerald-500/20 ring-4 ring-emerald-500/5">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="size-64 sm:size-72 object-contain"
                />
              </div>

              <div className="space-y-2 max-w-md">
                <h4 className="font-semibold text-base text-foreground flex items-center justify-center gap-1.5">
                  <QrCodeIcon className="size-5 text-emerald-600" />
                  Escaneie o QR Code com seu WhatsApp
                </h4>

                <div className="text-xs text-muted-foreground text-left bg-muted/40 rounded-lg p-3 border space-y-1">
                  <p className="font-medium text-foreground">Como conectar:</p>
                  <ol className="list-decimal list-inside space-y-1 pt-0.5">
                    <li>Abra o aplicativo <b>WhatsApp</b> no celular</li>
                    <li>Toque em <b>Mais opções</b> (Android) ou <b>Configurações</b> (iPhone)</li>
                    <li>Selecione <b>Aparelhos conectados</b></li>
                    <li>Toque em <b>Conectar um aparelho</b> e aponte para a tela</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <RefreshCwIcon className="size-3 animate-spin text-emerald-600" />
                Atualização automática contínua
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 max-w-sm">
              <div className="size-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <Loader2Icon className="size-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-foreground">
                  Carregando QR Code do WhatsApp...
                </h4>
                <p className="text-xs text-muted-foreground">
                  Conectando ao microserviço Baileys no Render. O código aparecerá em instantes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Salvar */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted-foreground">
            🔒 O microserviço opera em nuvem segura sem armazenamento de mensagens.
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
