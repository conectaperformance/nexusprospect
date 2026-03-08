-- ============================================================
-- Migration: Adicionar coluna webhook_key na tabela profiles
-- Cada usuário terá uma chave webhook única (NEXUS-XXXXXXXXX)
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS webhook_key TEXT UNIQUE DEFAULT NULL;

-- Criar índice para busca rápida por webhook_key
CREATE INDEX IF NOT EXISTS idx_profiles_webhook_key ON public.profiles (webhook_key)
WHERE webhook_key IS NOT NULL;
