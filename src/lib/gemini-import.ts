import * as XLSX from "xlsx"
import { getSettingsAsync } from "@/lib/settings"

export interface MapeamentoColuna {
  coluna_original: string
  campo_sistema: string | null
  indice: number
}

export interface ResultadoMapeamento {
  linha_cabecalho: number
  linhas_secao: number[]
  linhas_ignorar: number[]
  mapeamento: MapeamentoColuna[]
  preview: Record<string, string>[]
}

export const CAMPOS_SISTEMA = [
  { campo: "descricao", descricao: "Nome / especificacao do item ou rubrica" },
  { campo: "codigo_natureza_despesa", descricao: "Codigo de natureza de despesa (ex: 33903501)" },
  { campo: "tipo", descricao: "Tipo: RH, SERVICO, MATERIAL, LOCACAO, OUTROS" },
  { campo: "quantidade", descricao: "Quantidade numerica" },
  { campo: "unidade", descricao: "Unidade de medida (UN, MES, HR, etc)" },
  { campo: "valor_unitario", descricao: "Valor unitario em reais" },
]

function escolherMelhorAba(wb: XLSX.WorkBook): string {
  // Prefere a aba com mais linhas nao-vazias e colunas relevantes
  let best = wb.SheetNames[0]
  let bestScore = -1
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
    const nonEmpty = rows.filter(r => r.some(c => String(c).trim())).length
    // Bonus se tiver palavras-chave de rubrica
    const text = rows.flat().join(" ").toLowerCase()
    const bonus = ["especificacao", "descricao", "item", "valor", "quantidade", "unidade"].filter(k => text.includes(k)).length * 3
    const score = nonEmpty + bonus
    if (score > bestScore) { bestScore = score; best = name }
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

export async function sugerirMapeamentoXLS(
  rows: string[][]
): Promise<ResultadoMapeamento> {
  const { gemini_api_key, gemini_model } = await getSettingsAsync()
  if (!gemini_api_key) {
    throw new Error(
      "Chave de API do Gemini nao configurada. Acesse Configuracoes para cadastra-la."
    )
  }

  // Tentar primeiro mapeamento automatico sem IA
  const autoResult = tentarMapeamentoAutomatico(rows)
  if (autoResult && autoResult.mapeamento.length > 0 && autoResult.preview.length > 0) {
    return autoResult
  }

  // Fallback: usar Gemini
  const linhasParaEnviar = rows.slice(0, 60)
  const tabela = linhasParaEnviar
    .map((row, i) => {
      const cellsNaoVazias = row.map((c, j) => c ? `[${j}]=${c}` : "").filter(Boolean)
      return `L${i}: ${cellsNaoVazias.join(" | ")}`
    })
    .filter(l => l.length > 4)
    .join("\n")

  const prompt = `Voce e um especialista em planilhas orcamentarias do terceiro setor brasileiro (MROSC / Transferegov / Ministerio das Mulheres).

Analise as linhas abaixo de uma planilha orcamentaria. Cada linha esta no formato Lnum: [col_index]=valor.
A planilha pode ter cabecalhos mesclados em 2 linhas, linhas de secao, e linhas em branco.

CAMPOS DO SISTEMA QUE QUEREMOS MAPEAR:
${CAMPOS_SISTEMA.map(c => `"${c.campo}": ${c.descricao}`).join("\n")}

REGRAS IMPORTANTES:
- "descricao" e o campo mais importante. Sera a coluna com nomes de cargos, servicos ou materiais.
- "valor_unitario" pode ser "Valor Unitario", "Valor/mes", "Valor mensal", ou a coluna de MENOR VALOR COTADO.
- "quantidade" pode ser "Qtd", "Quant", "Meses", "Diarias/Meses".
- Ignore colunas de fornecedores, CNPJ, telefone, cotacoes multiplas.
- "linhas_secao" sao linhas com texto de cabecalho de grupo (ex: "RECURSOS HUMANOS", "MATERIAL").
- "linhas_ignorar" sao totalizadores, rodapes, linhas com "TOTAL", "VALOR TOTAL", colunas de assinatura.
- "linha_cabecalho" e o indice da linha que tem os nomes das colunas reais dos dados.
- Identifique APENAS as colunas mais relevantes para importar rubricas orcamentarias.

LINHAS DA PLANILHA:
${tabela}

Retorne APENAS JSON valido (sem markdown) com esta estrutura exata:
{
  "linha_cabecalho": <numero>,
  "linhas_secao": [<numeros>],
  "linhas_ignorar": [<numeros>],
  "mapeamento": [
    {"coluna_original": "<nome>", "campo_sistema": "<campo ou null>", "indice": <numero>}
  ]
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${gemini_model}:generateContent?key=${gemini_api_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Gemini nao retornou JSON valido. Tente outro modelo ou verifique a chave.")

  let resultado: ResultadoMapeamento
  try {
    resultado = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error("JSON invalido retornado pelo Gemini.")
  }

  if (!resultado.mapeamento || resultado.mapeamento.length === 0) {
    // Fallback manual se Gemini falhou
    const auto = tentarMapeamentoAutomatico(rows)
    if (auto) return auto
    throw new Error("Nao foi possivel identificar as colunas. Verifique se a planilha tem uma coluna de descricao/especificacao.")
  }

  resultado.preview = gerarPreview(rows, resultado)
  return resultado
}

function tentarMapeamentoAutomatico(rows: string[][]): ResultadoMapeamento | null {
  // Encontrar linha de cabecalho: primeira linha com >= 3 celulas nao vazias e texto relevante
  const keywords = {
    descricao: ["especificacao", "descricao", "item", "servico", "cargo", "nome"],
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
      const cell = row[j].toLowerCase()
      if (!cell) continue
      for (const [campo, kws] of Object.entries(keywords)) {
        if (kws.some(kw => cell.includes(kw)) && !(campo in matches)) {
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

  const mapeamento: MapeamentoColuna[] = Object.entries(melhoresColIndex).map(([campo, indice]) => ({
    coluna_original: rows[linhaCabecalho][indice] || `Coluna ${indice}`,
    campo_sistema: campo,
    indice,
  }))

  // Linhas de secao e ignorar
  const linhasSecao: number[] = []
  const linhasIgnorar: number[] = []
  const descIdx = melhoresColIndex["descricao"]

  for (let i = linhaCabecalho + 1; i < rows.length; i++) {
    const row = rows[i]
    const desc = row[descIdx]?.trim() ?? ""
    if (!desc) { linhasIgnorar.push(i); continue }
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
  const linhasIgnorar = new Set([
    resultado.linha_cabecalho,
    ...resultado.linhas_secao,
    ...resultado.linhas_ignorar,
  ])
  const linhasDado = rows
    .map((row, i) => ({ row, i }))
    .filter(({ i }) => !linhasIgnorar.has(i) && i > resultado.linha_cabecalho)
    .filter(({ row }) => row.some(c => c.trim()))
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

export async function sugerirMapeamentoPDF(
  file: File
): Promise<ResultadoMapeamento> {
  const { gemini_api_key, gemini_model } = await getSettingsAsync()
  if (!gemini_api_key) {
    throw new Error(
      "Chave de API do Gemini nao configurada. Acesse Configuracoes para cadastra-la."
    )
  }

  const base64 = await fileToBase64(file)

  const prompt = `Voce e um especialista em planilhas orcamentarias do terceiro setor brasileiro (MROSC / Transferegov).

Analise a tabela orcamentaria neste documento e extraia as rubricas.

CAMPOS DO SISTEMA:
${CAMPOS_SISTEMA.map(c => `"${c.campo}": ${c.descricao}`).join("\n")}

Retorne APENAS JSON valido (sem markdown) com esta estrutura:
{
  "linha_cabecalho": 0,
  "linhas_secao": [],
  "linhas_ignorar": [],
  "mapeamento": [
    {"coluna_original": "<nome>", "campo_sistema": "<campo ou null>", "indice": <numero>}
  ],
  "preview": [
    {"descricao": "...", "quantidade": "...", "valor_unitario": "...", "tipo": "..."}
  ]
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${gemini_model}:generateContent?key=${gemini_api_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: file.type, data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Gemini nao retornou JSON valido.")
  return JSON.parse(jsonMatch[0])
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
