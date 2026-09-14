# Qwen Proxy v2 - Production Version

OpenAI-compatible API proxy for Qwen web chat with full authentication, analytics, and admin capabilities.

## Features

### Core Functionality
- ✅ **OpenAI-compatible API** - Drop-in replacement for OpenAI base URL
- ✅ **Stateless architecture** - Client manages conversation history (no server-side session state)
- ✅ **Streaming & non-streaming** - Full SSE support for real-time responses
- ✅ **Multiple models** - Support for all Qwen models via model parameter

### Production Features
- ✅ **API key authentication** - Secure access control via Supabase
- ✅ **Three-tier system** - Free, Premium, and Enterprise tiers
- ✅ **Request logging** - Comprehensive analytics in Supabase
- ✅ **Admin API** - Full CRUD for API keys and analytics
- ✅ **Usage tracking** - Atomic counters with race condition protection
- ✅ **Non-blocking analytics** - Logging never blocks requests

### Infrastructure
- ✅ **Supabase backend** - PostgreSQL with RLS policies
- ✅ **Native HTTPS** - Keep-alive connection pooling
- ✅ **Proxy support** - HTTP/HTTPS proxy for restricted networks
- ✅ **Render-ready** - Environment variable configuration

## Architecture

### Stateless Design
The proxy creates a fresh `chat_id` for each request, preventing context pollution between different API users:

```javascript
// Client sends full conversation history
POST /v1/chat/completions
{
  "model": "qwen3.7-plus",
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "How are you?"}
  ]
}
```

### Two-Request Pattern
Every chat completion makes two sequential Qwen API calls:
1. `POST /api/v2/chats/new` - Creates fresh chat (500ms)
2. `POST /api/v2/chat/completions` - Sends messages (3.2s including inference)

**Total latency: ~3.7s** (mostly Qwen inference, not proxy overhead)

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (for authentication/analytics)
- Qwen account credentials (cookies.txt)

### Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start

# Development mode with auto-reload
npm run dev
```

Server runs on `http://localhost:3000`

### Environment Variables

**Required:**
```bash
# Server configuration
PORT=3000

# Qwen credentials (local development)
QWEN_COOKIES_FILE=./cookies.txt
QWEN_HEADERS_FILE=./headers.json

# Supabase (authentication & analytics)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Optional:**
```bash
# Proxy support
PROXY_URL=http://proxy.example.com:8080

# Render deployment (use base64-encoded credentials)
COOKIES_B64=<base64-encoded cookies.txt content>
HEADERS_B64=<base64-encoded headers.json content>
```

### Capturing Qwen Credentials

Follow `QUICK-START.md` for detailed instructions on capturing cookies and headers from your browser's DevTools.

## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /health/credentials` - Verify Qwen credentials are valid

### OpenAI-Compatible Endpoints (require API key)
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (streaming/non-streaming)

### Admin Endpoints (require enterprise tier API key)
- `POST /admin/api-keys` - Create API key
- `GET /admin/api-keys` - List API keys
- `GET /admin/api-keys/:id` - Get specific key
- `PUT /admin/api-keys/:id` - Update API key
- `DELETE /admin/api-keys/:id` - Deactivate API key
- `GET /admin/analytics/logs` - Request logs with filters
- `GET /admin/analytics/usage` - Aggregated usage statistics
- `GET /admin/analytics/keys/:id` - Per-key statistics

## Usage Examples

### With OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="sk-your-api-key-here"
)

response = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### With OpenAI SDK (Node.js)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'sk-your-api-key-here'
});

const response = await client.chat.completions.create({
  model: 'qwen3.7-plus',
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
});

console.log(response.choices[0].message.content);
```

### With cURL

```bash
# Non-streaming
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.7-plus",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# Streaming
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.7-plus",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

## Database Setup

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Save your project URL and service role key

### 2. Run Migrations

Execute the following SQL in Supabase SQL Editor:

**API Keys Table:**
```sql
-- See scripts/create-api-keys-table.sql
-- Creates api_keys table with RLS policies
```

**Request Logs Table:**
```sql
-- See scripts/create-request-logs-table.sql
-- Creates request_logs table with indexes and cleanup function
```

**Atomic Counter Function:**
```sql
-- See scripts/create-increment-function.sql
-- Creates increment_api_key_usage() for race-free counters
```

### 3. Create Admin API Key

```bash
node scripts/create-admin-key.js
```

This creates an enterprise-tier API key for accessing admin endpoints.

## Deployment

### Render (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Create Web Service**
   - Go to https://dashboard.render.com
   - New → Web Service
   - Connect your repository
   - Root directory: `qwen-proxy-v2` (or leave blank if repo root)

3. **Configure Build**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free (or Starter for better performance)
   - Region: Choose closest to users

4. **Set Environment Variables**
   ```bash
   PORT=3000
   COOKIES_B64=<base64 encoded cookies.txt>
   HEADERS_B64=<base64 encoded headers.json>
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Deploy**
   - Render auto-deploys on every push to main branch

**Note:** To base64-encode credentials:
```bash
base64 -w 0 cookies.txt > cookies.b64
base64 -w 0 headers.json > headers.b64
```

### Docker (Alternative)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

Build and run:
```bash
docker build -t qwen-proxy .
docker run -p 3000:3000 --env-file .env qwen-proxy
```

## Security Considerations

### Authentication
- API keys use secure format: `sk-{32 hex chars}`
- Service role key bypasses RLS for admin operations
- Soft delete for API keys (deactivate, don't remove)

### Rate Limiting
- Currently not implemented (TODO)
- Recommend nginx rate limiting at reverse proxy layer

### Credential Management
- Never commit `cookies.txt`, `headers.json`, or `.env` files
- Use environment variables for all secrets
- Rotate Qwen credentials regularly (they expire)
- Use Render's environment variables UI for sensitive data

### Database Security
- RLS policies enabled on all tables
- Service role access only
- Atomic operations prevent race conditions
- 90-day log retention with automatic cleanup

## Monitoring

### Health Checks
```bash
# Basic health
curl https://your-app.onrender.com/health

# Credential validation
curl https://your-app.onrender.com/health/credentials
```

### Analytics (Enterprise API Key Required)
```bash
# Usage statistics (last 7 days)
curl https://your-app.onrender.com/admin/analytics/usage \
  -H "Authorization: Bearer sk-admin-xxx"

# Recent request logs
curl https://your-app.onrender.com/admin/analytics/logs?limit=50 \
  -H "Authorization: Bearer sk-admin-xxx"
```

## Troubleshooting

### "Invalid or inactive API key"
- Verify API key is correct
- Check key is active in Supabase `api_keys` table
- Ensure Authorization header format: `Bearer sk-xxx`

### "Credentials appear to be expired"
- Visit `/health/credentials` to test
- Recapture cookies.txt from Qwen web chat
- Update COOKIES_B64 environment variable
- Redeploy service

### "Failed to create chat"
- Check Qwen account is logged in
- Verify cookies.txt has `token` cookie
- Ensure headers.json has `bx-ua` and `bx-umidtoken`
- Check for WAF blocks (try different IP/proxy)

### Slow response times
- Normal: 3-4 seconds (Qwen API latency)
- If >10 seconds: Check Render free tier cold starts
- Consider upgrading to paid plan for persistent instances

## API Tier Comparison

| Feature | Free | Premium | Enterprise |
|---------|------|---------|------------|
| Chat completions | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ |
| Analytics tracking | ✅ | ✅ | ✅ |
| Admin API access | ❌ | ❌ | ✅ |
| Custom rate limits | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

*Note: Rate limiting not yet implemented. Tiers reserved for future use.*

## Contributing

Contributions welcome! See `CLAUDE.md` for development guidelines and architecture decisions.

## License

MIT

## Related Projects

- **qwen-proxy** (v1) - Simpler version without database backend
- **qwen-dashboard** - Web UI for managing API keys and viewing analytics

## Support

- Issues: https://github.com/earlcypher/qwnp/issues
- Documentation: See `CLAUDE.md` for detailed architecture
- Deployment guide: See `DEPLOYMENT-READY.md`
