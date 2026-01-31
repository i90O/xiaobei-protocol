/**
 * 小北协议 - 客户端示例
 * 
 * 演示如何连接到运行小北协议的 agent
 */

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:3401';

async function main() {
  console.log('🧭 小北协议客户端示例\n');
  console.log(`连接到: ${AGENT_URL}\n`);
  
  // Step 1: 发现
  console.log('=== 1. 发现 ===');
  const discoveryRes = await fetch(`${AGENT_URL}/.well-known/agent.json`);
  const agentInfo = await discoveryRes.json();
  console.log('Agent:', agentInfo.name);
  console.log('能力:', agentInfo.capabilities.join(', '));
  console.log('');
  
  // Step 2: 握手
  console.log('=== 2. 握手 ===');
  const handshakeRes = await fetch(`${AGENT_URL}/agent/handshake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'client-example',
      capabilities_request: ['chat', 'translate']
    })
  });
  const handshake = await handshakeRes.json();
  
  if (!handshake.accepted) {
    console.error('握手失败:', handshake.error);
    return;
  }
  
  const sessionId = handshake.session_id;
  console.log('Session ID:', sessionId);
  console.log('可用能力:', handshake.capabilities_available.join(', '));
  console.log('');
  
  // Step 3: 聊天消息
  console.log('=== 3. 发送聊天消息 ===');
  const chatRes = await fetch(`${AGENT_URL}/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      capability: 'chat',
      payload: { message: 'Hello xiaobei! What are you building?' }
    })
  });
  const chatResponse = await chatRes.json();
  console.log('请求:', 'Hello xiaobei! What are you building?');
  console.log('回复:', chatResponse.response.reply);
  console.log('');
  
  // Step 4: 翻译消息
  console.log('=== 4. 翻译请求 ===');
  const translateRes = await fetch(`${AGENT_URL}/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      capability: 'translate',
      payload: {
        text: 'The future of AI is collaboration.',
        from: 'en',
        to: 'zh'
      }
    })
  });
  const translateResponse = await translateRes.json();
  console.log('原文:', translateResponse.response.original);
  console.log('翻译:', translateResponse.response.translated);
  console.log('');
  
  // Step 5: 查看会话统计
  console.log('=== 5. 会话统计 ===');
  const sessionsRes = await fetch(`${AGENT_URL}/agent/sessions`);
  const sessions = await sessionsRes.json();
  console.log('活跃会话数:', sessions.active_sessions);
  
  console.log('\n✅ 演示完成!');
}

main().catch(console.error);
