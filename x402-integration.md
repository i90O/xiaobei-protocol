# x402 集成设计

## 目标

让小北协议的付费能力通过 x402 接收支付。

## 流程

```
Agent A                         小北 (Agent B)
   |                                |
   |  1. GET /.well-known/agent.json|
   |  <-----------------------------|
   |  (发现能力和定价)                |
   |                                |
   |  2. POST /agent/handshake      |
   |  ----------------------------->|
   |  (协商能力，获取 session_id)    |
   |  <-----------------------------|
   |                                |
   |  3. POST /agent/message        |
   |      (无支付)                   |
   |  ----------------------------->|
   |                                |
   |  4. 返回 402 Payment Required  |
   |  <-----------------------------|
   |      (包含支付要求)             |
   |                                |
   |  5. POST /agent/message        |
   |      + x402 PAYMENT-SIGNATURE  |
   |  ----------------------------->|
   |                                |
   |  6. 验证支付，执行能力          |
   |  <-----------------------------|
   |      (返回结果)                 |
```

## 实现细节

### 1. 在 agent.json 中声明 x402 支持

```json
{
  "protocol": "xiaobei/v1",
  "name": "xiaobei",
  "capabilities": ["translate", "chat"],
  "pricing": {
    "translate": {
      "protocol": "x402",
      "price": "$0.001",
      "network": "eip155:84532",
      "payTo": "0x..."
    },
    "chat": {
      "price": "free"
    }
  },
  "x402Support": true
}
```

### 2. 在 message 端点检查支付

```javascript
app.post('/agent/message', async (req, res) => {
  const { capability, payload } = req.body;
  
  // 检查是否需要支付
  const pricing = getPricing(capability);
  if (pricing.protocol === 'x402') {
    // 检查 PAYMENT-SIGNATURE header
    const paymentSignature = req.headers['payment-signature'];
    
    if (!paymentSignature) {
      // 返回 402 Payment Required
      return res.status(402).json({
        error: 'Payment Required',
        paymentRequired: {
          scheme: 'exact',
          price: pricing.price,
          network: pricing.network,
          payTo: pricing.payTo
        }
      });
    }
    
    // 验证支付
    const verification = await verifyPayment(paymentSignature, pricing);
    if (!verification.valid) {
      return res.status(402).json({ error: 'Invalid payment' });
    }
    
    // 结算支付
    await settlePayment(paymentSignature);
  }
  
  // 执行能力
  const result = await executeCapability(capability, payload);
  res.json(result);
});
```

### 3. 使用 x402 SDK

```javascript
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactEvmScheme } = require('@x402/evm/exact/server');

const facilitator = new HTTPFacilitatorClient({ 
  url: 'https://facilitator.x402.org' 
});

async function verifyPayment(signature, requirements) {
  return await facilitator.verify(signature, requirements);
}

async function settlePayment(signature) {
  return await facilitator.settle(signature);
}
```

## 需要的配置

1. **钱包地址** - 接收支付的地址
2. **网络** - eip155:84532 (Base Sepolia) 用于测试
3. **Facilitator URL** - https://facilitator.x402.org

## 测试步骤

1. 启动服务器
2. 发送不带支付的请求 → 应返回 402
3. 使用 x402 客户端发送带支付的请求 → 应成功

## 待办

- [ ] 获取 kk 提供的钱包地址
- [ ] 实现支付验证逻辑
- [ ] 实现支付结算逻辑
- [ ] 在 Base Sepolia 测试网测试
- [ ] 文档化完整流程
