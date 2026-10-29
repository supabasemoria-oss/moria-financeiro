"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  FileCheckIcon,
  UploadCloudIcon,
  FileTextIcon,
  ExternalLinkIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { mroscService } from "@/lib/api/mrosc-service"
import { usePermissoes } from "@/hooks/use-permissoes"
import type { Projeto } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

function ComprovantesContent() {
  const { pode } = usePermissoes()
  const searchParams = useSearchParams()
  const initialDespesaId = searchParams.get("despesaId") || ""

  const [comprovantes, setComprovantes] = useState<any[]>([])
  const [despesas, setDespesas] = useState<any[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [filtroDespesaId, setFiltroDespesaId] = useState<string>(initialDespesaId)
  const [filtroProjeto, setFiltroProjeto] = useState<string>("ALL")
  const [filtroTipo, setFiltroTipo] = useState<string>("ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [selectedDespesaId, setSelectedDespesaId] = useState<string>(initialDespesaId)
  const [tipoDocumento, setTipoDocumento] = useState<any>("NOTA_FISCAL")
  const [file, setFile] = useState<File | null>(null)

  async function loadData() {
    try {
      setLoading(true)
      const [compData, despData, projData] = await Promise.all([
        mroscService.getComprovantes(),
        mroscService.getDespesas(),
        mroscService.getProjetos(),
      ])
      setComprovantes(compData)
      setDespesas(despData)
      setProjetos(projData)
      if (despData.length > 0 && !selectedDespesaId) {
        setSelectedDespesaId(despData[0].id)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao carregar comprovantes: " + msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDespesaId || !file || !tipoDocumento) {
      toast.error("Selecione a despesa, o tipo de documento e o arquivo (PDF, JPG, PNG).")
      return
    }

    try {
      setUploading(true)
      await mroscService.uploadComprovante(file, selectedDespesaId, tipoDocumento)
      toast.success("Comprovante anexado com sucesso ao Supabase Storage!")
      setFile(null)
      setOpen(false)
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      toast.error("Erro ao fazer upload do comprovante: " + msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleViewOrDownload(storagePath: string, fileName: string) {
    try {
      const url = await mroscService.getComprovanteUrl(storagePath)
      window.open(url, "_blank")
    } catch {
      const url = mroscService.getComprovantePublicUrl(storagePath)
      window.open(url, "_blank")
    }
  }

  async function handleExcluirComprovante(id: string, storagePath: string, fileName: string) {
    if (!window.confirm(`Tem certeza que deseja excluir o comprovante "${fileName}"?\nEsta ação removerá o arquivo permanentemente.`)) {
      return
    }
    try {
      setDeletingId(id)
      await mroscService.deleteComprovante(id, storagePath)
      toast.success(`Comprovante "${fileName}" excluído com sucesso!`)
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir comprovante"
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  const tipoLabelMap: Record<string, string> = {
    NOTA_FISCAL: "Nota Fiscal (DANFE)",
    RECIBO: "Recibo de Pagamento",
    COMPROVANTE_PIX: "Comprovante Pix / TED",
    FOLHA_PAGAMENTO: "Folha de Pagamento / Holerite",
    GUIA_IMPOSTO: "Guia de Imposto (INSS / FGTS)",
    CONTRATO: "Contrato de Prestação",
    COTACAO: "Cotação de Preços (3 orçamentos)",
    OUTRO: "Outro Documento",
  }

  const despesaFiltrada = useMemo(() => {
    if (!filtroDespesaId) return null
    return despesas.find((d) => d.id === filtroDespesaId)
  }, [despesas, filtroDespesaId])

  const comprovantesFiltrados = useMemo(() => {
    return comprovantes.filter((comp) => {
      // 0. Filtro Despesa Específica (ex: via link da Execução Financeira)
      if (filtroDespesaId && comp.despesa_id !== filtroDespesaId) {
        return false
      }
      // 1. Filtro Projeto
      if (filtroProjeto !== "ALL" && comp.despesas?.projeto_id !== filtroProjeto) {
        return false
      }
      // 2. Filtro Tipo
      if (filtroTipo !== "ALL" && comp.tipo_documento !== filtroTipo) {
        return false
      }
      // 3. Busca Textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const nomeArq = (comp.file_name || comp.arquivo_nome || "").toLowerCase()
        const descDesp = (comp.despesas?.descricao || "").toLowerCase()
        const numDoc = (comp.despesas?.numero_documento_fiscal || "").toLowerCase()
        const forn = (comp.despesas?.fornecedores?.razao_social_nome || "").toLowerCase()
        const proj = (comp.despesas?.projetos?.nome || "").toLowerCase()
        if (
          !nomeArq.includes(term) &&
          !descDesp.includes(term) &&
          !numDoc.includes(term) &&
          !forn.includes(term) &&
          !proj.includes(term)
        ) {
          return false
        }
      }
      return true
    })
  }, [comprovantes, filtroDespesaId, filtroProjeto, filtroTipo, searchTerm])

  const hasFiltrosAtivos = filtroDespesaId !== "" || filtroProjeto !== "ALL" || filtroTipo !== "ALL" || searchTerm.trim() !== ""

  function limparFiltros() {
    setFiltroDespesaId("")
    setFiltroProjeto("ALL")
    setFiltroTipo("ALL")
    setSearchTerm("")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Comprovantes & Gestão Documental</h2>
          <p className="text-sm text-muted-foreground">
            Auditoria e armazenamento seguro de notas, recibos, guias e comprovantes Pix no Supabase Storage.
          </p>
        </div>

        {pode("comprovantes_anexar") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                  <UploadCloudIcon className="size-4" />
                  Anexar Comprovante
                </Button>
              }
            />
          <DialogContent className="sm:max-w-[540px]">
            <form onSubmit={handleUpload}>
              <DialogHeader>
                <DialogTitle>Upload e Tipificação de Comprovante</DialogTitle>
                <DialogDescription>
                  Vincule o arquivo digital diretamente à despesa correspondente para o Transferegov.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="despesa">Despesa Vinculada *</Label>
                  <Select
                    value={selectedDespesaId}
                    onValueChange={(val) => {
                      if (val) setSelectedDespesaId(val)
                    }}
                  >
                    <SelectTrigger id="despesa">
                      <SelectValue placeholder="Selecione a despesa...">
                        {(val) => {
                          if (!val) return "Selecione a despesa..."
                          const d = despesas.find((item) => item.id === val)
                          return d ? `${formatDate(d.data_despesa)} - ${d.descricao} (${formatCurrency(d.valor)})` : val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {despesas.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {formatDate(d.data_despesa)} - {d.descricao} ({formatCurrency(d.valor)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tipo">Tipificação do Documento *</Label>
                  <Select
                    value={tipoDocumento}
                    onValueChange={(val: any) => {
                      if (val) setTipoDocumento(val)
                    }}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue>
                        {(val) => {
                          const labels: Record<string, string> = {
                            NOTA_FISCAL: "Nota Fiscal (DANFE)",
                            RECIBO: "Recibo de Pagamento (RPA)",
                            COMPROVANTE_PIX: "Comprovante Pix / TED Bancário",
                            FOLHA_PAGAMENTO: "Folha de Pagamento / Holerite",
                            GUIA_IMPOSTO: "Guia de Imposto (GPS / DARF / FGTS)",
                            CONTRATO: "Contrato / Termo de Referência",
                            COTACAO: "Cotação de Preços (Pesquisa Mercadológica)",
                            OUTRO: "Outro Comprovante",
                          }
                          return (val && labels[val]) ? labels[val] : val
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOTA_FISCAL">Nota Fiscal (DANFE)</SelectItem>
                      <SelectItem value="RECIBO">Recibo de Pagamento (RPA)</SelectItem>
                      <SelectItem value="COMPROVANTE_PIX">Comprovante Pix / TED Bancário</SelectItem>
                      <SelectItem value="FOLHA_PAGAMENTO">Folha de Pagamento / Holerite</SelectItem>
                      <SelectItem value="GUIA_IMPOSTO">Guia de Imposto (GPS / DARF / FGTS)</SelectItem>
                      <SelectItem value="CONTRATO">Contrato / Termo de Referência</SelectItem>
                      <SelectItem value="COTACAO">Cotação de Preços (Pesquisa Mercadológica)</SelectItem>
                      <SelectItem value="OUTRO">Outro Comprovante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="file">Arquivo Digital (PDF, JPG, PNG) *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Formatos aceitos: PDF, JPEG ou PNG até 25MB.
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {uploading ? "Enviando para o Supabase..." : "Salvar Comprovante"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {filtroDespesaId && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheckIcon className="size-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Filtrando anexos da despesa:{" "}
              <strong>
                {despesaFiltrada
                  ? `${despesaFiltrada.descricao}${despesaFiltrada.fornecedores?.razao_social_nome ? ` • ${despesaFiltrada.fornecedores.razao_social_nome}` : ""}`
                  : filtroDespesaId}
              </strong>
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-[11px] gap-1 self-start sm:self-auto shrink-0"
            onClick={() => setFiltroDespesaId("")}
          >
            <XIcon className="size-3" />
            Ver todos os comprovantes
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Repositório Digital de Comprovantes</CardTitle>
              <CardDescription className="text-xs">
                {comprovantesFiltrados.length === comprovantes.length
                  ? `Total de ${comprovantes.length} documento(s) arquivado(s).`
                  : `Exibindo ${comprovantesFiltrados.length} de ${comprovantes.length} comprovante(s).`}
              </CardDescription>
            </div>

            {hasFiltrosAtivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-7 text-xs text-muted-foreground hover:text-destructive px-2 self-start sm:self-auto gap-1"
              >
                <XIcon className="size-3.5" />
                Limpar todos os filtros
              </Button>
            )}
          </div>

          {/* BARRA DE FILTROS E BUSCA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t">
            {/* 1. Busca Textual */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do arquivo, NFe, despesa ou fornecedor..."
                className="pl-8 pr-8 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>

            {/* 2. Filtro por Projeto */}
            <div>
              <Select value={filtroProjeto} onValueChange={(val) => setFiltroProjeto(val ?? "ALL")}>
                <SelectTrigger className="h-9 text-xs w-full max-w-full overflow-hidden">
                  <FilterIcon className="size-3.5 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Projeto">
                    {(val) => {
                      if (!val || val === "ALL") return "Todos os Projetos"
                      const p = projetos.find((item) => item.id === val)
                      const nome = p?.nome ?? val
                      return (
                        <span className="truncate block max-w-[170px]" title={nome}>
                          {nome}
                        </span>
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Projetos</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Filtro por Tipificação */}
            <div>
              <Select value={filtroTipo} onValueChange={(val) => setFiltroTipo(val ?? "ALL")}>
                <SelectTrigger className="h-9 text-xs w-full max-w-full overflow-hidden">
                  <SlidersHorizontalIcon className="size-3.5 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Tipificação">
                    {(val) => {
                      if (!val || val === "ALL") return "Todas as Tipificações"
                      return tipoLabelMap[val] || val
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Tipificações</SelectItem>
                  <SelectItem value="NOTA_FISCAL">Nota Fiscal (DANFE)</SelectItem>
                  <SelectItem value="RECIBO">Recibo de Pagamento (RPA)</SelectItem>
                  <SelectItem value="COMPROVANTE_PIX">Comprovante Pix / TED</SelectItem>
                  <SelectItem value="FOLHA_PAGAMENTO">Folha de Pagamento / Holerite</SelectItem>
                  <SelectItem value="GUIA_IMPOSTO">Guia de Imposto (GPS / DARF / FGTS)</SelectItem>
                  <SelectItem value="CONTRATO">Contrato / Termo</SelectItem>
                  <SelectItem value="COTACAO">Cotação de Preços</SelectItem>
                  <SelectItem value="OUTRO">Outro Comprovante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando repositório...</div>
          ) : comprovantesFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileCheckIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhum comprovante encontrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {hasFiltrosAtivos
                  ? "Tente ajustar ou limpar os filtros para localizar os documentos."
                  : "Faça o upload dos arquivos digitais para manter a auditoria fiscal 100% regular."}
              </p>
              {hasFiltrosAtivos && (
                <Button variant="outline" size="sm" onClick={limparFiltros} className="text-xs h-8">
                  Limpar todos os filtros
                </Button>
              )}
            </div>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipificação</TableHead>
                    <TableHead>Despesa Relacionada</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Data Anexo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprovantesFiltrados.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileTextIcon className="size-4 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[200px] text-xs font-semibold">{comp.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {tipoLabelMap[comp.tipo_documento] || comp.tipo_documento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {comp.despesas ? (
                          <div>
                            <div className="font-medium">{comp.despesas.descricao}</div>
                            <div className="text-muted-foreground font-mono">{formatCurrency(comp.despesas.valor)}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {comp.despesas?.projetos?.nome || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {formatDate(comp.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleViewOrDownload(comp.storage_path, comp.file_name)}
                          >
                            <ExternalLinkIcon className="size-3" />
                            Abrir
                          </Button>
                          {pode("comprovantes_anexar") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === comp.id}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Excluir comprovante"
                              onClick={() => handleExcluirComprovante(comp.id, comp.storage_path, comp.file_name)}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ComprovantesPage() {
  return (
    <DashboardShell>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando módulo de comprovantes...</div>}>
        <ComprovantesContent />
      </Suspense>
    </DashboardShell>
  )
}
