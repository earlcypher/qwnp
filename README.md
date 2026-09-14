# Qwen Proxy v2 - Stateless API (No Auth)

Simple, stateless OpenAI-compatible proxy for Qwen web chat.

## What's Different from v1?

**v2 (this version):**
- ✅ No API key authentication
- ✅ No rate limiting
- ✅ Pure stateless proxy
- ✅ Ready for Render testing

**v1 (../qwen-proxy):**
- API key management
- Per-key rate limiting
- Admin dashboard
- Multi-user support

## Features

- ✅ OpenAI-compatible API
- ✅ Stateless (client manages conversation history)
- ✅ Streaming and non-streaming responses
- ✅ Lightweight and minimal dependencies
- ✅ Easy to deploy

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start server
npm start
```

Server runs on `http://localhost:3000`

### Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# List models
curl http://localhost:3000/v1/models

# Chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.7-plus",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

## Deploy to Render (Free)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy qwen-proxy-v2"
   git push origin main
   ```

2. **Create Web Service on Render**
   - Connect your GitHub repo
   - Build: `npm install`
   - Start: `npm start`
   - Plan: Free

3. **Set Environment Variables**
   ```
   PORT = 3000
   QWEN_COOKIES_FILE = ./cookies.txt
   ```

4. **Add Qwen Credentials**
   - You'll need to add your `cookies.txt` and `headers.json` as environment variables
   - See parent directory for credential capture instructions

## Endpoints

- `GET /health` - Health check
- `GET /health/credentials` - Verify Qwen credentials
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (OpenAI compatible)

## OpenAI SDK Compatibility

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="not-needed"  # No API key required in v2
)

response = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Next Steps

After testing on Render:
1. If it works, you can add Supabase database
2. Build a dashboard for management
3. Add back auth & rate limiting (upgrade to v1)

## License

MIT
