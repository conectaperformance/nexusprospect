-- Migration V2: Add company and company_site columns to leads table (ROBUST VERSION)
-- Run this in the Supabase Dashboard SQL Editor

-- 1. Add columns if they don't exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS company_site TEXT;

-- 2. Diagnostic (Optional - Run this first to see what your data looks like if you are unsure)
-- SELECT id, custom_fields FROM leads WHERE custom_fields IS NOT NULL AND custom_fields::text != '{}' LIMIT 10;

-- 3. Backfill data from custom_fields with Multiple Key Variations
-- This tries to find 'empresa', 'Empresa', 'company', 'Company' for the company name
-- And 'site', 'Site', 'website', 'Website', 'url' for the site URL
UPDATE leads
SET 
  company = COALESCE(
    custom_fields->>'empresa', 
    custom_fields->>'Empresa', 
    custom_fields->>'company', 
    custom_fields->>'Company',
    custom_fields->>'nome_empresa'
  ),
  company_site = COALESCE(
    custom_fields->>'site', 
    custom_fields->>'Site', 
    custom_fields->>'website', 
    custom_fields->>'Website',
    custom_fields->>'url',
    custom_fields->>'Url'
  )
WHERE 
  company IS NULL 
  AND custom_fields IS NOT NULL
  AND (
      custom_fields->>'empresa' IS NOT NULL OR 
      custom_fields->>'Empresa' IS NOT NULL OR 
      custom_fields->>'company' IS NOT NULL OR 
      custom_fields->>'Company' IS NOT NULL OR
      custom_fields->>'nome_empresa' IS NOT NULL OR
      
      custom_fields->>'site' IS NOT NULL OR
      custom_fields->>'Site' IS NOT NULL OR
      custom_fields->>'website' IS NOT NULL OR
      custom_fields->>'Website' IS NOT NULL OR
      custom_fields->>'url' IS NOT NULL
  );

-- 4. Verify
SELECT count(*) as migrated_count FROM leads WHERE company IS NOT NULL;
