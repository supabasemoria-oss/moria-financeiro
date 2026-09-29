import * as XLSX from "xlsx"
import * as path from "path"
import { executarSkillMrosc } from "../src/lib/gemini-import"

function testarPlanilha(caminhoRelativo: string) {
  const filePath = path.join(process.cwd(), caminhoRelativo)
  console.log("\n" + "=".repeat(70))
  console.log(`TESTANDO: ${caminhoRelativo}`)
  console.log("=".repeat(70))

  const wb = XLSX.readFile(filePath)
  console.log(`Abas no arquivo: ${JSON.stringify(wb.SheetNames)}`)

  // Testar na aba escolhida
  const abaName = wb.SheetNames.includes("Planilha de Custo") ? "Planilha de Custo" : wb.SheetNames[0]
  console.log(`Aba selecionada para extração: "${abaName}"`)
  const sheet = wb.Sheets[abaName]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
  const stringRows = rows.map((r) => r.map((c) => String(c ?? "").trim()))

  console.log(`Total de linhas na aba: ${stringRows.length}`)

  // Mostrar as primeiras 15 linhas brutas da planilha original
  console.log("\n--- Linhas Iniciais da Planilha Original ---")
  stringRows.slice(0, 15).forEach((r, idx) => {
    const text = r.map((c, i) => (c ? `[${i}]=${c}` : "")).filter(Boolean).join(" | ")
    if (text) console.log(`L${idx}: ${text}`)
  })

  // Executar a Skill MROSC
  const resultado = executarSkillMrosc(stringRows)

  if (!resultado) {
    console.log("\n❌ SKILL RETORNOU NULL! (Nenhum modelo reconhecido)")
    return
  }

  console.log("\n--- RESULTADO DA SKILL MROSC ---")
  console.log("Modelo Identificado:", resultado.metadados?.modelo_identificado)
  console.log("Proposta:", resultado.metadados?.proposta_numero)
  console.log("OSC:", resultado.metadados?.osc_nome)
  console.log("CNPJ OSC:", resultado.metadados?.cnpj_osc)

  console.log(`\nFornecedores Detectados (${resultado.fornecedores_detectados?.length || 0}):`)
  resultado.fornecedores_detectados?.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.razao_social_nome} | CNPJ: ${f.cpf_cnpj}`)
  })

  console.log(`\nRubricas Detectadas (${resultado.rubricas_detectadas?.length || 0}):`)
  let somaTotal = 0
  resultado.rubricas_detectadas?.forEach((r, i) => {
    somaTotal += r.valor_total
    console.log(`  ${i + 1}. [${r.codigo_natureza_despesa}] [${r.tipo}] "${r.descricao}"`)
    console.log(`     Qtd: ${r.quantidade} ${r.unidade} | Unitário: R$ ${r.valor_unitario.toFixed(2)} | Total: R$ ${r.valor_total.toFixed(2)}`)
    console.log(`     Parcelamento: ${r.periodo_meses || 1} meses | Vencedor: ${r.fornecedor_selecionado ? `${r.fornecedor_selecionado.razao_social_nome} (${r.fornecedor_selecionado.cpf_cnpj})` : "Nenhum"}`)
  })

  console.log(`\nSOMA TOTAL DAS RUBRICAS GERADAS: R$ ${somaTotal.toFixed(2)}`)

  // Procurar o Total na planilha original para comparar!
  console.log("\n--- COMPARAÇÃO COM TOTAIS GRAFADOS NA PLANILHA ORIGINAL ---")
  for (let i = 0; i < stringRows.length; i++) {
    const line = stringRows[i].join(" ").toUpperCase()
    if (line.includes("TOTAL") && (line.includes("GERAL") || line.includes("PROPOSTA") || line.includes("R$") || line.includes(","))) {
      console.log(`Linha original ${i}:`, stringRows[i].filter(Boolean))
    }
  }
}

testarPlanilha("informacoes/Planilha de Custos - Proposta N°023809_2026.xlsx")
testarPlanilha("informacoes/Planilha Inpro ministério das mulheres V11 Final (4).xls")
