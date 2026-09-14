-- Request Logs Table for Analytics
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS request_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Request details
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,

  -- Performance metrics
  response_time_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_type TEXT,

  -- Request metadata
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_logs_api_key_id ON request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_status_code ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_logs_endpoint ON request_logs(endpoint);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_logs_key_created ON request_logs(api_key_id, created_at DESC);

-- Enable Row Level Security (optional, for future multi-tenancy)
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do anything (used by your proxy)
CREATE POLICY "Service role has full access to request_logs" ON request_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- View for aggregated stats (faster queries)
-- SECURITY: security_invoker = true prevents privilege escalation
-- The view runs with the privileges of the caller, not the view owner
CREATE OR REPLACE VIEW request_stats
WITH (security_invoker = true) AS
SELECT
  api_key_id,
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
  COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
  AVG(response_time_ms)::INTEGER as avg_response_time_ms,
  MAX(created_at) as last_request_at
FROM request_logs
GROUP BY api_key_id, DATE(created_at);

-- Function to clean old logs (optional - keep last 90 days)
CREATE OR REPLACE FUNCTION clean_old_request_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM request_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean old logs
-- (You can set this up in Supabase Dashboard > Database > Extensions > pg_cron)
-- SELECT cron.schedule('clean-old-logs', '0 2 * * *', 'SELECT clean_old_request_logs()');

COMMENT ON TABLE request_logs IS 'Logs all API requests for analytics and monitoring';
COMMENT ON COLUMN request_logs.response_time_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN request_logs.status_code IS 'HTTP status code (200, 400, 500, etc)';
