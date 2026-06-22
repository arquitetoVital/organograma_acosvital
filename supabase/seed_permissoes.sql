-- ============================================================
-- seed_permissoes.sql
-- Execute UMA VEZ no SQL Editor do Supabase depois do schema.sql.
-- Corrige usuários que existiam antes do trigger on_profile_created.
-- ============================================================

-- 1. Garante que todos os profiles existentes tenham uma linha
--    em user_permissoes (padrão: viewer).
INSERT INTO organograma.user_permissoes (user_id, role)
SELECT id, 'viewer'
FROM   organograma.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 2. Promove a Sara para admin.
--    (Ela já tem profile — só atualiza o role.)
UPDATE organograma.user_permissoes
SET    role = 'admin',
       updated_at = now()
WHERE  user_id = (
  SELECT id FROM organograma.profiles
  WHERE  email = 'sara.bertolani@acosvital.com.br'
  LIMIT  1
);

-- 3. Quando você criar o usuário organograma@acosvital.com.br
--    pelo painel do Supabase (Authentication → Users → Add user),
--    o trigger vai criar o profile e a permissão 'viewer' automaticamente.
--    Nenhum SQL extra necessário para esse usuário.

-- Verificação: mostra o estado atual das permissões.
SELECT
  p.email,
  p.nome_completo,
  up.role,
  up.ativo
FROM organograma.profiles p
JOIN organograma.user_permissoes up ON up.user_id = p.id
ORDER BY p.email;
