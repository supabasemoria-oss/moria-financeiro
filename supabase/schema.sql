-- ==============================================================================
-- SISTEMA MORIÁ - GESTÃO DE PARCERIAS DO TERCEIRO SETOR (MROSC - LEI 13.019/2014)
-- SCHEMA DE BANCO DE DADOS SUPABASE / POSTGRESQL
-- ==============================================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. CADASTROS BASE (PROMPT 1)
-- ==============================================================================

-- Tabela: Instituições (OSCs / ONGs / Institutos)
CREATE TABLE IF NOT EXISTS public.instituicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    email VARCHAR(255),
    telefone VARCHAR(30),
    endereco TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Projetos / Termos de Parceria
CREATE TABLE IF NOT EXISTS public.projetos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instituicao_id UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    numero_termo VARCHAR(100),
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    valor_total_aprovado NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (valor_total_aprovado >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PRESTACAO_CONTAS', 'CONCLUIDO', 'CANCELADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Fornecedores e Prestadores de Serviço
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social_nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(18) NOT NULL UNIQUE,
    tipo_chave_pix VARCHAR(30) CHECK (tipo_chave_pix IN ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA')),
    chave_pix VARCHAR(255),
    banco VARCHAR(100),
    agencia VARCHAR(30),
    conta VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. PREVISÃO ORÇAMENTÁRIA E TRAVAS DE TETO (PROMPT 2)
-- ==============================================================================

-- Tabela: Rubricas Orçamentárias / Linhas do Plano de Trabalho
CREATE TABLE IF NOT EXISTS public.rubricas_orcamentarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('SERVICO', 'MATERIAL', 'LOCACAO', 'RH', 'OUTROS')),
    descricao TEXT NOT NULL,
    codigo_natureza_despesa VARCHAR(20) NOT NULL, -- Ex: 33903501, 33903000, 33903900
    unidade VARCHAR(50) NOT NULL DEFAULT 'UN',
    quantidade NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantidade > 0),
    valor_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (valor_unitario >= 0),
    valor_total NUMERIC(14, 2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. EXECUÇÃO FINANCEIRA E CONTROLE DE SALDO (PROMPT 3)
-- ==============================================================================

-- Tabela: Despesas / Lançamentos Financeiros
CREATE TABLE IF NOT EXISTS public.despesas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    rubrica_id UUID NOT NULL REFERENCES public.rubricas_orcamentarias(id) ON DELETE RESTRICT,
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
    descricao TEXT NOT NULL,
    valor NUMERIC(14, 2) NOT NULL CHECK (valor > 0),
    data_despesa DATE NOT NULL,
    data_pagamento DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    numero_documento_fiscal VARCHAR(100),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 4. UPLOAD E TIPIFICAÇÃO DE COMPROVANTES (PROMPT 4)
-- ==============================================================================

-- Tabela: Comprovantes e Anexos Digitais
CREATE TABLE IF NOT EXISTS public.comprovantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    despesa_id UUID NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(50) NOT NULL CHECK (
        tipo_documento IN ('NOTA_FISCAL', 'RECIBO', 'COMPROVANTE_PIX', 'FOLHA_PAGAMENTO', 'GUIA_IMPOSTO', 'CONTRATO', 'COTACAO', 'OUTRO')
    ),
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 5. VIEW CONSOLIDADA DE SALDOS E PRESTAÇÃO DE CONTAS (PROMPT 5)
-- ==============================================================================

CREATE OR REPLACE VIEW public.vw_saldos_rubricas AS
SELECT 
    r.id AS rubrica_id,
    r.projeto_id,
    p.nome AS projeto_nome,
    p.numero_termo,
    r.tipo AS rubrica_tipo,
    r.descricao AS rubrica_descricao,
    r.codigo_natureza_despesa,
    r.unidade,
    r.quantidade,
    r.valor_unitario,
    r.valor_total AS valor_orcado,
    COALESCE(SUM(CASE WHEN d.status = 'PAGO' THEN d.valor ELSE 0 END), 0) AS total_pago,
    COALESCE(SUM(CASE WHEN d.status = 'PENDENTE' THEN d.valor ELSE 0 END), 0) AS total_pendente,
    COALESCE(SUM(CASE WHEN d.status IN ('PAGO', 'PENDENTE') THEN d.valor ELSE 0 END), 0) AS total_comprometido,
    (r.valor_total - COALESCE(SUM(CASE WHEN d.status = 'PAGO' THEN d.valor ELSE 0 END), 0)) AS saldo_real,
    (r.valor_total - COALESCE(SUM(CASE WHEN d.status IN ('PAGO', 'PENDENTE') THEN d.valor ELSE 0 END), 0)) AS saldo_disponivel,
    COUNT(d.id) AS total_lancamentos
FROM public.rubricas_orcamentarias r
JOIN public.projetos p ON p.id = r.projeto_id
LEFT JOIN public.despesas d ON d.rubrica_id = r.id AND d.status != 'CANCELADO'
GROUP BY r.id, p.id;

-- View para dashboard consolidado por projeto
CREATE OR REPLACE VIEW public.vw_resumo_projetos AS
SELECT 
    p.id AS projeto_id,
    p.nome AS projeto_nome,
    p.numero_termo,
    p.valor_total_aprovado,
    p.status AS status_projeto,
    i.razao_social AS instituicao_nome,
    i.cnpj AS instituicao_cnpj,
    COALESCE(SUM(r.valor_total), 0) AS total_planejado_rubricas,
    COALESCE(SUM(d_pagos.valor), 0) AS total_executado_pago,
    COALESCE(SUM(d_pend.valor), 0) AS total_executado_pendente,
    (p.valor_total_aprovado - COALESCE(SUM(d_pagos.valor), 0)) AS saldo_remanescente
FROM public.projetos p
JOIN public.instituicoes i ON i.id = p.instituicao_id
LEFT JOIN public.rubricas_orcamentarias r ON r.projeto_id = p.id
LEFT JOIN (
    SELECT rubrica_id, SUM(valor) as valor 
    FROM public.despesas 
    WHERE status = 'PAGO' 
    GROUP BY rubrica_id
) d_pagos ON d_pagos.rubrica_id = r.id
LEFT JOIN (
    SELECT rubrica_id, SUM(valor) as valor 
    FROM public.despesas 
    WHERE status = 'PENDENTE' 
    GROUP BY rubrica_id
) d_pend ON d_pend.rubrica_id = r.id
GROUP BY p.id, i.id;

-- ==============================================================================
-- 6. TRIGGER DE TRAVA DE TETO ORÇAMENTÁRIO (MROSC)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_validar_teto_rubrica()
RETURNS TRIGGER AS $$
DECLARE
    v_valor_orcado NUMERIC(14, 2);
    v_total_gasto NUMERIC(14, 2);
    v_saldo_disponivel NUMERIC(14, 2);
BEGIN
    IF NEW.status = 'CANCELADO' THEN
        RETURN NEW;
    END IF;

    -- Obter o valor total orçado da rubrica
    SELECT valor_total INTO v_valor_orcado
    FROM public.rubricas_orcamentarias
    WHERE id = NEW.rubrica_id;

    -- Obter o total já gasto/comprometido por outras despesas
    SELECT COALESCE(SUM(valor), 0) INTO v_total_gasto
    FROM public.despesas
    WHERE rubrica_id = NEW.rubrica_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status != 'CANCELADO';

    v_saldo_disponivel := v_valor_orcado - v_total_gasto;

    -- Verificar se ultrapassa o teto
    IF NEW.valor > v_saldo_disponivel THEN
        RAISE EXCEPTION 'Trava de Teto MROSC: Lançamento de R$ % ultrapassa o saldo disponível de R$ % da rubrica orçamentária.', 
            to_char(NEW.valor, 'FM999G999G990D00'), 
            to_char(v_saldo_disponivel, 'FM999G999G990D00');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_teto_rubrica ON public.despesas;
CREATE TRIGGER trg_validar_teto_rubrica
BEFORE INSERT OR UPDATE OF valor, rubrica_id, status
ON public.despesas
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_teto_rubrica();

-- ==============================================================================
-- 7. STORAGE BUCKET CONFIGURATION (SUPABASE STORAGE)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 8. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ==============================================================================

ALTER TABLE public.instituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubricas_orcamentarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público para Desenvolvimento / Operação da Moriá
CREATE POLICY "Permitir acesso completo a instituicoes" ON public.instituicoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso completo a projetos" ON public.projetos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso completo a fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso completo a rubricas" ON public.rubricas_orcamentarias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso completo a despesas" ON public.despesas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso completo a comprovantes" ON public.comprovantes FOR ALL USING (true) WITH CHECK (true);

-- Políticas Storage
CREATE POLICY "Permitir upload e leitura pública comprovantes" ON storage.objects
FOR ALL USING (bucket_id = 'comprovantes') WITH CHECK (bucket_id = 'comprovantes');
