"use client"

import { useState, useEffect } from "react"
import {
  SettingsIcon,
  BotIcon,
  KeyRoundIcon,
  CheckCircle2Icon,
  XCircleIcon,
  EyeIcon,
  EyeOffIcon,
  SaveIcon,
  ZapIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  getSettingsAsync,
  saveSettings,
  testGeminiConnection,
} from "@/lib/settings"

interface GeminiModel {
  name: string
  displayName: string
  description: string
}

export default function ConfiguracoesPage() {
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("gemini-3.8-flash")
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [models, setModels] = useState<GeminiModel[]>([])
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    getSettingsAsync().then((s) => {
      setApiKey(s.gemini_api_key)
      setModel(s.gemini_model)
      if (s.gemini_api_key) {
        fetchModels(s.gemini_api_key)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchModels(key: string) {
    if (!key.trim()) return
    setLoadingModels(true)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const filtered: GeminiModel[] = (data.models ?? [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes("generateContent") &&
          m.name?.includes("gemini")
        )
        .map((m: any) => ({
          name: m.name.replace("models/", ""),
          displayName: m.displayName ?? m.name.replace("models/", ""),
          description: m.description ?? "",
        }))
        .sort((a: GeminiModel, b: GeminiModel) =>
          b.name.localeCompare(a.name)
        )
      setModels(filtered)
      if (filtered.length > 0 && !model) {
        setModel(filtered[0].name)
      }
    } catch {
      toast.error("Não foi possível carregar os modelos. Verifique a chave.")
    } finally {
      setLoadingModels(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({ gemini_api_key: apiKey, gemini_model: model })
      toast.success("Configurações salvas.")
      setTestResult(null)
    } catch {
      toast.error("Erro ao salvar configurações.")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!apiKey.trim()) {
      toast.error("Informe a chave de API antes de testar.")
      return
    }
    setTesting(true)
    setTestResult(null)
    const result = await testGeminiConnection(apiKey.trim(), model)
    setTestResult(result)
    if (result.ok) {
      toast.success("Conexão com Gemini estabelecida com sucesso.")
    } else {
      toast.error("Falha na conexão: " + result.message)
    }
    setTesting(false)
  }

  const maskedKey =
    apiKey.length > 8
      ? apiKey.slice(0, 4) + "•".repeat(apiKey.length - 8) + apiKey.slice(-4)
      : apiKey

  return (
    <DashboardShell>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-5" />
          Configurações
        </h2>
        <p className="text-sm text-muted-foreground">
          Credenciais e preferências do sistema Moriá.
        </p>
      </div>

      {/* Seção Gemini */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BotIcon className="size-5 text-blue-600" />
            <CardTitle className="text-base font-semibold">
              Google Gemini Flash
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] px-2 text-blue-700 border-blue-500/30"
            >
              IA de Importação
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Utilizado para sugerir automaticamente o mapeamento de colunas ao
            importar planilhas orçamentárias (XLS, XLSX, PDF). O custo por
            importação é inferior a{" "}
            <span className="font-semibold text-foreground">R$ 0,01</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Modelo */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model" className="text-sm font-medium">
                Modelo
              </Label>
              <button
                type="button"
                onClick={() => fetchModels(apiKey)}
                disabled={loadingModels || !apiKey.trim()}
                className="text-xs text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingModels ? "Buscando..." : "↻ Buscar modelos disponíveis"}
              </button>
            </div>
            {models.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Informe a chave de API e clique em "Buscar modelos disponíveis" para ver todos os modelos acessíveis com sua conta.
              </p>
            ) : (
              <Select value={model} onValueChange={(v) => { if (v) setModel(v) }}>
                <SelectTrigger id="model" className="w-full max-w-sm">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.displayName}</span>
                        {m.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                            {m.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Chave de API */}
          <div className="grid gap-2">
            <Label htmlFor="apikey" className="text-sm font-medium flex items-center gap-1.5">
              <KeyRoundIcon className="size-3.5" />
              Chave de API (API Key)
            </Label>
            <div className="flex gap-2 max-w-lg">
              <div className="relative flex-1">
                <Input
                  id="apikey"
                  type={showKey ? "text" : "password"}
                  placeholder="AIza..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setTestResult(null)
                  }}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                >
                  {showKey ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtenha sua chave em{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-3 hover:text-foreground"
              >
                aistudio.google.com/apikey
              </a>
              . A chave é armazenada apenas no seu navegador.
            </p>
          </div>

          {/* Status do teste */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2Icon className="size-4 shrink-0" />
              ) : (
                <XCircleIcon className="size-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !apiKey.trim()}
              className="gap-2"
            >
              <ZapIcon className="size-4" />
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
            >
              <SaveIcon className="size-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>

          {/* Info de segurança */}
          <p className="text-[11px] text-muted-foreground border-t pt-3">
            🔒 A chave de API nunca é enviada para servidores da Moriá. É
            armazenada localmente no navegador (localStorage) e utilizada
            diretamente nas chamadas à API do Google.
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
