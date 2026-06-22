-- ============================================================
-- Migration: adiciona coluna sector_director_of em org_nodes
--
-- Permite associar uma diretoria (level 0) a um setor específico.
-- Quando preenchida, o nó não aparece no centro do organograma
-- geral, mas sim dentro do detalhe do setor, posicionado acima
-- do gerente de setor (anel 1, r=150).
-- ============================================================

ALTER TABLE organograma.org_nodes
  ADD COLUMN IF NOT EXISTS sector_director_of text
    REFERENCES organograma.org_nodes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_nodes_sector_director_of
  ON organograma.org_nodes (sector_director_of);
