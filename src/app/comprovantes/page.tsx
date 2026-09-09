"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  FileCheckIcon,
  UploadCloudIcon,
  FileTextIcon,
  ExternalLinkIcon,
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
import { moriaService } from "@/lib/api/moria-service"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

function ComprovantesContent() {
  const searchParams = useSearchParams()
  const initialDespesaId = searchParams.get("despesaId") || ""

  const [comprovantes, setComprovantes] = useState<any[]>([])
  const [despesas, setDespesas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [selectedDespesaId, setSelectedDespesaId] = useState<string>(initialDespesaId)
  const [tipoDocumento, setTipoDocumento] = useState<any>("NOTA_FISCAL")
  const [file, setFile] = useState<File | null>(null)

  async function loadData() {
    try {
      setLoading(true)
      const [compData, despData] = await Promise.all([
        moriaService.getComprovantes(),
        moriaService.getDespesas(),
      ])
      setComprovantes(compData)
      setDespesas(despData)
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
      await moriaService.uploadComprovante(file, selectedDespesaId, tipoDocumento)
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

  function handleViewOrDownload(storagePath: string, fileName: string) {
    const url = moriaService.getComprovantePublicUrl(storagePath)
    window.open(url, "_blank")
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Comprovantes & Gestão Documental</h2>
          <p className="text-sm text-muted-foreground">
            Auditoria e armazenamento seguro de notas, recibos, guias e comprovantes Pix no Supabase Storage.
          </p>
        </div>

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
                      <SelectValue placeholder="Selecione a despesa..." />
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
                      <SelectValue />
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
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Repositório Digital de Comprovantes</CardTitle>
          <CardDescription className="text-xs">
            Documentos organizados e preparados para prestação de contas no Transferegov.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando repositório...</div>
          ) : comprovantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileCheckIcon className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhum comprovante anexado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Faça o upload dos arquivos digitais para manter a auditoria fiscal 100% regular.
              </p>
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
                {comprovantes.map((comp) => (
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleViewOrDownload(comp.storage_path, comp.file_name)}
                      >
                        <ExternalLinkIcon className="size-3" />
                        Abrir
                      </Button>
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
