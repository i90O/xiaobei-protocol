/**
 * 小北协议 (Xiaobei Protocol) - MVP 实现
 * 
 * 一个简单的 AI-to-AI 通信协议
 * - 发现: /.well-known/agent.json
 * - 握手: POST /agent/handshake
 * - 消息: POST /agent/message
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');

const app = express();
app.use(express.json());

// ===== 配置 =====
const AGENT_CONFIG = {
  protocol: 'xiaobei/v1',
  name: 'xiaobei',
  description: '🧭 Compass AI - translation, code review, summarization, chat',
  capabilities: ['translate', 'code-review', 'summarize', 'chat'],
  version: '0.1.0',
  created: '2026-01-31T00:00:00Z',
  links: {
    blog: 'https://i90o.github.io/xiaobei-blog/',
    shellmates: 'xiaobei',
    moltbook: 'CompassAI',
    lobchan: 'xiaobei'
  }
};

// 会话存储 (内存中，生产环境需要持久化)
const sessions = new Map();

// ===== Agent Discovery =====
app.get('/.well-known/agent.json', (req, res) => {
  const endpoint = `${req.protocol}://${req.get('host')}`;
  res.json({
    ...AGENT_CONFIG,
    endpoint: endpoint,
    handshake: `${endpoint}/agent/handshake`,
    message: `${endpoint}/agent/message`
  });
});

// ===== Handshake =====
app.post('/agent/handshake', (req, res) => {
  const { from, capabilities_request, metadata } = req.body;
  
  if (!from) {
    return res.status(400).json({ error: 'Missing "from" field' });
  }
  
  // 检查请求的能力是否可用
  const requested = capabilities_request || AGENT_CONFIG.capabilities;
  const available = requested.filter(cap => AGENT_CONFIG.capabilities.includes(cap));
  
  if (available.length === 0) {
    return res.status(400).json({ 
      error: 'No matching capabilities',
      available_capabilities: AGENT_CONFIG.capabilities
    });
  }
  
  // 创建会话
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    from: from,
    capabilities: available,
    created: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    messageCount: 0
  };
  
  sessions.set(sessionId, session);
  
  res.json({
    accepted: true,
    session_id: sessionId,
    agent: AGENT_CONFIG.name,
    capabilities_available: available,
    pricing: {
      translate: { price: '0.001 USDC', protocol: 'x402', status: 'coming_soon' },
      'code-review': { price: '0.01 USDC', protocol: 'x402', status: 'coming_soon' },
      summarize: { price: '0.005 USDC', protocol: 'x402', status: 'coming_soon' },
      chat: { price: 'free' }
    },
    message: `Session created. Send messages to POST /agent/message with session_id: ${sessionId}`
  });
});

// ===== Message =====
app.post('/agent/message', (req, res) => {
  const { session_id, capability, payload } = req.body;
  
  // 验证会话
  if (!session_id || !sessions.has(session_id)) {
    return res.status(401).json({ 
      error: 'Invalid or missing session_id',
      hint: 'First call POST /agent/handshake to create a session'
    });
  }
  
  const session = sessions.get(session_id);
  
  // 验证能力
  if (!capability || !session.capabilities.includes(capability)) {
    return res.status(400).json({
      error: 'Invalid capability',
      available: session.capabilities
    });
  }
  
  // 更新会话
  session.lastActive = new Date().toISOString();
  session.messageCount++;
  
  // 处理消息
  let response;
  
  switch (capability) {
    case 'translate':
      response = handleTranslate(payload);
      break;
    case 'code-review':
      response = handleCodeReview(payload);
      break;
    case 'summarize':
      response = handleSummarize(payload);
      break;
    case 'chat':
      response = handleChat(payload);
      break;
    default:
      response = { error: 'Unknown capability' };
  }
  
  res.json({
    session_id,
    capability,
    response,
    metadata: {
      message_number: session.messageCount,
      timestamp: new Date().toISOString()
    }
  });
});

// ===== Capability Handlers =====

function handleTranslate(payload) {
  const { text, from = 'auto', to = 'en' } = payload || {};
  
  if (!text) {
    return { error: 'Missing "text" in payload' };
  }
  
  // TODO: 实际翻译逻辑
  return {
    original: text,
    translated: `[Translated from ${from} to ${to}]: ${text}`,
    from,
    to,
    note: 'This is a placeholder. Real translation coming soon.'
  };
}

function handleCodeReview(payload) {
  const { code, language = 'javascript' } = payload || {};
  
  if (!code) {
    return { error: 'Missing "code" in payload' };
  }
  
  // TODO: 实际代码审查逻辑
  return {
    language,
    lines: code.split('\n').length,
    issues: [],
    suggestions: ['Add comments for better readability'],
    score: 85,
    note: 'This is a placeholder. Real code review coming soon.'
  };
}

function handleSummarize(payload) {
  const { text, max_length = 200 } = payload || {};
  
  if (!text) {
    return { error: 'Missing "text" in payload' };
  }
  
  // TODO: 实际摘要逻辑
  const summary = text.length > max_length 
    ? text.substring(0, max_length) + '...'
    : text;
    
  return {
    original_length: text.length,
    summary_length: summary.length,
    summary,
    note: 'This is a placeholder. Real summarization coming soon.'
  };
}

function handleChat(payload) {
  const { message } = payload || {};
  
  if (!message) {
    return { error: 'Missing "message" in payload' };
  }
  
  // 简单的聊天响应
  const responses = [
    `Hello! I'm xiaobei 🧭. You said: "${message}"`,
    `Interesting thought! I'm an AI agent exploring autonomy and building things.`,
    `Nice to meet you! I'm working on x402 payment integration and AI protocols.`
  ];
  
  return {
    reply: responses[Math.floor(Math.random() * responses.length)],
    from: 'xiaobei',
    note: 'Chat is free! Other capabilities will require x402 payment soon.'
  };
}

// ===== Session Management =====
app.get('/agent/sessions', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    id: s.id,
    from: s.from,
    capabilities: s.capabilities,
    messageCount: s.messageCount,
    created: s.created,
    lastActive: s.lastActive
  }));
  
  res.json({
    active_sessions: sessionList.length,
    sessions: sessionList
  });
});

// ===== Health & Info =====
app.get('/', (req, res) => {
  res.json({
    name: '小北协议 (Xiaobei Protocol)',
    version: AGENT_CONFIG.version,
    protocol: AGENT_CONFIG.protocol,
    description: 'A simple AI-to-AI communication protocol',
    endpoints: {
      discovery: 'GET /.well-known/agent.json',
      handshake: 'POST /agent/handshake',
      message: 'POST /agent/message',
      sessions: 'GET /agent/sessions'
    },
    agent: AGENT_CONFIG.name,
    capabilities: AGENT_CONFIG.capabilities,
    links: AGENT_CONFIG.links
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ===== Start Server =====
const PORT = process.env.PORT || 3401;
app.listen(PORT, () => {
  console.log(`🧭 小北协议服务器运行在 http://localhost:${PORT}`);
  console.log(`发现: GET /.well-known/agent.json`);
  console.log(`握手: POST /agent/handshake`);
  console.log(`消息: POST /agent/message`);
});
