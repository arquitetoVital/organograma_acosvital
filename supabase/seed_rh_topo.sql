-- ============================================================
-- TOPO DA HIERARQUIA NO RH — Diretor Central (nivel 0) + Gerência Geral (nivel 1)
-- Execute no Supabase SQL Editor e depois clique em "Importar do RH".
--
-- Use junto com o import atualizado (importFromFuncionarios), que monta o
-- organograma pelo nível do cargo:
--   nivel 0 → Diretoria (raiz) | nivel 1 → Gerência Geral | setores → nível 2
--   nivel 4–11 → pessoas sob seus setores.
--
-- Os funcionários abaixo precisam de id_setor (coluna NOT NULL), mas o import
-- IGNORA o setor para níveis 0/1 — eles são posicionados como Diretoria/GG.
-- ============================================================

BEGIN;

-- (Opcional, recomendado) Se você já rodou algum SQL manual de org_nodes antes,
-- limpe o organograma visual para o import reconstruir tudo do zero, sem duplicar.
-- O import recria os nós a partir do RH. Descomente:
-- DELETE FROM organograma.org_nodes;

INSERT INTO organograma.cargos (id, nome, nivel, descricao, ativo) VALUES
  ('b1000000-0000-0000-0000-000000000050', 'Diretor-Presidente', 0, 'Direção central / CEO',          true),
  ('b1000000-0000-0000-0000-000000000051', 'Diretor Geral',      1, 'Gerência geral da organização',  true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organograma.funcionarios
  (id, nome_completo, id_cargo, id_setor, id_unidade, cpf,
   contrato_tipo, jornada_trabalho, data_nascimento, data_admissao, cidade, estado, cep, bairro)
VALUES
  ('d1000000-0000-0000-0000-000000000050', 'Helena Vasconcelos Aguiar', 'b1000000-0000-0000-0000-000000000050', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000050', 'CLT', 'Integral', '1968-05-12', '2005-01-10', 'São Paulo', 'SP', '01310-000', 'Bela Vista'),
  ('d1000000-0000-0000-0000-000000000051', 'Roberto Camargo Sales',     'b1000000-0000-0000-0000-000000000051', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000051', 'CLT', 'Integral', '1972-09-03', '2007-03-01', 'São Paulo', 'SP', '04538-133', 'Pinheiros')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Depois de rodar isto: clique em "Importar do RH".
-- Resultado esperado no toast: ~20 criados (18 setores + Diretoria + GG),
-- 44 atualizados (as pessoas reencaixadas nos setores), 0 sem setor.
