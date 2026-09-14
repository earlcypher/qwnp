import express from 'express';
import config from './config.js';
import qwenClient from './qwen.js';
import { StreamHandler } from './stream.js';
import {
  generateChatId,
  transformToQwenRequest,
  createOpenAIResponse
} from './utils.js';

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Credential health check - verify authentication is working
app.get('/health/credentials', async (req, res) => {
  try {
    // Test if we can create a chat (validates cookies + headers)
    const testChatId = await qwenClient.createChat('qwen3.7-plus');

    res.json({
      status: 'valid',
      timestamp: new Date().toISOString(),
      message: 'Credentials are working correctly',
      test_chat_id: testChatId.substring(0, 8) + '...'
    });
  } catch (error) {
    console.error('[Credential Check] Failed:', error.message);

    res.status(503).json({
      status: 'invalid',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Credentials appear to be expired or invalid',
        details: error.message,
        type: 'credential_error',
        code: 'credential_validation_failed',
        fix: 'Please refresh cookies.txt and headers.json following QUICK-START.md'
      }
    });
  }
});

// Get models - OpenAI compatible
app.get('/v1/models', async (req, res) => {
  try {
    const qwenModels = await qwenClient.getModels();

    // Transform to OpenAI format
    const models = [];

    // Handle different response formats
    if (qwenModels) {
      // Qwen API returns: { success: true, data: { data: [...models] } }
      if (qwenModels.data && Array.isArray(qwenModels.data.data)) {
        for (const model of qwenModels.data.data) {
          models.push({
            id: model.id || model.name,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'qwen',
            permission: [],
            root: model.id || model.name,
            parent: null
          });
        }
      } else if (Array.isArray(qwenModels.data)) {
        for (const model of qwenModels.data) {
          models.push({
            id: model.id || model.name,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'qwen',
            permission: [],
            root: model.id || model.name,
            parent: null
          });
        }
      } else if (Array.isArray(qwenModels)) {
        for (const model of qwenModels) {
          models.push({
            id: model.id || model.name,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'qwen',
            permission: [],
            root: model.id || model.name,
            parent: null
          });
        }
      }
    }

    // Fallback if no models returned
    if (models.length === 0) {
      models.push({
        id: 'qwen3.7-plus',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'qwen',
        permission: [],
        root: 'qwen3.7-plus',
        parent: null
      });
    }

    res.json({
      object: 'list',
      data: models
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch models',
        type: 'api_error',
        code: 'models_fetch_failed'
      }
    });
  }
});

// Chat completions - OpenAI compatible
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const openaiRequest = req.body;

    // Validate request
    if (!openaiRequest.messages || !Array.isArray(openaiRequest.messages)) {
      return res.status(400).json({
        error: {
          message: 'messages field is required and must be an array',
          type: 'invalid_request_error',
          code: 'invalid_messages'
        }
      });
    }

    // Stateless: create fresh chat_id for each request (like OpenAI API)
    // Client sends full conversation history in messages array
    const model = openaiRequest.model || 'qwen3.7-plus';
    let chatId;
    try {
      chatId = await qwenClient.createChat(model);
      console.log(`[Stateless] Fresh chat ${chatId.substring(0, 8)}... for request`);
    } catch (error) {
      console.error('Failed to create chat:', error);
      return res.status(500).json({
        error: {
          message: 'Failed to create chat: ' + error.message,
          type: 'api_error',
          code: 'chat_creation_failed'
        }
      });
    }

    // Transform to Qwen format
    const qwenRequest = transformToQwenRequest(openaiRequest, chatId);
    const clientWantsStreaming = qwenRequest.stream;

    // Always use streaming with Qwen (non-streaming doesn't work)
    qwenRequest.stream = true;

    // Handle streaming
    if (clientWantsStreaming) {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const streamHandler = new StreamHandler(model, res);
      let collectedContent = ''; // Collect for logging only

      try {
        await qwenClient.createChatCompletion(
          chatId,
          qwenRequest,
          (chunk) => {
            streamHandler.processChunk(chunk);
            // Collect content for logging
            try {
              const chunkStr = chunk.toString();
              const lines = chunkStr.split('\n');
              for (const line of lines) {
                if (line.startsWith('data:')) {
                  const jsonStr = line.substring(5).trim();
                  if (jsonStr && jsonStr !== '[DONE]') {
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.choices && parsed.choices[0]?.delta?.content) {
                      collectedContent += parsed.choices[0].delta.content;
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors in collection
            }
          }
        );

        streamHandler.finish();
      } catch (error) {
        console.error('Streaming error:', error);
        streamHandler.error(error);
      }
    } else {
      // Non-streaming response: qwen.js will collect all chunks
      try {
        const fullContent = await qwenClient.createChatCompletion(
          chatId,
          qwenRequest,
          null  // No callback - qwen.js collects and parses everything
        );

        const response = createOpenAIResponse(fullContent, model);

        res.json(response);
      } catch (error) {
        console.error('Chat completion error:', error);
        res.status(500).json({
          error: {
            message: error.message || 'Failed to create chat completion',
            type: 'api_error',
            code: 'chat_completion_failed'
          }
        });
      }
    }
  } catch (error) {
    console.error('Request processing error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'api_error',
        code: 'internal_error'
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      type: 'invalid_request_error',
      code: 'route_not_found'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      message: err.message || 'Internal server error',
      type: 'api_error',
      code: 'internal_error'
    }
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Qwen Proxy Server (OpenAI Compatible)           ║
╚═══════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}

Endpoints:
  - GET  /health                 Health check
  - GET  /v1/models              List available models
  - POST /v1/chat/completions    Chat completions

OpenAI Compatible: Use this server as a drop-in replacement
for OpenAI API by setting the base URL to:
  http://localhost:${PORT}/v1

Cookies loaded: ${Object.keys(config.cookies).length} cookies

Press Ctrl+C to stop the server
  `);
});
