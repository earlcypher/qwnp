-- API Keys Table for Authentication
-- Run this in Supabase SQL Editor FIRST (before request_logs table)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- API key string (format: sk-{32 hex chars})
  key TEXT NOT NULL UNIQUE,

  -- Friendly name for identification
  name TEXT NOT NULL,

  -- Tier: 'free', 'premium', or 'enterprise'
  tier TEXT NOT NULL DEFAULT 'free',

  -- Active status (soft delete)
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON api_keys(tier);

-- Add check constraint for valid tiers
ALTER TABLE api_keys
  ADD CONSTRAINT valid_tier
  CHECK (tier IN ('free', 'premium', 'enterprise'));

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (used by your proxy)
CREATE POLICY "Service role has full access to api_keys" ON api_keys
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Block public access (no one can access without service role)
CREATE POLICY "Block public access to api_keys" ON api_keys
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Block authenticated users (only service role can access)
CREATE POLICY "Block authenticated access to api_keys" ON api_keys
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_api_keys_updated_at_trigger
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- Comments for documentation
COMMENT ON TABLE api_keys IS 'API keys for authentication and access control';
COMMENT ON COLUMN api_keys.key IS 'API key string in format: sk-{32 hex chars}';
COMMENT ON COLUMN api_keys.tier IS 'Access tier: free, premium, or enterprise';
COMMENT ON COLUMN api_keys.is_active IS 'Active status - set to false for soft delete';
COMMENT ON COLUMN api_keys.usage_count IS 'Total number of requests made with this key';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of most recent request';
