/**
 * Test stateless API (OpenAI-compatible)
 * Client maintains conversation history and sends full messages array
 */

import http from 'http';

const PORT = 3000;
const HOST = 'localhost';

function makeRequest(messages) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'qwen3.7-plus',
      messages: messages,
      stream: false
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve(response.choices[0].message.content);
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function test() {
  console.log('Testing Stateless API (OpenAI-compatible)\n');

  // Request 1: Initial message
  console.log('Request 1: "My favorite numbers are 7 and 42"');
  const response1 = await makeRequest([
    { role: 'user', content: 'My favorite numbers are 7 and 42. Remember that!' }
  ]);
  console.log(`Response: ${response1}\n`);

  // Request 2: Client sends FULL history (like OpenAI)
  console.log('Request 2: Client sends FULL conversation history');
  const response2 = await makeRequest([
    { role: 'user', content: 'My favorite numbers are 7 and 42. Remember that!' },
    { role: 'assistant', content: response1 },
    { role: 'user', content: 'What are my favorite numbers?' }
  ]);
  console.log(`Response: ${response2}\n`);

  // Check result
  const success = response2.includes('7') && response2.includes('42');
  console.log(success ? '✅ SUCCESS! Stateless API works!' : '❌ FAILED');
}

test().catch(console.error);
