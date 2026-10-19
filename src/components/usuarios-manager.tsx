"use client"

import * as React from "react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { mroscService } from "@/lib/api/mrosc-service"
import {
  type Usuario,
  type RoleUsuario,
  type PermissoesUsuario,
  type ProjetoComInstituicao,
  PERMISSOES_LABELS,
  PERMISSOES_DEFAULT_POR_ROLE,
} from "@/lib/types"
import { maskTelefone } from "@/lib/masks"
import { toast } from "sonner"
import {
  UsersIcon,
  UserPlusIcon,
  SearchIcon,
  PencilIcon,
  Trash2Icon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ShieldIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  FolderGit2Icon,
  CheckIcon,
} from "lucide-react"

const ROLE_CONFIG: Record<RoleUsuario, { label: string; variant: "default" | "secondary" | "outline"; icon: React.ReactNode }> = {
  ADMIN: {
    label: "Administrador",
    variant: "default",
    icon: <ShieldCheckIcon className="size-3.5 mr-1 text-primary-foreground" />,
  },
  OPERADOR: {
    label: "Operador",
    variant: "secondary",
    icon: <ShieldIcon className="size-3.5 mr-1" />,
  },
  CONSULTA: {
    label: "Consulta",
    variant: "outline",
    icon: <ShieldAlertIcon className="size-3.5 mr-1 text-muted-foreground" />,
  },
}

export function UsuariosManager() {
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([])
  const [projetos, setProjetos] = React.useState<ProjetoComInstituicao[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busca, setBusca] = React.useState("")
  const [filtroRole, setFiltroRole] = React.useState<string>("TODOS")

  // Modal Criar
  const [openCriar, setOpenCriar] = React.useState(false)
  const [savingCriar, setSavingCriar] = React.useState(false)
  const [formCriar, setFormCriar] = React.useState({
    nome: "",
    email: "",
    password: "",
    cargo: "",
    role: "ADMIN" as RoleUsuario,
    telefone: "",
    permissoes: { ...PERMISSOES_DEFAULT_POR_ROLE.ADMIN } as PermissoesUsuario,
    acesso_todos_projetos: true,
    projetos_permitidos: [] as string[],
  })

  // Modal Editar
  const [openEditar, setOpenEditar] = React.useState(false)
  const [savingEditar, setSavingEditar] = React.useState(false)
  const [usuarioEditando, setUsuarioEditando] = React.useState<Usuario | null>(null)
  const [formEditar, setFormEditar] = React.useState({
    nome: "",
    cargo: "",
    role: "ADMIN" as RoleUsuario,
    telefone: "",
    ativo: true,
    password: "",
    permissoes: { ...PERMISSOES_DEFAULT_POR_ROLE.ADMIN } as PermissoesUsuario,
    acesso_todos_projetos: true,
    projetos_permitidos: [] as string[],
  })

  function togglePermissaoCriar(chave: keyof PermissoesUsuario, valor: boolean) {
    setFormCriar((prev) => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [chave]: valor,
      },
    }))
  }

  function togglePermissaoEditar(chave: keyof PermissoesUsuario, valor: boolean) {
    setFormEditar((prev) => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [chave]: valor,
      },
    }))
  }

  function toggleProjetoCriar(projetoId: string) {
    setFormCriar((prev) => {
      const existe = prev.projetos_permitidos.includes(projetoId)
      return {
        ...prev,
        projetos_permitidos: existe
          ? prev.projetos_permitidos.filter((id) => id !== projetoId)
          : [...prev.projetos_permitidos, projetoId],
      }
    })
  }

  function toggleProjetoEditar(projetoId: string) {
    setFormEditar((prev) => {
      const existe = prev.projetos_permitidos.includes(projetoId)
      return {
        ...prev,
        projetos_permitidos: existe
          ? prev.projetos_permitidos.filter((id) => id !== projetoId)
          : [...prev.projetos_permitidos, projetoId],
      }
    })
  }

  const carregarDados = React.useCallback(async () => {
    try {
      setLoading(true)
      const [usersData, projsData] = await Promise.all([
        mroscService.getUsuarios(),
        mroscService.getProjetos().catch(() => []),
      ])
      setUsuarios(usersData)
      setProjetos(projsData)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar dados: " + msg)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Submissão Criar
  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!formCriar.nome.trim() || !formCriar.email.trim() || !formCriar.password.trim()) {
      toast.error("Preencha nome, e-mail e senha.")
      return
    }
    if (formCriar.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.")
      return
    }

    try {
      setSavingCriar(true)
      const perms =
        formCriar.role === "ADMIN"
          ? {
              ...PERMISSOES_DEFAULT_POR_ROLE.ADMIN,
              acesso_todos_projetos: true,
              projetos_permitidos: [],
            }
          : {
              ...formCriar.permissoes,
              acesso_todos_projetos: formCriar.acesso_todos_projetos,
              projetos_permitidos: formCriar.acesso_todos_projetos ? [] : formCriar.projetos_permitidos,
            }

      await mroscService.createUsuario({
        nome: formCriar.nome.trim(),
        email: formCriar.email.trim().toLowerCase(),
        password: formCriar.password,
        cargo: formCriar.cargo.trim() || null,
        role: formCriar.role,
        telefone: formCriar.telefone.trim() || null,
        ativo: true,
        permissoes: perms,
      })
      toast.success("Usuário criado com sucesso!")
      setOpenCriar(false)
      setFormCriar({
        nome: "",
        email: "",
        password: "",
        cargo: "",
        role: "ADMIN",
        telefone: "",
        permissoes: { ...PERMISSOES_DEFAULT_POR_ROLE.ADMIN },
        acesso_todos_projetos: true,
        projetos_permitidos: [],
      })
      carregarDados()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar usuário"
      toast.error(msg)
    } finally {
      setSavingCriar(false)
    }
  }

  // Abrir Modal Editar
  function abrirEdicao(u: Usuario) {
    setUsuarioEditando(u)
    const acessoTodos =
      u.permissoes?.acesso_todos_projetos !== undefined
        ? u.permissoes.acesso_todos_projetos
        : true
    const projsPermitidos = u.permissoes?.projetos_permitidos || []

    setFormEditar({
      nome: u.nome,
      cargo: u.cargo || "",
      role: u.role,
      telefone: u.telefone || "",
      ativo: u.ativo,
      password: "",
      permissoes: u.permissoes
        ? { ...u.permissoes }
        : { ...PERMISSOES_DEFAULT_POR_ROLE[u.role] },
      acesso_todos_projetos: acessoTodos,
      projetos_permitidos: projsPermitidos,
    })
    setOpenEditar(true)
  }

  // Submissão Editar
  async function handleEditar(e: React.FormEvent) {
    e.preventDefault()
    if (!usuarioEditando) return
    if (!formEditar.nome.trim()) {
      toast.error("O nome é obrigatório.")
      return
    }
    if (formEditar.password && formEditar.password.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.")
      return
    }

    try {
      setSavingEditar(true)
      const perms =
        formEditar.role === "ADMIN"
          ? {
              ...PERMISSOES_DEFAULT_POR_ROLE.ADMIN,
              acesso_todos_projetos: true,
              projetos_permitidos: [],
            }
          : {
              ...formEditar.permissoes,
              acesso_todos_projetos: formEditar.acesso_todos_projetos,
              projetos_permitidos: formEditar.acesso_todos_projetos ? [] : formEditar.projetos_permitidos,
            }

      const payload: any = {
        nome: formEditar.nome.trim(),
        cargo: formEditar.cargo.trim() || null,
        role: formEditar.role,
        telefone: formEditar.telefone.trim() || null,
        ativo: formEditar.ativo,
        permissoes: perms,
      }
      if (formEditar.password.trim()) {
        payload.password = formEditar.password.trim()
      }

      await mroscService.updateUsuario(usuarioEditando.id, payload)
      toast.success("Usuário atualizado com sucesso!")
      setOpenEditar(false)
      carregarDados()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar usuário"
      toast.error(msg)
    } finally {
      setSavingEditar(false)
    }
  }

  // Excluir Usuário
  async function handleExcluir(id: string) {
    try {
      await mroscService.deleteUsuario(id)
      toast.success("Usuário excluído com sucesso.")
      carregarDados()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir usuário"
      toast.error(msg)
    }
  }

  // Filtros em memória
  const filtrados = React.useMemo(() => {
    return usuarios.filter((u) => {
      const matchBusca =
        u.nome.toLowerCase().includes(busca.toLowerCase()) ||
        u.email.toLowerCase().includes(busca.toLowerCase()) ||
        (u.cargo && u.cargo.toLowerCase().includes(busca.toLowerCase()))
      const matchRole = filtroRole === "TODOS" || u.role === filtroRole
      return matchBusca && matchRole
    })
  }, [usuarios, busca, filtroRole])

  return (
    <div className="space-y-6">
      {/* Barra superior de ações e filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou cargo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Select
            value={filtroRole}
            onValueChange={(v) => {
              if (v) setFiltroRole(v)
            }}
          >
            <SelectTrigger className="w-[170px] bg-background">
              <SelectValue placeholder="Perfil de acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os perfis</SelectItem>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="OPERADOR">Operador</SelectItem>
              <SelectItem value="CONSULTA">Consulta</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={carregarDados}
            title="Atualizar lista"
            className="shrink-0"
          >
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Button onClick={() => setOpenCriar(true)} className="gap-2 shrink-0">
          <UserPlusIcon className="size-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Tabela de Usuários */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Usuários Cadastrados</CardTitle>
              <CardDescription className="text-xs">
                {filtrados.length} {filtrados.length === 1 ? "usuário encontrado" : "usuários encontrados"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Acesso a Projetos</TableHead>
                  <TableHead>Cargo / Função</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <RefreshCwIcon className="size-5 animate-spin mx-auto mb-2 text-primary" />
                      Carregando usuários...
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <UsersIcon className="size-8 mx-auto mb-2 opacity-40" />
                      Nenhum usuário localizado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((u) => {
                    const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.ADMIN
                    const isAll =
                      u.role === "ADMIN" ||
                      u.permissoes?.acesso_todos_projetos !== false
                    const countPermitidos = u.permissoes?.projetos_permitidos?.length || 0

                    return (
                      <TableRow key={u.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{u.nome}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleConfig.variant} className="inline-flex items-center text-xs">
                            {roleConfig.icon}
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAll ? (
                            <Badge variant="outline" className="text-[11px] bg-muted/40 font-normal text-muted-foreground gap-1">
                              <FolderGit2Icon className="size-3 text-emerald-600" />
                              Todos os Projetos
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px] font-medium text-foreground gap-1">
                              <FolderGit2Icon className="size-3 text-primary" />
                              {countPermitidos} {countPermitidos === 1 ? "projeto" : "projetos"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.cargo || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.telefone || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={u.ativo ? "outline" : "secondary"}
                            className={`text-xs ${
                              u.ativo
                                ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10"
                                : "text-muted-foreground"
                            }`}
                          >
                            {u.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirEdicao(u)}
                              title="Editar usuário"
                              className="size-8 text-muted-foreground hover:text-foreground"
                            >
                              <PencilIcon className="size-4" />
                            </Button>

                            <ConfirmDialog
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir usuário"
                                  className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                              }
                              title="Excluir Usuário"
                              description={`Tem certeza que deseja excluir o usuário "${u.nome}"? O acesso será revogado imediatamente.`}
                              confirmLabel="Excluir"
                              onConfirm={() => handleExcluir(u.id)}
                              variant="destructive"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Criar Usuário */}
      <Dialog open={openCriar} onOpenChange={setOpenCriar}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCriar} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Adicione um novo usuário para acesso ao sistema MROSC.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Maria Silva"
                  value={formCriar.nome}
                  onChange={(e) => setFormCriar({ ...formCriar, nome: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail de Acesso *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@organizacao.org.br"
                    value={formCriar.email}
                    onChange={(e) => setFormCriar({ ...formCriar, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha Inicial *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formCriar.password}
                    onChange={(e) => setFormCriar({ ...formCriar, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role">Perfil de Permissão</Label>
                  <Select
                    value={formCriar.role}
                    onValueChange={(v) => {
                      if (v) {
                        const newRole = v as RoleUsuario
                        setFormCriar({
                          ...formCriar,
                          role: newRole,
                          permissoes: { ...PERMISSOES_DEFAULT_POR_ROLE[newRole] },
                        })
                      }
                    }}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                      <SelectItem value="CONSULTA">Apenas Leitura / Consulta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cargo">Cargo / Função</Label>
                  <Input
                    id="cargo"
                    placeholder="Ex: Gestor Financeiro"
                    value={formCriar.cargo}
                    onChange={(e) => setFormCriar({ ...formCriar, cargo: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={formCriar.telefone}
                  onChange={(e) =>
                    setFormCriar({ ...formCriar, telefone: maskTelefone(e.target.value) })
                  }
                />
              </div>

              {/* Seletor de Permissões Granulares */}
              {formCriar.role === "ADMIN" ? (
                <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/20 p-3 flex items-start gap-2.5 text-xs text-muted-foreground mt-2">
                  <ShieldCheckIcon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Autoridade Total (Administrador)</p>
                    <p>Administradores possuem acesso irrestrito a todas as operações, cadastros e configurações do sistema.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Autoridades Personalizadas
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Marque o que este usuário pode executar
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {(Object.keys(PERMISSOES_LABELS) as (keyof typeof PERMISSOES_LABELS)[]).map((chave) => {
                      const item = PERMISSOES_LABELS[chave]
                      const checked = Boolean(formCriar.permissoes?.[chave])
                      return (
                        <div
                          key={chave}
                          className="flex items-start gap-2 rounded-md border p-2 bg-background hover:bg-muted/30 transition-colors"
                        >
                          <Checkbox
                            id={`criar-perm-${chave}`}
                            checked={checked}
                            onCheckedChange={(val) => togglePermissaoCriar(chave, Boolean(val))}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={`criar-perm-${chave}`}
                            className="grid gap-0.5 cursor-pointer text-xs leading-none select-none"
                          >
                            <span className="font-medium text-foreground">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">{item.descricao}</span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Seletor de Acesso a Projetos */}
              {formCriar.role !== "ADMIN" && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <FolderGit2Icon className="size-3.5 text-primary" />
                        Acesso a Projetos
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Restrinja a quais projetos este usuário poderá visualizar e gerenciar
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-md border p-2.5 bg-muted/20">
                    <Checkbox
                      id="criar-todos-projetos"
                      checked={formCriar.acesso_todos_projetos}
                      onCheckedChange={(val) =>
                        setFormCriar((prev) => ({
                          ...prev,
                          acesso_todos_projetos: Boolean(val),
                          projetos_permitidos: Boolean(val) ? [] : prev.projetos_permitidos,
                        }))
                      }
                    />
                    <label
                      htmlFor="criar-todos-projetos"
                      className="cursor-pointer text-xs font-medium text-foreground select-none"
                    >
                      Acesso a todos os projetos (atuais e futuros)
                    </label>
                  </div>

                  {!formCriar.acesso_todos_projetos && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Selecione os projetos permitidos ({formCriar.projetos_permitidos.length} selecionados):
                      </span>
                      <div className="max-h-[160px] overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                        {projetos.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">Nenhum projeto cadastrado.</p>
                        ) : (
                          projetos.map((proj) => {
                            const isSelected = formCriar.projetos_permitidos.includes(proj.id)
                            return (
                              <div
                                key={proj.id}
                                className="flex items-center gap-2 rounded p-1.5 hover:bg-muted/40 transition-colors text-xs"
                              >
                                <Checkbox
                                  id={`criar-proj-${proj.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleProjetoCriar(proj.id)}
                                />
                                <label
                                  htmlFor={`criar-proj-${proj.id}`}
                                  className="cursor-pointer flex-1 flex items-center justify-between select-none"
                                >
                                  <span className="font-medium text-foreground">{proj.nome}</span>
                                  {proj.numero_termo && (
                                    <span className="text-[10px] text-muted-foreground">{proj.numero_termo}</span>
                                  )}
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenCriar(false)}
                disabled={savingCriar}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingCriar}>
                {savingCriar ? "Criando..." : "Salvar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Usuário */}
      <Dialog open={openEditar} onOpenChange={setOpenEditar}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditar} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados e perfil de {usuarioEditando?.email}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-nome">Nome Completo *</Label>
                <Input
                  id="edit-nome"
                  value={formEditar.nome}
                  onChange={(e) => setFormEditar({ ...formEditar, nome: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-role">Perfil de Permissão</Label>
                  <Select
                    value={formEditar.role}
                    onValueChange={(v) => {
                      if (v) {
                        const newRole = v as RoleUsuario
                        setFormEditar({
                          ...formEditar,
                          role: newRole,
                          permissoes: { ...PERMISSOES_DEFAULT_POR_ROLE[newRole] },
                        })
                      }
                    }}
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                      <SelectItem value="CONSULTA">Apenas Leitura / Consulta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Status da Conta</Label>
                  <Select
                    value={formEditar.ativo ? "ATIVO" : "INATIVO"}
                    onValueChange={(v) => {
                      if (v) setFormEditar({ ...formEditar, ativo: v === "ATIVO" })
                    }}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO">Ativo</SelectItem>
                      <SelectItem value="INATIVO">Inativo / Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cargo">Cargo / Função</Label>
                  <Input
                    id="edit-cargo"
                    value={formEditar.cargo}
                    onChange={(e) => setFormEditar({ ...formEditar, cargo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    value={formEditar.telefone}
                    onChange={(e) =>
                      setFormEditar({ ...formEditar, telefone: maskTelefone(e.target.value) })
                    }
                  />
                </div>
              </div>

              {/* Seletor de Permissões Granulares em Edição */}
              {formEditar.role === "ADMIN" ? (
                <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/20 p-3 flex items-start gap-2.5 text-xs text-muted-foreground mt-2">
                  <ShieldCheckIcon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Autoridade Total (Administrador)</p>
                    <p>Administradores possuem acesso irrestrito a todas as operações, cadastros e configurações do sistema.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Autoridades Personalizadas
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Marque o que este usuário pode executar
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {(Object.keys(PERMISSOES_LABELS) as (keyof typeof PERMISSOES_LABELS)[]).map((chave) => {
                      const item = PERMISSOES_LABELS[chave]
                      const checked = Boolean(formEditar.permissoes?.[chave])
                      return (
                        <div
                          key={chave}
                          className="flex items-start gap-2 rounded-md border p-2 bg-background hover:bg-muted/30 transition-colors"
                        >
                          <Checkbox
                            id={`editar-perm-${chave}`}
                            checked={checked}
                            onCheckedChange={(val) => togglePermissaoEditar(chave, Boolean(val))}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={`editar-perm-${chave}`}
                            className="grid gap-0.5 cursor-pointer text-xs leading-none select-none"
                          >
                            <span className="font-medium text-foreground">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">{item.descricao}</span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Seletor de Acesso a Projetos em Edição */}
              {formEditar.role !== "ADMIN" && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <FolderGit2Icon className="size-3.5 text-primary" />
                        Acesso a Projetos
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Restrinja a quais projetos este usuário poderá visualizar e gerenciar
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-md border p-2.5 bg-muted/20">
                    <Checkbox
                      id="editar-todos-projetos"
                      checked={formEditar.acesso_todos_projetos}
                      onCheckedChange={(val) =>
                        setFormEditar((prev) => ({
                          ...prev,
                          acesso_todos_projetos: Boolean(val),
                          projetos_permitidos: Boolean(val) ? [] : prev.projetos_permitidos,
                        }))
                      }
                    />
                    <label
                      htmlFor="editar-todos-projetos"
                      className="cursor-pointer text-xs font-medium text-foreground select-none"
                    >
                      Acesso a todos os projetos (atuais e futuros)
                    </label>
                  </div>

                  {!formEditar.acesso_todos_projetos && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Selecione os projetos permitidos ({formEditar.projetos_permitidos.length} selecionados):
                      </span>
                      <div className="max-h-[160px] overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                        {projetos.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">Nenhum projeto cadastrado.</p>
                        ) : (
                          projetos.map((proj) => {
                            const isSelected = formEditar.projetos_permitidos.includes(proj.id)
                            return (
                              <div
                                key={proj.id}
                                className="flex items-center gap-2 rounded p-1.5 hover:bg-muted/40 transition-colors text-xs"
                              >
                                <Checkbox
                                  id={`editar-proj-${proj.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleProjetoEditar(proj.id)}
                                />
                                <label
                                  htmlFor={`editar-proj-${proj.id}`}
                                  className="cursor-pointer flex-1 flex items-center justify-between select-none"
                                >
                                  <span className="font-medium text-foreground">{proj.nome}</span>
                                  {proj.numero_termo && (
                                    <span className="text-[10px] text-muted-foreground">{proj.numero_termo}</span>
                                  )}
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <KeyRoundIcon className="size-3.5" />
                  <span>Redefinir Senha (opcional):</span>
                </div>
                <Input
                  type="password"
                  placeholder="Deixe em branco para manter a senha atual"
                  value={formEditar.password}
                  onChange={(e) => setFormEditar({ ...formEditar, password: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenEditar(false)}
                disabled={savingEditar}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEditar}>
                {savingEditar ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
