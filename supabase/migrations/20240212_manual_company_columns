-- Migration: Add company and company_site columns to leads table
-- Run this in the Supabase Dashboard SQL Editor

-- 1. Add columns if they don't exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS company_site TEXT;

-- 2. Backfill data from custom_fields
-- This updates existing rows where company is null but custom_fields has 'empresa'
UPDATE leads
SET 
  company = (custom_fields->>'empresa'),
  company_site = (custom_fields->>'site')
WHERE 
  company IS NULL 
  AND custom_fields IS NOT NULL
  AND (custom_fields->>'empresa' IS NOT NULL OR custom_fields->>'site' IS NOT NULL);

-- 3. Verify
SELECT count(*) as migrated_count FROM leads WHERE company IS NOT NULL;
