# Tasklist & Test List Exaustiva: Correções e Evoluções Moriá (MROSC)

> **Protocolo de Execução:**  
> 1. Executar estritamente **uma tarefa atômica por vez**.  
> 2. Solicitar autorização antes de qualquer edição de código (salvo se houver ordem de "vai").  
> 3. Ao concluir a implementação da tarefa, apresentar o roteiro de teste e perguntar se o usuário pode verificar no navegador.  
> 4. Somente após a verificação e validação do usuário, marcar a tarefa como `[x]` e prosseguir para a próxima.

---

## 📊 Progresso Geral

- [x] **Fase 1: Ajustes Visuais Imediatos** (2/2)
- [x] **Fase 2: Navegação, Filtros e CRUDs** (4/4)
- [x] **Fase 3: Regras Avançadas MROSC (Quitação Rateada & RH)** (3/3)
- [ ] **Fase 4: Módulo Extra (Plano de Trabalho)** (0/1)

---

## 🎯 FASE 1: Ajustes Visuais Imediatos (Layout & Responsividade)

### 📌 Tarefa 1.1 — Truncamento e Contenção dos Dropdowns de Filtro
* **Objetivo:** Impedir que nomes longos de projetos estufem o botão e sobreponham o dropdown *"Todas as Rubricas"* na tela de Execução Financeira.
* **Arquivos:** `src/app/execucao/page.tsx`
* **Implementação Técnica:**
  - Adicionar `flex-wrap` e espaçamento harmonioso no container de filtros.
  - Fixar larguras responsivas (`sm:w-[280px] md:w-[320px] max-w-full`) no trigger do select de projetos.
  - Aplicar classes de truncamento (`truncate`, `min-w-0`, `block text-left`) e atributo `title` para tooltip com nome completo.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 1.1.1 (Cenário Crítico):** Selecionar o *"Projeto Articuladoras Territoriais pela Autonomia das Mulheres"*.
    - *Resultado Esperado:* O nome longo deve ser truncado com reticências (`...`), sem empurrar ou sobrepor o botão *"Todas as Rubricas"*.
  - [x] **Teste 1.1.2 (Hover/Tooltip):** Passar o mouse sobre o botão do projeto truncado.
    - *Resultado Esperado:* O tooltip nativo exibe o nome completo do projeto.
  - [x] **Teste 1.1.3 (Responsividade):** Reduzir a largura da janela para simular tela menor (laptop / tablet).
    - *Resultado Esperado:* Os filtros quebram de linha suavemente sem quebrar o layout nem sobrepor botões adjacentes.
* **Status:** `[x] Concluído`

---

### 📌 Tarefa 1.2 — Contenção de Overflow no Modal de Quitação de Parcela
* **Objetivo:** Impedir que nomes de arquivos fiscais longos (chaves de acesso NFe de 44+ dígitos sem espaço) estiquem o modal para fora da tela e escondam os botões de confirmação.
* **Arquivos:** `src/components/campo-nota-fiscal.tsx` e `src/app/execucao/page.tsx`
* **Implementação Técnica:**
  - Em `campo-nota-fiscal.tsx`: aplicar `min-w-0 overflow-hidden w-full` no card de preview e `truncate text-xs max-w-full` no nome do arquivo.
  - Em `execucao/page.tsx`: aplicar `w-[95vw] sm:max-w-[540px] max-h-[90vh] overflow-y-auto overflow-x-hidden` no `<DialogContent>` de quitação.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 1.2.1 (Upload de NFe com Chave Longa):** Clicar em *"Quitar"* em qualquer parcela pendente e selecionar um arquivo com nome `NFE_0000798_33260334031062000182550010000007981010007983_11.pdf`.
    - *Resultado Esperado:* O modal mantém a largura centralizada na tela, o nome do arquivo exibe reticências (`...`) e o card não expande horizontalmente.
  - [x] **Teste 1.2.2 (Visibilidade dos Botões de Ação):** Verificar a barra inferior do modal.
    - *Resultado Esperado:* O botão verde *"Confirmar Quitação"* e o botão *"Cancelar"* estão 100% visíveis, alinhados e acessíveis para clique.
  - [x] **Teste 1.2.3 (Remoção do Arquivo):** Clicar no botão de remover/substituir o anexo.
    - *Resultado Esperado:* O arquivo é removido sem alterar o tamanho do diálogo.
* **Status:** `[x] Concluído`

---

## 🧭 FASE 2: Navegação, Filtros e CRUDs Básicos

### 📌 Tarefa 2.1 — Persistência de Filtros via URL e Botão "Limpar Filtros"
* **Objetivo:** Manter os filtros selecionados de Projeto e Rubrica ao navegar para outras rotas e voltar pelo navegador, além de disponibilizar botão para resetar.
* **Arquivos:** `src/app/execucao/page.tsx`
* **Implementação Técnica:**
  - Inicializar `filtroProjeto`, `filtroRubrica` e `activeTab` lendo `useSearchParams()`.
  - Atualizar os parâmetros na URL via `router.replace` sem scroll ao modificar seletores.
  - Adicionar botão *"Limpar Filtros"* visível quando qualquer filtro ativo diferir do padrão.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 2.1.1 (Persistência ao Navegar e Voltar):** Na tela de Execução, filtrar um Projeto específico e uma Rubrica (ex: Assessoria Jurídica). Clicar em uma despesa para abrir Comprovantes. Em seguida, clicar na seta *"Voltar"* do navegador ($\leftarrow$).
    - *Resultado Esperado:* A tela de Execução recarrega com o Projeto e a Rubrica anteriormente filtrados já selecionados.
  - [x] **Teste 2.1.2 (Refresh / F5):** Com os filtros aplicados, pressionar `F5`.
    - *Resultado Esperado:* Os filtros permanecem intactos.
  - [x] **Teste 2.1.3 (Botão Limpar Filtros):** Clicar no botão *"Limpar Filtros"*.
    - *Resultado Esperado:* Os seletores voltam para *"Todos os Projetos"* e *"Todas as Rubricas"*, e a URL é limpa.
* **Status:** `[x] Concluído`

---

### 📌 Tarefa 2.2 — Filtro por Projeto em Comprovantes & Gestão Documental
* **Objetivo:** Permitir ao usuário filtrar os documentos e notas fiscais por projeto na tela de Comprovantes.
* **Arquivos:** `src/app/comprovantes/page.tsx`
* **Implementação Técnica:**
  - Carregar a lista de projetos ativos do usuário.
  - Adicionar seletor dropdown no topo da tela com opção *"Todos os Projetos"* e os projetos individuais.
  - Filtrar o array de comprovantes exibidos comparando o `projeto_id` da despesa associada.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 2.2.1 (Seleção de Projeto Específico):** Selecionar o *"Projeto Rio Ar Livre"*.
    - *Resultado Esperado:* A tabela exibe exclusivamente os comprovantes vinculados às despesas desse projeto.
  - [x] **Teste 2.2.2 (Todos os Projetos):** Selecionar *"Todos os Projetos"*.
    - *Resultado Esperado:* Todos os comprovantes cadastrados no repositório voltam a ser listados.
  - [x] **Teste 2.2.3 (Projeto sem comprovantes):** Selecionar um projeto recém-criado sem anexos.
    - *Resultado Esperado:* Exibição de estado vazio limpo ("Nenhum comprovante encontrado para este projeto").
* **Status:** `[x] Concluído`

---

### 📌 Tarefa 2.3 — Edição Cadastral de Fornecedores (Foco Bancário e Endereço)
* **Objetivo:** Possibilitar a edição de dados cadastrais, bancários (Banco, Agência, Conta, Pix) e contato de fornecedores já existentes.
* **Arquivos:** `src/app/fornecedores/page.tsx` e `src/lib/api/mrosc-service.ts`
* **Implementação Técnica:**
  - Adicionar método `updateFornecedor(id, dados)` no serviço.
  - Adicionar botão com ícone de lápis na listagem de fornecedores.
  - Criar modal de edição pré-populado com os dados atuais do fornecedor.
  - Validar CPF/CNPJ e salvar alterações no Supabase.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 2.3.1 (Abertura do Formulário de Edição):** Clicar em *"Editar"* em um fornecedor existente.
    - *Resultado Esperado:* O modal abre com todos os dados atuais (Nome, CNPJ, Chave Pix, Banco, Agência, Conta) preenchidos nos campos.
  - [x] **Teste 2.3.2 (Atualização de Chave Pix e Conta):** Alterar a Chave Pix e o número da Conta Bancária e clicar em *"Salvar Alterações"*.
    - *Resultado Esperado:* Toast de sucesso emitido, modal fecha, e a linha da tabela exibe os novos dados bancários.
  - [x] **Teste 2.3.3 (Persistência e Integridade):** Recarregar a página com F5.
    - *Resultado Esperado:* Os dados atualizados persistem sem quebrar o histórico de pagamentos anteriores daquele fornecedor.
* **Status:** `[x] Concluído`

---

### 📌 Tarefa 2.4 — Edição da Descrição de Parcela de Pagamento
* **Objetivo:** Permitir ao usuário editar o texto descritivo de obrigações/parcelas cadastradas.
* **Arquivos:** `src/app/execucao/page.tsx` e `src/lib/api/mrosc-service.ts`
* **Implementação Técnica:**
  - Implementar/garantir método `updateParcela(id, { descricao })` no `mroscService`.
  - Adicionar ação de edição (lápis) na listagem de parcelas.
  - Abrir diálogo rápido de alteração de descrição.
  - Atualizar no Supabase e refletir instantaneamente na tabela.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 2.4.1 (Edição de Texto):** Clicar no lápis de uma parcela com texto *"Coordenador geral - Agosto/2026"*.
    - *Resultado Esperado:* Abre diálogo com campo de texto preenchido.
  - [x] **Teste 2.4.2 (Salvar Novo Nome):** Mudar para *"Coordenador Geral - Pagamento 1º Mês / Agosto"* e salvar.
    - *Resultado Esperado:* A linha na tabela exibe imediatamente a nova descrição e o valor/vencimento permanecem intactos.
  - [x] **Teste 2.4.3 (Validação de Campo Vazio):** Apagar todo o texto e tentar salvar.
    - *Resultado Esperado:* O sistema bloqueia com mensagem de validação "A descrição não pode ser vazia".
* **Status:** `[x] Concluído`

---

## 💼 FASE 3: Regras Avançadas MROSC (Orçamento, Quitação Rateada & RH)

### 📌 Tarefa 3.1 — Parser Orçamentário com Seções/Categorias da Planilha
* **Objetivo:** Preservar e exibir as macro-seções oficiais da planilha MROSC (RH, Encargos, Materiais, Uniformes, Divulgação) na visualização orçamentária.
* **Arquivos:** `src/app/orcamento/page.tsx` e rotina de parser de planilha.
* **Implementação Técnica:**
  - Capturar no parser as seções e blocos originais da planilha.
  - Persistir metadado `categoria_planilha` / `secao_mrosc` nas rubricas.
  - Agrupar visualmente as tabelas por bloco com subtotais dedicados.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 3.1.1 (Importação e Classificação de Seções):** Filtrar e categorizar as rubricas da Proposta 023809/2026 pelas seções oficiais MROSC.
    - *Resultado Esperado:* O sistema reconhece e separa as seções de Recursos Humanos, Encargos Sociais, Materiais Esportivos, Uniformes, Identificação/Divulgação e Serviços, com badges coloridos e filtro dedicado.
  - [x] **Teste 3.1.2 (Conferência de Filtro por Seção e Subtotais):** Filtrar por seção "Recursos Humanos" e alternar entre visão de Cards e Cronograma Mensal.
    - *Resultado Esperado:* Apenas rubricas da categoria selecionada são exibidas com seus totais consolidados.
* **Status:** `[x] Concluído`

---

### 📌 Tarefa 3.2 — Quitação de Parcela com Múltiplos Credores e NFes (Rateio)
* **Objetivo:** Permitir liquidar uma parcela consolidada (ex: Coordenadores de Núcleo R$ 10.000) distribuindo o pagamento entre múltiplos favorecidos com comprovantes individuais.
* **Arquivos:** `src/app/execucao/page.tsx` e `src/lib/api/mrosc-service.ts`
* **Implementação Técnica:**
  - Reformular modal de quitação para gerenciar lista dinâmica de pagamentos parciais (`fornecedor`, `valor`, `numero_nf`, `arquivo_nf`).
  - Botão *"+ Adicionar Favorecido / Comprovante"*.
  - Salvar cada lançamento individualmente na tabela `despesas` e em `comprovantes` vinculados à mesma parcela.
  - Marcar parcela como liquidada quando a soma atingir o valor previsto.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 3.2.1 (Quitação Multi-Credor):** Em uma parcela de R$ 10.000, cadastrar Favorecido A (R$ 5.000 + NF 101 + PDF A) e Favorecido B (R$ 5.000 + NF 102 + PDF B).
    - *Resultado Esperado:* O modal calcula `Total a liquidar: R$ 10.000 / R$ 10.000` com comparador de saldo dinâmico.
  - [x] **Teste 3.2.2 (Confirmação e Reflexo no Livro Caixa):** Confirmar quitação rateada.
    - *Resultado Esperado:* A parcela vai para o status *"Pago"*. O serviço `executarParcelaRateada` gera os registros individuais no Supabase com seus comprovantes e dados fiscais.
* **Status:** `[x] Concluído`

---

### 📌 Tarefa 3.3 — Liquidação de RH por Quantitativo vs Previsto
* **Objetivo:** Permitir ao gestor liquidar rubricas de RH informando a quantidade de profissionais pagos no mês (ex: 5 de 10), abatendo o saldo automaticamente.
* **Arquivos:** `src/app/execucao/page.tsx`
* **Implementação Técnica:**
  - Detectar rubricas do grupo Recursos Humanos.
  - Oferecer opção de quitação por quantitativo informado (Qtd Paga $\times$ Valor Unitário).
  - Atualizar saldo restante e manter registro da meta física liquidada.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [x] **Teste 3.3.1 (Cálculo Automático por Quantitativo):** Em obrigação de RH com previsão de 10 articuladores a R$ 2.000 (R$ 20.000), preencher quantidade paga: 5.
    - *Resultado Esperado:* O sistema calcula valor total pago de R$ 10.000 e indica saldo restante de 5 articuladores (R$ 10.000).
  - [x] **Teste 3.3.2 (Anexo do Comprovante de Pagamento da Folha/RPA):** Anexar o comprovante de pagamento dos 5 articuladores e confirmar.
    - *Resultado Esperado:* Despesa registrada no Livro Caixa com valor exato de R$ 10.000 e status atualizado.
* **Status:** `[x] Concluído`

---

## 🚀 FASE 4: Módulo Extra (Plano de Trabalho & Metas Físicas)

### 📌 Tarefa 4.1 — Upload e Acompanhamento do Plano de Trabalho (PDF)
* **Objetivo:** Upload do documento de projeto técnico pedagógico, extração das fases (Estruturação vs Execução) e checklist de cumprimento físico do objeto.
* **Arquivos:** Nova rota `src/app/plano-trabalho/page.tsx`, assistente de projeto e parser de PDF.
* **Implementação Técnica:**
  - Campo de upload de Plano de Trabalho no cadastro do projeto.
  - Extração de fases, etapas operacionais e metas de atendimento (núcleos e vagas).
  - Interface interativa de acompanhamento do cumprimento do objeto com status (*Pendente*, *Em Andamento*, *Cumprido*) e anexação de evidências físicas.
* **🧪 Roteiro de Teste Exaustivo (Test List):**
  - [ ] **Teste 4.1.1 (Upload do PDF):** Fazer upload do PDF da Proposta 023809/2026.
    - *Resultado Esperado:* Reconhecimento da vigência total (14 meses: 2 estruturação + 12 execução), 10 núcleos e 1.000 vagas.
  - [ ] **Teste 4.1.2 (Atualização de Metas):** Marcar etapa de "Formação e Treinamento da Equipe" como *Cumprida* com anexo de ata.
    - *Resultado Esperado:* O progresso físico avança percentualmente no painel geral.
* **Status:** `[ ] Não Iniciado`
