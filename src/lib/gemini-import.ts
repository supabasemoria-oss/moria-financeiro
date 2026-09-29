import * as XLSX from "xlsx"
import { getSettingsAsync } from "@/lib/settings"
import { supabase } from "@/lib/supabase"
import { mroscService } from "@/lib/api/mrosc-service"

export interface MapeamentoColuna {
  coluna_original: string
  campo_sistema: string | null
  indice: number
  sugestao_ia?: string | null
  motivo_ia?: string | null
}

export interface MetadadosPlanilha {
  modelo_identificado?: string
  proposta_numero?: string | null
  osc_nome?: string | null
  cnpj_osc?: string | null
  valor_total_estimado?: number | null
}

export interface FornecedorIdentificado {
  razao_social_nome: string
  cpf_cnpj: string
  telefone?: string | null
}

export interface RubricaSkillExtraida {
  descricao: string
  especificacao?: string
  tipo: "RH" | "SERVICO" | "MATERIAL" | "LOCACAO" | "OUTROS"
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
  codigo_natureza_despesa: string
  periodo_meses?: number
  fornecedor_selecionado?: FornecedorIdentificado | null
}

export interface ResultadoMapeamento {
  linha_cabecalho: number
  linhas_secao: number[]
  linhas_ignorar: number[]
  mapeamento: MapeamentoColuna[]
  preview: Record<string, string>[]
  metadados?: MetadadosPlanilha
  fornecedores_detectados?: FornecedorIdentificado[]
  rubricas_detectadas?: RubricaSkillExtraida[]
}

export const CAMPOS_SISTEMA = [
  { campo: "descricao", descricao: "Nome / especificação do item ou rubrica" },
  { campo: "codigo_natureza_despesa", descricao: "Código de natureza de despesa (ex: 33903501)" },
  { campo: "tipo", descricao: "Tipo: RH, SERVICO, MATERIAL, LOCACAO, OUTROS" },
  { campo: "quantidade", descricao: "Quantidade numérica" },
  { campo: "unidade", descricao: "Unidade de medida (UN, MES, HR, etc)" },
  { campo: "valor_unitario", descricao: "Valor unitário em reais" },
]

export function parseMoedaBR(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val
  if (!val) return 0
  let s = String(val).trim()
  if (!s) return 0
  s = s.replace(/^R\$\s*/i, "").trim()
  if (!s || s === "-" || s === "—") return 0

  if (s.includes(".") && s.includes(",")) {
    const lastDot = s.lastIndexOf(".")
    const lastComma = s.lastIndexOf(",")
    if (lastComma > lastDot) {
      // Formato brasileiro: 6.000,00
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      // Formato americano: 6,000.00
      s = s.replace(/,/g, "")
    }
  } else if (s.includes(",")) {
    const parts = s.split(",")
    if (parts.length > 2) {
      s = s.replace(/,/g, "")
    } else {
      s = s.replace(",", ".")
    }
  } else if (s.includes(".")) {
    const parts = s.split(".")
    if (parts.length > 2) {
      s = s.replace(/\./g, "")
    }
  }

  s = s.replace(/[^0-9.-]/g, "")
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function sanitizarCnpj(val: string | null | undefined): string {
  if (!val) return ""
  return String(val).replace(/\D/g, "")
}

export function formatarCnpj(cnpj: string | null | undefined): string {
  const digits = sanitizarCnpj(cnpj)
  if (digits.length !== 14) return cnpj ? String(cnpj).trim() : ""
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

export function extrairFornecedorDeTexto(texto: unknown): FornecedorIdentificado | null {
  if (!texto) return null
  const str = String(texto).trim()
  const cnpjMatch = str.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
  if (!cnpjMatch) return null

  const cnpj = cnpjMatch[1]
  const parts = str.split(cnpj)
  let razao = parts[0].replace(/[,;/\-\s]+$/, "").trim()
  if (!razao && parts[1]) {
    razao = parts[1].replace(/^[,;/\s-]+/, "").replace(/tel.*$/i, "").trim()
  }

  const telMatch = str.match(/(?:\(?\d{2}\)?\s*)?\d{4,5}-?\d{4}/)
  const tel = telMatch ? telMatch[0] : null

  return {
    razao_social_nome: razao.replace(/\s*-\s*$/, "").replace(/\s*,\s*$/, "").trim() || "Fornecedor Cotado",
    cpf_cnpj: cnpj,
    telefone: tel,
  }
}

function escolherMelhorAba(wb: XLSX.WorkBook): string {
  if (wb.SheetNames.includes("Planilha de Custo")) return "Planilha de Custo"
  let best = wb.SheetNames[0]
  let bestScore = -1
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
    const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim())).length
    const text = rows.flat().join(" ").toLowerCase()
    const bonus = ["especificacao", "descricao", "item", "valor", "quantidade", "unidade"].filter((k) => text.includes(k)).length * 3
    const score = nonEmpty + bonus
    if (score > bestScore) {
      bestScore = score
      best = name
    }
  }
  return best
}

export async function extrairLinhasXLS(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: "array" })
  const abaName = escolherMelhorAba(wb)
  const sheet = wb.Sheets[abaName]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  })
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()))
}

/**
 * Motor de análise baseado na Skill MROSC (.agents/skills/mrosc-planilhas/SKILL.md).
 * Reconhece modelos estruturados de planilhas do governo e terceiro setor.
 */
export function executarSkillMrosc(rows: string[][]): ResultadoMapeamento | null {
  if (!rows || rows.length < 5) return null

  // 1. Extrair Metadados do Cabeçalho Institucional (Zero Alucinação: somente o que estiver grafado)
  let proposta_numero: string | null = null
  let cnpj_osc: string | null = null
  let osc_nome: string | null = null

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const lineText = rows[i].map((c) => String(c).trim()).join(" ")

    const propMatch = lineText.match(/PROPOSTA\s*(?:N[°º]|:)?\s*([0-9/\-.]+)/i)
    if (propMatch && !proposta_numero) proposta_numero = propMatch[1].trim()

    const cnpjMatch = lineText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
    if (cnpjMatch && !cnpj_osc) cnpj_osc = formatarCnpj(cnpjMatch[1])

    if (!osc_nome && !lineText.toUpperCase().includes("PLANILHA")) {
      const oscMatch = lineText.match(/(?:INSTITUTO|ASSOCIACAO|ORGANIZACAO|ASSOCIAÇÃO|ORGANIZAÇÃO)\s*([^:–\-\n]+)/i)
      if (oscMatch) {
        osc_nome = oscMatch[0].trim()
      } else {
        const nomeMatch = lineText.match(/NOME\s*:\s*([^,;]+)/i)
        if (nomeMatch) osc_nome = nomeMatch[1].trim()
      }
    }
  }

  // 2. Identificar Modelo Normativo
  let headerIndex = -1
  let modelo: "MODELO_A_TRANSFEREGOV" | "MODELO_B_DESCRITIVO" | null = null

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowStr = rows[i].map((c) => String(c).toLowerCase()).join(" ")
    if (rowStr.includes("gnd") || (rowStr.includes("item") && rowStr.includes("aquisicao"))) {
      headerIndex = i
      modelo = "MODELO_A_TRANSFEREGOV"
      break
    }
    if (rowStr.includes("empresa 1") || rowStr.includes("especificação do item/serviço") || rowStr.includes("especificacao do item/servico")) {
      headerIndex = i
      modelo = "MODELO_B_DESCRITIVO"
      break
    }
  }

  if (headerIndex === -1 || !modelo) return null

  const fornecedoresMap = new Map<string, FornecedorIdentificado>()
  const rubricas: RubricaSkillExtraida[] = []
  const mapeamento: MapeamentoColuna[] = []
  const linhasSecao: number[] = []
  const linhasIgnorar: number[] = []

  // Preencher linhas de cabeçalho e pré-cabeçalho como ignorar
  for (let k = 0; k <= headerIndex; k++) {
    linhasIgnorar.push(k)
  }

  if (modelo === "MODELO_A_TRANSFEREGOV") {
    const header = rows[headerIndex].map((c) => String(c).trim().toUpperCase())
    const colItem = header.findIndex((h) => h === "ITEM")
    const colEspec = header.findIndex((h) => h.includes("ESPECIFICAÇÃO") || h.includes("ESPECIFICACAO"))
    const colTipo = header.findIndex((h) => h === "TIPO")
    const colTotalQtd = header.findIndex((h) => h === "TOTAL")
    const colUnidade = header.findIndex((h) => h.includes("UNIDADE"))

    const cotacaoIndices: { razao: number; cnpj: number; vlUnit: number; vlTotal: number }[] = []
    for (let j = 0; j < header.length; j++) {
      if (header[j].includes("RAZÃO") || header[j].includes("RAZAO")) {
        cotacaoIndices.push({
          razao: j,
          cnpj: j + 1,
          vlUnit: j + 2,
          vlTotal: j + 3,
        })
      }
    }

    const colVlUnitFinal = header.length - 2
    const colVlTotalFinal = header.length - 1

    // Propor mapeamento completo para todas as colunas
    for (let j = 0; j < header.length; j++) {
      const colName = rows[headerIndex][j] || `Coluna ${j}`
      let campo: string | null = null
      let motivo: string | null = null

      if (j === colItem) {
        campo = "descricao"
        motivo = "Nome da rubrica / cargo"
      } else if (j === colTipo) {
        campo = "tipo"
        motivo = "Classificação de recurso"
      } else if (j === colTotalQtd) {
        campo = "quantidade"
        motivo = "Quantidade total de diárias/meses"
      } else if (j === colUnidade) {
        campo = "unidade"
        motivo = "Unidade de medida"
      } else if (j === colVlUnitFinal) {
        campo = "valor_unitario"
        motivo = "Menor valor unitário cotado"
      } else if (colName.toUpperCase().includes("CNPJ") || colName.toUpperCase().includes("RAZÃO") || colName.toUpperCase().includes("RAZAO")) {
        campo = null
        motivo = "Fornecedor da cotação tripla (auto-processado)"
      } else if (colName.toUpperCase().includes("GND") || colName.toUpperCase().includes("AQUISICAO") || colName.toUpperCase().includes("DESPESA")) {
        campo = null
        motivo = "Classificação orçamentária complementar"
      } else {
        campo = null
        motivo = "Coluna acessória"
      }

      mapeamento.push({
        coluna_original: colName,
        campo_sistema: campo,
        indice: j,
        sugestao_ia: campo,
        motivo_ia: motivo,
      })
    }

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      const itemNome = String(row[colItem] || "").trim()
      if (!itemNome || itemNome.toUpperCase().includes("TOTAL")) {
        linhasIgnorar.push(i)
        continue
      }

      const tipoStr = String(row[colTipo] || "").trim()
      const especStr = String(row[colEspec] || "").trim()
      const qtd = parseMoedaBR(row[colTotalQtd]) || 1
      const unidade = String(row[colUnidade] || "UN").trim()
      const vlUnit = parseMoedaBR(row[colVlUnitFinal])
      const vlTotal = parseMoedaBR(row[colVlTotalFinal]) || qtd * vlUnit

      let tipo: RubricaSkillExtraida["tipo"] = "SERVICO"
      let codNat = "33903900"
      if (tipoStr.toLowerCase().includes("tributo") || itemNome.toLowerCase().includes("encargo")) {
        tipo = "OUTROS"
        codNat = "33904700"
      } else if (tipoStr.toLowerCase().includes("humano") || tipoStr.toLowerCase().includes("rh")) {
        tipo = "RH"
        codNat = "33903600"
      } else if (tipoStr.toLowerCase().includes("material")) {
        tipo = "MATERIAL"
        codNat = "33903000"
      }

      let periodoMeses = 1
      const colQtdPeriodo = header.findIndex((h) => h.includes("PERÍODO") || h.includes("PERIODO"))
      if (colQtdPeriodo !== -1) {
        const txt = String(row[colQtdPeriodo] || "")
        const match = txt.match(/(\d+)/)
        if (match) periodoMeses = parseInt(match[1], 10)
      }

      // Identificar o fornecedor vencedor cotado no Modelo A
      let fornecedorVencedor: FornecedorIdentificado | null = null
      for (const cot of cotacaoIndices) {
        const cotVl = parseMoedaBR(row[cot.vlUnit])
        const rz = String(row[cot.razao] || "").trim()
        const rawCnpj = sanitizarCnpj(row[cot.cnpj])
        if (rawCnpj.length === 14 && rz && !rz.toUpperCase().includes("N/A")) {
          const doc = formatarCnpj(rawCnpj)
          const objF: FornecedorIdentificado = { razao_social_nome: rz, cpf_cnpj: doc }
          if (!fornecedoresMap.has(doc)) {
            fornecedoresMap.set(doc, objF)
          }
          if (!fornecedorVencedor && cotVl > 0 && Math.abs(cotVl - vlUnit) < 0.05) {
            fornecedorVencedor = objF
          }
        }
      }

      rubricas.push({
        descricao: itemNome,
        especificacao: especStr.slice(0, 300),
        tipo,
        quantidade: qtd,
        unidade,
        valor_unitario: vlUnit,
        valor_total: vlTotal,
        codigo_natureza_despesa: codNat,
        periodo_meses: periodoMeses,
        fornecedor_selecionado: fornecedorVencedor,
      })
    }
  } else if (modelo === "MODELO_B_DESCRITIVO") {
    const headerRow = rows[headerIndex]
    for (let j = 0; j < headerRow.length; j++) {
      const colName = String(headerRow[j] || `Coluna ${j}`).trim()
      let campo: string | null = null
      let motivo: string | null = null

      if (j === 1) {
        campo = "descricao"
        motivo = "Cargo e atribuições / especificação do item"
      } else if (j === 8 || colName.toUpperCase() === "QUANT." || colName.toUpperCase() === "TOTAL") {
        campo = "quantidade"
        motivo = "Quantidade total calculada (profissionais x meses ou unidades)"
      } else if (j === 18 || colName.toUpperCase().includes("MENOR VALOR")) {
        campo = "valor_unitario"
        motivo = "Menor valor unitário cotado"
      } else if (colName.toUpperCase().includes("EMPRESA")) {
        campo = null
        motivo = "Cotação de fornecedor (auto-processada)"
      } else {
        campo = null
        motivo = "Coluna acessória"
      }

      mapeamento.push({
        coluna_original: colName || `Coluna ${j}`,
        campo_sistema: campo,
        indice: j,
        sugestao_ia: campo,
        motivo_ia: motivo,
      })
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const c0 = String(row[0] || "").trim()
      const c1 = String(row[1] || "").trim()

      // Linha de item válida: c0 é numérico ("1", "2", etc.) e c1 não é cabeçalho
      if (
        !/^\d+$/.test(c0) ||
        !c1 ||
        c1.toUpperCase().includes("ESPECIFICAÇÃO") ||
        c1.toUpperCase().includes("ESPECIFICACAO") ||
        c0.toUpperCase().includes("VALOR")
      ) {
        linhasIgnorar.push(i)
        continue
      }

      const vlUnit = parseMoedaBR(row[18])
      const vlTotal = parseMoedaBR(row[19])

      // Se a linha da grade não tem valores cotados, ignorar
      if (vlTotal <= 0 && vlUnit <= 0) {
        linhasIgnorar.push(i)
        continue
      }

      const linhasTexto = c1.split("\n").map((l) => l.trim()).filter(Boolean)
      const cargoNome = linhasTexto[0].replace(/^[\d.\-\s]+/, "").trim()

      const qtdProfissionais = parseMoedaBR(row[6]) || 1
      const periodoMeses = Math.round(parseMoedaBR(row[7])) || (row[7] === "" ? 1 : 1)
      const qtdTotal = parseMoedaBR(row[8]) || (qtdProfissionais * periodoMeses) || 1

      // Cotações das 3 empresas nas colunas 9, 12, 15
      let fornecedorVencedor: FornecedorIdentificado | null = null
      const cotacoes = [
        { colTxt: 9, colUnit: 10, colTot: 11 },
        { colTxt: 12, colUnit: 13, colTot: 14 },
        { colTxt: 15, colUnit: 16, colTot: 17 },
      ]

      for (const cot of cotacoes) {
        const f = extrairFornecedorDeTexto(row[cot.colTxt])
        if (f && sanitizarCnpj(f.cpf_cnpj).length === 14) {
          if (!fornecedoresMap.has(f.cpf_cnpj)) {
            fornecedoresMap.set(f.cpf_cnpj, f)
          }
          const cotVl = parseMoedaBR(row[cot.colUnit])
          const cotTot = parseMoedaBR(row[cot.colTot])
          if (!fornecedorVencedor && (Math.abs(cotVl - vlUnit) < 0.05 || Math.abs(cotTot - vlTotal) < 0.05)) {
            fornecedorVencedor = f
          }
        }
      }

      let tipo: RubricaSkillExtraida["tipo"] = "RH"
      let codNat = "33903600"
      if (
        cargoNome.toLowerCase().includes("serviço") ||
        cargoNome.toLowerCase().includes("servico") ||
        cargoNome.toLowerCase().includes("assessoria") ||
        cargoNome.toLowerCase().includes("transporte")
      ) {
        tipo = "SERVICO"
        codNat = "33903900"
      } else if (
        cargoNome.toLowerCase().includes("banner") ||
        cargoNome.toLowerCase().includes("material") ||
        cargoNome.toLowerCase().includes("aquisição") ||
        cargoNome.toLowerCase().includes("aquisicao")
      ) {
        tipo = "MATERIAL"
        codNat = "33903000"
      }

      rubricas.push({
        descricao: cargoNome,
        especificacao: c1.slice(0, 300),
        tipo,
        quantidade: qtdTotal,
        unidade: periodoMeses > 1 ? "Meses" : "UN",
        valor_unitario: vlUnit,
        valor_total: vlTotal,
        codigo_natureza_despesa: codNat,
        periodo_meses: periodoMeses,
        fornecedor_selecionado: fornecedorVencedor,
      })
    }
  }

  const preview = rubricas.slice(0, 5).map((r) => ({
    descricao: r.descricao,
    tipo: r.tipo,
    quantidade: String(r.quantidade),
    unidade: r.unidade,
    valor_unitario: r.valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  }))

  const valorTotalSoma = rubricas.reduce((acc, r) => acc + r.valor_total, 0)

  return {
    linha_cabecalho: headerIndex,
    linhas_secao: linhasSecao,
    linhas_ignorar: linhasIgnorar,
    mapeamento,
    preview,
    metadados: {
      proposta_numero,
      cnpj_osc,
      osc_nome,
      valor_total_estimado: valorTotalSoma,
      modelo_identificado: modelo,
    },
    fornecedores_detectados: Array.from(fornecedoresMap.values()),
    rubricas_detectadas: rubricas,
  }
}

/**
 * Localiza ou cria a Instituição e o Projeto no banco a partir dos dados reais da planilha (Sem alucinação).
 */
export async function vincularOuCriarInstituicaoEProjeto(
  metadados: MetadadosPlanilha,
  valorTotalAprovado: number
): Promise<{ instituicaoId: string; projetoId: string; instituicaoNome: string; projetoNome: string; criadoNovo: boolean }> {
  let instituicaoId = ""
  let instituicaoNome = metadados.osc_nome?.trim() || "OSC Proponente"
  const cnpjLimpo = sanitizarCnpj(metadados.cnpj_osc)
  let criadoNovo = false

  // 1. Instituição
  if (cnpjLimpo && cnpjLimpo.length === 14) {
    const { data: instExistente } = await supabase
      .from("instituicoes")
      .select("id, razao_social, cnpj")
      .eq("cnpj", formatarCnpj(cnpjLimpo))
      .maybeSingle()

    if (instExistente) {
      instituicaoId = instExistente.id
      instituicaoNome = instExistente.razao_social
    } else {
      const novaInst = await mroscService.createInstituicao({
        razao_social: instituicaoNome,
        cnpj: formatarCnpj(cnpjLimpo),
      })
      instituicaoId = novaInst.id
      criadoNovo = true
    }
  } else {
    const { data: instPorNome } = await supabase
      .from("instituicoes")
      .select("id, razao_social")
      .ilike("razao_social", instituicaoNome)
      .maybeSingle()

    if (instPorNome) {
      instituicaoId = instPorNome.id
      instituicaoNome = instPorNome.razao_social
    } else {
      const novaInst = await mroscService.createInstituicao({
        razao_social: instituicaoNome,
        cnpj: "00.000.000/0000-00",
      })
      instituicaoId = novaInst.id
      criadoNovo = true
    }
  }

  // 2. Projeto
  const termo = metadados.proposta_numero ? `Proposta ${metadados.proposta_numero}` : `Parceria ${instituicaoNome}`
  const nomeProjeto = metadados.proposta_numero ? `Projeto Proposta ${metadados.proposta_numero}` : `Projeto ${instituicaoNome}`

  let projetoId = ""
  if (metadados.proposta_numero) {
    const { data: projExistente } = await supabase
      .from("projetos")
      .select("id, nome")
      .eq("numero_termo", termo)
      .maybeSingle()

    if (projExistente) {
      projetoId = projExistente.id
    }
  }

  if (!projetoId) {
    const hoje = new Date()
    const anoQueVem = new Date(hoje)
    anoQueVem.setFullYear(hoje.getFullYear() + 1)

    const novoProjeto = await mroscService.createProjeto({
      nome: nomeProjeto,
      instituicao_id: instituicaoId,
      numero_termo: termo,
      data_inicio: hoje.toISOString().split("T")[0],
      data_fim: anoQueVem.toISOString().split("T")[0],
      valor_total_aprovado: valorTotalAprovado > 0 ? valorTotalAprovado : 0,
      status: "EM_ANDAMENTO",
    })
    projetoId = novoProjeto.id
    criadoNovo = true
  }

  return { instituicaoId, projetoId, instituicaoNome, projetoNome: nomeProjeto, criadoNovo }
}

export async function sugerirMapeamentoXLS(rows: string[][]): Promise<ResultadoMapeamento> {
  const skillResult = executarSkillMrosc(rows)
  if (skillResult && skillResult.rubricas_detectadas && skillResult.rubricas_detectadas.length > 0) {
    return skillResult
  }

  const autoResult = tentarMapeamentoAutomatico(rows)
  if (autoResult && autoResult.mapeamento.length > 0 && autoResult.preview.length > 0) {
    return autoResult
  }

  const { gemini_api_key, gemini_model } = await getSettingsAsync()
  if (!gemini_api_key) {
    throw new Error("Chave de API do Gemini não configurada. Acesse Configurações para cadastrá-la.")
  }

  const linhasParaEnviar = rows.slice(0, 60)
  const tabela = linhasParaEnviar
    .map((row, i) => {
      const cellsNaoVazias = row.map((c, j) => (c ? `[${j}]=${c}` : "")).filter(Boolean)
      return `L${i}: ${cellsNaoVazias.join(" | ")}`
    })
    .filter((l) => l.length > 4)
    .join("\n")

  const prompt = `Você é um especialista em planilhas orçamentárias do terceiro setor brasileiro (MROSC Lei 13.019/2014 / Transferegov).
Analise as linhas abaixo de uma planilha orçamentária no formato Lnum: [col_index]=valor.

CAMPOS DO SISTEMA QUE QUEREMOS MAPEAR:
${CAMPOS_SISTEMA.map((c) => `"${c.campo}": ${c.descricao}`).join("\n")}

DIRETRIZES DA SKILL MROSC:
- Identifique metadados institucionais (Proposta Nº, OSC proponente, CNPJ da entidade).
- "descricao": coluna com nomes de cargos, serviços ou materiais.
- "valor_unitario": coluna de MENOR VALOR COTADO ou cotação selecionada.
- "quantidade": número de meses, diárias ou unidades.
- "fornecedores": identifique fornecedores citados nas cotações (Razão Social, CNPJ).

Retorne APENAS JSON válido com esta estrutura:
{
  "linha_cabecalho": <numero>,
  "linhas_secao": [<numeros>],
  "linhas_ignorar": [<numeros>],
  "mapeamento": [
    {"coluna_original": "<nome>", "campo_sistema": "<campo ou null>", "indice": <numero>, "sugestao_ia": "<campo ou null>", "motivo_ia": "<motivo>"}
  ],
  "metadados": {
    "proposta_numero": "<numero ou null>",
    "osc_nome": "<nome ou null>",
    "cnpj_osc": "<cnpj ou null>"
  },
  "fornecedores": [
    {"razao_social_nome": "<nome>", "cpf_cnpj": "<cnpj>", "telefone": "<tel ou null>"}
  ]
}`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gemini_model}:generateContent?key=${gemini_api_key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 4096 },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Gemini não retornou JSON válido.")

  let resultado: ResultadoMapeamento
  try {
    resultado = JSON.parse(jsonMatch[0])
    resultado.mapeamento = resultado.mapeamento.map((m) => ({
      ...m,
      sugestao_ia: m.sugestao_ia ?? m.campo_sistema,
      motivo_ia: m.motivo_ia ?? "Sugerido pelo modelo Gemini",
    }))
  } catch {
    throw new Error("JSON inválido retornado pelo Gemini.")
  }

  if (!resultado.mapeamento || resultado.mapeamento.length === 0) {
    const auto = tentarMapeamentoAutomatico(rows)
    if (auto) return auto
    throw new Error("Não foi possível identificar as colunas da planilha.")
  }

  resultado.preview = gerarPreview(rows, resultado)
  return resultado
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function tentarMapeamentoAutomatico(rows: string[][]): ResultadoMapeamento | null {
  const keywords = {
    descricao: ["especificacao", "descricao", "item", "servico", "cargo", "nome", "especif"],
    quantidade: ["quant", "qtd", "quantidade", "meses", "diaria"],
    valor_unitario: ["valor unit", "valor/mes", "valor mensal", "menor valor", "valor unitario", "unit"],
    unidade: ["unidade", "und", "un"],
    tipo: ["tipo", "natureza"],
  }

  let linhaCabecalho = -1
  let melhoresColIndex: Record<string, number> = {}

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i]
    const matches: Record<string, number> = {}
    for (let j = 0; j < row.length; j++) {
      const cell = norm(row[j])
      if (!cell) continue
      for (const [campo, kws] of Object.entries(keywords)) {
        if (kws.some((kw) => cell.includes(kw)) && !(campo in matches)) {
          matches[campo] = j
        }
      }
    }
    if ("descricao" in matches && Object.keys(matches).length >= 2) {
      linhaCabecalho = i
      melhoresColIndex = matches
      break
    }
  }

  if (linhaCabecalho === -1 || !("descricao" in melhoresColIndex)) return null

  const rowCabecalho = rows[linhaCabecalho]
  const mapeamento: MapeamentoColuna[] = []

  for (let j = 0; j < rowCabecalho.length; j++) {
    const colName = rowCabecalho[j] || `Coluna ${j}`
    const matchedEntry = Object.entries(melhoresColIndex).find(([, idx]) => idx === j)
    const campo = matchedEntry ? matchedEntry[0] : null
    mapeamento.push({
      coluna_original: colName,
      campo_sistema: campo,
      indice: j,
      sugestao_ia: campo,
      motivo_ia: campo ? `Padrão identificado como ${campo}` : "Coluna acessória",
    })
  }

  const linhasSecao: number[] = []
  const linhasIgnorar: number[] = []
  const descIdx = melhoresColIndex["descricao"]

  for (let i = linhaCabecalho + 1; i < rows.length; i++) {
    const row = rows[i]
    const desc = row[descIdx]?.trim() ?? ""
    if (!desc) {
      linhasIgnorar.push(i)
      continue
    }
    const lower = desc.toLowerCase()
    if (lower.includes("total") || lower.includes("valor total") || lower.includes("repasse") || lower.includes("contrapartida") || lower.includes("assinatura")) {
      linhasIgnorar.push(i)
    } else if (row.filter(Boolean).length <= 2) {
      linhasSecao.push(i)
    }
  }

  const resultado: ResultadoMapeamento = {
    linha_cabecalho: linhaCabecalho,
    linhas_secao: linhasSecao,
    linhas_ignorar: linhasIgnorar,
    mapeamento,
    preview: [],
  }

  resultado.preview = gerarPreview(rows, resultado)
  return resultado
}

function gerarPreview(rows: string[][], resultado: ResultadoMapeamento): Record<string, string>[] {
  const linhasIgnorar = new Set([resultado.linha_cabecalho, ...resultado.linhas_secao, ...resultado.linhas_ignorar])
  const linhasDado = rows
    .map((row, i) => ({ row, i }))
    .filter(({ i }) => !linhasIgnorar.has(i) && i > resultado.linha_cabecalho)
    .filter(({ row }) => row.some((c) => c.trim()))
    .slice(0, 5)

  return linhasDado.map(({ row }) => {
    const obj: Record<string, string> = {}
    for (const m of resultado.mapeamento) {
      if (m.campo_sistema) {
        obj[m.campo_sistema] = row[m.indice] ?? ""
      }
    }
    return obj
  })
}

export async function sugerirMapeamentoPDF(file: File): Promise<ResultadoMapeamento> {
  const { gemini_api_key, gemini_model } = await getSettingsAsync()
  if (!gemini_api_key) {
    throw new Error("Chave de API do Gemini não configurada. Acesse Configurações para cadastrá-la.")
  }

  const base64 = await fileToBase64(file)

  const prompt = `Você é um especialista em planilhas orçamentárias do terceiro setor brasileiro (MROSC / Transferegov).
Analise a tabela orçamentária neste documento e extraia as rubricas e dados da proposta.

CAMPOS DO SISTEMA:
${CAMPOS_SISTEMA.map((c) => `"${c.campo}": ${c.descricao}`).join("\n")}

Retorne APENAS JSON válido com esta estrutura:
{
  "linha_cabecalho": 0,
  "linhas_secao": [],
  "linhas_ignorar": [],
  "mapeamento": [
    {"coluna_original": "<nome>", "campo_sistema": "<campo ou null>", "indice": <numero>, "sugestao_ia": "<campo ou null>", "motivo_ia": "<motivo>"}
  ],
  "preview": [
    {"descricao": "...", "quantidade": "...", "valor_unitario": "...", "tipo": "..."}
  ],
  "metadados": {
    "proposta_numero": "<numero ou null>",
    "osc_nome": "<nome ou null>",
    "cnpj_osc": "<cnpj ou null>"
  },
  "fornecedores": []
}`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gemini_model}:generateContent?key=${gemini_api_key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data: base64 } }],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Gemini não retornou JSON válido.")
  const resultado = JSON.parse(jsonMatch[0])
  if (resultado.mapeamento) {
    resultado.mapeamento = resultado.mapeamento.map((m: any) => ({
      ...m,
      sugestao_ia: m.sugestao_ia ?? m.campo_sistema,
      motivo_ia: m.motivo_ia ?? "Extraído via visão de documento",
    }))
  }
  return resultado
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
