-- ============================================================
-- ESTRUTURA DO ORGANOGRAMA — níveis 0 a 3 + reencaixe das pessoas
-- Execute no Supabase SQL Editor.
--
-- Use este script DEPOIS de já ter:
--   1) rodado a massa de RH (unidades/cargos/setores/funcionarios), e
--   2) clicado em "Importar do RH" (que criou as 44 pessoas órfãs).
--
-- O que ele faz:
--   • Cria Diretoria (nível 0), Gerência Geral (1), 18 Setores (2),
--     2 Sub-setores (3)  →  os níveis que o import NÃO cria.
--   • Atualiza (ON CONFLICT DO UPDATE) as 44 pessoas já importadas
--     (id = 'rh-<uuid>') reencaixando-as na árvore: diretor→gerente→…
--
-- ⚠️  Depois de rodar isto, NÃO clique de novo em "Importar do RH":
--     o import resolve o pai pelo NOME do setor e achataria as pessoas
--     direto sob o setor (perdendo o aninhamento). Os níveis se mantêm.
-- ============================================================

BEGIN;

INSERT INTO organograma.org_nodes
  (id, name, role, level, parent_id, is_sector, sector_color, funcionario_id)
VALUES
  -- ── Nível 0 — Diretoria (Diretor Central / CEO) ──
  ('seed-dir-centro', 'Helena Vasconcelos Aguiar', 'Diretora-Presidente (CEO)', 0, NULL,              false, NULL, NULL),

  -- ── Nível 1 — Gerência Geral ──
  ('seed-gg-ind', 'Roberto Camargo Sales',     'Diretor Industrial',          1, 'seed-dir-centro', false, NULL, NULL),
  ('seed-gg-adm', 'Cláudia Bittencourt Reis',  'Diretora Adm. e Financeira',  1, 'seed-dir-centro', false, NULL, NULL),
  ('seed-gg-com', 'Marcelo Tavares Brito',     'Diretor Comercial',           1, 'seed-dir-centro', false, NULL, NULL),

  -- ── Nível 2 — Setores (is_sector=true; nome IDÊNTICO ao da tabela setores) ──
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

  -- ── Diretores de Setor (nível 4) dos demais setores ──
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

-- ── Conferência ───────────────────────────────────────────────────────
-- SELECT level, count(*) FROM organograma.org_nodes GROUP BY level ORDER BY level;
-- Esperado: 0→1 | 1→3 | 2→18 | 3→2 | 4→18 | 5→8 | 6→5 | 7→2 | 8→1 | 9→6 | 10→3 | 11→1
-- SELECT count(*) FROM organograma.org_nodes WHERE parent_id IS NULL;  -- deve ser 1 (só a Diretoria)
