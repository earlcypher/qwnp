# Qwen API Cookie Requirements

**Generated:** 2026-09-15  
**Purpose:** Document which cookies need to be refreshed when credentials expire

## Summary

Your cookies.txt contains **20 cookies**. Based on code analysis and authentication patterns, here's what you need to know when refreshing credentials.

## Cookie Analysis

### 🔴 CRITICAL - Must Refresh

| Cookie | Type | Expires | Why Critical |
|--------|------|---------|--------------|
| `token` | JWT Auth | 2026-10-13 | Main authentication token. Explicitly extracted in `qwen.js:16`. Without this, authentication fails. |
| `cna` | Session | 2027-03-12 | Alibaba Cloud session identifier. Core session tracking. |
| `isg` | Security | 2027-03-12 | Alibaba security token. Part of Aliyun's security layer. |

### 🟡 IMPORTANT - Likely Required

| Cookie | Type | Expires | Why Important |
|--------|------|---------|---------------|
| `acw_tc` | WAF Token | 2026-09-13 | Alibaba Cloud WAF session. Required to bypass Aliyun's firewall. |
| `atpsida` | Session | Session only | Session tracking token. |
| `sca` | Session | Session only | Session control token. |
| `ssxmod_itna` | Anti-bot | 2026-09-13 | Anti-bot fingerprint (454 chars). Part of bot detection. |
| `ssxmod_itna2` | Anti-bot | 2026-09-13 | Secondary anti-bot token (237 chars). |
| `tfstk` | Fingerprint | 2027-03-12 | Long tracking token (502 chars). Anti-bot fingerprinting. |
| `cbc` | Anti-bot | 2027-03-12 | Cross-domain anti-bot token from alibaba.com. |

### 🟢 OPTIONAL - User Preferences

| Cookie | Type | Expires | Note |
|--------|------|---------|------|
| `qwen-locale` | Preference | 2027-03-12 | Language setting (en-US). Not required for API auth. |
| `qwen-theme` | Preference | 2027-03-12 | UI theme (dark/light). Not required for API auth. |
| `qwen-thinking_mode` | Preference | 2026-12-24 | Thinking mode (Fast/Deep). Not required for API auth. |
| `x-ap` | Region | Session only | Region preference (ap-southeast-1). Not critical. |
| `aui` | User ID | 2027-03-12 | User identifier UUID. |
| `cnaui` | User ID | 2026-12-27 | Duplicate user identifier. |
| `xlly_s` | Flag | 2026-09-16 | Simple flag value. |

### ⚪ NOT REQUIRED - Analytics

| Cookie | Type | Expires | Note |
|--------|------|---------|------|
| `_bl_uid` | Analytics | 2026-12-17 | Browser analytics. Safe to ignore. |
| `_c_WBKFRo` | Analytics | 2026-12-27 | Tracking cookie. Safe to ignore. |
| `_gcl_au` | Analytics | 2026-10-23 | Google Analytics. Safe to ignore. |

## What to Refresh When Credentials Expire

### Minimum Required Set (10 cookies)

When refreshing credentials, focus on capturing these cookies from chat.qwen.ai:

```
1. token                 (JWT - CRITICAL)
2. cna                   (Session - CRITICAL)
3. isg                   (Security - CRITICAL)
4. acw_tc                (WAF - IMPORTANT)
5. atpsida               (Session - IMPORTANT)
6. sca                   (Session - IMPORTANT)
7. ssxmod_itna           (Anti-bot - IMPORTANT)
8. ssxmod_itna2          (Anti-bot - IMPORTANT)
9. tfstk                 (Fingerprint - IMPORTANT)
10. cbc                  (Anti-bot - IMPORTANT)
```

### Full Recommended Set (14 cookies)

For maximum compatibility, also include:

```
11. aui                  (User ID)
12. cnaui                (User ID)
13. qwen-locale          (Preference)
14. x-ap                 (Region)
```

### Can Skip (6 cookies)

These are analytics/tracking and not required:

```
- _bl_uid
- _c_WBKFRo
- _gcl_au
- qwen-theme
- qwen-thinking_mode
- xlly_s
```

## Quick Refresh Guide

1. **Open browser DevTools** (F12) on https://chat.qwen.ai
2. **Go to Application/Storage → Cookies**
3. **Copy these 10 critical cookies:**
   - token, cna, isg, acw_tc, atpsida, sca
   - ssxmod_itna, ssxmod_itna2, tfstk, cbc
4. **Update cookies.txt** in Netscape format
5. **Restart proxy** to load new cookies

## Expiration Schedule

| Date | Cookies Expiring | Action Needed |
|------|------------------|---------------|
| 2026-09-13 | acw_tc, ssxmod_itna, ssxmod_itna2 | **URGENT** - These expired 2 days ago! |
| 2026-09-16 | xlly_s | Optional |
| 2026-10-13 | token | **CRITICAL** - Auth will fail |
| 2026-10-23 | _gcl_au | Optional (analytics) |
| 2026-12-17 | _bl_uid | Optional (analytics) |

## ⚠️ URGENT ACTION REQUIRED

Your WAF and anti-bot cookies expired on **2026-09-13** (2 days ago):
- `acw_tc` (Alibaba Cloud WAF)
- `ssxmod_itna` (Anti-bot)
- `ssxmod_itna2` (Anti-bot)

Your authentication token expires on **2026-10-13** (28 days from now).

**Recommendation:** Refresh all cookies NOW following QUICK-START.md to avoid service interruption.

## Code References

- **Cookie loading:** `src/config.js:29-68`
- **Cookie usage:** `src/qwen.js:15-17, 40`
- **Token extraction:** `src/qwen.js:16` explicitly extracts `token` cookie
- **Headers building:** `src/qwen.js:31-59` includes full cookie string

## Additional Headers

Besides cookies, these headers are also sent (from headers.json):

- `bx-ua` (~2000 chars) - Browser fingerprint
- `bx-umidtoken` - Anti-bot token (has hardcoded fallback in code)

These should also be refreshed when updating cookies.

## Testing

After refreshing cookies:

```bash
# Test locally
npm start
curl http://localhost:3000/health/credentials

# Test production
curl https://qwnp.onrender.com/health/credentials
```

The `/health/credentials` endpoint validates that cookies are loaded correctly.

## Notes

- The proxy sends **ALL** cookies in every request (see `qwen.js:40`)
- Qwen's API is protected by Aliyun WAF which requires valid session cookies
- Direct API testing from dev environments may be blocked even with valid cookies
- The deployed Render proxy works because its IP is not flagged by the WAF
- Session cookies (`atpsida`, `sca`, `x-ap`) say "Session" but have long lifetimes in practice

## Related Documentation

- Cookie capture instructions: `QUICK-START.md`
- Project architecture: `../CLAUDE.md`
- Endpoints reference: `endpoints.txt`
