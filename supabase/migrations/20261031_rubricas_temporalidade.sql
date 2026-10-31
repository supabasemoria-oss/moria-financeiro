-- Migração: Temporalidade de Rubricas e Execução Sob Demanda (MROSC / Lei 13.019/2014)
-- Data: 2026-10-31

-- 1. Data de início da atividade da rubrica (permite largadas desfasadas no cronograma)
ALTER TABLE rubricas_orcamentarias 
ADD COLUMN IF NOT EXISTS data_inicio DATE;

-- 2. Indicador de rubrica executada sob demanda (materiais, bens pontuais e serviços esporádicos)
-- Rubricas sob demanda não geram parcelas com vencimento fixo antecipado, evitando falsos alarmes
ALTER TABLE rubricas_orcamentarias 
ADD COLUMN IF NOT EXISTS sob_demanda BOOLEAN DEFAULT false;

-- Comentários descritivos para rastreabilidade
COMMENT ON COLUMN rubricas_orcamentarias.data_inicio IS 'Data de início da atividade da rubrica (marco inicial para cálculo de parcelas recorrentes). Quando nulo, herda a ordem de início do projeto.';
COMMENT ON COLUMN rubricas_orcamentarias.sob_demanda IS 'Se verdadeiro, a rubrica é executada sob demanda (materiais/serviços pontuais) e não gera parcelas antecipadas no calendário.';
