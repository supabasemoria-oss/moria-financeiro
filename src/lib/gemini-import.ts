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

const CAMPOS_SISTEMA = [
  { campo: "descricao", descricao: "Descrição do item / rubrica" },
  { campo: "codigo_natureza_despesa", descricao: "Código de natureza de despesa (ex: 33903501)" },
  { campo: "tipo", descricao: "Tipo: RH, SERVICO, MATERIAL, LOCACAO, OUTROS" },
  { campo: "quantidade", descricao: "Quantidade numérica" },
  { campo: "unidade", descricao: "Unidade de medida (UN, MÊS, HR, etc)" },
  { campo: "valor_unitario", descricao: "Valor unitário em reais" },
]

export async function extrairLinhasXLS(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: "array" })
  const sheet = wb.Sheets[wb.SheetNames[0]]
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
      "Chave de API do Gemini não configurada. Acesse Configurações para cadastrá-la."
    )
  }

  const linhasParaEnviar = rows.slice(0, 50)
  const tabela = linhasParaEnviar
    .map((row, i) => `Linha ${i}: [${row.map((c) => `"${c}"`).join(", ")}]`)
    .join("\n")

  const prompt = `Você é um assistente especializado em planilhas orçamentárias do terceiro setor brasileiro (MROSC / Transferegov).

Analise as linhas brutas abaixo extraídas de uma planilha orçamentária e retorne um JSON com o mapeamento de colunas.

CAMPOS DO SISTEMA:
${CAMPOS_SISTEMA.map((c) => `- "${c.campo}": ${c.descricao}`).join("\n")}

LINHAS DA PLANILHA:
${tabela}

Retorne APENAS um JSON válido (sem markdown, sem explicação) com esta estrutura:
{
  "linha_cabecalho": <índice da linha que contém os cabeçalhos reais das colunas>,
  "linhas_secao": [<índices de linhas que são cabeçalhos de seção/grupo, não dados>],
  "linhas_ignorar": [<índices de linhas totalizadoras, rodapés, vazias, etc>],
  "mapeamento": [
    {
      "coluna_original": "<nome exato da coluna>",
      "campo_sistema": "<campo do sistema ou null se não mapear>",
      "indice": <índice da coluna 0-based>
    }
  ]
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${gemini_model}:generateContent?key=${gemini_api_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  const text: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Gemini não retornou JSON válido.")

  const resultado: ResultadoMapeamento = JSON.parse(jsonMatch[0])

  // Gerar preview com as primeiras 3 linhas de dado
  const linhasIgnorar = new Set([
    resultado.linha_cabecalho,
    ...resultado.linhas_secao,
    ...resultado.linhas_ignorar,
  ])
  const linhasDado = rows
    .map((row, i) => ({ row, i }))
    .filter(({ i }) => !linhasIgnorar.has(i) && i > resultado.linha_cabecalho)
    .slice(0, 3)

  resultado.preview = linhasDado.map(({ row }) => {
    const obj: Record<string, string> = {}
    for (const m of resultado.mapeamento) {
      if (m.campo_sistema) {
        obj[m.campo_sistema] = row[m.indice] ?? ""
      }
    }
    return obj
  })

  return resultado
}

export async function sugerirMapeamentoPDF(
  file: File
): Promise<ResultadoMapeamento> {
  const { gemini_api_key, gemini_model } = await getSettingsAsync()
  if (!gemini_api_key) {
    throw new Error(
      "Chave de API do Gemini não configurada. Acesse Configurações para cadastrá-la."
    )
  }

  const base64 = await fileToBase64(file)

  const prompt = `Você é um assistente especializado em planilhas orçamentárias do terceiro setor brasileiro (MROSC / Transferegov).

Analise a tabela orçamentária neste documento e retorne um JSON com o mapeamento de colunas para os campos do sistema.

CAMPOS DO SISTEMA:
${CAMPOS_SISTEMA.map((c) => `- "${c.campo}": ${c.descricao}`).join("\n")}

Retorne APENAS um JSON válido (sem markdown, sem explicação) com esta estrutura:
{
  "linha_cabecalho": 0,
  "linhas_secao": [],
  "linhas_ignorar": [],
  "mapeamento": [
    {
      "coluna_original": "<nome exato da coluna>",
      "campo_sistema": "<campo do sistema ou null se não mapear>",
      "indice": <índice da coluna 0-based>
    }
  ],
  "preview": [
    { "descricao": "...", "codigo_natureza_despesa": "...", "quantidade": "...", "valor_unitario": "..." }
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
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  const text: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Gemini não retornou JSON válido.")

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

export { CAMPOS_SISTEMA }
