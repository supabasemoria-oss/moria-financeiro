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
  SparklesIcon,
  Building2Icon,
  FolderPlusIcon,
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
import { mroscService } from "@/lib/api/mrosc-service"
import {
  extrairLinhasXLS,
  sugerirMapeamentoXLS,
  sugerirMapeamentoPDF,
  vincularOuCriarInstituicaoEProjeto,
  CAMPOS_SISTEMA,
  type MapeamentoColuna,
  type ResultadoMapeamento,
} from "@/lib/gemini-import"
import { useRouter } from "next/navigation"

type Etapa = "upload" | "mapeando" | "validando" | "importando" | "concluido"

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
  const [cadastrarFornecedores, setCadastrarFornecedores] = React.useState(true)

  // Gerenciamento de Projeto / Instituição destino
  const [projetos, setProjetos] = React.useState<any[]>([])
  const [projetoSelecionadoId, setProjetoSelecionadoId] = React.useState<string>(projetoId || "")
  const [modoDestino, setModoDestino] = React.useState<"auto_criar" | "existente">("auto_criar")

  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      mroscService.getProjetos().then((lista) => {
        setProjetos(lista)
        if (!projetoId && lista.length > 0 && !projetoSelecionadoId) {
          setProjetoSelecionadoId(lista[0].id)
        }
      })
    }
  }, [open, projetoId])

  function reset() {
    setEtapa("upload")
    setArquivo(null)
    setRowsXLS([])
    setResultado(null)
    setMapeamento([])
    setErro(null)
    setCadastrarFornecedores(true)
    setModoDestino("auto_criar")
  }

  function handleClose(v: boolean) {
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

      // Se temos projetoId passado via prop, focar nele; caso contrário, se a planilha tiver dados de proposta/OSC, focar em auto_criar
      if (projetoId) {
        setModoDestino("existente")
        setProjetoSelecionadoId(projetoId)
      } else if (res.metadados?.proposta_numero || res.metadados?.osc_nome) {
        setModoDestino("auto_criar")
      } else {
        setModoDestino("existente")
      }

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

  function aplicarTodasSugestoesIA() {
    setMapeamento((prev) =>
      prev.map((m) => ({
        ...m,
        campo_sistema: m.sugestao_ia ?? null,
      }))
    )
    toast.success("Sugestões da IA reaplicadas em todas as colunas.")
  }

  async function handleImportar() {
    if (!resultado) return
    setEtapa("importando")

    try {
      let targetProjetoId = projetoId || projetoSelecionadoId
      let nomeProjetoFinal = ""

      // 1. Vincular ou Auto-criar Instituição e Projeto se solicitado
      if (modoDestino === "auto_criar" || !targetProjetoId) {
        if (!resultado.metadados?.osc_nome && !resultado.metadados?.proposta_numero && !targetProjetoId) {
          throw new Error("Selecione um projeto existente ou forneça uma planilha com dados da OSC/Proposta.")
        }

        const valorTotal = resultado.rubricas_detectadas
          ? resultado.rubricas_detectadas.reduce((acc, r) => acc + r.valor_total, 0)
          : resultado.metadados?.valor_total_estimado || 0

        const resVinculo = await vincularOuCriarInstituicaoEProjeto(
          resultado.metadados || {},
          valorTotal
        )
        targetProjetoId = resVinculo.projetoId
        nomeProjetoFinal = resVinculo.projetoNome
      } else {
        const projEncontrado = projetos.find((p) => p.id === targetProjetoId)
        nomeProjetoFinal = projEncontrado?.nome || "Projeto"
      }

      if (!targetProjetoId) {
        throw new Error("Não foi possível identificar o projeto de destino.")
      }

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

      // 2. Criar rubricas: se a skill identificou rubricas estruturadas de alta fidelidade
      if (resultado.rubricas_detectadas && resultado.rubricas_detectadas.length > 0) {
        for (const rub of resultado.rubricas_detectadas) {
          await mroscService.createRubrica({
            projeto_id: targetProjetoId,
            descricao: rub.descricao,
            codigo_natureza_despesa: rub.codigo_natureza_despesa || "33903900",
            tipo: (rub.tipo as any) || "SERVICO",
            quantidade: rub.quantidade,
            unidade: rub.unidade || "UN",
            valor_unitario: rub.valor_unitario,
          })
          criadas++
        }
      } else {
        // Fallback para linhas mapeadas manualmente
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

          await mroscService.createRubrica({
            projeto_id: targetProjetoId,
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
      }

      // 3. Auto-cadastro de fornecedores identificados nas cotações
      let fornecedoresCriados = 0
      if (
        cadastrarFornecedores &&
        resultado.fornecedores_detectados &&
        resultado.fornecedores_detectados.length > 0
      ) {
        try {
          const existentes = await mroscService.getFornecedores()
          const cnpjsExistentes = new Set(
            existentes.map((f) => f.cpf_cnpj.replace(/\D/g, ""))
          )

          for (const f of resultado.fornecedores_detectados) {
            const rawCnpj = f.cpf_cnpj.replace(/\D/g, "")
            if (!cnpjsExistentes.has(rawCnpj)) {
              await mroscService.createFornecedor({
                razao_social_nome: f.razao_social_nome,
                cpf_cnpj: f.cpf_cnpj,
              })
              cnpjsExistentes.add(rawCnpj)
              fornecedoresCriados++
            }
          }
        } catch (errFornecedores) {
          console.warn("Aviso ao auto-cadastrar fornecedores cotados:", errFornecedores)
        }
      }

      setEtapa("concluido")
      if (fornecedoresCriados > 0) {
        toast.success(
          `${criadas} rubrica(s) e ${fornecedoresCriados} fornecedor(es) vinculados com sucesso no projeto ${nomeProjetoFinal}.`
        )
      } else {
        toast.success(`${criadas} rubrica(s) importada(s) com sucesso no projeto ${nomeProjetoFinal}.`)
      }
      onImportado?.()
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Erro desconhecido"

      if (msg.includes("foreign key") || msg.includes("projeto_id")) {
        msg = "Projeto de destino não encontrado. Crie ou selecione um projeto válido."
      } else if (msg.includes("gemini_api_key") || msg.includes("Chave de API")) {
        msg = "Chave do Gemini não configurada."
        toast.error(msg, {
          action: { label: "Configurações", onClick: () => router.push("/configuracoes") },
          duration: 8000,
        })
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="size-4" />
            Importar Planilha Orçamentária
          </DialogTitle>
          <DialogDescription>
            Importe rubricas e cotações de um arquivo XLS, XLSX ou PDF. A inteligência MROSC sugerirá o mapeamento e vinculará as entidades.
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
                Analisando planilha com Skill MROSC e Gemini...
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
            {/* 1. Metadados Extraídos da Planilha */}
            {resultado.metadados?.modelo_identificado && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2Icon className="size-4 text-emerald-600" />
                  Skill MROSC:{" "}
                  {resultado.metadados.modelo_identificado === "MODELO_A_TRANSFEREGOV"
                    ? "Padrão Transferegov (Cotação Tripla & Encargos)"
                    : "Padrão Descritivo (Min. Mulheres)"}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {resultado.metadados.proposta_numero && (
                    <span>
                      <strong className="text-foreground">Proposta:</strong> {resultado.metadados.proposta_numero}
                    </span>
                  )}
                  {resultado.metadados.osc_nome && (
                    <span>
                      <strong className="text-foreground">OSC:</strong> {resultado.metadados.osc_nome}
                    </span>
                  )}
                  {resultado.metadados.cnpj_osc && (
                    <span>
                      <strong className="text-foreground">CNPJ:</strong> {resultado.metadados.cnpj_osc}
                    </span>
                  )}
                  {resultado.rubricas_detectadas && (
                    <span>
                      <strong className="text-foreground">Rubricas prontas:</strong> {resultado.rubricas_detectadas.length}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 2. Seleção de Destino: Criar ou Vincular Projeto / Instituição */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderPlusIcon className="size-4 text-muted-foreground" />
                Destino do Projeto & Instituição
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(resultado.metadados?.proposta_numero || resultado.metadados?.osc_nome) && (
                  <label
                    onClick={() => setModoDestino("auto_criar")}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      modoDestino === "auto_criar"
                        ? "border-emerald-500 bg-emerald-500/10 font-medium text-foreground"
                        : "border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="destino"
                      checked={modoDestino === "auto_criar"}
                      onChange={() => setModoDestino("auto_criar")}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <div>
                      <span className="block text-foreground font-semibold">
                        Auto-vincular / Criar Projeto
                      </span>
                      <span className="text-[11px] block mt-0.5">
                        {resultado.metadados.proposta_numero
                          ? `Proposta ${resultado.metadados.proposta_numero} • ${resultado.metadados.osc_nome || "OSC"}`
                          : `Projeto ${resultado.metadados.osc_nome}`}
                      </span>
                    </div>
                  </label>
                )}

                <label
                  onClick={() => setModoDestino("existente")}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    modoDestino === "existente"
                      ? "border-emerald-500 bg-emerald-500/10 font-medium text-foreground"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="destino"
                    checked={modoDestino === "existente"}
                    onChange={() => setModoDestino("existente")}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div className="w-full">
                    <span className="block text-foreground font-semibold">
                      Vincular a projeto existente
                    </span>
                    {modoDestino === "existente" && (
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={projetoSelecionadoId}
                          onValueChange={(val) => setProjetoSelecionadoId(val || "")}
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue>
                              {(val) => {
                                if (!val) return "Selecione o projeto..."
                                const p = projetos.find((proj) => proj.id === val)
                                return p ? p.nome : "Selecione o projeto..."
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {projetos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} ({p.instituicoes?.razao_social || "Sem OSC"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* 3. Checkbox para auto-cadastrar fornecedores das cotações */}
            {resultado.fornecedores_detectados && resultado.fornecedores_detectados.length > 0 && (
              <label className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5 text-xs cursor-pointer hover:bg-muted/60 transition-colors">
                <div>
                  <span className="font-medium text-foreground">
                    Cadastrar {resultado.fornecedores_detectados.length} fornecedores identificados nas cotações
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Insere automaticamente as empresas cotadas na base de fornecedores do sistema.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cadastrarFornecedores}
                  onChange={(e) => setCadastrarFornecedores(e.target.checked)}
                  className="size-4 accent-emerald-600 rounded cursor-pointer ml-3"
                />
              </label>
            )}

            {/* 4. Mapeamento com propostas da I.A. explícitas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Mapeamento de Colunas
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    A I.A. propõe o melhor campo com base na Skill MROSC. Você pode aceitar ou ajustar livremente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={aplicarTodasSugestoesIA}
                  className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <SparklesIcon className="size-3 text-emerald-500" />
                  Reaplicar sugestões da IA
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Coluna da planilha</TableHead>
                      <TableHead className="w-[25%]">Proposta da I.A.</TableHead>
                      <TableHead className="w-[30%]">Campo escolhido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapeamento.map((m) => (
                      <TableRow key={m.indice}>
                        <TableCell className="font-mono text-xs py-2">
                          <span className="font-medium text-foreground">
                            {m.coluna_original || `Coluna ${m.indice}`}
                          </span>
                          {m.motivo_ia && (
                            <span className="block text-[11px] text-muted-foreground font-sans mt-0.5">
                              {m.motivo_ia}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {m.sugestao_ia ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] gap-1 py-0.5 font-normal"
                            >
                              <SparklesIcon className="size-3 text-emerald-500" />
                              {CAMPO_LABELS[m.sugestao_ia] ?? m.sugestao_ia}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground/70 text-[11px] py-0.5 font-normal"
                            >
                              Ignorar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Select
                            value={m.campo_sistema ?? "__ignorar__"}
                            onValueChange={(v) =>
                              atualizarCampo(
                                m.indice,
                                v === "__ignorar__" ? null : v
                              )
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue>
                                {(val) => {
                                  if (!val || val === "__ignorar__") return "— ignorar —"
                                  return CAMPO_LABELS[val as any] ?? val
                                }}
                              </SelectValue>
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
            </div>

            {/* 5. Prévia de Rubricas */}
            {resultado.preview.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5 text-muted-foreground">
                  Prévia — amostra das primeiras rubricas a importar:
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
            <p className="text-sm font-medium">Vinculando entidades e gravando rubricas...</p>
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
                className="gap-1 cursor-pointer"
              >
                <XIcon className="size-3.5" />
                Trocar arquivo
              </Button>
              <Button
                onClick={handleImportar}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <UploadIcon className="size-4" />
                Confirmar e Importar
              </Button>
            </>
          )}
          {etapa === "concluido" && (
            <Button onClick={() => handleClose(false)} className="cursor-pointer">Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
