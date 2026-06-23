-- ============================================================
-- Organograma — Supabase Schema (idempotente)
-- Pode ser executado múltiplas vezes sem erros.
-- ============================================================

-- 1. Schema
CREATE SCHEMA IF NOT EXISTS organograma;

GRANT USAGE ON SCHEMA organograma TO authenticated;
GRANT USAGE ON SCHEMA organograma TO service_role;

-- ============================================================
-- HELPER: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION organograma.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: profiles
-- Criada automaticamente ao registrar um usuário no Supabase Auth.
-- É o perfil da pessoa dentro da plataforma (nome, avatar etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS organograma.profiles (
  id            uuid                     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email         character varying(255),
  nome_completo character varying(255),
  avatar_url    text,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pk_profiles PRIMARY KEY (id)
) TABLESPACE pg_default;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON organograma.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON organograma.profiles
  FOR EACH ROW EXECUTE FUNCTION organograma.set_updated_at();

-- ============================================================
-- TABLE: user_permissoes
-- Vinculada 1-para-1 com profiles.
--
-- profiles   = QUEM é a pessoa (nome, avatar, e-mail)
-- user_permissoes = O QUE ela pode fazer no sistema
--
-- Roles disponíveis:
--   admin  → acesso total: painel admin, cadastro/edição de funcionários,
--            gerenciamento de usuários
--   editor → pode editar dados de funcionários, mas não gerencia usuários
--   viewer → só visualiza o organograma; não vê o botão de administração
--
-- Todo novo usuário começa como 'viewer'. O admin promove manualmente.
-- ============================================================
CREATE TABLE IF NOT EXISTS organograma.user_permissoes (
  id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  -- FK para profiles (não direto para auth.users):
  -- garante que só usuários com perfil ativo na plataforma têm permissão.
  user_id     uuid                     NOT NULL REFERENCES organograma.profiles(id) ON DELETE CASCADE,
  role        character varying(20)    NOT NULL DEFAULT 'viewer',
  ativo       boolean                  NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  created_by  uuid                     REFERENCES auth.users(id),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_by  uuid                     REFERENCES auth.users(id),
  CONSTRAINT pk_user_permissoes PRIMARY KEY (id),
  CONSTRAINT uq_user_permissoes_user UNIQUE (user_id),
  CONSTRAINT ck_user_permissoes_role CHECK (
    role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])
  )
) TABLESPACE pg_default;

DROP TRIGGER IF EXISTS trg_user_permissoes_updated_at ON organograma.user_permissoes;
CREATE TRIGGER trg_user_permissoes_updated_at
  BEFORE UPDATE ON organograma.user_permissoes
  FOR EACH ROW EXECUTE FUNCTION organograma.set_updated_at();

-- ============================================================
-- TABLE: unidades
-- ============================================================
CREATE TABLE IF NOT EXISTS organograma.unidades (
  id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  nome        character varying(100)   NOT NULL,
  descricao   text,
  ativo       boolean                  NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  created_by  uuid                     REFERENCES auth.users(id),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_by  uuid                     REFERENCES auth.users(id),
  deleted_at  timestamp with time zone,
  deleted_by  uuid                     REFERENCES auth.users(id),
  CONSTRAINT pk_unidades PRIMARY KEY (id),
  CONSTRAINT uq_unidades_nome UNIQUE (nome)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_unidades_deleted_at ON organograma.unidades (deleted_at) WHERE (deleted_at IS NULL);

DROP TRIGGER IF EXISTS trg_unidades_updated_at ON organograma.unidades;
CREATE TRIGGER trg_unidades_updated_at
  BEFORE UPDATE ON organograma.unidades
  FOR EACH ROW EXECUTE FUNCTION organograma.set_updated_at();

-- ============================================================
-- TABLE: cargos
-- ============================================================
CREATE TABLE IF NOT EXISTS organograma.cargos (
  id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  nome        character varying(100)   NOT NULL,
  nivel       integer                  NOT NULL DEFAULT 1,
  descricao   text,
  ativo       boolean                  NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  created_by  uuid                     REFERENCES auth.users(id),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_by  uuid                     REFERENCES auth.users(id),
  deleted_at  timestamp with time zone,
  deleted_by  uuid                     REFERENCES auth.users(id),
  CONSTRAINT pk_cargos PRIMARY KEY (id),
  CONSTRAINT uq_cargos_nome UNIQUE (nome),
  CONSTRAINT ck_cargos_nivel CHECK (nivel >= 0)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cargos_deleted_at ON organograma.cargos (deleted_at) WHERE (deleted_at IS NULL);

DROP TRIGGER IF EXISTS trg_cargos_updated_at ON organograma.cargos;
CREATE TRIGGER trg_cargos_updated_at
  BEFORE UPDATE ON organograma.cargos
  FOR EACH ROW EXECUTE FUNCTION organograma.set_updated_at();

-- ============================================================
-- TABLE: setores
-- ============================================================
CREATE TABLE IF NOT EXISTS organograma.setores (
  id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  nome        character varying(100)   NOT NULL,
  sigla       character varying(10),
  descricao   text,
  id_unidade  uuid                     REFERENCES organograma.unidades(id),
  cor         character varying(7),
  ativo       boolean                  NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  created_by  uuid                     REFERENCES auth.users(id),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_by  uuid                     REFERENCES auth.users(id),
  deleted_at  timestamp with time zone,
  deleted_by  uuid                     REFERENCES auth.users(id),
  CONSTRAINT pk_setores PRIMARY KEY (id),
  CONSTRAINT uq_setores_nome_unidade UNIQUE (nome, id_unidade),
  CONSTRAINT ck_setores_cor CHECK (
    cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$'
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_setores_id_unidade  ON organograma.setores (id_unidade);
CREATE INDEX IF NOT EXISTS idx_setores_deleted_at   ON organograma.setores (deleted_at) WHERE (deleted_at IS NULL);

DROP TRIGGER IF EXISTS trg_setores_updated_at ON organograma.setores;
CREATE TRIGGER trg_setores_updated_at
  BEFORE UPDATE ON organograma.setores
  FOR EACH ROW EXECUTE FUNCTION organograma.set_updated_at();

-- ============================================================
-- TABLE: funcionarios
-- Nota: id_cargo / id_setor / id_unidade são referências
-- sem FK declarada (apenas índices) para permitir flexibilidade
-- de cadastro independente.
-- ============================================================
CREATE TABLE IF NOT EXISTS organograma.funcionarios (
  id                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  nome_completo     character varying(255)   NOT NULL,
  id_cargo          uuid                     NOT NULL,
  id_setor          uuid                     NOT NULL,
  id_unidade        uuid                     NOT NULL,
  cpf               character varying(11),
  rg                character varying(20),
  cnpj              character varying(18),
  contrato_tipo     character varying(20),
  jornada_trabalho  character varying(20),
  data_nascimento   date,
  data_admissao     date,
  data_desligamento date,
  telefone          character varying(20),
  celular           character varying(20),
  homepage          character varying(100),
  logradouro        character varying(100),
  numero            character varying(10),
  complemento       character varying(255),
  bairro            character varying(100),
  cidade            character varying(100),
  estado            character(2),
  cep               character varying(9),
  foto_url          text,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  created_by        uuid                     REFERENCES auth.users(id),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_by        uuid                     REFERENCES auth.users(id),
  deleted_at        timestamp with time zone,
  deleted_by        uuid                     REFERENCES auth.users(id),
  CONSTRAINT pk_funcionarios PRIMARY KEY (id),
  CONSTRAINT uq_funcionarios_cpf UNIQUE (cpf),
  CONSTRAINT uq_funcionarios_rg  UNIQUE (rg),
  CONSTRAINT ck_funcionarios_datas CHECK (
    (data_desligamento IS NULL)
    OR (data_admissao IS NULL)
    OR (data_desligamento >= data_admissao)
  ),
  CONSTRAINT ck_funcionarios_cep CHECK (
    cep IS NULL OR (cep)::text ~ '^\d{5}-?\d{3}$'
  ),
  CONSTRAINT ck_funcionarios_jornada_trabalho CHECK (
    (jornada_trabalho IS NULL)
    OR (jornada_trabalho)::text = ANY (
      ARRAY['Integral'::text, 'Meio Período'::text, 'Flexível'::text]
    )
  ),
  CONSTRAINT ck_funcionarios_estado CHECK (
    estado IS NULL OR estado ~ '^[A-Z]{2}$'
  ),
  CONSTRAINT ck_funcionarios_contrato_tipo CHECK (
    (contrato_tipo IS NULL)
    OR (contrato_tipo)::text = ANY (
      ARRAY['CLT'::text, 'PJ'::text, 'Freelancer'::text]
    )
  ),
  CONSTRAINT ck_funcionarios_cpf CHECK (
    cpf IS NULL OR (cpf)::text ~ '^[0-9]{11}$'
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_funcionarios_id_cargo    ON organograma.funcionarios (id_cargo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_id_setor    ON organograma.funcionarios (id_setor);
CREATE INDEX IF NOT EXISTS idx_funcionarios_id_unidade  ON organograma.funcionarios (id_unidade);
CREATE INDEX IF NOT EXISTS idx_funcionarios_deleted_at  ON organograma.funcionarios (deleted_at) WHERE (deleted_at IS NULL);

DROP TRIGGER IF EXISTS trg_funcionarios_updated_at ON organograma.funcionarios;
CREATE TRIGGER trg_funcionarios_updated_at
  BEFORE UPDATE ON organograma.funcionarios
  FOR EACH ROW EXECUTE FUNCTION organograma.set_updated_at();

-- ============================================================
-- TRIGGER: cria profile ao registrar usuário no Supabase Auth
-- ============================================================
CREATE OR REPLACE FUNCTION organograma.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = organograma, public AS $$
BEGIN
  INSERT INTO organograma.profiles (id, email, nome_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION organograma.handle_new_user();

-- ============================================================
-- TRIGGER: cria permissão 'viewer' ao criar um profile
-- Fluxo completo: auth.users INSERT
--   → handle_new_user  → cria profiles
--   → handle_new_profile → cria user_permissoes (role='viewer')
--
-- O admin depois promove manualmente para 'editor' ou 'admin'.
-- ============================================================
CREATE OR REPLACE FUNCTION organograma.handle_new_profile()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = organograma, public AS $$
BEGIN
  INSERT INTO organograma.user_permissoes (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON organograma.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON organograma.profiles
  FOR EACH ROW EXECUTE FUNCTION organograma.handle_new_profile();

-- ============================================================
-- FUNÇÃO PÚBLICA: get_my_role()
-- Exposta no schema public para ser chamável via supabase.rpc('get_my_role').
-- Retorna o role do usuário autenticado atual, ou NULL se sem permissão.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = organograma, public AS $$
  SELECT role
  FROM   organograma.user_permissoes
  WHERE  user_id = auth.uid()
    AND  ativo   = true
  LIMIT  1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- ============================================================
-- FUNÇÕES AUXILIARES DE PERMISSÃO
-- ============================================================
CREATE OR REPLACE FUNCTION organograma.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = organograma, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organograma.user_permissoes
    WHERE user_id = p_user_id AND role = 'admin' AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION organograma.is_editor(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = organograma, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organograma.user_permissoes
    WHERE user_id = p_user_id
      AND role = ANY (ARRAY['admin', 'editor'])
      AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION organograma.get_user_role(p_user_id uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = organograma, public AS $$
  SELECT role FROM organograma.user_permissoes
  WHERE user_id = p_user_id AND ativo = true LIMIT 1;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organograma.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organograma.user_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE organograma.unidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organograma.cargos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organograma.setores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organograma.funcionarios    ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: ver próprio ou admin"  ON organograma.profiles;
DROP POLICY IF EXISTS "profiles: ver próprio"           ON organograma.profiles;
DROP POLICY IF EXISTS "profiles: admin vê todos"        ON organograma.profiles;
DROP POLICY IF EXISTS "profiles: atualizar próprio"     ON organograma.profiles;
DROP POLICY IF EXISTS "profiles: sistema insere"        ON organograma.profiles;

CREATE POLICY "profiles: ver próprio"
  ON organograma.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles: admin vê todos"
  ON organograma.profiles FOR SELECT
  USING (organograma.is_admin());

CREATE POLICY "profiles: atualizar próprio"
  ON organograma.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: sistema insere"
  ON organograma.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── user_permissoes ─────────────────────────────────────────
DROP POLICY IF EXISTS "permissoes: ver própria ou admin" ON organograma.user_permissoes;
DROP POLICY IF EXISTS "permissoes: admin insere"         ON organograma.user_permissoes;
DROP POLICY IF EXISTS "permissoes: admin atualiza"       ON organograma.user_permissoes;
DROP POLICY IF EXISTS "permissoes: admin deleta"         ON organograma.user_permissoes;

CREATE POLICY "permissoes: ver própria ou admin"
  ON organograma.user_permissoes FOR SELECT
  USING (user_id = auth.uid() OR organograma.is_admin());

CREATE POLICY "permissoes: admin insere"
  ON organograma.user_permissoes FOR INSERT
  WITH CHECK (organograma.is_admin());

CREATE POLICY "permissoes: admin atualiza"
  ON organograma.user_permissoes FOR UPDATE
  USING (organograma.is_admin());

CREATE POLICY "permissoes: admin deleta"
  ON organograma.user_permissoes FOR DELETE
  USING (organograma.is_admin());

-- ── unidades ────────────────────────────────────────────────
DROP POLICY IF EXISTS "unidades: autenticado lê ativas" ON organograma.unidades;
DROP POLICY IF EXISTS "unidades: editor insere"         ON organograma.unidades;
DROP POLICY IF EXISTS "unidades: editor atualiza"       ON organograma.unidades;
DROP POLICY IF EXISTS "unidades: admin deleta"          ON organograma.unidades;

CREATE POLICY "unidades: autenticado lê ativas"
  ON organograma.unidades FOR SELECT
  USING (auth.uid() IS NOT NULL AND (deleted_at IS NULL OR organograma.is_admin()));

CREATE POLICY "unidades: editor insere"
  ON organograma.unidades FOR INSERT WITH CHECK (organograma.is_editor());

CREATE POLICY "unidades: editor atualiza"
  ON organograma.unidades FOR UPDATE USING (organograma.is_editor());

CREATE POLICY "unidades: admin deleta"
  ON organograma.unidades FOR DELETE USING (organograma.is_admin());

-- ── cargos ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "cargos: autenticado lê ativos" ON organograma.cargos;
DROP POLICY IF EXISTS "cargos: editor insere"         ON organograma.cargos;
DROP POLICY IF EXISTS "cargos: editor atualiza"       ON organograma.cargos;
DROP POLICY IF EXISTS "cargos: admin deleta"          ON organograma.cargos;

CREATE POLICY "cargos: autenticado lê ativos"
  ON organograma.cargos FOR SELECT
  USING (auth.uid() IS NOT NULL AND (deleted_at IS NULL OR organograma.is_admin()));

CREATE POLICY "cargos: editor insere"
  ON organograma.cargos FOR INSERT WITH CHECK (organograma.is_editor());

CREATE POLICY "cargos: editor atualiza"
  ON organograma.cargos FOR UPDATE USING (organograma.is_editor());

CREATE POLICY "cargos: admin deleta"
  ON organograma.cargos FOR DELETE USING (organograma.is_admin());

-- ── setores ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "setores: autenticado lê ativos" ON organograma.setores;
DROP POLICY IF EXISTS "setores: editor insere"         ON organograma.setores;
DROP POLICY IF EXISTS "setores: editor atualiza"       ON organograma.setores;
DROP POLICY IF EXISTS "setores: admin deleta"          ON organograma.setores;

CREATE POLICY "setores: autenticado lê ativos"
  ON organograma.setores FOR SELECT
  USING (auth.uid() IS NOT NULL AND (deleted_at IS NULL OR organograma.is_admin()));

CREATE POLICY "setores: editor insere"
  ON organograma.setores FOR INSERT WITH CHECK (organograma.is_editor());

CREATE POLICY "setores: editor atualiza"
  ON organograma.setores FOR UPDATE USING (organograma.is_editor());

CREATE POLICY "setores: admin deleta"
  ON organograma.setores FOR DELETE USING (organograma.is_admin());

-- ── funcionarios ────────────────────────────────────────────
DROP POLICY IF EXISTS "funcionarios: autenticado lê ativos" ON organograma.funcionarios;
DROP POLICY IF EXISTS "funcionarios: editor insere"         ON organograma.funcionarios;
DROP POLICY IF EXISTS "funcionarios: editor atualiza"       ON organograma.funcionarios;
DROP POLICY IF EXISTS "funcionarios: admin deleta"          ON organograma.funcionarios;

CREATE POLICY "funcionarios: autenticado lê ativos"
  ON organograma.funcionarios FOR SELECT
  USING (auth.uid() IS NOT NULL AND (deleted_at IS NULL OR organograma.is_admin()));

CREATE POLICY "funcionarios: editor insere"
  ON organograma.funcionarios FOR INSERT WITH CHECK (organograma.is_editor());

CREATE POLICY "funcionarios: editor atualiza"
  ON organograma.funcionarios FOR UPDATE USING (organograma.is_editor());

CREATE POLICY "funcionarios: admin deleta"
  ON organograma.funcionarios FOR DELETE USING (organograma.is_admin());

-- ============================================================
-- ÍNDICES (idempotentes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_permissoes_user_id    ON organograma.user_permissoes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissoes_role_ativo  ON organograma.user_permissoes(role) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_funcionarios_id_setor       ON organograma.funcionarios(id_setor);
CREATE INDEX IF NOT EXISTS idx_funcionarios_id_cargo       ON organograma.funcionarios(id_cargo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_id_unidade     ON organograma.funcionarios(id_unidade);
CREATE INDEX IF NOT EXISTS idx_funcionarios_deleted_at     ON organograma.funcionarios(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_setores_id_unidade          ON organograma.setores(id_unidade);
CREATE INDEX IF NOT EXISTS idx_setores_deleted_at          ON organograma.setores(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unidades_deleted_at         ON organograma.unidades(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cargos_deleted_at           ON organograma.cargos(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- GRANTS FINAIS — schema organograma
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA organograma TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA organograma TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA organograma TO service_role;

-- ============================================================
-- TABLE: organograma.org_nodes
-- Nós do organograma (estrutura hierárquica visual).
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

GRANT SELECT, INSERT, UPDATE, DELETE ON organograma.org_nodes TO authenticated;
GRANT ALL ON organograma.org_nodes TO service_role;

CREATE INDEX IF NOT EXISTS idx_org_nodes_parent_id ON organograma.org_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_nodes_level     ON organograma.org_nodes(level);
