-- Atomic Counter Increment Function
-- Run this in Supabase SQL Editor AFTER creating api_keys table

-- This function atomically increments usage_count and updates last_used_at
-- It prevents race conditions when multiple requests use the same API key concurrently
--
-- WHY ATOMIC FUNCTIONS MATTER:
-- ❌ BAD (race condition):
--   1. Read current usage_count: 100
--   2. Add 1: 101
--   3. Write back: 101
--   Problem: If 2 requests run simultaneously, both read 100 and write 101
--
-- ✅ GOOD (atomic):
--   Database handles increment as single atomic operation
--   No read-modify-write pattern = no race condition

CREATE OR REPLACE FUNCTION increment_api_key_usage(key_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Atomically increment usage_count and update last_used_at
  UPDATE api_keys
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = key_id;
END;
$$ LANGUAGE plpgsql
-- SECURITY: Prevents SQL injection by fixing search_path
-- See: https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
SET search_path = public, pg_temp
-- Run with invoker's privileges (not function owner)
SECURITY INVOKER;

-- Comments for documentation
COMMENT ON FUNCTION increment_api_key_usage(UUID) IS 'Atomically increments API key usage counter and updates last_used_at timestamp. Prevents race conditions in concurrent requests.';

-- Test the function (optional - uncomment to test)
-- SELECT increment_api_key_usage('00000000-0000-0000-0000-000000000000');
