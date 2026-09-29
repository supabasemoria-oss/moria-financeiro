"use client"

import { useState, useEffect, useRef } from "react"
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
  UploadIcon,
  Building2Icon,
  UsersIcon,
  MessageSquareIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { WhatsAppConnectCard } from "@/components/whatsapp-connect-card"
import { UsuariosManager } from "@/components/usuarios-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  uploadSystemLogo,
  testGeminiConnection,
} from "@/lib/settings"
import { maskCnpj, maskTelefone } from "@/lib/masks"
import { useSystemSettings } from "@/contexts/system-context"

interface GeminiModel {
  name: string
  displayName: string
  description: string
}

export default function ConfiguracoesPage() {
  const { refreshSettings } = useSystemSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Identidade do Sistema
  const [nomeSistema, setNomeSistema] = useState("")
  const [subtituloSistema, setSubtituloSistema] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [razaoSocial, setRazaoSocial] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [emailContato, setEmailContato] = useState("")
  const [telefoneContato, setTelefoneContato] = useState("")
  const [savingIdentidade, setSavingIdentidade] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Gemini
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("gemini-3.8-flash")
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [savingGemini, setSavingGemini] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [models, setModels] = useState<GeminiModel[]>([])
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    getSettingsAsync().then((s) => {
      setNomeSistema(s.nome_sistema)
      setSubtituloSistema(s.subtitulo_sistema)
      setLogoUrl(s.logo_url)
      setRazaoSocial(s.razao_social || "")
      setCnpj(s.cnpj || "")
      setEmailContato(s.email_contato || "")
      setTelefoneContato(s.telefone_contato || "")

      setApiKey(s.gemini_api_key)
      setModel(s.gemini_model)
      if (s.gemini_api_key) {
        fetchModels(s.gemini_api_key)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSalvarIdentidade(e: React.FormEvent) {
    e.preventDefault()
    setSavingIdentidade(true)
    try {
      await saveSettings({
        nome_sistema: nomeSistema.trim() || "MROSC Gestão",
        subtitulo_sistema: subtituloSistema.trim() || "MROSC • Lei 13.019",
        logo_url: logoUrl,
        razao_social: razaoSocial.trim() || null,
        cnpj: cnpj.trim() || null,
        email_contato: emailContato.trim() || null,
        telefone_contato: telefoneContato.trim() || null,
      })
      await refreshSettings()
      window.dispatchEvent(new Event("system_settings_updated"))
      toast.success("Identidade e dados do sistema salvos com sucesso!")
    } catch {
      toast.error("Erro ao salvar dados do sistema.")
    } finally {
      setSavingIdentidade(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido (PNG, JPG, SVG ou WebP).")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.")
      return
    }

    setUploadingLogo(true)
    try {
      const publicUrl = await uploadSystemLogo(file)
      setLogoUrl(publicUrl)
      await saveSettings({ logo_url: publicUrl })
      await refreshSettings()
      window.dispatchEvent(new Event("system_settings_updated"))
      toast.success("Logotipo atualizado com sucesso!")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido"
      toast.error("Erro ao enviar logotipo: " + msg)
    } finally {
      setUploadingLogo(false)
    }
  }

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

  async function handleSalvarGemini() {
    setSavingGemini(true)
    try {
      await saveSettings({ gemini_api_key: apiKey, gemini_model: model })
      toast.success("Configurações do Gemini salvas.")
      setTestResult(null)
    } catch {
      toast.error("Erro ao salvar configurações do Gemini.")
    } finally {
      setSavingGemini(false)
    }
  }

  async function handleTestGemini() {
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

  return (
    <DashboardShell>
      <div className="flex flex-col gap-1 mb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-5" />
          Configurações
        </h2>
        <p className="text-sm text-muted-foreground">
          Gerenciamento de identidade, acessos, inteligência artificial e canais de notificação.
        </p>
      </div>

      <Tabs defaultValue="sistema" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border flex flex-wrap h-auto gap-1">
          <TabsTrigger value="sistema" className="gap-2 px-3.5 py-2 text-xs font-medium cursor-pointer">
            <Building2Icon className="size-4" />
            Identidade & Sistema
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 px-3.5 py-2 text-xs font-medium cursor-pointer">
            <UsersIcon className="size-4" />
            Usuários & Acessos
          </TabsTrigger>
          <TabsTrigger value="ia" className="gap-2 px-3.5 py-2 text-xs font-medium cursor-pointer">
            <BotIcon className="size-4" />
            Inteligência Artificial (Gemini)
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 px-3.5 py-2 text-xs font-medium cursor-pointer">
            <MessageSquareIcon className="size-4" />
            WhatsApp & Alertas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: IDENTIDADE & SISTEMA */}
        <TabsContent value="sistema" className="space-y-6 focus-visible:outline-hidden">
          <Card className="border-border">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2Icon className="size-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Identidade Visual & Dados do Sistema
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Personalize o nome, logotipo e dados cadastrais exibidos na plataforma e relatórios.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSalvarIdentidade} className="space-y-6">
                {/* Logotipo */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border bg-muted/20">
                  <div className="relative flex aspect-square size-20 shrink-0 items-center justify-center rounded-xl bg-background border p-2 shadow-xs overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl || "/logo-symbol.png"}
                      alt="Logotipo"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/logo-symbol.png"
                      }}
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Logotipo do Sistema</h4>
                      <p className="text-xs text-muted-foreground">
                        Formatos recomendados: PNG, SVG ou JPG (máx. 5MB). Aparecerá no menu lateral e cabeçalhos.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="gap-2"
                      >
                        <UploadIcon className="size-3.5" />
                        {uploadingLogo ? "Enviando..." : "Alterar Logotipo"}
                      </Button>
                      {logoUrl && logoUrl !== "/logo-symbol.png" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogoUrl("/logo-symbol.png")}
                          className="text-xs text-muted-foreground"
                        >
                          Restaurar Padrão
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nome e Subtítulo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome_sistema">Nome do Sistema *</Label>
                    <Input
                      id="nome_sistema"
                      value={nomeSistema}
                      onChange={(e) => setNomeSistema(e.target.value)}
                      placeholder="Ex: MROSC Gestão"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subtitulo_sistema">Subtítulo / Descrição Curta</Label>
                    <Input
                      id="subtitulo_sistema"
                      value={subtituloSistema}
                      onChange={(e) => setSubtituloSistema(e.target.value)}
                      placeholder="Ex: MROSC • Lei 13.019"
                    />
                  </div>
                </div>

                {/* Dados da Organização */}
                <div className="pt-2 border-t space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Building2Icon className="size-4 text-muted-foreground" />
                    Dados da Entidade Mantenedora
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="razao_social">Razão Social / Nome da OSC</Label>
                      <Input
                        id="razao_social"
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        placeholder="Nome oficial da organização"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={cnpj}
                        onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email_contato">E-mail de Contato</Label>
                      <Input
                        id="email_contato"
                        type="email"
                        value={emailContato}
                        onChange={(e) => setEmailContato(e.target.value)}
                        placeholder="contato@organizacao.org.br"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="telefone_contato">Telefone / Suporte</Label>
                      <Input
                        id="telefone_contato"
                        value={telefoneContato}
                        onChange={(e) => setTelefoneContato(maskTelefone(e.target.value))}
                        placeholder="(00) 0000-0000"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={savingIdentidade} className="gap-2">
                    <SaveIcon className="size-4" />
                    {savingIdentidade ? "Salvando..." : "Salvar Identidade do Sistema"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: USUÁRIOS & ACESSOS */}
        <TabsContent value="usuarios" className="space-y-6 focus-visible:outline-hidden">
          <UsuariosManager />
        </TabsContent>

        {/* TAB 3: INTELIGÊNCIA ARTIFICIAL (GEMINI) */}
        <TabsContent value="ia" className="space-y-6 focus-visible:outline-hidden">
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
                  <Select
                    value={model}
                    onValueChange={(v) => {
                      if (v) setModel(v)
                    }}
                  >
                    <SelectTrigger id="model" className="w-full max-w-sm">
                      <SelectValue placeholder="Selecione um modelo">
                        {(val) => {
                          if (!val) return "Selecione um modelo"
                          const m = models.find((item) => item.name === val)
                          return m?.displayName ?? val
                        }}
                      </SelectValue>
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
                  . A chave é armazenada de forma segura na nuvem e utilizada pelo sistema.
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
                  onClick={handleTestGemini}
                  disabled={testing || !apiKey.trim()}
                  className="gap-2"
                >
                  <ZapIcon className="size-4" />
                  {testing ? "Testando..." : "Testar Conexão"}
                </Button>
                <Button
                  onClick={handleSalvarGemini}
                  disabled={savingGemini}
                  className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <SaveIcon className="size-4" />
                  {savingGemini ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: WHATSAPP */}
        <TabsContent value="whatsapp" className="space-y-6 focus-visible:outline-hidden">
          <WhatsAppConnectCard />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
