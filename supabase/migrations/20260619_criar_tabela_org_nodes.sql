-- ============================================================
-- Migration: criação da tabela organograma.org_nodes
-- Nós do organograma (estrutura hierárquica visual).
--
-- ATENÇÃO: antes de executar, certifique-se de que o schema
-- 'organograma' já existe (rode schema.sql primeiro se necessário).
--
-- ATENÇÃO: após executar, adicione 'organograma' em:
--   Supabase Dashboard → Settings → API → Extra Search Path
-- ============================================================

CREATE TABLE IF NOT EXISTS organograma.org_nodes (
  id           text    NOT NULL,
  name         text    NOT NULL DEFAULT '',
  role         text    NOT NULL DEFAULT '',
  level        integer NOT NULL,
  parent_id    text,
  is_sector    boolean NOT NULL DEFAULT false,
  photo_url    text,
  sector_color text,
  CONSTRAINT pk_org_nodes PRIMARY KEY (id),
  CONSTRAINT ck_org_nodes_level CHECK (level >= 0 AND level <= 10),
  CONSTRAINT ck_org_nodes_color CHECK (
    sector_color IS NULL OR sector_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

ALTER TABLE organograma.org_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_nodes: autenticado lê"  ON organograma.org_nodes;
DROP POLICY IF EXISTS "org_nodes: editor insere"   ON organograma.org_nodes;
DROP POLICY IF EXISTS "org_nodes: editor atualiza" ON organograma.org_nodes;
DROP POLICY IF EXISTS "org_nodes: editor deleta"   ON organograma.org_nodes;

CREATE POLICY "org_nodes: autenticado lê"
  ON organograma.org_nodes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "org_nodes: editor insere"
  ON organograma.org_nodes FOR INSERT
  WITH CHECK (organograma.is_editor());

CREATE POLICY "org_nodes: editor atualiza"
  ON organograma.org_nodes FOR UPDATE
  USING (organograma.is_editor());

CREATE POLICY "org_nodes: editor deleta"
  ON organograma.org_nodes FOR DELETE
  USING (organograma.is_editor());

-- Já coberto pelo GRANT geral do schema.sql, mas explícito por clareza
GRANT SELECT, INSERT, UPDATE, DELETE ON organograma.org_nodes TO authenticated;
GRANT ALL ON organograma.org_nodes TO service_role;

CREATE INDEX IF NOT EXISTS idx_org_nodes_parent_id ON organograma.org_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_nodes_level     ON organograma.org_nodes(level);

-- Se a tabela já existia em public.org_nodes, migre os dados e remova:
-- INSERT INTO organograma.org_nodes SELECT * FROM public.org_nodes ON CONFLICT DO NOTHING;
-- DROP TABLE IF EXISTS public.org_nodes;
