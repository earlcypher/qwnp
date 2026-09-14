#!/usr/bin/env node

/**
 * CLI Chatbot with Client-Side Persistence
 * Demonstrates proper usage of stateless API (like OpenAI)
 *
 * The CLIENT maintains conversation history and sends it with each request
 */

import http from 'http';
import readline from 'readline';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const PROXY_HOST = 'localhost';
const PROXY_PORT = 3000;
const HISTORY_FILE = '.chat-history.json';

// Conversation history (client-side persistence)
let messages = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n💬 You: '
});

/**
 * Make request to proxy with full conversation history
 */
function chat(userMessage) {
  return new Promise((resolve, reject) => {
    // Add user message to history
    messages.push({ role: 'user', content: userMessage });

    // Send FULL conversation history (OpenAI-compatible)
    const requestBody = JSON.stringify({
      model: 'qwen3.7-plus',
      messages: messages,  // Full history!
      stream: false
    });

    const options = {
      hostname: PROXY_HOST,
      port: PROXY_PORT,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (response.error) {
            reject(new Error(response.error.message));
            return;
          }

          const assistantMessage = response.choices[0].message.content;

          // Add assistant response to history
          messages.push({ role: 'assistant', content: assistantMessage });

          resolve(assistantMessage);
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Save conversation to file
 */
function saveHistory() {
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2));
    console.log(`\n💾 Saved ${messages.length} messages to ${HISTORY_FILE}`);
  } catch (error) {
    console.error(`\n❌ Failed to save: ${error.message}`);
  }
}

/**
 * Load conversation from file
 */
function loadHistory() {
  try {
    if (existsSync(HISTORY_FILE)) {
      const data = readFileSync(HISTORY_FILE, 'utf8');
      messages = JSON.parse(data);
      console.log(`\n📂 Loaded ${messages.length} messages from ${HISTORY_FILE}`);
      showHistory();
    } else {
      console.log(`\n❌ No saved history found`);
    }
  } catch (error) {
    console.error(`\n❌ Failed to load: ${error.message}`);
  }
}

/**
 * Show conversation history
 */
function showHistory() {
  if (messages.length === 0) {
    console.log('\n📭 No conversation history');
    return;
  }

  console.log('\n📜 Conversation History:');
  console.log('─'.repeat(60));

  messages.forEach((msg, i) => {
    const role = msg.role === 'user' ? '💬 You' : '🤖 AI';
    const content = msg.content.length > 100
      ? msg.content.substring(0, 97) + '...'
      : msg.content;
    console.log(`[${i + 1}] ${role}: ${content}`);
  });

  console.log('─'.repeat(60));
  console.log(`Total: ${messages.length} messages`);
}

/**
 * Clear conversation
 */
function clearHistory() {
  messages = [];
  console.log('\n🗑️  Conversation cleared');
}

/**
 * Show help
 */
function showHelp() {
  console.log('\n📖 Commands:');
  console.log('  /help     - Show this help');
  console.log('  /history  - Show conversation history');
  console.log('  /clear    - Clear conversation (start fresh)');
  console.log('  /save     - Save conversation to file');
  console.log('  /load     - Load conversation from file');
  console.log('  /exit     - Exit the chatbot');
  console.log('');
  console.log('💡 The chatbot maintains conversation context!');
  console.log('   Try asking follow-up questions to test persistence.');
}

/**
 * Welcome message
 */
function showWelcome() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     CLI Chatbot with Client-Side Persistence            ║');
  console.log('║     Using Stateless Qwen Proxy (OpenAI-compatible)      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('💡 Conversation history is maintained by the CLIENT');
  console.log('   Each request sends the full conversation to the server');
  console.log('');
  console.log('Type /help for commands, or just start chatting!');
}

/**
 * Handle user input
 */
async function handleInput(input) {
  const trimmed = input.trim();

  // Handle commands
  if (trimmed.startsWith('/')) {
    const command = trimmed.toLowerCase();

    switch (command) {
      case '/exit':
      case '/quit':
        console.log('\n👋 Goodbye!\n');
        process.exit(0);

      case '/help':
        showHelp();
        return;

      case '/history':
        showHistory();
        return;

      case '/clear':
        clearHistory();
        return;

      case '/save':
        saveHistory();
        return;

      case '/load':
        loadHistory();
        return;

      default:
        console.log(`\n❌ Unknown command: ${command}`);
        console.log('   Type /help for available commands');
        return;
    }
  }

  if (!trimmed) {
    return;
  }

  // Send message to AI
  try {
    const response = await chat(trimmed);
    console.log(`\n🤖 AI: ${response}`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    // Remove the failed user message from history
    messages.pop();
  }
}

// Main
showWelcome();
rl.prompt();

rl.on('line', async (line) => {
  await handleInput(line);
  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});
