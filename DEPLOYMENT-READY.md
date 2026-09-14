# ✅ Deployment Ready - Qwen Proxy v2

**Status:** Production version with authentication, analytics, and admin API. Ready for deployment.

**Date:** 2026-09-14

**Version:** 2.0 (with Supabase backend)

---

## 🎯 What This Version Includes

### Core Features
- ✅ **OpenAI-compatible API** - Drop-in replacement for OpenAI
- ✅ **Stateless architecture** - Client manages conversation history
- ✅ **Streaming & non-streaming** - Full SSE support
- ✅ **Multiple models** - All Qwen models supported

### Production Features
- ✅ **API key authentication** - Secure access via Supabase
- ✅ **Three-tier system** - Free, Premium, Enterprise
- ✅ **Request logging** - Comprehensive analytics
- ✅ **Admin API** - Full CRUD for keys and analytics
- ✅ **Usage tracking** - Atomic counters (race-free)
- ✅ **Non-blocking analytics** - Never blocks requests

---

## 📋 Pre-Deployment Checklist

### Database Setup
- [ ] Supabase project created
- [ ] API keys table created (`scripts/create-api-keys-table.sql`)
- [ ] Request logs table created (`scripts/create-request-logs-table.sql`)
- [ ] Atomic function created (`scripts/create-increment-function.sql`)
- [ ] Admin API key generated (`scripts/create-admin-key.js`)
- [ ] RLS policies verified
- [ ] Database credentials configured

### Qwen Credentials
- [ ] `cookies.txt` captured from browser
- [ ] `headers.json` captured (bx-ua, bx-umidtoken)
- [ ] Credentials tested via `/health/credentials`
- [ ] Qwen account settings configured (disable memory/history)

### Environment Configuration
- [ ] `.env` file configured (or environment variables set)
- [ ] `SUPABASE_URL` set
- [ ] `SUPABASE_SERVICE_KEY` set (service role, not anon)
- [ ] `PORT` configured (default: 3000)
- [ ] Credentials encoded for cloud deployment (COOKIES_B64, HEADERS_B64)

### Testing
- [ ] Health check passes: `GET /health`
- [ ] Credential check passes: `GET /health/credentials`
- [ ] Models list works: `GET /v1/models` (with API key)
- [ ] Chat completion works: `POST /v1/chat/completions`
- [ ] Admin API accessible: `GET /admin/api-keys` (enterprise key)
- [ ] Analytics logging verified in Supabase

---

## 🚀 Deployment Options

### Option 1: Render (Recommended)

**Advantages:**
- Free tier available
- Auto-deploys from GitHub
- Good for APIs (persistent connections)
- Simple environment variable management

**Steps:**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy Qwen Proxy v2 to Render"
   git push origin main
   ```

2. **Create Web Service on Render:**
   - Go to https://dashboard.render.com
   - New → Web Service
   - Connect your GitHub repository
   - Configure:
     - Name: `qwen-proxy` (or your choice)
     - Region: Choose closest to your users
     - Branch: `main`
     - Root Directory: `qwen-proxy-v2` (if repo contains multiple projects)
     - Runtime: Node
     - Build Command: `npm install`
     - Start Command: `npm start`
     - Plan: Free (or paid for better performance)

3. **Set Environment Variables:**
   ```bash
   PORT=3000
   COOKIES_B64=<base64 encoded cookies.txt>
   HEADERS_B64=<base64 encoded headers.json>
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Encode Credentials:**
   ```bash
   # On Linux/Mac
   base64 -w 0 cookies.txt > cookies.b64
   base64 -w 0 headers.json > headers.b64
   
   # Copy the content of cookies.b64 and headers.b64 into Render environment variables
   ```

5. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically deploy
   - Monitor logs for any errors

**Verify Deployment:**
```bash
curl https://your-app.onrender.com/health
curl https://your-app.onrender.com/health/credentials
```

### Option 2: Docker

**Create Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "src/index.js"]
```

**Build and Run:**
```bash
# Build image
docker build -t qwen-proxy .

# Run container
docker run -p 3000:3000 \
  -e SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co" \
  -e SUPABASE_SERVICE_KEY="eyJ..." \
  -e COOKIES_B64="..." \
  -e HEADERS_B64="..." \
  qwen-proxy
```

### Option 3: Local/VPS Deployment

**Using PM2 (Process Manager):**

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start with PM2:**
   ```bash
   pm2 start src/index.js --name qwen-proxy
   pm2 save
   pm2 startup  # Enable auto-start on reboot
   ```

4. **Monitor:**
   ```bash
   pm2 logs qwen-proxy
   pm2 status
   ```

---

## 🔍 Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-domain.com/health
```
**Expected:** `{"status":"ok","timestamp":"2026-09-14T..."}`

### 2. Credential Validation
```bash
curl https://your-domain.com/health/credentials
```
**Expected:** `{"status":"valid","message":"Credentials are working correctly",...}`

**If invalid:** Recapture cookies.txt and headers.json, update environment variables.

### 3. List Models (Requires API Key)
```bash
curl https://your-domain.com/v1/models \
  -H "Authorization: Bearer sk-your-key-here"
```
**Expected:** `{"object":"list","data":[...]}`

### 4. Chat Completion (Non-Streaming)
```bash
curl https://your-domain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.7-plus",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```
**Expected:** AI response in OpenAI format

### 5. Admin API Access (Enterprise Key Required)
```bash
curl https://your-domain.com/admin/api-keys \
  -H "Authorization: Bearer sk-admin-your-enterprise-key"
```
**Expected:** List of API keys

### 6. Analytics Logging
Check Supabase dashboard:
- Open your project → Table Editor → `request_logs`
- Should see entries for your test requests
- Verify `api_key_id`, `endpoint`, `status_code` are populated

---

## 🔒 Security Considerations

### Before Going Public

1. **Review IP Restrictions:**
   - Current: `0.0.0.0/0` (public access by design)
   - Consider: IP allowlist for admin endpoints

2. **Rate Limiting:**
   - Not yet implemented in application
   - Recommended: Add nginx rate limiting at reverse proxy
   - Or: Implement in-app rate limiting by tier

3. **API Key Rotation:**
   - Admin key has full access - rotate regularly
   - Set expiration dates (future enhancement)
   - Monitor usage for anomalies

4. **Database Security:**
   - Service role key has full access - keep secret
   - RLS policies prevent unauthorized access
   - Regular backups recommended

5. **Credential Management:**
   - Never commit sensitive files to git
   - Use environment variables for all secrets
   - Rotate Qwen credentials when expired

### CORS Configuration

Currently configured for public API:
```javascript
Access-Control-Allow-Origin: *
```

For private deployments, restrict to your domains:
```javascript
// In src/index.js
res.header('Access-Control-Allow-Origin', 'https://yourdomain.com');
```

---

## 📊 Monitoring & Maintenance

### Health Monitoring

**Set up automated health checks:**
- Use UptimeRobot, Pingdom, or similar
- Monitor both `/health` and `/health/credentials`
- Alert on non-200 responses

**Key metrics to track:**
- Response time (should be ~3-4 seconds for completions)
- Error rate (4xx, 5xx responses)
- API key usage distribution
- Credential expiration (manual check currently)

### Log Management

**Supabase request_logs:**
- Auto-cleanup after 90 days (via `clean_old_request_logs()`)
- Set up pg_cron for automatic cleanup:
  ```sql
  SELECT cron.schedule(
    'clean-old-logs',
    '0 2 * * *',
    'SELECT clean_old_request_logs()'
  );
  ```

**Application logs:**
- Render: View in dashboard → Logs
- Docker: `docker logs -f container_id`
- PM2: `pm2 logs qwen-proxy`

### Credential Refresh

**When Qwen credentials expire:**
1. Follow `QUICK-START.md` to recapture
2. Encode to base64 (for cloud deployment)
3. Update environment variables
4. Restart service (or redeploy)
5. Verify via `/health/credentials`

**Signs of expired credentials:**
- `/health/credentials` returns error
- Chat completions fail with "Failed to create chat"
- Qwen API returns authentication errors

---

## 🎯 Performance Optimization

### Expected Latency
- Health check: <50ms
- Model list: ~500ms
- Chat completion: 3-4 seconds (mostly Qwen inference)
  - Create chat: ~500ms
  - Completion: ~3.2s

### Optimization Tips

1. **Connection Pooling:**
   - Already implemented (native HTTPS with keep-alive)
   - Reuses connections to Qwen API

2. **Database Queries:**
   - Indexes already created on frequent lookups
   - Use `request_stats` view for aggregated data

3. **Caching:**
   - Consider caching model list (changes infrequently)
   - Not recommended for chat completions (dynamic content)

4. **Proxy Support:**
   - Set `PROXY_URL` if behind corporate firewall
   - Supports HTTP/HTTPS/SOCKS5 proxies

---

## 🐛 Troubleshooting

### "Authentication required" Error
**Cause:** Missing or invalid API key

**Fix:**
- Check Authorization header: `Bearer sk-...`
- Verify key exists in Supabase `api_keys` table
- Ensure key is active (`is_active = true`)

### "Credentials appear to be expired"
**Cause:** Qwen session cookies/headers invalid

**Fix:**
1. Check `/health/credentials` endpoint
2. Recapture credentials from browser
3. Update `COOKIES_B64` and `HEADERS_B64`
4. Redeploy or restart service

### "Failed to create chat"
**Cause:** Qwen API rejecting requests

**Possible reasons:**
- Expired credentials
- WAF blocking your IP
- Rate limiting by Qwen
- Invalid headers

**Fix:**
- Verify credentials are fresh
- Try different IP/proxy (`PROXY_URL`)
- Check Qwen account is logged in

### "Database connection error"
**Cause:** Invalid Supabase credentials

**Fix:**
- Verify `SUPABASE_URL` is correct
- Ensure using service role key (not anon key)
- Check Supabase project is active
- Test connection in Supabase dashboard

### Slow Response Times (>10s)
**Causes:**
- Render free tier cold starts (first request after idle)
- Network latency to Qwen
- Qwen API congestion

**Fix:**
- Upgrade to paid Render plan (persistent instance)
- Use proxy closer to Qwen servers
- Consider request timeout adjustments

---

## 📝 API Usage Examples

### With OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-domain.com/v1",
    api_key="sk-your-api-key-here"  # Required in v2
)

response = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[
        {"role": "user", "content": "What is 2+2?"}
    ]
)

print(response.choices[0].message.content)
```

### With OpenAI SDK (Node.js)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-domain.com/v1',
  apiKey: 'sk-your-api-key-here'  // Required in v2
});

const response = await client.chat.completions.create({
  model: 'qwen3.7-plus',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ]
});

console.log(response.choices[0].message.content);
```

---

## 🎉 Summary

Qwen Proxy v2 is **production-ready** with:
- ✅ Secure authentication via Supabase
- ✅ Comprehensive request logging and analytics
- ✅ Admin API for key management
- ✅ OpenAI-compatible interface
- ✅ Stateless architecture (client manages history)
- ✅ Three-tier access system

**Next Steps:**
1. Complete the pre-deployment checklist above
2. Choose deployment option (Render recommended)
3. Deploy and verify with test endpoints
4. Monitor health and credential expiration
5. Set up automated backups and monitoring

For detailed setup instructions, see:
- `README.md` - Full API documentation
- `DATABASE-SETUP.md` - Complete database setup guide
- `QUICK-START.md` - Credential capture guide
- `CLAUDE.md` - Architecture and development guide
