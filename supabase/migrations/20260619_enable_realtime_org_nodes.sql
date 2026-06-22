-- Habilita Realtime (CDC) na tabela org_nodes do schema organograma.
-- Sem isso o Supabase Realtime só observa tabelas do schema "public".
ALTER PUBLICATION supabase_realtime ADD TABLE organograma.org_nodes;
