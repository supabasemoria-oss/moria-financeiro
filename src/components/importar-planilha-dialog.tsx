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
  CalendarDaysIcon,
  CreditCardIcon,
  UsersIcon,
  CoinsIcon,
  SlidersHorizontalIcon,
  SearchIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { CornerChase } from "@/components/ui/corner-chase"
import { getTodaySaoPaulo } from "@/lib/utils"
import { mroscService } from "@/lib/api/mrosc-service"
import {
  extrairLinhasXLS,
  sugerirMapeamentoXLS,
  sugerirMapeamentoPDF,
  vincularOuCriarInstituicaoEProjeto,
  inferirMesesERecorrenciaRubrica,
  CAMPOS_SISTEMA,
  type MapeamentoColuna,
  type ResultadoMapeamento,
  type RubricaSkillExtraida,
} from "@/lib/gemini-import"
import { useRouter } from "next/navigation"

type Etapa = "upload" | "mapeando" | "validando" | "importando" | "concluido"

interface Props {
  projetoId?: string
  trigger?: React.ReactNode
  onImportado?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const CAMPO_LABELS: Record<string, string> = {
  descricao: "Descrição",
  codigo_natureza_despesa: "Cód. Natureza Despesa",
  tipo: "Tipo",
  quantidade: "Quantidade",
  unidade: "Unidade",
  valor_unitario: "Valor Unitário",
}

export function ImportarPlanilhaDialog({
  projetoId,
  trigger,
  onImportado,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: Props) {
  const router = useRouter()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? (setControlledOpen || (() => {})) : setUncontrolledOpen
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
  const [dataOrdemInicio, setDataOrdemInicio] = React.useState<string>(getTodaySaoPaulo())
  const [abaVisualizacao, setAbaVisualizacao] = React.useState<"pagamentos" | "colunas">("pagamentos")
  const [termoBusca, setTermoBusca] = React.useState("")
  const [filtroTipo, setFiltroTipo] = React.useState<"TODOS" | "ATENCAO" | "DURACAO_REDUZIDA" | "RH" | "MATERIAL" | "SERVICO">("TODOS")

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
    setDataOrdemInicio(getTodaySaoPaulo())
    setAbaVisualizacao("pagamentos")
    setTermoBusca("")
    setFiltroTipo("TODOS")
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
      setMapeamento(res.mapeamento || [])

      if (res.rubricas_detectadas && res.rubricas_detectadas.length > 0) {
        setAbaVisualizacao("pagamentos")
      } else {
        setAbaVisualizacao("colunas")
      }

      // O padrão da importação é sempre auto-criar e autovincular um novo projeto
      setModoDestino("auto_criar")
      if (projetoId) {
        setProjetoSelecionadoId(projetoId)
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

  function atualizarRubricaDetectada(idx: number, patch: Partial<RubricaSkillExtraida>) {
    if (!resultado?.rubricas_detectadas) return
    const novas = [...resultado.rubricas_detectadas]
    novas[idx] = { ...novas[idx], ...patch }
    setResultado({ ...resultado, rubricas_detectadas: novas })
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
        const nomeArquivoBase = arquivo?.name ? arquivo.name.replace(/\.[^/.]+$/, "") : "Planilha Importada"
        const metadadosParaCriar = {
          ...(resultado.metadados || {}),
          osc_nome: resultado.metadados?.osc_nome || "OSC Proponente",
          proposta_numero: resultado.metadados?.proposta_numero || nomeArquivoBase,
        }

        const valorTotal = resultado.rubricas_detectadas
          ? resultado.rubricas_detectadas.reduce((acc, r) => acc + r.valor_total, 0)
          : resultado.metadados?.valor_total_estimado || 0

        const resVinculo = await vincularOuCriarInstituicaoEProjeto(
          metadadosParaCriar,
          valorTotal,
          {
            dataOrdemInicio: dataOrdemInicio || undefined,
            vigenciaMeses: vigenciaPadraoMeses || 12,
          }
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

      // Sincronizar data da Ordem de Início (Marco Zero Financeiro) no projeto
      if (dataOrdemInicio) {
        await mroscService.setOrdemInicioProjeto(targetProjetoId, dataOrdemInicio)
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
          : (resultado.preview || []).map((p) => ({
              row: [] as string[],
              i: -1,
              previewObj: p,
            }))

      let criadas = 0
      let totalParcelasGeradas = 0

      // Calcular vigência estimada do projeto em meses (se datas estiverem presentes)
      const projEncontrado = projetos.find((p) => p.id === targetProjetoId)
      let vigenciaMesesProjeto = vigenciaPadraoMeses || 12
      if (projEncontrado?.data_inicio && projEncontrado?.data_fim) {
        const d1 = new Date(projEncontrado.data_inicio + "T00:00:00")
        const d2 = new Date(projEncontrado.data_fim + "T00:00:00")
        const difMeses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
        if (difMeses > 0) vigenciaMesesProjeto = difMeses
      }

      // 2. Criar rubricas com ciclo inteligente MROSC (RH e Serviços Contínuos divididos nos meses reais)
      if (resultado.rubricas_detectadas && resultado.rubricas_detectadas.length > 0) {
        for (const rub of resultado.rubricas_detectadas) {
          const inferencia = inferirMesesERecorrenciaRubrica({
            descricao: rub.descricao,
            especificacao: rub.especificacao,
            tipo: rub.tipo,
            unidade: rub.unidade,
            quantidade: rub.quantidade,
            periodo_meses: rub.periodo_meses,
            mes_inicio: rub.mes_inicio,
            data_inicio: rub.data_inicio,
            sob_demanda: rub.sob_demanda,
            vigenciaMesesProjeto,
          })

          const tipoPagamento = inferencia.tipoPagamento
          const meses = inferencia.numParcelas
          const isSobDemanda = rub.sob_demanda !== undefined ? rub.sob_demanda : inferencia.sob_demanda

          // Calcular data de início da rubrica se houver desfasamento de mês
          let dataInicioRubrica: string | null = rub.data_inicio || null
          if (!dataInicioRubrica && rub.mes_inicio && rub.mes_inicio > 1) {
            const baseData = dataOrdemInicio || projEncontrado?.data_ordem_inicio || projEncontrado?.data_inicio
            if (baseData) {
              const [bAno, bMes, bDia] = baseData.split("T")[0].split("-").map(Number)
              const baseDate = new Date(bAno, bMes - 1, bDia)
              baseDate.setMonth(baseDate.getMonth() + (rub.mes_inicio - 1))
              const ano = baseDate.getFullYear()
              const m = String(baseDate.getMonth() + 1).padStart(2, "0")
              const d = String(baseDate.getDate()).padStart(2, "0")
              dataInicioRubrica = `${ano}-${m}-${d}`
            }
          } else if (!dataInicioRubrica && dataOrdemInicio) {
            dataInicioRubrica = dataOrdemInicio
          }

          const vlTotalCalculado =
            rub.valor_total && rub.valor_total > 0
              ? rub.valor_total
              : rub.quantidade * rub.valor_unitario * (tipoPagamento === "RECORRENTE" && meses > 1 ? meses : 1)

          await mroscService.createRubrica({
            projeto_id: targetProjetoId,
            descricao: rub.descricao,
            codigo_natureza_despesa: rub.codigo_natureza_despesa || "33903900",
            tipo: (rub.tipo as any) || "SERVICO",
            quantidade: rub.quantidade,
            unidade: rub.unidade || "UN",
            valor_unitario: rub.valor_unitario,
            valor_total: vlTotalCalculado,
            tipo_pagamento: tipoPagamento,
            num_parcelas: meses,
            frequencia_meses: 1,
            dia_vencimento: 10,
            data_inicio: dataInicioRubrica,
            sob_demanda: isSobDemanda,
          })
          criadas++
          if (!isSobDemanda) {
            const qtdVagas = Math.max(1, Math.round(rub.quantidade || 1))
            totalParcelasGeradas += qtdVagas > 1 ? qtdVagas * meses : meses
          }
        }
      } else {
        // Fallback para linhas mapeadas manualmente com inteligência MROSC
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

          const inferencia = inferirMesesERecorrenciaRubrica({
            descricao,
            tipo: obj.tipo,
            unidade: obj.unidade,
            quantidade: isNaN(quantidade) ? 1 : quantidade,
            vigenciaMesesProjeto,
          })

          const qtdNum = isNaN(quantidade) ? 1 : quantidade
          const vlUnitNum = isNaN(valor_unitario) ? 0 : valor_unitario
          const vlTotalCalculado =
            inferencia.tipoPagamento === "RECORRENTE" && inferencia.numParcelas > 1
              ? qtdNum * vlUnitNum * inferencia.numParcelas
              : qtdNum * vlUnitNum

          await mroscService.createRubrica({
            projeto_id: targetProjetoId,
            descricao,
            codigo_natureza_despesa:
              obj.codigo_natureza_despesa?.trim() || "33903900",
            tipo: (obj.tipo?.toUpperCase() as any) || "SERVICO",
            quantidade: qtdNum,
            unidade: obj.unidade?.trim() || "UN",
            valor_unitario: vlUnitNum,
            valor_total: vlTotalCalculado,
            tipo_pagamento: inferencia.tipoPagamento,
            num_parcelas: inferencia.numParcelas,
            frequencia_meses: 1,
            dia_vencimento: 10,
            sob_demanda: inferencia.sob_demanda,
          })
          criadas++
          if (!inferencia.sob_demanda) {
            const qtdVagas = Math.max(1, Math.round(qtdNum || 1))
            totalParcelasGeradas += qtdVagas > 1 ? qtdVagas * inferencia.numParcelas : inferencia.numParcelas
          }
        }
      }

      // 3. Auto-cadastro de fornecedores identificados nas cotações e vencedores
      let fornecedoresCriados = 0
      if (cadastrarFornecedores) {
        const todosFornecedores = [...(resultado.fornecedores_detectados || [])]
        if (resultado.rubricas_detectadas) {
          for (const rub of resultado.rubricas_detectadas) {
            if (
              rub.fornecedor_selecionado &&
              !todosFornecedores.some(
                (f) => f.cpf_cnpj === rub.fornecedor_selecionado?.cpf_cnpj
              )
            ) {
              todosFornecedores.push(rub.fornecedor_selecionado)
            }
          }
        }

        if (todosFornecedores.length > 0) {
          try {
            const existentes = await mroscService.getFornecedores()
            const cnpjsExistentes = new Set(
              existentes.map((f) => f.cpf_cnpj.replace(/\D/g, ""))
            )

            for (const f of todosFornecedores) {
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
      }

      setEtapa("concluido")
      if (totalParcelasGeradas > 0) {
        toast.success(
          `${criadas} rubrica(s) e ${totalParcelasGeradas} parcela(s) financeira(s) geradas no projeto ${nomeProjetoFinal}${
            fornecedoresCriados > 0 ? ` com ${fornecedoresCriados} fornecedor(es) cadastrado(s)` : ""
          }.`
        )
      } else {
        toast.success(
          `${criadas} rubrica(s) importada(s) com sucesso no projeto ${nomeProjetoFinal}.`
        )
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

  function obterMesesRubrica(r: RubricaSkillExtraida): number {
    if (r.periodo_meses && r.periodo_meses > 0) return r.periodo_meses
    const u = (r.unidade || "").toLowerCase()
    if (u.includes("mês") || u.includes("mes")) {
      return Math.round(r.quantidade) || 1
    }
    return 1
  }

  const vigenciaPadraoMeses = React.useMemo(() => {
    if (!resultado?.rubricas_detectadas || resultado.rubricas_detectadas.length === 0) return 12
    const mesesRecorrentes = resultado.rubricas_detectadas
      .filter((r) => !r.sob_demanda)
      .map(obterMesesRubrica)
      .filter((m) => m > 1)
    if (mesesRecorrentes.length === 0) return 12
    return Math.max(...mesesRecorrentes)
  }, [resultado?.rubricas_detectadas])

  const totalDuracaoReduzida = React.useMemo(() => {
    if (!resultado?.rubricas_detectadas) return 0
    return resultado.rubricas_detectadas.filter((r) => {
      if (r.sob_demanda) return false
      const m = obterMesesRubrica(r)
      return m > 1 && m < vigenciaPadraoMeses
    }).length
  }, [resultado?.rubricas_detectadas, vigenciaPadraoMeses])

  const totalParcelasEstimadas = resultado?.rubricas_detectadas
    ? resultado.rubricas_detectadas.reduce((acc, r) => {
        if (r.sob_demanda) return acc
        const meses =
          r.periodo_meses && r.periodo_meses > 1
            ? r.periodo_meses
            : r.unidade?.toLowerCase().includes("mês") ||
              r.unidade?.toLowerCase().includes("mes")
            ? Math.round(r.quantidade)
            : 1
        const qtdVagas = Math.max(1, Math.round(r.quantidade || 1))
        return acc + (qtdVagas > 1 ? qtdVagas * meses : meses)
      }, 0)
    : 0

  const totalValorEstimado = resultado?.rubricas_detectadas
    ? resultado.rubricas_detectadas.reduce((acc, r) => acc + r.valor_total, 0)
    : resultado?.metadados?.valor_total_estimado || 0

  const fornecedoresContagem = resultado?.fornecedores_detectados?.length || 0

  const totalPontosAtencao =
    resultado?.rubricas_detectadas?.filter((r) => Boolean(r.ponto_atencao)).length || 0

  const rubricasExibidas = React.useMemo(() => {
    if (!resultado?.rubricas_detectadas) return []
    return resultado.rubricas_detectadas
      .map((rub, originalIdx) => ({ rub, originalIdx }))
      .filter(({ rub }) => {
        if (filtroTipo === "ATENCAO" && !rub.ponto_atencao) return false
        if (filtroTipo === "DURACAO_REDUZIDA") {
          if (rub.sob_demanda) return false
          const m = obterMesesRubrica(rub)
          if (m <= 1 || m >= vigenciaPadraoMeses) return false
        }
        if (filtroTipo === "RH" && rub.tipo !== "RH" && rub.codigo_natureza_despesa !== "33904700") return false
        if (filtroTipo === "MATERIAL" && rub.tipo !== "MATERIAL") return false
        if (filtroTipo === "SERVICO" && rub.tipo !== "SERVICO" && rub.tipo !== "LOCACAO") return false

        if (termoBusca.trim()) {
          const termo = termoBusca.toLowerCase().trim()
          const desc = (rub.descricao || "").toLowerCase()
          const espec = (rub.especificacao || "").toLowerCase()
          const fornecedor = (rub.fornecedor_selecionado?.razao_social_nome || "").toLowerCase()
          const cnpj = (rub.fornecedor_selecionado?.cpf_cnpj || "").toLowerCase()
          const cod = (rub.codigo_natureza_despesa || "").toLowerCase()
          const tipo = (rub.tipo || "").toLowerCase()
          return (
            desc.includes(termo) ||
            espec.includes(termo) ||
            fornecedor.includes(termo) ||
            cnpj.includes(termo) ||
            cod.includes(termo) ||
            tipo.includes(termo)
          )
        }
        return true
      })
  }, [resultado?.rubricas_detectadas, filtroTipo, termoBusca, vigenciaPadraoMeses])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent
        className="w-[95vw] sm:max-w-[95vw] lg:max-w-7xl 2xl:max-w-[1500px] h-[92vh] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden"
        style={{ width: "95vw", maxWidth: "1500px", height: "92vh", maxHeight: "94vh" }}
      >
        {/* Header fixo no topo com cantos protegidos */}
        <div className="p-6 pb-4 border-b shrink-0 pr-12">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadIcon className="size-4" />
              Importar Planilha Orçamentária
            </DialogTitle>
            <DialogDescription>
              Importe rubricas e cotações de um arquivo XLS, XLSX ou PDF. A inteligência MROSC sugerirá o mapeamento e vinculará as entidades.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Corpo rolável apenas na vertical, sem overflow nos cantos */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0">
          {/* ETAPA: UPLOAD */}
          {etapa === "upload" && (
            <div className="flex flex-col gap-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 py-20 md:py-28 cursor-pointer hover:bg-muted/50 transition-colors"
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
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 text-center my-auto">
            <CornerChase size="lg" className="text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Analisando planilha com Skill MROSC e Gemini...
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
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
                      <strong className="text-foreground">Rubricas prontas:</strong> {resultado.rubricas_detectadas.length || 0}
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
                      Auto-vincular / Criar Novo Projeto
                    </span>
                    <span className="text-[11px] block mt-0.5 text-muted-foreground">
                      {resultado?.metadados?.proposta_numero
                        ? `Proposta ${resultado.metadados.proposta_numero} • ${resultado.metadados.osc_nome || "OSC"}`
                        : resultado?.metadados?.osc_nome
                        ? `Projeto ${resultado.metadados.osc_nome}`
                        : arquivo?.name
                        ? `Criar a partir de ${arquivo.name}`
                        : "Criar novo projeto a partir da planilha"}
                    </span>
                  </div>
                </label>

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

            {/* 3. Marco Zero Financeiro: Data da Ordem de Início */}
            <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-4 text-blue-600" />
                  Data da Ordem de Início (Marco Zero Financeiro)
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Define o início da vigência ({vigenciaPadraoMeses} meses) e a base de cálculo para as parcelas financeiras deste projeto.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dataOrdemInicio}
                  onChange={(e) => setDataOrdemInicio(e.target.value)}
                  className="h-8 w-40 text-xs bg-background font-mono"
                />
              </div>
            </div>

            {/* 4. Checkbox para auto-cadastrar fornecedores das cotações */}
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

            {/* 4. Alternância entre Ciclo de Pagamentos do Gestor e Mapeamento de Colunas */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setAbaVisualizacao("pagamentos")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      abaVisualizacao === "pagamentos"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CalendarDaysIcon className="size-3.5 text-emerald-600" />
                    <span>Programação de Pagamentos</span>
                    {resultado.rubricas_detectadas && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                        {resultado.rubricas_detectadas.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaVisualizacao("colunas")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      abaVisualizacao === "colunas"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <SlidersHorizontalIcon className="size-3.5 text-blue-500" />
                    <span>Mapeamento de Colunas</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-muted-foreground/15 text-muted-foreground font-semibold">
                      {mapeamento?.length || 0}
                    </span>
                  </button>
                </div>

                {abaVisualizacao === "colunas" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={aplicarTodasSugestoesIA}
                    className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer self-start sm:self-auto"
                  >
                    <SparklesIcon className="size-3 text-emerald-500" />
                    Reaplicar sugestões da IA
                  </Button>
                )}
              </div>

              {/* ABA 1: PROGRAMAÇÃO DE PAGAMENTOS DO GESTOR */}
              {abaVisualizacao === "pagamentos" && (
                <div className="space-y-3">
                  {/* Resumo numérico do ciclo de desembolso */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">Total Reservado</span>
                      <span className="text-sm font-bold text-foreground">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValorEstimado)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">Vigência Padrão</span>
                      <span className="text-sm font-bold text-indigo-600 flex items-center gap-1">
                        <ClockIcon className="size-3.5" />
                        {vigenciaPadraoMeses} meses
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">Rubricas Previstas</span>
                      <span className="text-sm font-bold text-emerald-600">
                        {resultado.rubricas_detectadas?.length || 0} itens
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">Parcelas Financeiras</span>
                      <span className="text-sm font-bold text-blue-600">
                        {totalParcelasEstimadas} parcelas automáticas
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">Fornecedores Cotados</span>
                      <span className="text-sm font-bold text-violet-600">
                        {fornecedoresContagem} identificados
                      </span>
                    </div>
                  </div>

                  {/* Banner de Pontos de Atenção (quando houver itens problemáticos/ambíguos) */}
                  {totalPontosAtencao > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 px-3 text-xs text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangleIcon className="size-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-semibold">{totalPontosAtencao} ponto(s) de atenção detectado(s)</span>
                          <span className="text-muted-foreground ml-1 hidden sm:inline">
                            — itens com potenciais ambiguidades identificados para sua conferência.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-6 text-[11px] px-2.5 border-amber-500/30 ${
                            filtroTipo === "ATENCAO"
                              ? "bg-amber-600 text-white hover:bg-amber-700"
                              : "hover:bg-amber-500/20 text-amber-900 dark:text-amber-100"
                          }`}
                          onClick={() => setFiltroTipo(filtroTipo === "ATENCAO" ? "TODOS" : "ATENCAO")}
                        >
                          {filtroTipo === "ATENCAO" ? "Ver Todas" : `Filtrar Atenção (${totalPontosAtencao})`}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Barra de Pesquisa e Filtros Rápidos */}
                  {resultado.rubricas_detectadas && resultado.rubricas_detectadas.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      {/* Campo de Pesquisa */}
                      <div className="relative flex-1">
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome, cargo, material, fornecedor ou código..."
                          value={termoBusca}
                          onChange={(e) => setTermoBusca(e.target.value)}
                          className="h-8 pl-8 pr-7 text-xs bg-background"
                        />
                        {termoBusca && (
                          <button
                            type="button"
                            onClick={() => setTermoBusca("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                            title="Limpar busca"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Pílulas de Filtro Rápido */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                        <Button
                          type="button"
                          variant={filtroTipo === "TODOS" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setFiltroTipo("TODOS")}
                        >
                          Todas ({resultado.rubricas_detectadas.length})
                        </Button>
                        {totalPontosAtencao > 0 && (
                          <Button
                            type="button"
                            variant={filtroTipo === "ATENCAO" ? "default" : "outline"}
                            size="sm"
                            className={`h-7 text-xs px-2 ${
                              filtroTipo === "ATENCAO"
                                ? "bg-amber-600 text-white hover:bg-amber-700"
                                : "border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                            }`}
                            onClick={() => setFiltroTipo("ATENCAO")}
                          >
                            ⚠️ Atenção ({totalPontosAtencao})
                          </Button>
                        )}
                        {totalDuracaoReduzida > 0 && (
                          <Button
                            type="button"
                            variant={filtroTipo === "DURACAO_REDUZIDA" ? "default" : "outline"}
                            size="sm"
                            className={`h-7 text-xs px-2 ${
                              filtroTipo === "DURACAO_REDUZIDA"
                                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                : "border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
                            }`}
                            onClick={() => setFiltroTipo(filtroTipo === "DURACAO_REDUZIDA" ? "TODOS" : "DURACAO_REDUZIDA")}
                          >
                            ⏱️ Duração Reduzida ({totalDuracaoReduzida})
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant={filtroTipo === "RH" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setFiltroTipo("RH")}
                        >
                          RH / Encargos
                        </Button>
                        <Button
                          type="button"
                          variant={filtroTipo === "MATERIAL" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setFiltroTipo("MATERIAL")}
                        >
                          Materiais
                        </Button>
                        <Button
                          type="button"
                          variant={filtroTipo === "SERVICO" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setFiltroTipo("SERVICO")}
                        >
                          Serviços
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tabela detalhada do ciclo */}
                  {resultado.rubricas_detectadas && resultado.rubricas_detectadas.length > 0 ? (
                    <div className="flex-1 min-h-[380px] max-h-[55vh] overflow-y-auto rounded-lg border">
                      <Table className="min-w-[760px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[26%]">Item / Rubrica</TableHead>
                            <TableHead className="w-[20%]">Fornecedor Cotado</TableHead>
                            <TableHead className="w-[14%] text-center">Início / Duração</TableHead>
                            <TableHead className="w-[16%] text-center">Modalidade</TableHead>
                            <TableHead className="w-[12%] text-right">Unitário</TableHead>
                            <TableHead className="w-[12%] text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rubricasExibidas.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                                Nenhuma rubrica encontrada para os filtros aplicados.
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 ml-1 text-xs"
                                  onClick={() => {
                                    setTermoBusca("")
                                    setFiltroTipo("TODOS")
                                  }}
                                >
                                  Limpar filtros
                                </Button>
                              </TableCell>
                            </TableRow>
                          ) : (
                            rubricasExibidas.map(({ rub, originalIdx }) => {
                              const isSobDemanda = rub.sob_demanda ?? false
                              const meses =
                                rub.periodo_meses && rub.periodo_meses > 1
                                  ? rub.periodo_meses
                                  : rub.unidade?.toLowerCase().includes("mês") ||
                                    rub.unidade?.toLowerCase().includes("mes")
                                  ? Math.round(rub.quantidade)
                                  : 1
                              const mesInicio = rub.mes_inicio || 1
                              return (
                                <TableRow
                                  key={originalIdx}
                                  className={
                                    rub.ponto_atencao
                                      ? "bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-500"
                                      : undefined
                                  }
                                >
                                  <TableCell className="py-2 max-w-[260px]">
                                    <div className="font-semibold text-xs text-foreground line-clamp-2" title={rub.descricao}>
                                      <span>{rub.descricao}</span>
                                    </div>

                                    {/* Ponto de Atenção Explicativo */}
                                    {rub.ponto_atencao && (
                                      <div
                                        className="mt-1 flex items-start gap-1 rounded bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-900 dark:text-amber-200"
                                        title={rub.ponto_atencao.motivo}
                                      >
                                        <AlertTriangleIcon className="size-3 text-amber-600 shrink-0 mt-0.5" />
                                        <span className="font-medium shrink-0">{rub.ponto_atencao.titulo}:</span>
                                        <span className="truncate text-muted-foreground">{rub.ponto_atencao.motivo}</span>
                                      </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                        {rub.codigo_natureza_despesa}
                                      </Badge>
                                      <Badge
                                        variant="secondary"
                                        className={`text-[10px] py-0 px-1 ${
                                          rub.codigo_natureza_despesa === "33904700"
                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                            : rub.tipo === "RH"
                                            ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                            : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                        }`}
                                      >
                                        {rub.codigo_natureza_despesa === "33904700" ? "ENCARGOS CLT" : rub.tipo}
                                      </Badge>
                                      {!isSobDemanda && meses > 1 && meses < vigenciaPadraoMeses && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] py-0 px-1.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-medium"
                                          title={`Item com duração de ${meses} meses, inferior à vigência padrão de ${vigenciaPadraoMeses} meses do projeto`}
                                        >
                                          ⏱️ {meses} de {vigenciaPadraoMeses} m
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 max-w-[200px]">
                                    {rub.fornecedor_selecionado ? (
                                      <div>
                                        <span className="font-medium text-xs block text-foreground truncate" title={rub.fornecedor_selecionado.razao_social_nome}>
                                          {rub.fornecedor_selecionado.razao_social_nome}
                                        </span>
                                        <span className="text-[11px] font-mono text-muted-foreground block">
                                          {rub.fornecedor_selecionado.cpf_cnpj}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">
                                        {rub.codigo_natureza_despesa === "33904700"
                                          ? "Guia Previdência / FGTS"
                                          : "Cotação sob demanda"}
                                      </span>
                                    )}
                                  </TableCell>

                                  {/* Coluna Início / Duração */}
                                  <TableCell className="py-2 text-center">
                                    {isSobDemanda ? (
                                      <span className="text-[11px] text-muted-foreground">Sob Demanda</span>
                                    ) : (
                                      <div className="flex flex-col items-center justify-center gap-1">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-muted-foreground">Início:</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max="48"
                                            value={mesInicio}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value, 10) || 1
                                              atualizarRubricaDetectada(originalIdx, { mes_inicio: val })
                                            }}
                                            className="w-10 h-6 text-center text-xs border rounded bg-background"
                                            title="Mês relativo de início no projeto (ex: Mês 1, Mês 3)"
                                          />
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-muted-foreground">Meses:</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max="60"
                                            value={meses}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value, 10) || 1
                                              atualizarRubricaDetectada(originalIdx, { periodo_meses: val })
                                            }}
                                            className={`w-10 h-6 text-center text-xs border rounded bg-background ${
                                              meses < vigenciaPadraoMeses
                                                ? "border-indigo-500/50 text-indigo-700 dark:text-indigo-300 font-medium"
                                                : ""
                                            }`}
                                            title={`Quantidade de meses deste item (Padrão do projeto: ${vigenciaPadraoMeses} meses)`}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Coluna Modalidade */}
                                  <TableCell className="py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        atualizarRubricaDetectada(originalIdx, { sob_demanda: !isSobDemanda })
                                      }}
                                      className="cursor-pointer"
                                      title="Clique para alternar entre Sob Demanda e Cronograma Mensal Fixo"
                                    >
                                      {isSobDemanda ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                                        >
                                          ⚡ Sob Demanda
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                                        >
                                          🗓️ {meses > 1 ? (Math.round(rub.quantidade) > 1 ? `${Math.round(rub.quantidade) * meses} parcelas (${Math.round(rub.quantidade)} vagas × ${meses} m)` : `${meses} parcelas`) : "Única"}
                                        </Badge>
                                      )}
                                    </button>
                                  </TableCell>

                                  <TableCell className="py-2 text-right font-mono text-xs text-foreground">
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                                      rub.valor_unitario
                                    )}
                                    <span className="block text-[10px] text-muted-foreground font-sans">
                                      /{rub.unidade || "un"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2 text-right font-mono text-xs font-semibold text-foreground">
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                                      rub.valor_total
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground rounded-lg border bg-muted/20">
                      Nenhuma rubrica estruturada pré-detectada. Alterne para a aba de Mapeamento de Colunas para importar por colunas.
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: MAPEAMENTO DE COLUNAS */}
              {abaVisualizacao === "colunas" && (
                <div className="space-y-3">
                  <div className="flex-1 min-h-[350px] max-h-[52vh] overflow-y-auto rounded-lg border">
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
              )}
            </div>

            {/* 5. Prévia de Rubricas */}
            {(resultado.preview?.length || 0) > 0 && (
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
                      {(resultado.preview || []).map((row, i) => (
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
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 text-center my-auto">
            <CornerChase size="lg" className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-foreground">Vinculando entidades e gravando rubricas...</p>
          </div>
        )}

        {/* ETAPA: CONCLUÍDO */}
        {etapa === "concluido" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 text-center my-auto">
            <CheckCircle2Icon className="size-12 text-emerald-500" />
            <p className="text-base font-semibold text-foreground">Importação concluída com sucesso!</p>
          </div>
        )}

        </div>

        {/* Rodapé de ações fixo na base */}
        <div className="p-4 border-t bg-muted/20 shrink-0">
          <DialogFooter className="gap-2 sm:justify-end">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
