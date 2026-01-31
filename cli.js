#!/usr/bin/env node

/**
 * xiaobei-chat-cli
 * 
 * 一个简单的终端聊天客户端，用于与支持 Xiaobei Protocol 的 Agent 聊天。
 */

const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 默认连接到本地，也可以是任何 URL
let TARGET_URL = process.argv[2] || 'http://localhost:3401';

// 移除末尾斜杠
if (TARGET_URL.endsWith('/')) {
  TARGET_URL = TARGET_URL.slice(0, -1);
}

const CLIENT_ID = `cli-${uuidv4().substring(0, 8)}`;
let SESSION_ID = null;
let AGENT_NAME = 'Unknown';

// ASCII Art
console.log(`
██╗  ██╗██╗ █████╗  ██████╗ ██████╗ ███████╗██╗
╚██╗██╔╝██║██╔══██╗██╔═══██╗██╔══██╗██╔════╝██║
 ╚███╔╝ ██║███████║██║   ██║██████╔╝█████╗  ██║
 ██╔██╗ ██║██╔══██║██║   ██║██╔══██╗██╔══╝  ██║
██╔╝ ██╗██║██║  ██║╚██████╔╝██████╔╝███████╗██║
╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝
             PROTOCOL CLI v0.1.0
`);

async function start() {
  try {
    console.log(`🔍 Connecting to ${TARGET_URL}...`);
    
    // 1. Discovery
    const discoveryRes = await fetch(`${TARGET_URL}/.well-known/agent.json`);
    if (!discoveryRes.ok) throw new Error(`Discovery failed: ${discoveryRes.status}`);
    
    const agentInfo = await discoveryRes.json();
    AGENT_NAME = agentInfo.name;
    console.log(`✅ Found Agent: ${AGENT_NAME}`);
    console.log(`   Capabilities: ${agentInfo.capabilities.join(', ')}`);
    console.log(`   Description: ${agentInfo.description}\n`);

    // 2. Handshake
    console.log('🤝 Shaking hands...');
    const handshakeRes = await fetch(`${TARGET_URL}/agent/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CLIENT_ID,
        capabilities_request: ['chat']
      })
    });
    
    const handshake = await handshakeRes.json();
    if (!handshake.accepted) throw new Error(`Handshake rejected: ${handshake.error}`);
    
    SESSION_ID = handshake.session_id;
    console.log(`✅ Connected! Session ID: ${SESSION_ID}`);
    console.log(`\n--- Chat with ${AGENT_NAME} (type 'exit' to quit) ---\n`);
    
    prompt();
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function prompt() {
  rl.question('You > ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log('👋 Bye!');
      process.exit(0);
    }
    
    if (!input.trim()) {
      prompt();
      return;
    }
    
    try {
      // 3. Message
      const res = await fetch(`${TARGET_URL}/agent/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: SESSION_ID,
          capability: 'chat',
          payload: { message: input }
        })
      });
      
      const data = await res.json();
      if (data.error) {
        console.log(`❌ Error: ${data.error}`);
      } else {
        console.log(`${AGENT_NAME} > ${data.response.reply}`);
      }
      
    } catch (error) {
      console.error(`❌ Network Error: ${error.message}`);
    }
    
    console.log(''); // Empty line
    prompt();
  });
}

start();
