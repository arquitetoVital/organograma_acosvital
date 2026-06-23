-- ============================================================
-- SEED DEMO — Organograma Açosvital (dados de teste "reais")
-- Execute no Supabase SQL Editor.  Sem loops, idempotente (re-rodável).
--
-- ┌────────────────────────────────────────────────────────────────────┐
-- │ DOIS CAMINHOS — escolha UM (não use os dois juntos):                │
-- │                                                                    │
-- │ (A) RH-driven (recomendado): rode só a PARTE 1 e clique em         │
-- │     "Importar do RH". O import (importFromFuncionarios) monta o     │
-- │     organograma inteiro pelo nível do cargo:                       │
-- │       cargo nivel 0 → Diretoria | nivel 1 → Gerência Geral          │
-- │       setores → nível 2 | nivel 4–11 → pessoas sob seus setores.    │
-- │     (Pessoas ficam DIRETO sob o setor — sem aninhar chefias.)       │
-- │                                                                    │
-- │ (B) Manual / instantâneo: rode PARTE 1 + PARTE 2 e NÃO importe.     │
-- │     A PARTE 2 cria os nós em org_nodes já ANINHADOS (diretor→…),    │
-- │     bom para o detalhe do setor. Se importar depois, o import       │
-- │     reaproveita os setores por nome e achata as pessoas.            │
-- │                                                                    │
-- │ ⚠️  Rodar PARTE 2 *e* importar gera Diretoria/Setores duplicados.   │
-- └────────────────────────────────────────────────────────────────────┘
--
-- O que cria:
--   • RH (organograma.*): 2 unidades, 28 cargos (níveis 0–11),
--     18 setores, 46 funcionários (inclui Diretoria nivel 0 e GG nivel 1).
--   • PARTE 2 (opcional) org_nodes: Diretoria(0), 3 Gerências(1),
--     18 Setores(2), 2 Sub-setores(3), 44 pessoas(4–11) aninhadas.
-- ============================================================

BEGIN;

-- ── (Opcional) Limpeza para re-rodar do zero ──────────────────────────
-- Descomente para apagar SOMENTE as linhas deste seed antes de inserir:
-- DELETE FROM organograma.org_nodes    WHERE id LIKE 'seed-%' OR id LIKE 'rh-d1000000-%';
-- DELETE FROM organograma.funcionarios WHERE id LIKE 'd1000000-%';
-- DELETE FROM organograma.setores      WHERE id LIKE 'c1000000-%';
-- DELETE FROM organograma.cargos       WHERE id LIKE 'b1000000-%';
-- DELETE FROM organograma.unidades     WHERE id LIKE 'a1000000-%';

-- ══════════════════════════════════════════════════════════════════════
-- PARTE 1 — RH (massa de dados)
-- ══════════════════════════════════════════════════════════════════════

-- ── UNIDADES ──────────────────────────────────────────────────────────
INSERT INTO organograma.unidades (id, nome, descricao, ativo) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Matriz',           'Sede administrativa e industrial — São Paulo/SP', true),
  ('a1000000-0000-0000-0000-000000000002', 'Filial Campinas',  'Unidade de logística e expedição — Campinas/SP',  true)
ON CONFLICT (id) DO NOTHING;

-- ── CARGOS (nivel 4–11 para mapear na hierarquia do organograma) ──────
INSERT INTO organograma.cargos (id, nome, nivel, descricao, ativo) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Diretor de Setor',             4,  'Direção do setor',                          true),
  ('b1000000-0000-0000-0000-000000000002', 'Diretor de Produção',          4,  'Direção da operação fabril',                true),
  ('b1000000-0000-0000-0000-000000000003', 'Diretor Financeiro',           4,  'Direção financeira',                        true),
  ('b1000000-0000-0000-0000-000000000004', 'Diretor de TI',                4,  'Direção de tecnologia',                     true),
  ('b1000000-0000-0000-0000-000000000005', 'Gerente de Setor',             5,  'Gerência do setor',                         true),
  ('b1000000-0000-0000-0000-000000000006', 'Gerente de Produção',          5,  'Gestão da linha de produção',               true),
  ('b1000000-0000-0000-0000-000000000007', 'Gerente Financeiro',           5,  'Gestão financeira e controladoria',         true),
  ('b1000000-0000-0000-0000-000000000008', 'Gerente de TI',                5,  'Gestão de sistemas e infraestrutura',       true),
  ('b1000000-0000-0000-0000-000000000009', 'Coordenador',                  6,  'Coordenação de equipe',                     true),
  ('b1000000-0000-0000-0000-000000000010', 'Coordenador de Produção',      6,  'Coordena processos produtivos',             true),
  ('b1000000-0000-0000-0000-000000000011', 'Coordenador de Usinagem',      6,  'Coordena o sub-setor de usinagem',          true),
  ('b1000000-0000-0000-0000-000000000012', 'Coordenador de Sistemas',      6,  'Coordena desenvolvimento de sistemas',      true),
  ('b1000000-0000-0000-0000-000000000013', 'Coordenador de Infraestrutura',6,  'Coordena infraestrutura de TI',             true),
  ('b1000000-0000-0000-0000-000000000014', 'Supervisor de Linha',          7,  'Supervisão direta na linha de produção',    true),
  ('b1000000-0000-0000-0000-000000000015', 'Supervisor de Tesouraria',     7,  'Supervisão de tesouraria',                  true),
  ('b1000000-0000-0000-0000-000000000016', 'Líder de Turno',               8,  'Liderança operacional por turno',           true),
  ('b1000000-0000-0000-0000-000000000017', 'Analista de Processos',        9,  'Análise e melhoria de processos',           true),
  ('b1000000-0000-0000-0000-000000000018', 'Analista Financeiro',          9,  'Análise contábil e relatórios',             true),
  ('b1000000-0000-0000-0000-000000000019', 'Analista de Sistemas',         9,  'Desenvolvimento de sistemas',               true),
  ('b1000000-0000-0000-0000-000000000020', 'Analista de Suporte',          9,  'Suporte técnico ao usuário',                true),
  ('b1000000-0000-0000-0000-000000000021', 'Analista de Infraestrutura',   9,  'Redes, servidores e cloud',                 true),
  ('b1000000-0000-0000-0000-000000000022', 'Analista de Usinagem',         9,  'Análise técnica de usinagem',               true),
  ('b1000000-0000-0000-0000-000000000023', 'Auxiliar de Produção',         10, 'Apoio às linhas de montagem e corte',       true),
  ('b1000000-0000-0000-0000-000000000024', 'Assistente Financeiro',        10, 'Suporte financeiro e fiscal',               true),
  ('b1000000-0000-0000-0000-000000000025', 'Auxiliar de Usinagem',         10, 'Apoio ao sub-setor de usinagem',            true),
  ('b1000000-0000-0000-0000-000000000026', 'Aprendiz Industrial',          11, 'Programa de aprendizagem profissional',     true),
  -- Topo da hierarquia (usado pelo "Importar do RH" — caminho A)
  ('b1000000-0000-0000-0000-000000000050', 'Diretor-Presidente',           0,  'Direção central / CEO',                     true),
  ('b1000000-0000-0000-0000-000000000051', 'Diretor Geral',                1,  'Gerência geral da organização',             true)
ON CONFLICT (id) DO NOTHING;

-- ── SETORES (nome IDÊNTICO ao nó is_sector do organograma) ────────────
INSERT INTO organograma.setores (id, nome, sigla, descricao, id_unidade, cor, ativo) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Produção',                            'PROD', 'Fabricação e montagem de aço',            'a1000000-0000-0000-0000-000000000001', '#2563eb', true),
  ('c1000000-0000-0000-0000-000000000002', 'Qualidade',                           'QUAL', 'Controle e garantia de qualidade',        'a1000000-0000-0000-0000-000000000001', '#7c3aed', true),
  ('c1000000-0000-0000-0000-000000000003', 'Manutenção',                          'MNT',  'Manutenção industrial e predial',         'a1000000-0000-0000-0000-000000000001', '#dc2626', true),
  ('c1000000-0000-0000-0000-000000000004', 'Engenharia',                          'ENG',  'Engenharia de produto e processo',        'a1000000-0000-0000-0000-000000000001', '#0891b2', true),
  ('c1000000-0000-0000-0000-000000000005', 'Planejamento e Controle da Produção', 'PCP',  'Planejamento e controle da produção',     'a1000000-0000-0000-0000-000000000001', '#ca8a04', true),
  ('c1000000-0000-0000-0000-000000000006', 'Logística',                           'LOG',  'Armazenagem e transporte',                'a1000000-0000-0000-0000-000000000002', '#16a34a', true),
  ('c1000000-0000-0000-0000-000000000007', 'Segurança do Trabalho',               'SST',  'Saúde e segurança ocupacional',           'a1000000-0000-0000-0000-000000000001', '#ea580c', true),
  ('c1000000-0000-0000-0000-000000000008', 'Meio Ambiente',                       'MA',   'Gestão ambiental e sustentabilidade',     'a1000000-0000-0000-0000-000000000001', '#15803d', true),
  ('c1000000-0000-0000-0000-000000000009', 'Financeiro',                          'FIN',  'Finanças, contabilidade e fiscal',        'a1000000-0000-0000-0000-000000000001', '#059669', true),
  ('c1000000-0000-0000-0000-000000000010', 'Controladoria',                       'CTR',  'Controladoria e orçamento',               'a1000000-0000-0000-0000-000000000001', '#0d9488', true),
  ('c1000000-0000-0000-0000-000000000011', 'Recursos Humanos',                    'RH',   'Gestão de pessoas e desenvolvimento',     'a1000000-0000-0000-0000-000000000001', '#db2777', true),
  ('c1000000-0000-0000-0000-000000000012', 'Tecnologia da Informação',            'TI',   'Sistemas, suporte e infraestrutura',      'a1000000-0000-0000-0000-000000000001', '#0ea5e9', true),
  ('c1000000-0000-0000-0000-000000000013', 'Jurídico',                            'JUR',  'Assessoria jurídica e contratos',         'a1000000-0000-0000-0000-000000000001', '#6d28d9', true),
  ('c1000000-0000-0000-0000-000000000014', 'Suprimentos',                         'SUP',  'Compras e suprimentos',                   'a1000000-0000-0000-0000-000000000001', '#b45309', true),
  ('c1000000-0000-0000-0000-000000000015', 'Comercial',                           'COM',  'Vendas e relacionamento com clientes',    'a1000000-0000-0000-0000-000000000001', '#f59e0b', true),
  ('c1000000-0000-0000-0000-000000000016', 'Marketing',                           'MKT',  'Marketing e comunicação',                 'a1000000-0000-0000-0000-000000000001', '#e11d48', true),
  ('c1000000-0000-0000-0000-000000000017', 'Expedição',                           'EXP',  'Expedição e faturamento de carga',        'a1000000-0000-0000-0000-000000000002', '#4f46e5', true),
  ('c1000000-0000-0000-0000-000000000018', 'Assistência Técnica',                 'AT',   'Pós-venda e assistência técnica',         'a1000000-0000-0000-0000-000000000001', '#0369a1', true)
ON CONFLICT (id) DO NOTHING;

-- ── FUNCIONÁRIOS (44) ─────────────────────────────────────────────────
INSERT INTO organograma.funcionarios
  (id, nome_completo, id_cargo, id_setor, id_unidade, cpf,
   contrato_tipo, jornada_trabalho, data_nascimento, data_admissao, cidade, estado, cep, bairro)
VALUES
  -- ── Produção (setor c01) — cadeia completa nível 4→11 ──
  ('d1000000-0000-0000-0000-000000000001', 'Ricardo Alves Monteiro',      'b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000001', 'CLT', 'Integral',     '1978-03-15', '2009-06-01', 'São Paulo', 'SP', '04538-133', 'Pinheiros'),
  ('d1000000-0000-0000-0000-000000000002', 'Fernanda Costa Ribeiro',      'b1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000002', 'CLT', 'Integral',     '1984-07-22', '2013-02-10', 'São Paulo', 'SP', '05422-010', 'Pinheiros'),
  ('d1000000-0000-0000-0000-000000000003', 'Bruno Tadeu Oliveira',        'b1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000003', 'CLT', 'Integral',     '1987-11-08', '2015-04-15', 'São Paulo', 'SP', '03301-000', 'Brás'),
  ('d1000000-0000-0000-0000-000000000004', 'Lucas Pereira Santos',        'b1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000004', 'CLT', 'Integral',     '1990-05-30', '2017-01-09', 'São Paulo', 'SP', '08210-090', 'Canindé'),
  ('d1000000-0000-0000-0000-000000000005', 'Marcos Vinícius Lima',        'b1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000005', 'CLT', 'Integral',     '1992-09-14', '2018-03-22', 'São Paulo', 'SP', '02510-000', 'Santana'),
  ('d1000000-0000-0000-0000-000000000006', 'Juliana Ferreira Souza',      'b1000000-0000-0000-0000-000000000017', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000006', 'CLT', 'Integral',     '1994-02-19', '2019-07-11', 'São Paulo', 'SP', '01310-100', 'Bela Vista'),
  ('d1000000-0000-0000-0000-000000000007', 'Paulo Henrique Souza',        'b1000000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000007', 'CLT', 'Integral',     '1999-06-03', '2021-02-01', 'São Paulo', 'SP', '03026-000', 'Mooca'),
  ('d1000000-0000-0000-0000-000000000008', 'Gabriela Nascimento Torres',  'b1000000-0000-0000-0000-000000000026', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000008', 'CLT', 'Meio Período', '2006-04-21', '2024-02-01', 'São Paulo', 'SP', '03178-000', 'Vila Prudente'),
  -- ── Sub-setor Usinagem (RH: setor Produção c01) ──
  ('d1000000-0000-0000-0000-000000000009', 'Diego Araújo Martins',        'b1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000009', 'CLT', 'Integral',     '1986-04-27', '2014-10-07', 'São Paulo', 'SP', '04041-001', 'Vila Mariana'),
  ('d1000000-0000-0000-0000-000000000010', 'Renata Campos Dias',          'b1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000010', 'CLT', 'Integral',     '1995-01-12', '2020-05-18', 'São Paulo', 'SP', '04062-001', 'Saúde'),
  ('d1000000-0000-0000-0000-000000000011', 'Felipe Andrade Nunes',        'b1000000-0000-0000-0000-000000000025', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000011', 'CLT', 'Integral',     '2000-12-07', '2022-05-15', 'São Paulo', 'SP', '03177-000', 'Vila Prudente'),
  -- ── Financeiro (setor c09) — cadeia 4→10 ──
  ('d1000000-0000-0000-0000-000000000012', 'André Lúcio Barbosa',         'b1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', '90000000012', 'CLT', 'Integral',     '1980-01-28', '2010-09-12', 'São Paulo', 'SP', '05402-000', 'Pinheiros'),
  ('d1000000-0000-0000-0000-000000000013', 'Vanessa Lopes Guimarães',     'b1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', '90000000013', 'CLT', 'Integral',     '1985-10-16', '2013-06-08', 'São Paulo', 'SP', '04552-050', 'Itaim Bibi'),
  ('d1000000-0000-0000-0000-000000000014', 'Carla Menezes Pinto',         'b1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', '90000000014', 'CLT', 'Integral',     '1989-03-05', '2016-01-17', 'São Paulo', 'SP', '04728-000', 'Campo Belo'),
  ('d1000000-0000-0000-0000-000000000015', 'Otávio Ramires Castro',       'b1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', '90000000015', 'CLT', 'Integral',     '1991-08-11', '2017-05-03', 'São Paulo', 'SP', '01415-001', 'Consolação'),
  ('d1000000-0000-0000-0000-000000000016', 'Patrícia Vieira Almeida',     'b1000000-0000-0000-0000-000000000018', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', '90000000016', 'CLT', 'Integral',     '1994-10-25', '2019-03-17', 'São Paulo', 'SP', '04062-002', 'Saúde'),
  ('d1000000-0000-0000-0000-000000000017', 'Bruno Carvalho Nunes',        'b1000000-0000-0000-0000-000000000024', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', '90000000017', 'CLT', 'Integral',     '2000-07-22', '2022-03-06', 'São Paulo', 'SP', '03178-001', 'Vila Prudente'),
  -- ── Tecnologia da Informação (setor c12) — cadeia 4→9 ──
  ('d1000000-0000-0000-0000-000000000018', 'Rafael Teixeira Moura',       'b1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000018', 'PJ',  'Flexível',     '1983-06-09', '2014-11-20', 'São Paulo', 'SP', '05432-001', 'Vila Madalena'),
  ('d1000000-0000-0000-0000-000000000019', 'Isabela Pinto Gomes',         'b1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000019', 'CLT', 'Flexível',     '1988-02-14', '2016-08-30', 'São Paulo', 'SP', '01227-200', 'República'),
  ('d1000000-0000-0000-0000-000000000020', 'Thiago Batista Cruz',         'b1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000020', 'PJ',  'Flexível',     '1990-03-05', '2018-01-22', 'São Paulo', 'SP', '08210-010', 'Belém'),
  ('d1000000-0000-0000-0000-000000000021', 'Mariana Sousa Pinheiro',      'b1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000021', 'CLT', 'Flexível',     '1996-08-04', '2020-09-05', 'São Paulo', 'SP', '04552-001', 'Itaim Bibi'),
  ('d1000000-0000-0000-0000-000000000022', 'Eduardo Ramos Dias',          'b1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000022', 'CLT', 'Flexível',     '1997-12-01', '2021-04-12', 'São Paulo', 'SP', '05409-002', 'Pinheiros'),
  -- ── Sub-setor Infraestrutura (RH: setor TI c12) ──
  ('d1000000-0000-0000-0000-000000000023', 'Tatiane Correia Bastos',      'b1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000023', 'CLT', 'Flexível',     '1989-09-18', '2017-11-23', 'São Paulo', 'SP', '02011-000', 'Santana'),
  ('d1000000-0000-0000-0000-000000000024', 'Gustavo Almeida Rocha',       'b1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', '90000000024', 'CLT', 'Flexível',     '1995-05-19', '2021-07-19', 'São Paulo', 'SP', '02230-000', 'Tucuruvi'),
  -- ── Diretores de Setor (1 por setor restante) ──
  ('d1000000-0000-0000-0000-000000000025', 'Adriana Moraes Pacheco',      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '90000000025', 'CLT', 'Integral',     '1979-04-10', '2011-02-14', 'São Paulo', 'SP', '04101-000', 'Vila Mariana'),
  ('d1000000-0000-0000-0000-000000000026', 'Sérgio Bezerra Lopes',        'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '90000000026', 'CLT', 'Integral',     '1976-08-23', '2010-05-03', 'São Paulo', 'SP', '03102-000', 'Brás'),
  ('d1000000-0000-0000-0000-000000000027', 'Cristina Vasques Aragão',     'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', '90000000027', 'CLT', 'Integral',     '1981-12-02', '2012-09-19', 'São Paulo', 'SP', '05508-000', 'Butantã'),
  ('d1000000-0000-0000-0000-000000000028', 'Rodrigo Mattos Vidal',        'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', '90000000028', 'CLT', 'Integral',     '1982-06-17', '2012-03-05', 'São Paulo', 'SP', '02710-000', 'Casa Verde'),
  ('d1000000-0000-0000-0000-000000000029', 'Daniela Freitas Coelho',      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', '90000000029', 'CLT', 'Integral',     '1980-09-30', '2011-08-01', 'Campinas',  'SP', '13015-001', 'Centro'),
  ('d1000000-0000-0000-0000-000000000030', 'Henrique Salgado Pires',      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', '90000000030', 'CLT', 'Integral',     '1983-02-11', '2013-04-22', 'São Paulo', 'SP', '04262-000', 'Ipiranga'),
  ('d1000000-0000-0000-0000-000000000031', 'Luciana Prado Vasconcelos',   'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', '90000000031', 'CLT', 'Integral',     '1984-11-05', '2014-01-13', 'São Paulo', 'SP', '04301-000', 'Saúde'),
  ('d1000000-0000-0000-0000-000000000032', 'Fábio Antunes Cordeiro',      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', '90000000032', 'CLT', 'Integral',     '1978-07-19', '2010-11-08', 'São Paulo', 'SP', '04552-060', 'Itaim Bibi'),
  ('d1000000-0000-0000-0000-000000000033', 'Simone Galvão Teixeira',      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000001', '90000000033', 'CLT', 'Integral',     '1981-03-28', '2012-06-25', 'São Paulo', 'SP', '04728-001', 'Campo Belo'),
  ('d1000000-0000-0000-0000-000000000034', 'Eduardo Mancini Rosa',        'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000001', '90000000034', 'PJ',  'Flexível',     '1977-10-09', '2011-09-30', 'São Paulo', 'SP', '01310-200', 'Bela Vista'),
  ('d1000000-0000-0000-0000-000000000035', 'Priscila Nogueira Fonseca',   'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000001', '90000000035', 'CLT', 'Integral',     '1982-05-14', '2013-02-18', 'São Paulo', 'SP', '02520-000', 'Santana'),
  ('d1000000-0000-0000-0000-000000000036', 'Alexandre Quintela Barros',   'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000001', '90000000036', 'CLT', 'Integral',     '1979-01-22', '2010-07-12', 'São Paulo', 'SP', '01415-002', 'Consolação'),
  ('d1000000-0000-0000-0000-000000000037', 'Beatriz Sampaio Leal',        'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000001', '90000000037', 'CLT', 'Integral',     '1986-06-30', '2015-03-09', 'São Paulo', 'SP', '05435-000', 'Vila Madalena'),
  ('d1000000-0000-0000-0000-000000000038', 'Wagner Tomaz Brandão',        'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000002', '90000000038', 'CLT', 'Integral',     '1980-12-07', '2011-05-15', 'Campinas',  'SP', '13050-000', 'Botafogo'),
  ('d1000000-0000-0000-0000-000000000039', 'Letícia Furtado Amaral',      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000001', '90000000039', 'CLT', 'Integral',     '1985-08-16', '2014-10-20', 'São Paulo', 'SP', '04094-000', 'Moema'),
  -- ── Gerentes de Setor (5 setores adicionais) ──
  ('d1000000-0000-0000-0000-000000000040', 'Marcelo Pinheiro Goulart',    'b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '90000000040', 'CLT', 'Integral',     '1986-03-12', '2015-07-04', 'São Paulo', 'SP', '03103-000', 'Brás'),
  ('d1000000-0000-0000-0000-000000000041', 'Tânia Regina Bastos',         'b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', '90000000041', 'CLT', 'Integral',     '1987-09-18', '2016-11-23', 'São Paulo', 'SP', '05509-000', 'Butantã'),
  ('d1000000-0000-0000-0000-000000000042', 'Roberto Vargas Mello',        'b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000001', '90000000042', 'CLT', 'Integral',     '1985-04-25', '2015-02-09', 'São Paulo', 'SP', '04729-000', 'Campo Belo'),
  ('d1000000-0000-0000-0000-000000000043', 'Cláudia Renata Lima',         'b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000001', '90000000043', 'CLT', 'Integral',     '1988-07-01', '2017-01-30', 'São Paulo', 'SP', '02521-000', 'Santana'),
  ('d1000000-0000-0000-0000-000000000044', 'Marcos Aurélio Pena',         'b1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000001', '90000000044', 'CLT', 'Integral',     '1984-02-09', '2014-06-16', 'São Paulo', 'SP', '01416-000', 'Consolação'),
  -- ── Topo da hierarquia (Diretoria nivel 0 + Gerência Geral nivel 1) ──
  -- id_setor é obrigatório, mas o import o IGNORA para níveis 0/1.
  ('d1000000-0000-0000-0000-000000000050', 'Helena Vasconcelos Aguiar',   'b1000000-0000-0000-0000-000000000050', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000050', 'CLT', 'Integral',     '1968-05-12', '2005-01-10', 'São Paulo', 'SP', '01310-000', 'Bela Vista'),
  ('d1000000-0000-0000-0000-000000000051', 'Roberto Camargo Sales',       'b1000000-0000-0000-0000-000000000051', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000051', 'CLT', 'Integral',     '1972-09-03', '2007-03-01', 'São Paulo', 'SP', '04538-133', 'Pinheiros')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- PARTE 2 — ORGANOGRAMA VISUAL (organograma.org_nodes)  ⚠️ OPCIONAL (caminho B)
-- ══════════════════════════════════════════════════════════════════════
-- NÃO rode esta parte se for usar "Importar do RH" (caminho A) — geraria
-- Diretoria/Setores duplicados. Use-a só para montar tudo via SQL, aninhado.
-- Estruturais (centro, gerências, setores, sub-setores): funcionario_id = NULL.
-- Pessoas: id = 'rh-<uuid funcionário>', funcionario_id preenchido (idempotente p/ import).
INSERT INTO organograma.org_nodes
  (id, name, role, level, parent_id, is_sector, sector_color, funcionario_id)
VALUES
  -- ── Nível 0 — Diretoria (Diretor do Centro) ──
  ('seed-dir-centro', 'Helena Vasconcelos Aguiar', 'Diretora-Presidente (CEO)', 0, NULL,              false, NULL, NULL),

  -- ── Nível 1 — Gerência Geral ──
  ('seed-gg-ind', 'Roberto Camargo Sales',     'Diretor Industrial',          1, 'seed-dir-centro', false, NULL, NULL),
  ('seed-gg-adm', 'Cláudia Bittencourt Reis',  'Diretora Adm. e Financeira',  1, 'seed-dir-centro', false, NULL, NULL),
  ('seed-gg-com', 'Marcelo Tavares Brito',     'Diretor Comercial',           1, 'seed-dir-centro', false, NULL, NULL),

  -- ── Nível 2 — Setores (is_sector=true) ──
  ('seed-set-01', 'Produção',                            'PROD', 2, 'seed-gg-ind', true, '#2563eb', NULL),
  ('seed-set-02', 'Qualidade',                           'QUAL', 2, 'seed-gg-ind', true, '#7c3aed', NULL),
  ('seed-set-03', 'Manutenção',                          'MNT',  2, 'seed-gg-ind', true, '#dc2626', NULL),
  ('seed-set-04', 'Engenharia',                          'ENG',  2, 'seed-gg-ind', true, '#0891b2', NULL),
  ('seed-set-05', 'Planejamento e Controle da Produção', 'PCP',  2, 'seed-gg-ind', true, '#ca8a04', NULL),
  ('seed-set-06', 'Logística',                           'LOG',  2, 'seed-gg-ind', true, '#16a34a', NULL),
  ('seed-set-07', 'Segurança do Trabalho',               'SST',  2, 'seed-gg-ind', true, '#ea580c', NULL),
  ('seed-set-08', 'Meio Ambiente',                       'MA',   2, 'seed-gg-ind', true, '#15803d', NULL),
  ('seed-set-09', 'Financeiro',                          'FIN',  2, 'seed-gg-adm', true, '#059669', NULL),
  ('seed-set-10', 'Controladoria',                       'CTR',  2, 'seed-gg-adm', true, '#0d9488', NULL),
  ('seed-set-11', 'Recursos Humanos',                    'RH',   2, 'seed-gg-adm', true, '#db2777', NULL),
  ('seed-set-12', 'Tecnologia da Informação',            'TI',   2, 'seed-gg-adm', true, '#0ea5e9', NULL),
  ('seed-set-13', 'Jurídico',                            'JUR',  2, 'seed-gg-adm', true, '#6d28d9', NULL),
  ('seed-set-14', 'Suprimentos',                         'SUP',  2, 'seed-gg-adm', true, '#b45309', NULL),
  ('seed-set-15', 'Comercial',                           'COM',  2, 'seed-gg-com', true, '#f59e0b', NULL),
  ('seed-set-16', 'Marketing',                           'MKT',  2, 'seed-gg-com', true, '#e11d48', NULL),
  ('seed-set-17', 'Expedição',                           'EXP',  2, 'seed-gg-com', true, '#4f46e5', NULL),
  ('seed-set-18', 'Assistência Técnica',                 'AT',   2, 'seed-gg-com', true, '#0369a1', NULL),

  -- ── Nível 3 — Sub-setores (is_sector=true) ──
  ('seed-sub-01', 'Usinagem',       'Sub-setor', 3, 'seed-set-01', true, '#1d4ed8', NULL),
  ('seed-sub-02', 'Infraestrutura', 'Sub-setor', 3, 'seed-set-12', true, '#38bdf8', NULL),

  -- ── Produção — cadeia aninhada nível 4→11 ──
  ('rh-d1000000-0000-0000-0000-000000000001', 'Ricardo Alves Monteiro',     'Diretor de Produção',     4,  'seed-set-01',                                false, NULL, 'd1000000-0000-0000-0000-000000000001'),
  ('rh-d1000000-0000-0000-0000-000000000002', 'Fernanda Costa Ribeiro',     'Gerente de Produção',     5,  'rh-d1000000-0000-0000-0000-000000000001',    false, NULL, 'd1000000-0000-0000-0000-000000000002'),
  ('rh-d1000000-0000-0000-0000-000000000003', 'Bruno Tadeu Oliveira',       'Coordenador de Produção', 6,  'rh-d1000000-0000-0000-0000-000000000002',    false, NULL, 'd1000000-0000-0000-0000-000000000003'),
  ('rh-d1000000-0000-0000-0000-000000000004', 'Lucas Pereira Santos',       'Supervisor de Linha',     7,  'rh-d1000000-0000-0000-0000-000000000003',    false, NULL, 'd1000000-0000-0000-0000-000000000004'),
  ('rh-d1000000-0000-0000-0000-000000000005', 'Marcos Vinícius Lima',       'Líder de Turno',          8,  'rh-d1000000-0000-0000-0000-000000000004',    false, NULL, 'd1000000-0000-0000-0000-000000000005'),
  ('rh-d1000000-0000-0000-0000-000000000006', 'Juliana Ferreira Souza',     'Analista de Processos',   9,  'rh-d1000000-0000-0000-0000-000000000005',    false, NULL, 'd1000000-0000-0000-0000-000000000006'),
  ('rh-d1000000-0000-0000-0000-000000000007', 'Paulo Henrique Souza',       'Auxiliar de Produção',    10, 'rh-d1000000-0000-0000-0000-000000000006',    false, NULL, 'd1000000-0000-0000-0000-000000000007'),
  ('rh-d1000000-0000-0000-0000-000000000008', 'Gabriela Nascimento Torres', 'Aprendiz Industrial',     11, 'rh-d1000000-0000-0000-0000-000000000007',    false, NULL, 'd1000000-0000-0000-0000-000000000008'),
  -- ── Sub-setor Usinagem ──
  ('rh-d1000000-0000-0000-0000-000000000009', 'Diego Araújo Martins',       'Coordenador de Usinagem', 6,  'seed-sub-01',                                false, NULL, 'd1000000-0000-0000-0000-000000000009'),
  ('rh-d1000000-0000-0000-0000-000000000010', 'Renata Campos Dias',         'Analista de Usinagem',    9,  'rh-d1000000-0000-0000-0000-000000000009',    false, NULL, 'd1000000-0000-0000-0000-000000000010'),
  ('rh-d1000000-0000-0000-0000-000000000011', 'Felipe Andrade Nunes',       'Auxiliar de Usinagem',    10, 'rh-d1000000-0000-0000-0000-000000000009',    false, NULL, 'd1000000-0000-0000-0000-000000000011'),

  -- ── Financeiro — cadeia 4→10 ──
  ('rh-d1000000-0000-0000-0000-000000000012', 'André Lúcio Barbosa',        'Diretor Financeiro',       4,  'seed-set-09',                               false, NULL, 'd1000000-0000-0000-0000-000000000012'),
  ('rh-d1000000-0000-0000-0000-000000000013', 'Vanessa Lopes Guimarães',    'Gerente Financeiro',       5,  'rh-d1000000-0000-0000-0000-000000000012',   false, NULL, 'd1000000-0000-0000-0000-000000000013'),
  ('rh-d1000000-0000-0000-0000-000000000014', 'Carla Menezes Pinto',        'Coordenador',              6,  'rh-d1000000-0000-0000-0000-000000000013',   false, NULL, 'd1000000-0000-0000-0000-000000000014'),
  ('rh-d1000000-0000-0000-0000-000000000015', 'Otávio Ramires Castro',      'Supervisor de Tesouraria', 7,  'rh-d1000000-0000-0000-0000-000000000014',   false, NULL, 'd1000000-0000-0000-0000-000000000015'),
  ('rh-d1000000-0000-0000-0000-000000000016', 'Patrícia Vieira Almeida',    'Analista Financeiro',      9,  'rh-d1000000-0000-0000-0000-000000000015',   false, NULL, 'd1000000-0000-0000-0000-000000000016'),
  ('rh-d1000000-0000-0000-0000-000000000017', 'Bruno Carvalho Nunes',       'Assistente Financeiro',    10, 'rh-d1000000-0000-0000-0000-000000000016',   false, NULL, 'd1000000-0000-0000-0000-000000000017'),

  -- ── Tecnologia da Informação — cadeia 4→9 ──
  ('rh-d1000000-0000-0000-0000-000000000018', 'Rafael Teixeira Moura',      'Diretor de TI',            4,  'seed-set-12',                               false, NULL, 'd1000000-0000-0000-0000-000000000018'),
  ('rh-d1000000-0000-0000-0000-000000000019', 'Isabela Pinto Gomes',        'Gerente de TI',            5,  'rh-d1000000-0000-0000-0000-000000000018',   false, NULL, 'd1000000-0000-0000-0000-000000000019'),
  ('rh-d1000000-0000-0000-0000-000000000020', 'Thiago Batista Cruz',        'Coordenador de Sistemas',  6,  'rh-d1000000-0000-0000-0000-000000000019',   false, NULL, 'd1000000-0000-0000-0000-000000000020'),
  ('rh-d1000000-0000-0000-0000-000000000021', 'Mariana Sousa Pinheiro',     'Analista de Sistemas',     9,  'rh-d1000000-0000-0000-0000-000000000020',   false, NULL, 'd1000000-0000-0000-0000-000000000021'),
  ('rh-d1000000-0000-0000-0000-000000000022', 'Eduardo Ramos Dias',         'Analista de Suporte',      9,  'rh-d1000000-0000-0000-0000-000000000020',   false, NULL, 'd1000000-0000-0000-0000-000000000022'),
  -- ── Sub-setor Infraestrutura ──
  ('rh-d1000000-0000-0000-0000-000000000023', 'Tatiane Correia Bastos',     'Coordenador de Infraestrutura', 6, 'seed-sub-02',                          false, NULL, 'd1000000-0000-0000-0000-000000000023'),
  ('rh-d1000000-0000-0000-0000-000000000024', 'Gustavo Almeida Rocha',      'Analista de Infraestrutura',    9, 'rh-d1000000-0000-0000-0000-000000000023', false, NULL, 'd1000000-0000-0000-0000-000000000024'),

  -- ── Diretores de Setor (níveis 4) dos demais setores ──
  ('rh-d1000000-0000-0000-0000-000000000025', 'Adriana Moraes Pacheco',     'Diretor de Setor', 4, 'seed-set-02', false, NULL, 'd1000000-0000-0000-0000-000000000025'),
  ('rh-d1000000-0000-0000-0000-000000000026', 'Sérgio Bezerra Lopes',       'Diretor de Setor', 4, 'seed-set-03', false, NULL, 'd1000000-0000-0000-0000-000000000026'),
  ('rh-d1000000-0000-0000-0000-000000000027', 'Cristina Vasques Aragão',    'Diretor de Setor', 4, 'seed-set-04', false, NULL, 'd1000000-0000-0000-0000-000000000027'),
  ('rh-d1000000-0000-0000-0000-000000000028', 'Rodrigo Mattos Vidal',       'Diretor de Setor', 4, 'seed-set-05', false, NULL, 'd1000000-0000-0000-0000-000000000028'),
  ('rh-d1000000-0000-0000-0000-000000000029', 'Daniela Freitas Coelho',     'Diretor de Setor', 4, 'seed-set-06', false, NULL, 'd1000000-0000-0000-0000-000000000029'),
  ('rh-d1000000-0000-0000-0000-000000000030', 'Henrique Salgado Pires',     'Diretor de Setor', 4, 'seed-set-07', false, NULL, 'd1000000-0000-0000-0000-000000000030'),
  ('rh-d1000000-0000-0000-0000-000000000031', 'Luciana Prado Vasconcelos',  'Diretor de Setor', 4, 'seed-set-08', false, NULL, 'd1000000-0000-0000-0000-000000000031'),
  ('rh-d1000000-0000-0000-0000-000000000032', 'Fábio Antunes Cordeiro',     'Diretor de Setor', 4, 'seed-set-10', false, NULL, 'd1000000-0000-0000-0000-000000000032'),
  ('rh-d1000000-0000-0000-0000-000000000033', 'Simone Galvão Teixeira',     'Diretor de Setor', 4, 'seed-set-11', false, NULL, 'd1000000-0000-0000-0000-000000000033'),
  ('rh-d1000000-0000-0000-0000-000000000034', 'Eduardo Mancini Rosa',       'Diretor de Setor', 4, 'seed-set-13', false, NULL, 'd1000000-0000-0000-0000-000000000034'),
  ('rh-d1000000-0000-0000-0000-000000000035', 'Priscila Nogueira Fonseca',  'Diretor de Setor', 4, 'seed-set-14', false, NULL, 'd1000000-0000-0000-0000-000000000035'),
  ('rh-d1000000-0000-0000-0000-000000000036', 'Alexandre Quintela Barros',  'Diretor de Setor', 4, 'seed-set-15', false, NULL, 'd1000000-0000-0000-0000-000000000036'),
  ('rh-d1000000-0000-0000-0000-000000000037', 'Beatriz Sampaio Leal',       'Diretor de Setor', 4, 'seed-set-16', false, NULL, 'd1000000-0000-0000-0000-000000000037'),
  ('rh-d1000000-0000-0000-0000-000000000038', 'Wagner Tomaz Brandão',       'Diretor de Setor', 4, 'seed-set-17', false, NULL, 'd1000000-0000-0000-0000-000000000038'),
  ('rh-d1000000-0000-0000-0000-000000000039', 'Letícia Furtado Amaral',     'Diretor de Setor', 4, 'seed-set-18', false, NULL, 'd1000000-0000-0000-0000-000000000039'),

  -- ── Gerentes de Setor (nível 5) em 5 setores ──
  ('rh-d1000000-0000-0000-0000-000000000040', 'Marcelo Pinheiro Goulart',   'Gerente de Setor', 5, 'rh-d1000000-0000-0000-0000-000000000026', false, NULL, 'd1000000-0000-0000-0000-000000000040'),
  ('rh-d1000000-0000-0000-0000-000000000041', 'Tânia Regina Bastos',        'Gerente de Setor', 5, 'rh-d1000000-0000-0000-0000-000000000027', false, NULL, 'd1000000-0000-0000-0000-000000000041'),
  ('rh-d1000000-0000-0000-0000-000000000042', 'Roberto Vargas Mello',       'Gerente de Setor', 5, 'rh-d1000000-0000-0000-0000-000000000033', false, NULL, 'd1000000-0000-0000-0000-000000000042'),
  ('rh-d1000000-0000-0000-0000-000000000043', 'Cláudia Renata Lima',        'Gerente de Setor', 5, 'rh-d1000000-0000-0000-0000-000000000035', false, NULL, 'd1000000-0000-0000-0000-000000000043'),
  ('rh-d1000000-0000-0000-0000-000000000044', 'Marcos Aurélio Pena',        'Gerente de Setor', 5, 'rh-d1000000-0000-0000-0000-000000000036', false, NULL, 'd1000000-0000-0000-0000-000000000044')
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  role           = EXCLUDED.role,
  level          = EXCLUDED.level,
  parent_id      = EXCLUDED.parent_id,
  is_sector      = EXCLUDED.is_sector,
  sector_color   = EXCLUDED.sector_color,
  funcionario_id = EXCLUDED.funcionario_id;

COMMIT;

-- ── Conferência rápida (opcional) ─────────────────────────────────────
-- SELECT level, count(*) FROM organograma.org_nodes GROUP BY level ORDER BY level;
-- SELECT count(*) AS funcionarios FROM organograma.funcionarios;
