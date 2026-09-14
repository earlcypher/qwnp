import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();

class Config {
  constructor() {
    this.port = process.env.PORT || 3000;
    this.cookiesFile = process.env.QWEN_COOKIES_FILE || './cookies.txt';
    this.headersFile = process.env.QWEN_HEADERS_FILE || './headers.json';
    this.cookies = this.loadCookies();
    this.headers = this.loadHeaders();
  }

  loadCookies() {
    try {
      const cookiesPath = resolve(this.cookiesFile);
      const content = readFileSync(cookiesPath, 'utf-8');

      // Parse cookies.txt format (tab-separated: name, value, domain, path, ...)
      const cookies = {};
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const value = parts[1].trim();

          // Sanitize cookie value - remove any control characters and newlines
          const sanitized = value.replace(/[\x00-\x1F\x7F]/g, '');

          if (name && sanitized) {
            cookies[name] = sanitized;
          }
        }
      }

      return cookies;
    } catch (error) {
      console.error('Failed to load cookies:', error.message);
      return {};
    }
  }

  getCookieString() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  getCookie(name) {
    return this.cookies[name];
  }

  loadHeaders() {
    try {
      const headersPath = resolve(this.headersFile);
      if (!existsSync(headersPath)) {
        console.warn('⚠️  headers.json not found - using default headers (may cause auth errors)');
        console.warn('   See capture-headers.md for instructions on capturing headers');
        return {};
      }

      const content = readFileSync(headersPath, 'utf-8');
      const headers = JSON.parse(content);
      console.log('✓ Loaded custom headers from headers.json');
      return headers;
    } catch (error) {
      console.error('Failed to load headers.json:', error.message);
      return {};
    }
  }

  getHeader(name) {
    return this.headers[name];
  }
}

export default new Config();
