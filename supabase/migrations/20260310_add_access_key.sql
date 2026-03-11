-- ============================================================
-- Migration: Adicionar coluna access_key na tabela profiles
-- Cada usuário terá uma chave de acesso única (NEXUS360-XXXXXXXXXXXX)
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS access_key TEXT UNIQUE DEFAULT NULL;

-- Criar índice para busca rápida por access_key
CREATE INDEX IF NOT EXISTS idx_profiles_access_key ON public.profiles (access_key)
WHERE access_key IS NOT NULL;

-- Função para obter a access_key do usuário (apenas o próprio usuário via RLS bypass no Security Definer se necessário, 
-- mas ler a chave própria não fere RLS padrão de perfil). Criaremos RPC por garantia de padrão.
CREATE OR REPLACE FUNCTION get_access_key(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Apenas o próprio usuário ou admin pode consultar
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT access_key INTO v_key
  FROM profiles
  WHERE id = p_user_id;

  RETURN v_key;
END;
$$;

-- Função para setar a access_key uma única vez
CREATE OR REPLACE FUNCTION set_access_key(p_user_id UUID, p_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_key TEXT;
BEGIN
  -- Apenas o próprio usuário pode setar
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Verifica se já existe uma chave
  SELECT access_key INTO v_current_key
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_key IS NOT NULL THEN
    RAISE EXCEPTION 'Chave de acesso já existente para este usuário';
  END IF;

  -- Verifica se a nova chave já está em uso por alguém (violação UNIQUE será pega pelo banco, mas podemos prevenir aqui também)
  IF EXISTS (SELECT 1 FROM profiles WHERE access_key = p_key) THEN
    RAISE EXCEPTION 'Esta chave já está em uso';
  END IF;

  -- Atualiza o profile
  UPDATE profiles
  SET access_key = p_key,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;
