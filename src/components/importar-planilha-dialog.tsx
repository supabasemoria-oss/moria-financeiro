"use client"

import * as React from "react"
import {
  UploadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  XIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { moriaService } from "@/lib/api/moria-service"
import {
  extrairLinhasXLS,
  sugerirMapeamentoXLS,
  sugerirMapeamentoPDF,
  CAMPOS_SISTEMA,
  type MapeamentoColuna,
  type ResultadoMapeamento,
} from "@/lib/gemini-import"

type Etapa = "upload" | "mapeando" | "validando" | "importando" | "concluido"

import { useRouter } from "next/navigation"

interface Props {
  projetoId?: string
  trigger: React.ReactNode
  onImportado?: () => void
}

const CAMPO_LABELS: Record<string, string> = {
  descricao: "Descrição",
  codigo_natureza_despesa: "Cód. Natureza Despesa",
  tipo: "Tipo",
  quantidade: "Quantidade",
  unidade: "Unidade",
  valor_unitario: "Valor Unitário",
}

export function ImportarPlanilhaDialog({ projetoId, trigger, onImportado }: Props) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [etapa, setEtapa] = React.useState<Etapa>("upload")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [rowsXLS, setRowsXLS] = React.useState<string[][]>([])
  const [resultado, setResultado] = React.useState<ResultadoMapeamento | null>(null)
  const [mapeamento, setMapeamento] = React.useState<MapeamentoColuna[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setEtapa("upload")
    setArquivo(null)
    setRowsXLS([])
    setResultado(null)
    setMapeamento([])
    setErro(null)
  }

  function handleClose(v: boolean) {
    if (v && !projetoId) {
      toast.error("Nenhum projeto cadastrado. Crie um projeto primeiro.", {
        action: { label: "Criar projeto", onClick: () => router.push("/projetos") },
        duration: 6000,
      })
      return
    }
    if (!v) reset()
    setOpen(v)
  }

  async function handleArquivo(file: File) {
    setArquivo(file)
    setErro(null)
    setEtapa("mapeando")

    try {
      let res: ResultadoMapeamento

      if (file.name.match(/\.(xlsx?|xls)$/i)) {
        const rows = await extrairLinhasXLS(file)
        setRowsXLS(rows)
        res = await sugerirMapeamentoXLS(rows)
      } else {
        res = await sugerirMapeamentoPDF(file)
      }

      setResultado(res)
      setMapeamento(res.mapeamento)
      setEtapa("validando")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido"
      setErro(msg)
      setEtapa("upload")
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleArquivo(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleArquivo(file)
  }

  function atualizarCampo(indice: number, campo: string | null) {
    setMapeamento((prev) =>
      prev.map((m) =>
        m.indice === indice ? { ...m, campo_sistema: campo } : m
      )
    )
  }

  async function handleImportar() {
    if (!resultado) return
    setEtapa("importando")

    try {
      const linhasIgnorar = new Set([
        resultado.linha_cabecalho,
        ...resultado.linhas_secao,
        ...resultado.linhas_ignorar,
      ])

      const linhasDado =
        rowsXLS.length > 0
          ? rowsXLS
              .map((row, i) => ({ row, i }))
              .filter(
                ({ i }) =>
                  !linhasIgnorar.has(i) && i > resultado.linha_cabecalho
              )
          : resultado.preview.map((p) => ({
              row: [] as string[],
              i: -1,
              previewObj: p,
            }))

      let criadas = 0
      for (const item of linhasDado) {
        const obj: Record<string, string> = {} as Record<string, string>
          if ("previewObj" in item && item.previewObj) {
            Object.assign(obj, item.previewObj as Record<string, string>)
          }

        if (rowsXLS.length > 0) {
          for (const m of mapeamento) {
            if (m.campo_sistema) {
              obj[m.campo_sistema] = (item as any).row[m.indice] ?? ""
            }
          }
        }

        const descricao = obj.descricao?.trim()
        if (!descricao) continue

        const quantidade = parseFloat(
          (obj.quantidade ?? "1").replace(/\./g, "").replace(",", ".")
        )
        const valor_unitario = parseFloat(
          (obj.valor_unitario ?? "0").replace(/\./g, "").replace(",", ".")
        )

        await moriaService.createRubrica({
          projeto_id: projetoId!,
          descricao,
          codigo_natureza_despesa:
            obj.codigo_natureza_despesa?.trim() || "33903900",
          tipo: (obj.tipo?.toUpperCase() as any) || "SERVICO",
          quantidade: isNaN(quantidade) ? 1 : quantidade,
          unidade: obj.unidade?.trim() || "UN",
          valor_unitario: isNaN(valor_unitario) ? 0 : valor_unitario,
        })
        criadas++
      }

      setEtapa("concluido")
      toast.success(`${criadas} rubrica(s) importada(s) com sucesso.`)
      onImportado?.()
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Erro desconhecido"

      // Erros conhecidos com mensagens amigáveis
      if (msg.includes("foreign key") || msg.includes("projeto_id")) {
        msg = "Projeto não encontrado no banco. Crie o projeto antes de importar rubricas."
        toast.error(msg, {
          action: { label: "Criar projeto", onClick: () => router.push("/projetos") },
          duration: 8000,
        })
      } else if (msg.includes("gemini_api_key") || msg.includes("Chave de API")) {
        msg = "Chave do Gemini não configurada."
        toast.error(msg, {
          action: { label: "Configurações", onClick: () => router.push("/configuracoes") },
          duration: 8000,
        })
      } else if (msg.includes("violates") || msg.includes("constraint")) {
        msg = "Erro de integridade no banco. Verifique se os dados da planilha são válidos."
        toast.error(msg)
      } else {
        toast.error("Erro ao importar: " + msg)
      }

      setErro(msg)
      setEtapa("validando")
    }
  }

  const camposUsados = new Set(
    mapeamento.filter((m) => m.campo_sistema).map((m) => m.campo_sistema)
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="size-4" />
            Importar Planilha Orçamentária
          </DialogTitle>
          <DialogDescription>
            Importe rubricas de um arquivo XLS, XLSX ou PDF. O Gemini sugerirá
            o mapeamento automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* ETAPA: UPLOAD */}
        {etapa === "upload" && (
          <div className="flex flex-col gap-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 py-12 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <UploadIcon className="size-8 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  XLS, XLSX, PDF — planilha do Ministério, Transferegov, etc.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  <FileSpreadsheetIcon className="size-3" /> XLS / XLSX
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <FileTextIcon className="size-3" /> PDF
                </Badge>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,.pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleInputChange}
            />
            {erro && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}
          </div>
        )}

        {/* ETAPA: MAPEANDO */}
        {etapa === "mapeando" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2Icon className="size-8 animate-spin text-blue-500" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Analisando planilha com Gemini...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {arquivo?.name}
              </p>
            </div>
          </div>
        )}

        {/* ETAPA: VALIDANDO */}
        {etapa === "validando" && resultado && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Confirme ou ajuste o mapeamento sugerido pelo Gemini. Colunas com{" "}
              <span className="text-muted-foreground font-medium">— ignorar —</span>{" "}
              não serão importadas.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna da planilha</TableHead>
                    <TableHead>Campo do sistema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapeamento.map((m) => (
                    <TableRow key={m.indice}>
                      <TableCell className="font-mono text-xs">
                        {m.coluna_original || `Coluna ${m.indice}`}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.campo_sistema ?? "__ignorar__"}
                          onValueChange={(v) =>
                            atualizarCampo(
                              m.indice,
                              v === "__ignorar__" ? null : v
                            )
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignorar__">
                              — ignorar —
                            </SelectItem>
                            {CAMPOS_SISTEMA.map((c) => (
                              <SelectItem
                                key={c.campo}
                                value={c.campo}
                                disabled={
                                  camposUsados.has(c.campo) &&
                                  m.campo_sistema !== c.campo
                                }
                              >
                                {CAMPO_LABELS[c.campo] ?? c.campo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {resultado.preview.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5 text-muted-foreground">
                  Prévia — {resultado.preview.length} rubrica(s) que serão criadas:
                </p>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {CAMPOS_SISTEMA.map((c) => (
                          <TableHead
                            key={c.campo}
                            className="text-xs whitespace-nowrap px-3"
                          >
                            {CAMPO_LABELS[c.campo] ?? c.campo}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.preview.map((row, i) => (
                        <TableRow key={i}>
                          {CAMPOS_SISTEMA.map((c) => (
                            <TableCell
                              key={c.campo}
                              className="text-xs px-3 max-w-[180px]"
                            >
                              {row[c.campo] ? (
                                <span
                                  className="block truncate"
                                  title={row[c.campo]}
                                >
                                  {row[c.campo]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {erro && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}
          </div>
        )}

        {/* ETAPA: IMPORTANDO */}
        {etapa === "importando" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2Icon className="size-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Criando rubricas...</p>
          </div>
        )}

        {/* ETAPA: CONCLUÍDO */}
        {etapa === "concluido" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2Icon className="size-10 text-emerald-500" />
            <p className="text-sm font-medium">Importação concluída com sucesso!</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {etapa === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
          {etapa === "validando" && (
            <>
              <Button
                variant="outline"
                onClick={reset}
                className="gap-1"
              >
                <XIcon className="size-3.5" />
                Trocar arquivo
              </Button>
              <Button
                onClick={handleImportar}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <UploadIcon className="size-4" />
                Importar rubricas
              </Button>
            </>
          )}
          {etapa === "concluido" && (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
