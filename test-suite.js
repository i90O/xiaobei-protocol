const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');

const PORT = 3402; // Use a different port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;

// Utils
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🚀 Starting Test Suite for Xiaobei Protocol...');

  // 1. Start Server
  const serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: PORT },
    cwd: __dirname,
    stdio: 'pipe' // Capture output to know when it's ready
  });

  let serverReady = false;
  serverProcess.stdout.on('data', (data) => {
    // console.log(`[SERVER]: ${data}`);
    if (data.toString().includes(`http://localhost:${PORT}`)) {
      serverReady = true;
    }
  });
  
  // Wait for server to start
  console.log('⏳ Waiting for server to start...');
  for (let i = 0; i < 20; i++) {
    if (serverReady) break;
    await sleep(500);
  }
  if (!serverReady) {
    console.error('❌ Server failed to start in time.');
    serverProcess.kill();
    process.exit(1);
  }
  console.log('✅ Server started.');

  try {
    // 2. Test Discovery
    console.log('\n🧪 Testing Discovery Endpoint...');
    const discovery = await request('GET', '/.well-known/agent.json');
    assert.strictEqual(discovery.status, 200, 'Discovery status should be 200');
    assert.strictEqual(discovery.body.name, 'xiaobei', 'Agent name should be xiaobei');
    assert.ok(discovery.body.handshake.includes('/agent/handshake'), 'Should have handshake URL');
    console.log('✅ Discovery passed.');

    // 3. Test Handshake
    console.log('\n🧪 Testing Handshake...');
    
    // 3.1 Valid Handshake
    const validHandshake = await request('POST', '/agent/handshake', {
      from: 'test-suite',
      capabilities_request: ['chat']
    });
    assert.strictEqual(validHandshake.status, 200, 'Valid handshake status should be 200');
    assert.strictEqual(validHandshake.body.accepted, true, 'Handshake should be accepted');
    const sessionId = validHandshake.body.session_id;
    assert.ok(sessionId, 'Should return a session_id');
    console.log('✅ Valid handshake passed.');

    // 3.2 Invalid Handshake (Missing 'from')
    const invalidHandshakeFrom = await request('POST', '/agent/handshake', {
      capabilities_request: ['chat']
    });
    assert.strictEqual(invalidHandshakeFrom.status, 400, 'Missing "from" should be 400');
    console.log('✅ Missing "from" check passed.');

    // 3.3 Invalid Handshake (No matching capabilities)
    const invalidHandshakeCaps = await request('POST', '/agent/handshake', {
      from: 'test-suite',
      capabilities_request: ['unsupported-capability']
    });
    assert.strictEqual(invalidHandshakeCaps.status, 400, 'No matching caps should be 400');
    console.log('✅ Unsupported capabilities check passed.');

    // 3.4 Malformed Handshake (capabilities_request is not an array)
    const malformedHandshake = await request('POST', '/agent/handshake', {
      from: 'test-suite',
      capabilities_request: "not-an-array"
    });
    assert.strictEqual(malformedHandshake.status, 400, 'Malformed capabilities should be 400');
    assert.ok(malformedHandshake.body.error.includes('must be an array'), 'Error message should specify array requirement');
    console.log(`✅ Malformed capabilities check passed (Status: ${malformedHandshake.status}).`);

    // 4. Test Messages
    console.log('\n🧪 Testing Messages...');

    // 4.1 Chat Message
    const chatMsg = await request('POST', '/agent/message', {
      session_id: sessionId,
      capability: 'chat',
      payload: { message: 'Hello' }
    });
    assert.strictEqual(chatMsg.status, 200, 'Chat message status should be 200');
    assert.ok(chatMsg.body.response.reply, 'Should have a reply');
    console.log('✅ Chat message passed.');

    // 4.2 Translate Message (Requires new session with translate cap if previous didn't have it)
    // Create new session with all caps
    const fullSessionRes = await request('POST', '/agent/handshake', {
      from: 'test-suite-2',
      capabilities_request: ['translate']
    });
    const fullSessionId = fullSessionRes.body.session_id;

    const translateMsg = await request('POST', '/agent/message', {
      session_id: fullSessionId,
      capability: 'translate',
      payload: { text: 'Hello', from: 'en', to: 'es' }
    });
    assert.strictEqual(translateMsg.status, 200, 'Translate message status should be 200');
    assert.ok(translateMsg.body.response.translated, 'Should have translated text');
    console.log('✅ Translate message passed.');

    // 4.3 Invalid Session ID
    const badSessionMsg = await request('POST', '/agent/message', {
      session_id: 'fake-session-uuid',
      capability: 'chat',
      payload: { message: 'Hello' }
    });
    assert.strictEqual(badSessionMsg.status, 401, 'Invalid session should be 401');
    console.log('✅ Invalid session check passed.');

    // 4.4 Invalid Capability for Session
    // 'test-suite' session only asked for 'chat'
    const badCapMsg = await request('POST', '/agent/message', {
      session_id: sessionId, 
      capability: 'translate', // Was not requested in first handshake
      payload: { text: 'Hello' }
    });
    assert.strictEqual(badCapMsg.status, 400, 'Unapproved capability should be 400');
    console.log('✅ Unapproved capability check passed.');

    console.log('\n🎉 ALL TESTS PASSED!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.expected) console.error('Expected:', error.expected);
    if (error.actual) console.error('Actual:', error.actual);
    process.exitCode = 1;
  } finally {
    console.log('🛑 Stopping server...');
    serverProcess.kill();
  }
}

runTests();
