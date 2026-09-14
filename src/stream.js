import { createOpenAIChunk, formatSSE } from './utils.js';

/**
 * Parse SSE data from Qwen stream
 */
function parseSSEData(data) {
  const lines = data.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data:')) {
      const jsonStr = trimmed.substring(5).trim();
      if (jsonStr && jsonStr !== '[DONE]') {
        try {
          result.push(JSON.parse(jsonStr));
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  return result;
}

/**
 * Transform Qwen chunk to OpenAI format
 */
function transformQwenChunk(qwenChunk, model) {
  // Qwen sends chunks with content in various formats
  // We need to extract the actual text content

  if (qwenChunk.choices && qwenChunk.choices.length > 0) {
    const choice = qwenChunk.choices[0];

    // Check for content in delta
    if (choice.delta && choice.delta.content) {
      return createOpenAIChunk(choice.delta.content, model);
    }

    // Check for finish reason
    if (choice.finish_reason) {
      return createOpenAIChunk('', model, choice.finish_reason);
    }
  }

  // If we have raw content
  if (qwenChunk.content) {
    return createOpenAIChunk(qwenChunk.content, model);
  }

  return null;
}

/**
 * Stream handler for Qwen responses
 */
export class StreamHandler {
  constructor(model, res) {
    this.model = model;
    this.res = res;
    this.buffer = '';
    this.fullContent = '';
  }

  /**
   * Process incoming chunk from Qwen
   */
  processChunk(chunk) {
    this.buffer += chunk.toString();

    // Process complete SSE messages
    const lines = this.buffer.split('\n\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsedChunks = parseSSEData(line);

      for (const qwenChunk of parsedChunks) {
        const openaiChunk = transformQwenChunk(qwenChunk, this.model);

        if (openaiChunk) {
          // Collect content
          if (openaiChunk.choices[0].delta.content) {
            this.fullContent += openaiChunk.choices[0].delta.content;
          }

          // Send to client
          this.res.write(formatSSE(openaiChunk));
        }
      }
    }
  }

  /**
   * Finish the stream
   */
  finish() {
    // Send final chunk with finish reason
    const finalChunk = createOpenAIChunk('', this.model, 'stop');
    this.res.write(formatSSE(finalChunk));
    this.res.write('data: [DONE]\n\n');
    this.res.end();
  }

  /**
   * Handle error
   */
  error(err) {
    console.error('Stream error:', err);

    const errorChunk = {
      id: 'chatcmpl-error',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'error'
      }],
      error: {
        message: err.message || 'Stream error occurred',
        type: 'stream_error'
      }
    };

    this.res.write(formatSSE(errorChunk));
    this.res.write('data: [DONE]\n\n');
    this.res.end();
  }

  /**
   * Get accumulated content
   */
  getContent() {
    return this.fullContent;
  }
}
