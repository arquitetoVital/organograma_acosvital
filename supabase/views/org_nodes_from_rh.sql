-- ── VIEW: Monta org_nodes a partir do RH (funcionarios, cargos, setores) ──
-- Sem necessidade de rodar a função TypeScript importFromFuncionarios
-- Esta view é VIRTUAL: não persiste dados, apenas transforma em tempo real

CREATE OR REPLACE VIEW organograma.org_nodes_from_rh AS

WITH cargos_data AS (
  -- Cache dos cargos para evitar múltiplos joins
  SELECT id, nome, nivel FROM organograma.cargos
),

diretores_ranked AS (
  -- Identifica o 1º diretor (nivel 0) — será a raiz
  -- Outros diretores serão rebaixados para Diretor de Setor (nivel 4)
  SELECT
    f.id,
    ROW_NUMBER() OVER (ORDER BY f.id) as director_rank
  FROM organograma.funcionarios f
  JOIN cargos_data c ON f.id_cargo = c.id
  WHERE c.nivel = 0
),

primary_director AS (
  -- ID do diretor primário (para usar como pai da Gerência Geral)
  SELECT id FROM diretores_ranked WHERE director_rank = 1 LIMIT 1
),

gm_unique AS (
  -- Gerente Geral único (se houver 1, setores ficam sob ele; senão, sob o diretor)
  SELECT f.id
  FROM organograma.funcionarios f
  JOIN cargos_data c ON f.id_cargo = c.id
  WHERE c.nivel = 1
  LIMIT 1
),

-- ── NÓS DE PESSOAS ──
pessoas_nodes AS (
  SELECT
    'rh-' || f.id::text as id,
    f.nome_completo as name,
    c.nome as role,
    -- Ajusta nível: diretores extras viram Diretor de Setor (4)
    CASE
      WHEN c.nivel = 0 AND d.director_rank = 1 THEN 0       -- Diretor principal
      WHEN c.nivel = 0 AND d.director_rank > 1 THEN 4       -- Diretor secundário → Diretor de Setor
      ELSE GREATEST(0, LEAST(11, c.nivel))                   -- Clamp nivel entre 0-11
    END as level,
    -- Define pai (parentId)
    CASE
      WHEN c.nivel = 0 AND d.director_rank = 1 THEN NULL     -- Diretor principal é raiz
      WHEN c.nivel = 0 AND d.director_rank > 1 THEN 'sec-' || f.id_setor::text  -- Dir. sec. → setor
      WHEN c.nivel = 1 THEN
        CASE
          WHEN (SELECT id FROM primary_director) IS NOT NULL
          THEN 'rh-' || (SELECT id::text FROM primary_director)
          ELSE NULL
        END                                                    -- Gerência Geral → Diretoria
      ELSE 'sec-' || f.id_setor::text                        -- Pessoa → setor
    END as parent_id,
    false as is_sector,
    f.foto_url as photo_url,
    NULL::text as sector_color,
    f.id as funcionario_id
  FROM organograma.funcionarios f
  JOIN cargos_data c ON f.id_cargo = c.id
  LEFT JOIN diretores_ranked d ON f.id = d.id
),

-- ── NÓS DE SETORES ──
setores_nodes AS (
  SELECT
    'sec-' || s.id::text as id,
    s.nome as name,
    COALESCE(s.sigla, '') as role,
    s.nivel as level,
    -- Sub-setor aponta para o setor pai via setores.parent_id;
    -- setor raiz fica sob a Gerência Geral (se existir) ou direto sob Diretoria
    CASE
      WHEN s.parent_id IS NOT NULL THEN 'sec-' || s.parent_id::text
      ELSE COALESCE(
        'rh-' || (SELECT id::text FROM gm_unique),
        'rh-' || (SELECT id::text FROM primary_director)
      )
    END as parent_id,
    true as is_sector,
    NULL::text as photo_url,
    s.cor as sector_color,
    NULL::uuid as funcionario_id
  FROM organograma.setores s
)

-- ── RESULTADO FINAL: Pessoas + Setores ──
SELECT * FROM pessoas_nodes
UNION ALL
SELECT * FROM setores_nodes
ORDER BY level, is_sector DESC, name;
