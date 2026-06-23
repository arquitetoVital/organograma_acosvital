-- ============================================================
-- Migration: refactor_levels
--
-- 1. Extends level constraint from 10 to 11 (new Aprendiz slot)
-- 2. Normalises sub-sectors to level 3
-- 3. Converts sectorDirectorOf links → level-4 parent nodes
-- 4. Shifts all existing person levels +2 (old 3→5 … old 9→11)
-- 5. Adds funcionario_id column for HR import
-- ============================================================

-- 1. Extend level constraint from 10 to 11
ALTER TABLE organograma.org_nodes DROP CONSTRAINT IF EXISTS org_nodes_level_check;
ALTER TABLE organograma.org_nodes DROP CONSTRAINT IF EXISTS ck_org_nodes_level;
ALTER TABLE organograma.org_nodes ADD CONSTRAINT ck_org_nodes_level CHECK (level >= 0 AND level <= 11);

-- 2. Migrate existing sub-sectors (level > 3 AND is_sector = TRUE) → level 3
UPDATE organograma.org_nodes SET level = 3 WHERE is_sector = TRUE AND level > 3;

-- 3. Migrate existing sectorDirectorOf links:
--    Find all nodes where sector_director_of IS NOT NULL
--    For each: set level=4, parent_id=sector_director_of value, clear sector_director_of
UPDATE organograma.org_nodes
SET level = 4, parent_id = sector_director_of, sector_director_of = NULL
WHERE sector_director_of IS NOT NULL;

-- 4. Migrate existing people levels (3→5, 4→6, 5→7, 6→8, 7→9, 8→10, 9→11)
--    Only non-sector nodes with level >= 3
--    Do in reverse order to avoid conflicts:
UPDATE organograma.org_nodes SET level = 11 WHERE is_sector = FALSE AND level = 9;
UPDATE organograma.org_nodes SET level = 10 WHERE is_sector = FALSE AND level = 8;
UPDATE organograma.org_nodes SET level = 9  WHERE is_sector = FALSE AND level = 7;
UPDATE organograma.org_nodes SET level = 8  WHERE is_sector = FALSE AND level = 6;
UPDATE organograma.org_nodes SET level = 7  WHERE is_sector = FALSE AND level = 5;
UPDATE organograma.org_nodes SET level = 6  WHERE is_sector = FALSE AND level = 4;
UPDATE organograma.org_nodes SET level = 5  WHERE is_sector = FALSE AND level = 3;

-- 5. Add funcionario_id column (optional link to HR data)
ALTER TABLE organograma.org_nodes
  ADD COLUMN IF NOT EXISTS funcionario_id uuid
    REFERENCES organograma.funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_nodes_funcionario_id
  ON organograma.org_nodes (funcionario_id);
