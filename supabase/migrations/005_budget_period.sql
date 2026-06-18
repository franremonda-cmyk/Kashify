-- Migration: Add period_type and applies_months to category_budgets
-- Run this in Supabase SQL Editor

ALTER TABLE category_budgets
  ADD COLUMN IF NOT EXISTS period_type text NOT NULL DEFAULT 'always'
    CHECK (period_type IN ('always', 'specific_months')),
  ADD COLUMN IF NOT EXISTS applies_months int[] DEFAULT NULL;

COMMENT ON COLUMN category_budgets.period_type IS 'always = every month, specific_months = only the months listed in applies_months';
COMMENT ON COLUMN category_budgets.applies_months IS 'Array of month numbers (1=Jan ... 12=Dec) when period_type=specific_months';
