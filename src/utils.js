import { randomUUID } from 'crypto';

/**
 * Generate a unique request ID
 */
export function generateRequestId() {
  return randomUUID();
}

/**
 * Generate a chat ID
 */
export function generateChatId() {
  return randomUUID();
}

/**
 * Generate current timezone header in the format Qwen expects
 * Format: "Mon Sep 14 2026 02:14:38 GMT+0800"
 */
export function getTimezoneHeader() {
  const now = new Date();
  // Get timezone offset in minutes and convert to +HHMM format
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mins = String(Math.abs(offset) % 60).padStart(2, '0');

  // Format: "Day Mon DD YYYY HH:MM:SS GMT+HHMM"
  const str = now.toString();
  const match = str.match(/^([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\d{2}) (\d{4}) (\d{2}:\d{2}:\d{2})/);

  if (match) {
    return `${match[1]} ${match[2]} ${match[3]} ${match[4]} ${match[5]} GMT${sign}${hours}${mins}`;
  }

  // Fallback to simpler format
  return now.toDateString() + ' ' + now.toTimeString().split(' ')[0] + ' GMT' + sign + hours + mins;
}

/**
 * Estimate token count for text (rough approximation)
 * Rule of thumb: 1 token ≈ 4 characters for English text
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncate messages to stay within token limits
 * Strategy: Keep recent messages, drop middle history if needed
 */
function truncateMessages(messages, maxTokens = 6000) {
  if (!messages || messages.length === 0) return messages;

  // Calculate total tokens
  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += estimateTokens(msg.content);
  }

  // If within limits, return as-is
  if (totalTokens <= maxTokens) {
    return messages;
  }

  console.log(`[Context Window] Total tokens: ${totalTokens}, limit: ${maxTokens}. Truncating...`);

  // Always keep the last message (current question)
  const lastMessage = messages[messages.length - 1];
  const lastTokens = estimateTokens(lastMessage.content);

  // Reserve tokens for the last message and formatting overhead
  const availableTokens = maxTokens - lastTokens - 200;

  // Keep as many recent messages as fit
  const truncated = [lastMessage];
  let currentTokens = lastTokens;

  // Walk backwards from second-to-last message
  for (let i = messages.length - 2; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (currentTokens + msgTokens <= availableTokens) {
      truncated.unshift(messages[i]);
      currentTokens += msgTokens;
    } else {
      // Add truncation notice
      const dropped = i + 1;
      console.log(`[Context Window] Kept ${truncated.length} messages, dropped ${dropped} older messages`);
      truncated.unshift({
        role: 'system',
        content: `[Earlier conversation history truncated - ${dropped} messages omitted to stay within context limits]`
      });
      break;
    }
  }

  return truncated;
}

/**
 * Transform OpenAI messages format to Qwen format
 *
 * Since Qwen's API doesn't accept multiple messages to a fresh chat_id,
 * we concatenate conversation history into a single prompt for stateless operation.
 */
export function transformMessages(messages, chatId) {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Truncate messages to stay within context window limits
  const truncatedMessages = truncateMessages(messages);

  let combinedContent;

  if (truncatedMessages.length === 1) {
    // Single message - send directly
    combinedContent = truncatedMessages[0].content;
  } else {
    // Multiple messages - concatenate conversation history into single prompt
    const conversationHistory = truncatedMessages.slice(0, -1)
      .map(msg => {
        if (msg.role === 'system') return msg.content; // Truncation notices
        return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
      })
      .join('\n\n');

    const currentMessage = truncatedMessages[truncatedMessages.length - 1].content;

    combinedContent = `Previous conversation:\n\n${conversationHistory}\n\n---\n\nCurrent question:\n${currentMessage}`;
  }

  return [{
    id: null,
    fid: generateRequestId(),
    parentId: null,
    childrenIds: [],
    role: 'user',
    content: combinedContent,
    user_action: 'chat',
    files: [],
    timestamp: Math.floor(Date.now() / 1000),
    models: ['qwen3.7-plus'],
    model: '',
    chat_type: 't2t',
    feature_config: {
      thinking_enabled: false,
      output_schema: 'phase',
      research_mode: 'normal',
      auto_thinking: false,
      thinking_mode: 'Fast',
      auto_search: true,
      use_memory: false,
      reference_saved_memories: false,
      reference_chat_history: false,
      enable_context: false
    },
    extra: {
      meta: {
        subChatType: 't2t'
      }
    },
    sub_chat_type: 't2t',
    parent_id: null
  }];
}

/**
 * Transform OpenAI request to Qwen request format
 */
export function transformToQwenRequest(openaiRequest, chatId) {
  const model = openaiRequest.model || 'qwen3.7-plus';

  return {
    stream: openaiRequest.stream !== false,
    version: '2.1',
    incremental_output: true,
    chatId: chatId,
    parentId: '',
    chat_id: chatId,
    chat_mode: 'normal',
    model: model,
    parent_id: null,
    messages: transformMessages(openaiRequest.messages, chatId),
    timestamp: Math.floor(Date.now() / 1000)
  };
}

/**
 * Create OpenAI-compatible chunk response
 */
export function createOpenAIChunk(content, model, finish_reason = null) {
  return {
    id: `chatcmpl-${generateRequestId()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: finish_reason ? {} : { content },
      finish_reason: finish_reason
    }]
  };
}

/**
 * Create OpenAI-compatible non-streaming response
 */
export function createOpenAIResponse(content, model) {
  return {
    id: `chatcmpl-${generateRequestId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

/**
 * Format SSE data
 */
export function formatSSE(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}
