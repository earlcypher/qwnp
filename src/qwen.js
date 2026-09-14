import https from 'https';
import config from './config.js';
import { generateRequestId, getTimezoneHeader } from './utils.js';

const QWEN_BASE_URL = 'chat.qwen.ai';
const MODELS_ENDPOINT = '/api/v2/models';
const CHAT_ENDPOINT = '/api/v2/chat/completions';

/**
 * Qwen API Client
 */
class QwenClient {
  constructor() {
    this.cookieString = config.getCookieString();
    this.token = config.getCookie('token');
    this.umidtoken = config.getCookie('bx-umidtoken') || 'T2gApOqwXfrS_qPdaTRShpgfFvvoyj4k6be6dFIPviLbe-swbd43bPpabeGVLmNlEY4=';
  }

  /**
   * Get common headers for Qwen API
   */
  getHeaders(chatId) {
    const bxUa = config.getHeader('bx-ua');
    const bxUmidtoken = config.getHeader('bx-umidtoken') || this.umidtoken;

    return {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Content-Type': 'application/json',
      'Cookie': this.cookieString,
      'DNT': '1',
      'Origin': 'https://chat.qwen.ai',
      'Referer': `https://chat.qwen.ai/c/${chatId}`,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Timezone': getTimezoneHeader(),
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
      'X-Accel-Buffering': 'no',
      'X-Request-Id': generateRequestId(),
      'bx-ua': bxUa,
      'bx-umidtoken': bxUmidtoken,
      'bx-v': '2.5.37',
      'sec-ch-ua': '"Brave";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'source': 'h5'
    };
  }

  /**
   * Create a new chat and return the chat_id
   */
  async createChat(model = 'qwen3.7-plus') {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify({
        chatId: '',
        models: [model],
        project_id: '',
        timestamp: Date.now(),
        chat_type: 't2t',
        chat_mode: 'normal'
      });

      const options = {
        hostname: QWEN_BASE_URL,
        path: '/api/v2/chats/new',
        method: 'POST',
        headers: {
          ...this.getHeaders('new-chat'),
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('[Qwen API] Create chat response status:', res.statusCode);
            console.log('[Qwen API] Create chat response body:', data.substring(0, 500));

            const parsed = JSON.parse(data);
            if (parsed.success && parsed.data && parsed.data.id) {
              console.log('[Qwen API] Created new chat:', parsed.data.id);
              resolve(parsed.data.id);
            } else {
              console.error('[Qwen API] Create chat failed - parsed response:', parsed);
              reject(new Error('Failed to create chat: ' + data));
            }
          } catch (e) {
            console.error('[Qwen API] Failed to parse create chat response. Raw data:', data.substring(0, 500));
            reject(new Error('Failed to parse create chat response: ' + data.substring(0, 200)));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.write(bodyStr);
      req.end();
    });
  }

  /**
   * Get available models
   */
  async getModels() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: QWEN_BASE_URL,
        path: MODELS_ENDPOINT,
        method: 'GET',
        headers: this.getHeaders('')
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Failed to parse models response'));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.end();
    });
  }

  /**
   * Create chat completion
   */
  async createChatCompletion(chatId, requestBody, onStream = null) {
    return new Promise((resolve, reject) => {
      const path = `${CHAT_ENDPOINT}?chat_id=${chatId}`;
      const bodyStr = JSON.stringify(requestBody);

      const options = {
        hostname: QWEN_BASE_URL,
        path: path,
        method: 'POST',
        headers: {
          ...this.getHeaders(chatId),
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      };

      console.log('[Qwen API] Request URL:', `https://${options.hostname}${options.path}`);
      console.log('[Qwen API] Request headers:', JSON.stringify(options.headers, null, 2));
      console.log('[Qwen API] Request body:', bodyStr.substring(0, 500));

      const req = https.request(options, (res) => {
        console.log(`[Qwen API] Response status: ${res.statusCode}`);
        console.log('[Qwen API] Response headers:', JSON.stringify(res.headers, null, 2));

        // Handle streaming response
        if (onStream && requestBody.stream) {
          res.on('data', (chunk) => {
            try {
              const chunkStr = chunk.toString();
              console.log('[Qwen API] Received chunk:', chunkStr.substring(0, 200));
              onStream(chunk);
            } catch (e) {
              console.error('Stream processing error:', e);
            }
          });

          res.on('end', () => {
            resolve();
          });

          res.on('error', (e) => {
            reject(e);
          });
        } else {
          // Non-streaming response
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              console.log('[Qwen API] Full response:', data.substring(0, 500));

              // Check if this is an error response
              try {
                const errorCheck = JSON.parse(data);
                if (errorCheck.success === false) {
                  console.error('[Qwen API] Error response:', errorCheck);
                  reject(new Error(`Qwen API error: ${errorCheck.data?.code} - ${errorCheck.data?.details || 'Unknown error'}`));
                  return;
                }
              } catch (e) {
                // Not a JSON error, continue with SSE parsing
              }

              // Extract content from SSE stream
              const lines = data.split('\n');
              let fullContent = '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  const jsonStr = line.substring(5).trim();
                  if (jsonStr && jsonStr !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(jsonStr);
                      console.log('[Qwen API] Parsed chunk:', JSON.stringify(parsed).substring(0, 200));

                      if (parsed.choices && parsed.choices[0]?.delta?.content) {
                        fullContent += parsed.choices[0].delta.content;
                      } else if (parsed.output && parsed.output.text) {
                        fullContent += parsed.output.text;
                      } else if (parsed.text) {
                        fullContent += parsed.text;
                      }
                    } catch (e) {
                      // Skip invalid JSON
                    }
                  }
                }
              }

              console.log('[Qwen API] Extracted content length:', fullContent.length);
              resolve(fullContent);
            } catch (e) {
              reject(new Error('Failed to parse chat response: ' + e.message));
            }
          });
        }
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.write(bodyStr);
      req.end();
    });
  }
}

export default new QwenClient();
