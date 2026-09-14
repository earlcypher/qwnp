import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import config from '../config.js';
import https from 'https';

/**
 * Cookie Management Service
 * Handles Qwen API cookie operations
 */

class CookieService {
  constructor() {
    this.cookiesFile = config.cookiesFile;
  }

  /**
   * Get cookie file status and metadata
   */
  getCookieStatus() {
    try {
      const cookiesPath = resolve(this.cookiesFile);

      // Check if using environment variable
      if (process.env.COOKIES_B64) {
        return {
          source: 'environment',
          exists: true,
          valid: Object.keys(config.cookies).length > 0,
          cookie_count: Object.keys(config.cookies).length,
          has_token: !!config.getCookie('token'),
          last_modified: null,
          file_path: null
        };
      }

      // Check file-based cookies
      if (!existsSync(cookiesPath)) {
        return {
          source: 'file',
          exists: false,
          valid: false,
          cookie_count: 0,
          has_token: false,
          last_modified: null,
          file_path: cookiesPath
        };
      }

      const stats = statSync(cookiesPath);
      const cookies = config.cookies;

      return {
        source: 'file',
        exists: true,
        valid: Object.keys(cookies).length > 0,
        cookie_count: Object.keys(cookies).length,
        has_token: !!config.getCookie('token'),
        last_modified: stats.mtime.toISOString(),
        file_path: cookiesPath,
        file_size: stats.size
      };
    } catch (error) {
      console.error('[CookieService] Get status error:', error);
      throw new Error('Failed to get cookie status');
    }
  }

  /**
   * Update cookies from uploaded content
   * @param {string} content - Cookie file content (Netscape format)
   */
  updateCookies(content) {
    try {
      // Validate content format
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      if (lines.length === 0) {
        throw new Error('Cookie file is empty or invalid format');
      }

      // Parse and validate cookies
      const cookies = {};
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const value = parts[1].trim();
          if (name && value) {
            cookies[name] = value;
          }
        }
      }

      if (Object.keys(cookies).length === 0) {
        throw new Error('No valid cookies found in file');
      }

      // Check for required token cookie
      if (!cookies.token) {
        throw new Error('Missing required "token" cookie');
      }

      // Write to file
      const cookiesPath = resolve(this.cookiesFile);
      writeFileSync(cookiesPath, content, 'utf-8');

      // Reload config
      config.cookies = config.parseCookiesContent(content);

      return {
        success: true,
        cookie_count: Object.keys(cookies).length,
        has_token: true,
        file_path: cookiesPath
      };
    } catch (error) {
      console.error('[CookieService] Update cookies error:', error);
      throw error;
    }
  }

  /**
   * Test connection to Qwen API with current cookies
   */
  async testConnection() {
    try {
      const cookieString = config.getCookieString();

      if (!cookieString) {
        return {
          success: false,
          error: 'No cookies configured'
        };
      }

      // Test by calling Qwen's model list endpoint
      const result = await this.makeTestRequest(cookieString);

      return {
        success: result.success,
        status_code: result.statusCode,
        response_time: result.responseTime,
        error: result.error,
        message: result.success
          ? 'Connection successful - cookies are valid'
          : 'Connection failed - cookies may be expired'
      };
    } catch (error) {
      console.error('[CookieService] Test connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make a test request to Qwen API
   */
  makeTestRequest(cookieString) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const options = {
        hostname: 'qwen.chat.qq.com',
        path: '/api/v1/models',
        method: 'GET',
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        const responseTime = Date.now() - startTime;

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              responseTime
            });
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              responseTime,
              error: `HTTP ${res.statusCode}`
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          statusCode: null,
          responseTime: Date.now() - startTime,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: null,
          responseTime: Date.now() - startTime,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }
}

export default new CookieService();
