# Quick Start: Capturing Fresh Credentials

The Qwen proxy is **fully functional**, but Qwen requires fresh session credentials (cookies + headers) that expire quickly. Here's how to capture them:

## Prerequisites
- Chrome, Brave, or Edge browser
- Active Qwen account at chat.qwen.ai

## Step-by-Step Guide

### 1. Export Cookies

**Option A: Using Browser Extension (Easiest)**
1. Install "Get cookies.txt LOCALLY" extension from Chrome Web Store
2. Go to https://chat.qwen.ai and log in
3. Click the extension icon → Export → Download `cookies.txt`
4. Replace `cookies.txt` in the project root

**Option B: Manual Export**
1. Go to https://chat.qwen.ai and log in
2. Press F12 → Application tab → Cookies → chat.qwen.ai
3. Copy all cookies to `cookies.txt` in this format:
```
cookieName	cookieValue	domain	path	expiration	size	...
```

### 2. Capture Headers

1. With DevTools open (F12), go to the **Network** tab
2. Clear the network log (🚫 icon)
3. Send a test message in the chat: "Hello"
4. Look for the request: `chat/completions?chat_id=...`
5. Click it → **Headers** tab → scroll to **Request Headers**
6. Find and copy these two headers:

**bx-ua**: A very long string (~2000 chars) starting with `234!tG4e...`
**bx-umidtoken**: Shorter token ending with `=`, like `T2gApOqw...=`

7. Create `headers.json`:
```json
{
  "bx-ua": "YOUR_BX_UA_HERE",
  "bx-umidtoken": "YOUR_BX_UMIDTOKEN_HERE"
}
```

### 3. Restart Server

```bash
npm start
```

### 4. Test

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3.7-plus","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```

## Troubleshooting

### Still getting "Bad_Request" errors?
- Cookies and headers expire together - recapture both at the same time
- Make sure you're logged into chat.qwen.ai when capturing
- Try logging out and back in to refresh your session

### Can't find bx-ua or bx-umidtoken?
- Make sure you're looking at the `chat/completions` request (not other requests)
- The headers are in **Request Headers** section (not Response)
- Scroll down - they might be near the bottom

### Session expires too quickly?
- This is normal - Qwen's anti-bot protections invalidate sessions
- Consider recapturing credentials when starting work
- For production use, you'd need to automate browser automation (Puppeteer/Playwright)

## Notes
- Credentials are session-specific and can't be reused indefinitely
- They're tied to your browser fingerprint and IP address  
- For personal use, manual capture every few hours is normal
- For production, consider using Qwen's official API instead
