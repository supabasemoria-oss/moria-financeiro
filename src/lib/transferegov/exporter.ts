import JSZip from "jszip"
import * as XLSX from "xlsx"
import type { Projeto, Rubrica, Despesa } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export interface RelatorioProjetoData {
  projeto: Projeto
  rubricas: (Rubrica & { despesas?: Despesa[] })[]
  despesas: (Despesa & { rubricas_orcamentarias?: Rubrica | null; fornecedores?: any })[]
}

export const transferegovExporter = {
  // Gerar Planilha Excel Consolidada (Padrão Prestação de Contas / Transferegov)
  exportarRelatorioExcel(data: RelatorioProjetoData) {
    const wb = XLSX.utils.book_new()

    // 1. Aba: Resumo do Projeto
    const resumoData = [
      ["PRESTAÇÃO DE CONTAS - TERCEIRO SETOR (MROSC / LEI 13.019/2014)"],
      ["Gerado via Plataforma Moriá Consultoria"],
      [],
      ["Nome do Projeto", data.projeto.nome],
      ["Número do Termo", data.projeto.numero_termo || "-"],
      ["Período de Execução", `${formatDate(data.projeto.data_inicio)} até ${formatDate(data.projeto.data_fim)}`],
      ["Valor Total Aprovado", Number(data.projeto.valor_total_aprovado)],
      ["Status Atual", data.projeto.status],
      [],
    ]
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo do Projeto")

    // 2. Aba: Plano de Aplicação / Rubricas Orçamentárias
    const rubricasRows = data.rubricas.map((r) => {
      const totalGasto = (r.despesas || [])
        .filter((d) => d.status === "PAGO")
        .reduce((acc, curr) => acc + Number(curr.valor), 0)
      const saldo = Number(r.valor_total) - totalGasto

      return {
        "Código Natureza": r.codigo_natureza_despesa,
        "Tipo": r.tipo,
        "Descrição da Rubrica": r.descricao,
        "Unidade": r.unidade,
        "Qtd": Number(r.quantidade),
        "Valor Unitário (R$)": Number(r.valor_unitario),
        "Valor Total Aprovado (R$)": Number(r.valor_total),
        "Total Executado / Pago (R$)": totalGasto,
        "Saldo Disponível (R$)": saldo,
        "% Executado": Number(r.valor_total) > 0 ? ((totalGasto / Number(r.valor_total)) * 100).toFixed(2) + "%" : "0%",
      }
    })
    const wsRubricas = XLSX.utils.json_to_sheet(rubricasRows)
    XLSX.utils.book_append_sheet(wb, wsRubricas, "Plano de Trabalho e Rubricas")

    // 3. Aba: Relação de Pagamentos e Despesas
    const despesasRows = data.despesas.map((d) => ({
      "Data Despesa": formatDate(d.data_despesa),
      "Data Pagamento": d.data_pagamento ? formatDate(d.data_pagamento) : "-",
      "Rubrica Vinculada": d.rubricas_orcamentarias ? `${d.rubricas_orcamentarias.codigo_natureza_despesa} - ${d.rubricas_orcamentarias.descricao}` : "-",
      "Fornecedor / Prestador": d.fornecedores?.razao_social_nome || "-",
      "CPF / CNPJ": d.fornecedores?.cpf_cnpj || "-",
      "Nº Documento Fiscal": d.numero_documento_fiscal || "-",
      "Descrição": d.descricao,
      "Valor (R$)": Number(d.valor),
      "Status": d.status,
    }))
    const wsDespesas = XLSX.utils.json_to_sheet(despesasRows)
    XLSX.utils.book_append_sheet(wb, wsDespesas, "Relação de Pagamentos")

    // Gerar e disparar download do arquivo .XLSX
    const fileName = `Prestacao_Contas_${data.projeto.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  },

  // Gerar Arquivo .ZIP com todos os comprovantes para o Transferegov
  async exportarLoteComprovantesZip(
    projeto: Projeto,
    despesas: (Despesa & { rubricas_orcamentarias?: Rubrica | null; comprovantes?: any[] })[],
    onProgress?: (msg: string) => void
  ) {
    const zip = new JSZip()
    const folderName = `Transferegov_Comprovantes_${projeto.nome.replace(/[^a-zA-Z0-9]/g, "_")}`
    const rootFolder = zip.folder(folderName)

    let count = 0
    const totalDespesas = despesas.length

    for (const [index, despesa] of despesas.entries()) {
      if (onProgress) {
        onProgress(`Processando comprovantes da despesa ${index + 1} de ${totalDespesas}...`)
      }

      if (!despesa.comprovantes || despesa.comprovantes.length === 0) continue

      const rubricaCode = despesa.rubricas_orcamentarias?.codigo_natureza_despesa || "SEM_RUBRICA"
      const despesaSubfolderName = `Rubrica_${rubricaCode}/Despesa_${despesa.data_despesa}_R$${despesa.valor}`
      const subFolder = rootFolder?.folder(despesaSubfolderName)

      for (const comp of despesa.comprovantes) {
        try {
          const filePrefix = comp.tipo_documento ? `${comp.tipo_documento}_` : ""
          const meta = `Comprovante: ${comp.file_name}\nTipo: ${comp.tipo_documento}\nPath: ${comp.storage_path}\n\n(Arquivo real disponível quando storage estiver conectado)`
          subFolder?.file(`${filePrefix}${comp.file_name}.txt`, meta)
          count++
        } catch (e) {
          console.warn(`Erro ao processar comprovante ${comp.file_name}:`, e)
        }
      }
    }

    if (onProgress) {
      onProgress(`Compactando ${count} arquivo(s) em lote .ZIP...`)
    }

    const content = await zip.generateAsync({ type: "blob" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(content)
    link.download = `${folderName}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    return count
  },
}
