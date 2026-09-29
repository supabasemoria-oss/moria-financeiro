---
name: mrosc-planilhas
description: Análise, auditoria e extração estruturada de planilhas orçamentárias do MROSC (Lei 13.019/2014) e Transferegov.br.
---

# Skill: Análise de Planilhas Orçamentárias MROSC / Transferegov

Esta skill define as diretrizes, heurísticas e especificações técnicas para analisar, validar e extrair dados de planilhas de custos e propostas de parcerias com o poder público (Ministérios, Governos Estaduais e Municipais).

---

## 1. Padrões de Modelos Identificados

### Modelo A: Padronizado Transferegov (Cotação Tripla & Encargos CLT)
- **Exemplo de Referência:** `Planilha de Custos - Proposta N°023809_2026.xlsx`
- **Cabeçalho:** Proposta Nº, CNPJ da OSC, Razão Social da OSC, Data.
- **Estrutura de Colunas:**
  - `N°`, `TIPO` (Recursos Humanos, Tributo, Material, Serviço), `ITEM` (Cargo ou Produto).
  - `ESPECIFICAÇÃO DO ITEM`: Descrição, Justificativa e Memória de Cálculo detalhada.
  - `AQUISIÇÃO`, `DESPESA`, `GND` (ex: GND3 - Outras Despesas Correntes / GND4 - Investimento).
  - `MEDIDAS`: `QTD` (ex: 10 pessoas), `QTD (PERÍODO)` (ex: 12 meses), `TOTAL` (QTD x Período = 120), `UNIDADE DE MEDIDA` (Meses, Diárias, Unidades).
  - `COTAÇÕES`: 3 blocos contendo `RAZÃO OU LINK`, `CNPJ`, `VALOR UNITÁRIO`, `VALOR TOTAL`.
  - `COTAÇÃO SELECIONADA`: `VALOR UNITÁRIO` (menor valor entre as 3 cotações) e `VALOR TOTAL`.
- **Regra de Encargos Sociais / Trabalhistas:**
  - Rubricas de RH frequentemente acompanhadas por rubricas de `Tributo / Encargos`.
  - Padrão CLT do terceiro setor: INSS Patronal 20%, FGTS 8%, SAT 1%, PIS 1%, COFINS 5.80%, 13º Salário 8.33%, Férias 2.23%, Projeção de Férias/Encargos 21.80% (Total: ~68.16%).

### Modelo B: Descritivo com Cotações Concatenadas (Ministérios / Emendas)
- **Exemplo de Referência:** `Planilha Inpro ministério das mulheres V11 Final (4).xls`
- **Cabeçalho:** OSC Proponente (`INSTITUTO PROVER`), Número da Proposta (`009415/2026`), Órgão Concedente.
- **Divisão em Etapas Orçamentárias:**
  - `Etapa 1.1`: Recursos Humanos, Coordenação e Serviços de Gestão (Itens 1 a 13, ex: Coordenador Geral, Instrutores, Assessoria, Locação de Veículos).
  - `Etapa 2.1`: Materiais e Serviços Gráficos (Itens 1 e 2, ex: Banner e Confecção de Material Didático).
- **Estrutura de Colunas:**
  - `Col 0`: `Nº` — Número sequencial do item (`1`, `2`, `3`...).
  - `Col 1`: `Especificação do Item/Serviço` — Título do cargo/serviço, atribuições, requisitos e carga horária.
  - `Col 6`: Quantidade de profissionais ou unidades por item.
  - `Col 7`: Diárias / Meses de atuação (ex: 8 meses para coordenação, 6 meses para instrutores).
  - `Col 8`: `QUANT.` / `TOTAL` — Total calculado (`Qtd * Meses` ou total de unidades).
  - `Col 9, 12, 15`: Cotações das Empresas 1, 2 e 3 (`Razão Social, CNPJ, Telefone`).
  - `Col 10, 13, 16`: Valores unitários cotados de cada empresa.
  - `Col 11, 14, 17`: Valores totais cotados de cada empresa.
  - `Col 18`: `MENOR VALOR UNITÁRIO COTADO` — Menor cotação unitária selecionada.
  - `Col 19`: `VALOR TOTAL` — Valor total aprovado do item (`Quantidade Total * Menor Valor Unitário`).
- **Regras Críticas de Parsing e Filtragem:**
  - `Robustez de Moeda`: Suporte a formatação com `R$`, vírgulas e pontos em formato americano (`R$ 6,000.00`) ou brasileiro (`R$ 6.000,00`).
  - `Filtro de Linhas`: Ignorar linhas intermediárias de cabeçalho ("Meta", "Etapa", "Nº", "VALOR TOTAL UNITÁRIO COTADO") e linhas vazias da grade onde valor total e unitário sejam zerados.
  - `Vencedor da Cotação`: Comparar o valor da `Col 18` com as cotações das colunas `10, 13, 16` para associar o fornecedor vencedor exato com CNPJ.
  - `Consistência com Valor Global`: A soma de todas as rubricas válidas deve igualar com precisão de centavos o `TOTAL (VALOR GLOBAL)` grafado na planilha.

### Modelo C: Planilha Simples / Tabela Direta
- Linha de cabeçalho direta: `Item`, `Descrição`, `Quantidade`, `Unidade`, `Valor Unitário`, `Valor Total`.

---

## 2. Regras de Validação e Auditoria MROSC

1. **Validação do Menor Preço (Economicidade):**
   - Transferegov exige no mínimo 3 cotações de fornecedores independentes.
   - O valor selecionado DEVE ser o menor valor unitário entre as 3 cotações (salvo justificativa técnica expressa).
2. **Consistência Matemática:**
   - Para itens mensais: `QTD (pessoas/unidades) * Meses * Valor Unitário = Valor Total`.
   - Divergências de arredondamento superiores a R$ 0,05 devem ser sinalizadas como inconformidade.
3. **Classificação de Natureza de Despesa:**
   - RH / Coordenação / Instrutores: Serviço de Terceiros PF (339036) ou CLT (339034/GND3).
   - Encargos Sociais: Encargos Patronais (339047).
   - Materiais de Consumo: 339030.
   - Serviços de Terceiros PJ: 339039.
4. **Extração de Fornecedores:**
   - Toda cotação identificada contém um potencial fornecedor do projeto.
   - Extrair Razão Social, CNPJ (sanitizado) e telefone para cadastro direto na base de fornecedores.

---

## 3. Esquema Padronizado de Extração (JSON)

```json
{
  "metadados": {
    "modelo_identificado": "MODELO_A_TRANSFEREGOV | MODELO_B_DESCRITIVO | MODELO_C_SIMPLES",
    "proposta_numero": "023809/2026",
    "osc_nome": "Instituto Exemplo",
    "cnpj_osc": "00.000.000/0001-00",
    "valor_total_projeto": 1500000.00,
    "vigencia_meses": 12
  },
  "rubricas": [
    {
      "numero_item": 1,
      "descricao": "Articulador Social",
      "especificacao_completa": "Responsável por...",
      "tipo": "RH",
      "gnd": "GND3",
      "quantidade": 10,
      "periodo_meses": 12,
      "quantidade_total": 120,
      "unidade": "Meses",
      "valor_unitario": 1650.00,
      "valor_total": 198000.00,
      "codigo_natureza_despesa": "33903600",
      "cotacao_menor_preco_valida": true,
      "fornecedor_selecionado": {
        "razao_social": "LOPES E LOPES ASSESSORIA EMPRESARIAL LTDA",
        "cnpj": "17728273000150"
      },
      "cotacoes": [
        {
          "posicao": 1,
          "razao_social": "LOPES E LOPES ASSESSORIA EMPRESARIAL LTDA",
          "cnpj": "17728273000150",
          "valor_unitario": 1650.00,
---

## 4. Mapeamento Direto do Ciclo de Pagamentos do Gestor

A planilha orçamentária fornece todos os dados necessários para o gestor programar e executar os pagamentos reais:

| Dimensão de Pagamento | Campo na Planilha | Destino no Sistema | Exemplo Real |
|---|---|---|---|
| **O que pagar** | `ITEM` ou Título do Cargo/Serviço | `rubricas_orcamentarias.descricao` | "Articulador Social" |
| **Quanto pagar por mês** | `VALOR UNITÁRIO` selecionado | `rubricas_orcamentarias.valor_unitario` | R$ 1.650,00 |
| **Quantas vezes pagar** | `QTD (PERÍODO)` (ex: 12 meses) | `rubricas_orcamentarias.num_parcelas` e geração de parcelas | 12 parcelas mensais em `parcelas_pagamento` |
| **Tributos e encargos** | Linhas de Tributo/Encargos CLT (68.16%) | Rubricas vinculadas com código `33904700` | "Articulador Social — Encargos" (R$ 1.124,64/mês) |
| **Quem vai receber** | Razão Social e CNPJ da cotação vencedora | Tabela `fornecedores` vinculada | LOPES E LOPES (CNPJ 17.728.273/0001-50) |
| **Total reservado** | `VALOR TOTAL` aprovado | `rubricas_orcamentarias.valor_total` | R$ 198.000,00 |

