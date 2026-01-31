/**
 * 小北协议 - 密码学工具
 * 
 * 用于签名验证和消息完整性
 */

const CryptoJS = require('crypto-js');

// 生成简单的签名 (用于演示，生产环境应使用真正的公钥加密)
function signMessage(message, secret) {
  const timestamp = Date.now();
  const payload = JSON.stringify({ message, timestamp });
  const signature = CryptoJS.HmacSHA256(payload, secret).toString();
  
  return {
    payload,
    timestamp,
    signature
  };
}

// 验证签名
function verifySignature(payload, signature, secret, maxAgeMs = 300000) {
  try {
    const parsed = JSON.parse(payload);
    
    // 检查时间戳
    const age = Date.now() - parsed.timestamp;
    if (age > maxAgeMs) {
      return { valid: false, error: 'Signature expired' };
    }
    
    // 验证签名
    const expectedSignature = CryptoJS.HmacSHA256(payload, secret).toString();
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true, message: parsed.message };
  } catch (e) {
    return { valid: false, error: 'Invalid payload format' };
  }
}

// 生成随机密钥
function generateSecret() {
  return CryptoJS.lib.WordArray.random(32).toString();
}

// 哈希消息 (用于消息完整性检查)
function hashMessage(message) {
  return CryptoJS.SHA256(JSON.stringify(message)).toString();
}

module.exports = {
  signMessage,
  verifySignature,
  generateSecret,
  hashMessage
};

// 测试
if (require.main === module) {
  console.log('=== 密码学工具测试 ===');
  
  const secret = generateSecret();
  console.log('生成密钥:', secret.substring(0, 20) + '...');
  
  const message = { text: 'Hello from xiaobei!', to: 'test-agent' };
  const signed = signMessage(message, secret);
  console.log('签名消息:', signed.signature.substring(0, 20) + '...');
  
  const verified = verifySignature(signed.payload, signed.signature, secret);
  console.log('验证结果:', verified);
  
  // 测试无效签名
  const badVerify = verifySignature(signed.payload, 'bad-signature', secret);
  console.log('无效签名测试:', badVerify);
}
