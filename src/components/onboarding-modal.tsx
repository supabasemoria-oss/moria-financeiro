"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ImportarPlanilhaDialog } from "@/components/importar-planilha-dialog"
import { mroscService } from "@/lib/api/mrosc-service"
import { saveSettings } from "@/lib/settings"
import { useSystemSettings } from "@/contexts/system-context"
import { supabase } from "@/lib/supabase"
import { maskCnpj, maskTelefone } from "@/lib/masks"
import { toast } from "sonner"
import {
  Building2Icon,
  SettingsIcon,
  KeyRoundIcon,
  UploadIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
  FileSpreadsheetIcon,
  ShieldCheckIcon,
} from "lucide-react"

export function OnboardingModal() {
  const { settings, refreshSettings } = useSystemSettings()

  const [open, setOpen] = React.useState(false)
  const [checking, setChecking] = React.useState(true)
  const [step, setStep] = React.useState<1 | 2>(1)
  const [savingStep1, setSavingStep1] = React.useState(false)
  const [savingManualInst, setSavingManualInst] = React.useState(false)

  // Modo no Passo 2: "manual" ou "importar"
  const [modoPasso2, setModoPasso2] = React.useState<"escolha" | "manual">("escolha")

  // Passo 1: Dados do Sistema & Senha
  const [formSistema, setFormSistema] = React.useState({
    nome_sistema: "",
    subtitulo_sistema: "",
    logo_url: "",
    whatsapp_phone: "",
    novaSenha: "",
    confirmarSenha: "",
  })

  // Passo 2: Dados da Instituição Manual
  const [formInst, setFormInst] = React.useState({
    razao_social: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
  })

  // Sincronizar dados do sistema existentes no Passo 1
  React.useEffect(() => {
    if (settings) {
      setFormSistema((prev) => ({
        ...prev,
        nome_sistema: settings.nome_sistema || "MROSC Gestão",
        subtitulo_sistema: settings.subtitulo_sistema || "MROSC • Lei 13.019",
        logo_url: settings.logo_url || "/logo-symbol.png",
        whatsapp_phone: settings.whatsapp_phone ? maskTelefone(settings.whatsapp_phone) : "",
      }))
    }
  }, [settings])

  // Verificar se há instituições cadastradas
  const verificarInstituicoes = React.useCallback(async () => {
    try {
      setChecking(true)
      const data = await mroscService.getInstituicoes()
      if (data && data.length === 0) {
        setOpen(true)
      } else {
        setOpen(false)
      }
    } catch {
      // Em caso de erro na checagem, não bloquear
    } finally {
      setChecking(false)
    }
  }, [])

  React.useEffect(() => {
    verificarInstituicoes()
  }, [verificarInstituicoes])

  // Submissão do Passo 1 (Sistema & Senha)
  async function handleSalvarPasso1(e: React.FormEvent) {
    e.preventDefault()

    if (!formSistema.nome_sistema.trim()) {
      toast.error("Informe o nome do sistema.")
      return
    }

    // Se informou nova senha, validar
    if (formSistema.novaSenha.trim()) {
      if (formSistema.novaSenha.trim().length < 6) {
        toast.error("A nova senha deve ter no mínimo 6 caracteres.")
        return
      }
      if (formSistema.novaSenha.trim() !== formSistema.confirmarSenha.trim()) {
        toast.error("As senhas informadas não coincidem.")
        return
      }
    }

    try {
      setSavingStep1(true)

      // 1. Salvar configurações do sistema
      await saveSettings({
        nome_sistema: formSistema.nome_sistema.trim(),
        subtitulo_sistema: formSistema.subtitulo_sistema.trim(),
        logo_url: formSistema.logo_url.trim() || "/logo-symbol.png",
        whatsapp_phone: formSistema.whatsapp_phone.replace(/\D/g, ""),
      })

      await refreshSettings()
      window.dispatchEvent(new Event("system_settings_updated"))

      // 2. Se informou nova senha, atualizar no Supabase Auth
      if (formSistema.novaSenha.trim()) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: formSistema.novaSenha.trim(),
        })
        if (pwdError) {
          throw new Error("Erro ao trocar senha: " + pwdError.message)
        }
        toast.success("Dados do sistema salvos e senha alterada com sucesso!")
      } else {
        toast.success("Dados do sistema configurados!")
      }

      // Avançar para o Passo 2
      setStep(2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar dados do sistema"
      toast.error(msg)
    } finally {
      setSavingStep1(false)
    }
  }

  // Submissão do Passo 2 (Cadastro Manual da OSC)
  async function handleSalvarInstituicaoManual(e: React.FormEvent) {
    e.preventDefault()

    if (!formInst.razao_social.trim() || !formInst.cnpj.trim()) {
      toast.error("Preencha a Razão Social e o CNPJ da Instituição.")
      return
    }

    try {
      setSavingManualInst(true)
      await mroscService.createInstituicao({
        razao_social: formInst.razao_social.trim(),
        cnpj: formInst.cnpj.trim(),
        email: formInst.email.trim() || null,
        telefone: formInst.telefone.trim() || null,
        endereco: formInst.endereco.trim() || null,
      })

      toast.success("Instituição cadastrada com sucesso! Bem-vindo ao sistema.")
      setOpen(false)
      window.location.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar instituição"
      toast.error(msg)
    } finally {
      setSavingManualInst(false)
    }
  }

  // Callback após importação de planilha no Passo 2
  function handlePlanilhaImportada() {
    toast.success("Planilha importada com sucesso! O onboarding foi concluído.")
    setOpen(false)
    window.location.reload()
  }

  if (checking || !open) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Banner Superior de Boas-Vindas */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 hover:bg-white/20 text-white border-0 text-xs">
                Configuração Inicial • Onboarding
              </Badge>
            </div>
            <span className="text-xs text-emerald-100 font-medium font-mono">
              Passo {step} de 2
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight mt-2 text-white">
            {step === 1
              ? "Bem-vindo! Vamos preparar seu ambiente"
              : "Cadastre sua primeira Instituição (OSC)"}
          </h2>
          <p className="text-xs text-emerald-50 mt-1 max-w-md">
            {step === 1
              ? "Confira os dados básicos do seu sistema e altere sua senha de acesso inicial."
              : "Vincule a organização gestora para gerenciar projetos, orçamentos e prestar contas."}
          </p>

          {/* Stepper Visual */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/20">
            <div className="flex items-center gap-2">
              <div
                className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "bg-emerald-800 text-emerald-200"
                }`}
              >
                1
              </div>
              <span className="text-xs font-medium text-emerald-50">
                Sistema & Senha
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "bg-white/20 text-white/70"
                }`}
              >
                2
              </div>
              <span className="text-xs font-medium text-emerald-50">
                Instituição (OSC)
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* ======================================================== */}
          {/* PASSO 1: DADOS BÁSICOS DO SISTEMA & ALTERAR SENHA        */}
          {/* ======================================================== */}
          {step === 1 && (
            <form onSubmit={handleSalvarPasso1} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <SettingsIcon className="size-4 text-emerald-600" />
                  <span>Identidade do Sistema</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome_sistema">Nome do Sistema *</Label>
                    <Input
                      id="nome_sistema"
                      required
                      placeholder="Ex: MROSC Gestão"
                      value={formSistema.nome_sistema}
                      onChange={(e) =>
                        setFormSistema({ ...formSistema, nome_sistema: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subtitulo_sistema">Subtítulo / Órgão</Label>
                    <Input
                      id="subtitulo_sistema"
                      placeholder="Ex: MROSC • Lei 13.019"
                      value={formSistema.subtitulo_sistema}
                      onChange={(e) =>
                        setFormSistema({
                          ...formSistema,
                          subtitulo_sistema: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="logo_url">Caminho da Logo (opcional)</Label>
                    <Input
                      id="logo_url"
                      placeholder="/logo-symbol.png"
                      value={formSistema.logo_url}
                      onChange={(e) =>
                        setFormSistema({ ...formSistema, logo_url: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_phone">WhatsApp de Avisos (opcional)</Label>
                    <Input
                      id="whatsapp_phone"
                      placeholder="(00) 00000-0000"
                      value={formSistema.whatsapp_phone}
                      onChange={(e) =>
                        setFormSistema({
                          ...formSistema,
                          whatsapp_phone: maskTelefone(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Seção Opcional de Redefinição de Senha */}
                <div className="pt-3 border-t mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <KeyRoundIcon className="size-4 text-emerald-600" />
                    <span>Trocar Senha de Acesso</span>
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      Recomendado no primeiro login
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Caso tenha recebido uma senha temporária ou queira definir uma senha pessoal segura, preencha abaixo:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="nova_senha">Nova Senha</Label>
                      <Input
                        id="nova_senha"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={formSistema.novaSenha}
                        onChange={(e) =>
                          setFormSistema({ ...formSistema, novaSenha: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmar_senha">Confirmar Nova Senha</Label>
                      <Input
                        id="confirmar_senha"
                        type="password"
                        placeholder="Repita a nova senha"
                        value={formSistema.confirmarSenha}
                        onChange={(e) =>
                          setFormSistema({
                            ...formSistema,
                            confirmarSenha: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t gap-2">
                <Button
                  type="submit"
                  disabled={savingStep1}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                >
                  {savingStep1 ? "Salvando..." : "Salvar e Continuar"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* PASSO 2: CRIAR PRIMEIRA INSTITUIÇÃO OU IMPORTAR PLANILHA */}
          {/* ======================================================== */}
          {step === 2 && modoPasso2 === "escolha" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Escolha como deseja iniciar os dados operacionais do sistema:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Opção A: Cadastro Manual */}
                <div
                  onClick={() => setModoPasso2("manual")}
                  className="rounded-lg border-2 border-muted hover:border-emerald-600 p-4 cursor-pointer transition-all hover:shadow-xs flex flex-col justify-between bg-card text-left group"
                >
                  <div className="space-y-2">
                    <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Building2Icon className="size-5" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">
                      Cadastrar Instituição Manualmente
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Preencha o formulário simples com Razão Social, CNPJ e contatos da sua organização.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full group-hover:bg-emerald-600 group-hover:text-white"
                  >
                    Preencher Formulário
                  </Button>
                </div>

                {/* Opção B: Importar Planilha */}
                <div className="rounded-lg border-2 border-muted hover:border-teal-600 p-4 transition-all hover:shadow-xs flex flex-col justify-between bg-card text-left group">
                  <div className="space-y-2">
                    <div className="size-10 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <SparklesIcon className="size-5" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      Importar Planilha Oficial
                      <Badge variant="secondary" className="text-[10px] bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                        IA MROSC
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Envie sua planilha Excel ou PDF do Transferegov. O assistente cria automaticamente a instituição, termo e rubricas.
                    </p>
                  </div>

                  <div className="mt-4">
                    <ImportarPlanilhaDialog
                      trigger={
                        <Button
                          type="button"
                          className="w-full bg-teal-600 hover:bg-teal-500 text-white gap-1.5"
                          size="sm"
                        >
                          <FileSpreadsheetIcon className="size-3.5" />
                          Selecionar Planilha
                        </Button>
                      }
                      onImportado={handlePlanilhaImportada}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="gap-1.5 text-xs text-muted-foreground"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  Voltar ao Passo 1
                </Button>
              </div>
            </div>
          )}

          {/* Sub-tela: Formulário Manual do Passo 2 */}
          {step === 2 && modoPasso2 === "manual" && (
            <form onSubmit={handleSalvarInstituicaoManual} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Building2Icon className="size-4 text-emerald-600" />
                    <span>Dados da Instituição (OSC)</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setModoPasso2("escolha")}
                    className="text-xs text-muted-foreground h-7"
                  >
                    Alternar para Importador
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inst_razao">Razão Social / Nome da Entidade *</Label>
                  <Input
                    id="inst_razao"
                    required
                    placeholder="Ex: Associação Beneficente Esperança"
                    value={formInst.razao_social}
                    onChange={(e) =>
                      setFormInst({ ...formInst, razao_social: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inst_cnpj">CNPJ *</Label>
                    <Input
                      id="inst_cnpj"
                      required
                      placeholder="00.000.000/0000-00"
                      value={formInst.cnpj}
                      onChange={(e) =>
                        setFormInst({ ...formInst, cnpj: maskCnpj(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inst_telefone">Telefone de Contato</Label>
                    <Input
                      id="inst_telefone"
                      placeholder="(00) 00000-0000"
                      value={formInst.telefone}
                      onChange={(e) =>
                        setFormInst({
                          ...formInst,
                          telefone: maskTelefone(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inst_email">E-mail Institucional</Label>
                  <Input
                    id="inst_email"
                    type="email"
                    placeholder="contato@organizacao.org.br"
                    value={formInst.email}
                    onChange={(e) =>
                      setFormInst({ ...formInst, email: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inst_endereco">Endereço da Sede</Label>
                  <Input
                    id="inst_endereco"
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    value={formInst.endereco}
                    onChange={(e) =>
                      setFormInst({ ...formInst, endereco: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModoPasso2("escolha")}
                  disabled={savingManualInst}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  Voltar
                </Button>

                <Button
                  type="submit"
                  disabled={savingManualInst}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                >
                  {savingManualInst ? "Cadastrando..." : "Concluir Onboarding"}
                  <CheckCircle2Icon className="size-4" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
