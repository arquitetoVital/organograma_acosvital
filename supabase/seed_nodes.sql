-- ============================================================
-- seed_nodes.sql — Estrutura inicial do organograma
-- Execute APÓS o schema.sql.
-- Seguro de re-executar (ON CONFLICT DO NOTHING).
-- ============================================================

INSERT INTO public.org_nodes (id, name, role, level, parent_id, is_sector, photo_url, sector_color)
VALUES
  -- Diretoria
  ('dir',        'Joanes Oliveira de Souza e Amanda Vital',
   'Diretoria', 0, NULL, false,
   'https://iaczridaljcdtnthoece.supabase.co/storage/v1/object/public/public-assets/Diretoria/Joanes&Amanda2.webp',
   NULL),

  -- Gerências Gerais
  ('gg1', '', 'Gerente Geral de Operações',                      1, 'dir', false, NULL, NULL),
  ('gg2', '', 'Gerente Geral de Suprimentos e Logística',        1, 'dir', false, NULL, NULL),
  ('gg3', 'Euveraldo Oliveira de Souza', 'Gerente Geral Comercial', 1, 'dir', false, NULL, NULL),
  ('gg4', '', 'Gerente Geral Financeiro e Administrativo',       1, 'dir', false, NULL, NULL),
  ('gg5', '', 'Gerente Geral de Pessoas e Suporte',              1, 'dir', false, NULL, NULL),

  -- Setores — GG1 (Operações)
  ('sector-prd', 'Produção',             'Setor', 2, 'gg1', true, NULL, '#f87171'),
  ('sector-qld', 'Qualidade',            'Setor', 2, 'gg1', true, NULL, '#fb923c'),
  ('sector-mnt', 'Manutenção Industrial','Setor', 2, 'gg1', true, NULL, '#fbbf24'),
  ('sector-eng', 'Engenharia',           'Setor', 2, 'gg1', true, NULL, '#a3e635'),

  -- Setores — GG2 (Suprimentos e Logística)
  ('sector-log', 'Logística',    'Setor', 2, 'gg2', true, NULL, '#34d399'),
  ('sector-alm', 'Almoxarifado', 'Setor', 2, 'gg2', true, NULL, '#22d3ee'),
  ('sector-cmp', 'Compras',      'Setor', 2, 'gg2', true, NULL, '#60a5fa'),
  ('sector-exp', 'Expedição',    'Setor', 2, 'gg2', true, NULL, '#818cf8'),

  -- Setores — GG3 (Comercial)
  ('sector-vdi', 'Vendas Internas', 'Setor', 2, 'gg3', true, NULL, '#c084fc'),
  ('sector-vde', 'Vendas Externas', 'Setor', 2, 'gg3', true, NULL, '#f472b6'),
  ('sector-mkt', 'Marketing',       'Setor', 2, 'gg3', true, NULL, '#fb7185'),
  ('sector-psv', 'Pós-Venda',       'Setor', 2, 'gg3', true, NULL, '#4ade80'),

  -- Setores — GG4 (Financeiro e Administrativo)
  ('sector-fin', 'Financeiro',    'Setor', 2, 'gg4', true, NULL, '#2dd4bf'),
  ('sector-cob', 'Contabilidade', 'Setor', 2, 'gg4', true, NULL, '#38bdf8'),
  ('sector-fat', 'Faturamento',   'Setor', 2, 'gg4', true, NULL, '#a78bfa'),

  -- Setores — GG5 (Pessoas e Suporte)
  ('sector-rh',  'Recursos Humanos',         'Setor', 2, 'gg5', true, NULL, '#e879f9'),
  ('sector-ti',  'Tecnologia da Informação', 'Setor', 2, 'gg5', true, NULL, '#facc15'),
  ('sector-sst', 'Segurança do Trabalho',    'Setor', 2, 'gg5', true, NULL, '#86efac')

ON CONFLICT (id) DO NOTHING;

-- Verificação
SELECT level, COUNT(*) AS total FROM public.org_nodes GROUP BY level ORDER BY level;
