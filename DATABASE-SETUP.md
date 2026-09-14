# Database Setup Guide

Complete guide for setting up the Supabase database for Qwen Proxy v2.

## Prerequisites

- Supabase account (https://supabase.com)
- Supabase project created
- SQL Editor access in Supabase Dashboard

## Overview

The database consists of:
1. **api_keys** table - Authentication and access control
2. **request_logs** table - Request logging and analytics
3. **increment_api_key_usage()** function - Atomic usage counter
4. **request_stats** view - Aggregated analytics

## Setup Steps

### Step 1: Create API Keys Table

Run the SQL script in Supabase SQL Editor:

```bash
scripts/create-api-keys-table.sql
```

**What it does:**
- Creates `api_keys` table with proper indexes
- Enables Row Level Security (RLS) with service role access
- Sets up automatic `updated_at` timestamp trigger
- Adds tier validation constraint

**Verify:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'api_keys';
```

### Step 2: Create Request Logs Table

Run the SQL script in Supabase SQL Editor:

```bash
scripts/create-request-logs-table.sql
```

**What it does:**
- Creates `request_logs` table with foreign key to `api_keys`
- Creates indexes for fast analytics queries
- Enables RLS with service role access
- Creates `request_stats` view with security_invoker
- Creates cleanup function for old logs (90+ days)

**Verify:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'request_logs';
```

### Step 3: Create Atomic Increment Function

Run the SQL script in Supabase SQL Editor:

```bash
scripts/create-increment-function.sql
```

**What it does:**
- Creates `increment_api_key_usage()` function
- Prevents race conditions in concurrent requests
- Sets proper security (search_path, security invoker)

**Verify:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'increment_api_key_usage';
```

### Step 4: Create Admin API Key

Run the Node.js script from the project root:

```bash
cd qwen-proxy-v2
node scripts/create-admin-key.js
```

**What it does:**
- Creates an enterprise-tier API key
- Grants access to admin endpoints
- Prints the API key (save it securely!)

**Output example:**
```
✓ Created admin API key: sk-admin-dc59c240a47135ac047cbd0fe84bb40558846c20bdf5fbcb
  Name: Admin Key
  Tier: enterprise
  ID: 123e4567-e89b-12d3-a456-426614174000
```

**⚠️ Important:** Save this API key immediately - it won't be shown again!

## Verification Checklist

Run these queries in Supabase SQL Editor to verify setup:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('api_keys', 'request_logs');

-- Check view exists
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name = 'request_stats';

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'increment_api_key_usage';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('api_keys', 'request_logs');

-- Check admin key was created
SELECT id, name, tier, is_active FROM api_keys 
WHERE tier = 'enterprise' 
ORDER BY created_at DESC 
LIMIT 1;
```

Expected results:
- ✅ 2 tables found (api_keys, request_logs)
- ✅ 1 view found (request_stats)
- ✅ 1 function found (increment_api_key_usage)
- ✅ RLS enabled on both tables (rowsecurity = true)
- ✅ 1 enterprise key exists

## Environment Variables

After database setup, configure your `.env` file:

```bash
# Supabase credentials
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get these values from:
- Supabase Dashboard → Project Settings → API
- Use the **service_role** key (NOT the anon key)

## Testing the Setup

### Test 1: Health Check
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Test 2: List Models (requires API key)
```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-admin-your-key-here"
# Expected: {"object":"list","data":[...]}
```

### Test 3: Create API Key (admin endpoint)
```bash
curl -X POST http://localhost:3000/admin/api-keys \
  -H "Authorization: Bearer sk-admin-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "tier": "free"
  }'
# Expected: {"success":true,"data":{"id":"...","key":"sk-..."}}
```

### Test 4: Check Request Logs
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM request_logs;
-- Should show requests from your tests
```

## Maintenance

### Clean Old Logs

Manually run the cleanup function:
```sql
SELECT clean_old_request_logs();
-- Returns: number of deleted rows
```

Or set up automatic cleanup with pg_cron:
```sql
-- Enable pg_cron extension (if not enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
  'clean-old-logs',
  '0 2 * * *',
  'SELECT clean_old_request_logs()'
);
```

### View Usage Statistics
```sql
-- Overall stats
SELECT * FROM request_stats 
ORDER BY date DESC 
LIMIT 30;

-- Per-key stats
SELECT 
  ak.name,
  ak.tier,
  rs.total_requests,
  rs.success_count,
  rs.error_count
FROM request_stats rs
JOIN api_keys ak ON rs.api_key_id = ak.id
WHERE rs.date >= CURRENT_DATE - INTERVAL '7 days';
```

## Troubleshooting

### "relation 'api_keys' does not exist"
- SQL script didn't run successfully
- Check for errors in Supabase SQL Editor
- Re-run the script

### "permission denied for table api_keys"
- Using anon key instead of service role key
- Check SUPABASE_SERVICE_KEY in .env

### "function increment_api_key_usage does not exist"
- Function script not run
- Run `scripts/create-increment-function.sql`

### "Authentication will be disabled"
- Missing SUPABASE_URL or SUPABASE_SERVICE_KEY
- Check .env file configuration
- Verify environment variables are loaded

### Node script errors
```bash
# If create-admin-key.js fails
cd qwen-proxy-v2
npm install  # Install dependencies first
node scripts/create-admin-key.js
```

## Security Notes

### API Key Format
- All keys start with `sk-` followed by 32 hex characters
- Never commit keys to version control
- Rotate keys regularly

### Service Role Key
- Grants full database access (bypasses RLS)
- Keep it secret and secure
- Never expose in client-side code

### RLS Policies
- Only service role can access api_keys and request_logs
- Public and authenticated users are blocked
- View runs with invoker privileges (security_invoker)

## Next Steps

After database setup:
1. ✅ Configure Qwen credentials (cookies.txt, headers.json)
2. ✅ Set all environment variables
3. ✅ Start the proxy server
4. ✅ Test with health endpoints
5. ✅ Deploy to Render or your platform

See `README.md` for full deployment instructions.
