import JSZip from "jszip"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import type { Projeto, Rubrica, Despesa } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export interface RelatorioProjetoData {
  projeto: Projeto
  rubricas: (Rubrica & { despesas?: Despesa[] })[]
  despesas: (Despesa & { rubricas_orcamentarias?: Rubrica | null; fornecedores?: any; comprovantes?: any[] })[]
}

export const transferegovExporter = {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Gerar Planilha Excel Oficial Transferegov / MROSC (Lei 13.019/2014)
  // ──────────────────────────────────────────────────────────────────────────
  exportarRelatorioExcel(data: RelatorioProjetoData) {
    const wb = XLSX.utils.book_new()

    const totalAprovado = Number(data.projeto.valor_total_aprovado || 0)
    const totalPago = data.despesas
      .filter((d) => d.status === "PAGO")
      .reduce((acc, d) => acc + Number(d.valor || 0), 0)
    const totalPendente = data.despesas
      .filter((d) => d.status === "PENDENTE")
      .reduce((acc, d) => acc + Number(d.valor || 0), 0)
    const saldoRemanescente = totalAprovado - totalPago
    const percExecucao = totalAprovado > 0 ? (totalPago / totalAprovado) * 100 : 0

    // ── Aba 1: Demonstrativo Sintético Oficial ─────────────────────────────
    const resumoData: (string | number)[][] = [
      ["DEMONSTRATIVO SINTÉTICO DE EXECUÇÃO FÍSICO-FINANCEIRA"],
      ["PADRÃO TRANSFEREGOV.BR / MROSC (LEI FEDERAL Nº 13.019/2014)"],
      ["Plataforma Moriá Consultoria e Gestão de Projetos"],
      [],
      ["DADOS DA PARCERIA", ""],
      ["Nome do Projeto / Objeto:", data.projeto.nome],
      ["Número do Termo / Parceria:", data.projeto.numero_termo || "Não informado"],
      ["Período de Vigência:", `${formatDate(data.projeto.data_inicio)} até ${formatDate(data.projeto.data_fim)}`],
      ["Status do Projeto:", data.projeto.status],
      ["Data de Emissão do Relatório:", new Date().toLocaleDateString("pt-BR")],
      [],
      ["QUADRO GERAL DE RECURSOS", "VALOR (R$)"],
      ["Valor Global Aprovado (Plano de Trabalho):", totalAprovado],
      ["Total de Despesas Liquidadas / Pagas:", totalPago],
      ["Despesas Comprometidas / Pendentes:", totalPendente],
      ["Saldo Financeiro Remanescente (A Devolver / Reprogramar):", saldoRemanescente],
      ["Percentual de Execução Financeira:", `${percExecucao.toFixed(2)}%`],
    ]

    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
    wsResumo["!cols"] = [{ wch: 45 }, { wch: 35 }]
    XLSX.utils.book_append_sheet(wb, wsResumo, "Demonstrativo Sintético")

    // ── Aba 2: Plano de Aplicação & Rubricas ────────────────────────────────
    const rubricasRows = data.rubricas.map((r, idx) => {
      const totalGasto = (r.despesas || [])
        .filter((d) => d.status === "PAGO")
        .reduce((acc, curr) => acc + Number(curr.valor), 0)
      const saldo = Number(r.valor_total) - totalGasto
      const percent = Number(r.valor_total) > 0 ? (totalGasto / Number(r.valor_total)) * 100 : 0
      const isExcedido = totalGasto > Number(r.valor_total)

      return {
        "Item": idx + 1,
        "Código Natureza (Transferegov)": r.codigo_natureza_despesa,
        "Tipo": r.tipo || "OUTROS",
        "Descrição da Rubrica": r.descricao,
        "Unidade": r.unidade || "UN",
        "Quantidade": Number(r.quantidade || 1),
        "Valor Unitário (R$)": Number(r.valor_unitario || 0),
        "Valor Aprovado (R$)": Number(r.valor_total || 0),
        "Total Executado / Pago (R$)": totalGasto,
        "Saldo Disponível (R$)": saldo,
        "% Executado": `${percent.toFixed(2)}%`,
        "Situação MROSC": isExcedido ? "TETO EXCEDIDO" : "REGULAR",
      }
    })

    const wsRubricas = XLSX.utils.json_to_sheet(rubricasRows)
    wsRubricas["!cols"] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 15 },
      { wch: 35 },
      { wch: 10 },
      { wch: 12 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, wsRubricas, "Plano de Aplicação")

    // ── Aba 3: Relação de Pagamentos (REF) ──────────────────────────────────
    const despesasRows = data.despesas.map((d, idx) => {
      const temComprovante = d.comprovantes && d.comprovantes.length > 0
      const nomesComprovantes = temComprovante
        ? d.comprovantes!.map((c) => c.file_name).join("; ")
        : "Pendente"

      return {
        "Nº": idx + 1,
        "Data Emissão Documento": formatDate(d.data_despesa),
        "Data Pagamento (Liquidação)": d.data_pagamento ? formatDate(d.data_pagamento) : "Pendente",
        "Código Rubrica": d.rubricas_orcamentarias?.codigo_natureza_despesa || "—",
        "Descrição da Rubrica": d.rubricas_orcamentarias?.descricao || "—",
        "Credor / Favorecido": d.fornecedores?.razao_social_nome || "Não informado",
        "CPF / CNPJ": d.fornecedores?.cpf_cnpj || "—",
        "Nº Documento Fiscal (NF/RPA)": d.numero_documento_fiscal || "S/N",
        "Especificação do Gasto": d.descricao,
        "Valor Pago (R$)": Number(d.valor || 0),
        "Status": d.status === "PAGO" ? "LIQUIDADO" : "PENDENTE",
        "Comprovante Fiscal Anexado": nomesComprovantes,
        "Observações / Conciliação": d.observacoes || "",
      }
    })

    const wsDespesas = XLSX.utils.json_to_sheet(despesasRows)
    wsDespesas["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 30 },
      { wch: 32 },
      { wch: 20 },
      { wch: 20 },
      { wch: 35 },
      { wch: 16 },
      { wch: 14 },
      { wch: 30 },
      { wch: 25 },
    ]
    XLSX.utils.book_append_sheet(wb, wsDespesas, "Relação de Pagamentos (REF)")

    // ── Download do arquivo .XLSX ──────────────────────────────────────────
    const cleanProjectName = data.projeto.nome.replace(/[^a-zA-Z0-9]/g, "_")
    const fileName = `Transferegov_REF_${cleanProjectName}_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Gerar Arquivo .ZIP com Download Real do Storage Supabase
  // ──────────────────────────────────────────────────────────────────────────
  async exportarLoteComprovantesZip(
    projeto: Projeto,
    despesas: (Despesa & { rubricas_orcamentarias?: Rubrica | null; fornecedores?: any; comprovantes?: any[] })[],
    onProgress?: (msg: string) => void
  ): Promise<number> {
    const zip = new JSZip()
    const cleanProjectName = projeto.nome.replace(/[^a-zA-Z0-9]/g, "_")
    const folderName = `Dossie_Comprovantes_${cleanProjectName}`
    const rootFolder = zip.folder(folderName)

    let totalBaixados = 0
    const linhasIndice: string[] = [
      "ITEM;DATA_PAGAMENTO;NUMERO_DOCUMENTO_FISCAL;FORNECEDOR;CNPJ_CPF;RUBRICA_CODIGO;VALOR_R$;STATUS;NOME_ARQUIVO",
    ]

    const totalDespesas = despesas.length

    for (const [index, despesa] of despesas.entries()) {
      if (onProgress) {
        onProgress(`Processando comprovantes da despesa ${index + 1} de ${totalDespesas}...`)
      }

      const rubricaCode = despesa.rubricas_orcamentarias?.codigo_natureza_despesa || "SEM_RUBRICA"
      const dataPag = despesa.data_pagamento || despesa.data_despesa || "SEM_DATA"
      const credorNome = (despesa.fornecedores?.razao_social_nome || "Credor").replace(/[^a-zA-Z0-9]/g, "_")
      const valorStr = Number(despesa.valor || 0).toFixed(2)

      const despesaSubfolderName = `Rubrica_${rubricaCode}/${dataPag}_${credorNome}_R$${valorStr}`
      const subFolder = rootFolder?.folder(despesaSubfolderName)

      if (despesa.comprovantes && despesa.comprovantes.length > 0) {
        for (const comp of despesa.comprovantes) {
          try {
            const cleanFileName = comp.file_name.replace(/[^a-zA-Z0-9.-]/g, "_")
            const filePrefix = comp.tipo_documento ? `${comp.tipo_documento}_` : ""
            const finalFileName = `${filePrefix}${cleanFileName}`

            // Download real do arquivo binário armazenado no Supabase Storage
            if (comp.storage_path) {
              const { data: blobData, error: dlErr } = await supabase.storage
                .from("comprovantes")
                .download(comp.storage_path)

              if (blobData && !dlErr) {
                subFolder?.file(finalFileName, blobData)
                totalBaixados++
              } else {
                // Fallback informativo se o arquivo estiver ausente no bucket
                const aviso = `AVISO DE COMPROVANTE FISCAL MROSC\nArquivo: ${comp.file_name}\nTipo: ${comp.tipo_documento}\nStorage Path: ${comp.storage_path}\nStatus: Arquivo não localizado no bucket (${dlErr?.message || "indisponível"})\nData: ${new Date().toISOString()}`
                subFolder?.file(`${finalFileName}_pendente.txt`, aviso)
              }
            } else {
              const aviso = `AVISO: Comprovante sem storage_path cadastrado para a despesa ${despesa.id}.`
              subFolder?.file(`${finalFileName}_sem_caminho.txt`, aviso)
            }

            linhasIndice.push(
              `${index + 1};"${dataPag}";"${despesa.numero_documento_fiscal || "S/N"}";"${despesa.fornecedores?.razao_social_nome || "-"}";"${despesa.fornecedores?.cpf_cnpj || "-"}";"${rubricaCode}";"${valorStr}";"${despesa.status}";"${finalFileName}"`
            )
          } catch (compErr) {
            console.warn(`Erro ao baixar comprovante ${comp.file_name}:`, compErr)
          }
        }
      } else {
        // Despesa sem comprovante anexado
        linhasIndice.push(
          `${index + 1};"${dataPag}";"${despesa.numero_documento_fiscal || "S/N"}";"${despesa.fornecedores?.razao_social_nome || "-"}";"${despesa.fornecedores?.cpf_cnpj || "-"}";"${rubricaCode}";"${valorStr}";"${despesa.status}";"PENDENTE"`
        )
      }
    }

    // Adicionar arquivo de índice UTF-8 com BOM para abertura automática no Excel
    const indiceContent = "\uFEFF" + linhasIndice.join("\r\n")
    rootFolder?.file("INDICE_OFICIAL_DE_COMPROVANTES.csv", indiceContent)

    if (onProgress) {
      onProgress(`Compactando ${totalBaixados} comprovante(s) no arquivo ZIP final...`)
    }

    const content = await zip.generateAsync({ type: "blob" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(content)
    link.download = `${folderName}_${new Date().toISOString().split("T")[0]}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    return totalBaixados
  },
}
