/**
 * test-deepseek.js
 * 用于测试DeepSeek API连接是否正常工作
 */

import dotenv from 'dotenv';
import { OpenAI } from 'openai';

// 加载环境变量
dotenv.config();

// 简单的测试函数
async function testDeepSeekConnection() {
  console.log('🔍 开始测试 DeepSeek API 连接...');
  
  try {
    // 检查API密钥
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('未找到 DEEPSEEK_API_KEY 环境变量，请确保您在 .env 文件中设置了正确的API密钥');
    }
    console.log('✓ 找到 DEEPSEEK_API_KEY');
    
    // 初始化客户端
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
    console.log('✓ 已初始化 DeepSeek 客户端');
    
    // 设置超时时间（可选，这里设置为30秒）
    const timeoutMs = 30000; 
    const startTime = Date.now();
    
    console.log(`📤 发送简单请求到 DeepSeek API (超时: ${timeoutMs/1000}秒)...`);
    
    // 发送一个非常简单的请求
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        { role: 'user', content: '你好，这是一个连接测试。请回复："DeepSeek API 连接正常"' }
      ],
      max_tokens: 20,
      temperature: 0.2,
    }, {
      timeout: timeoutMs
    });
    
    const elapsedTime = Date.now() - startTime;
    
    console.log(`✅ DeepSeek API 请求成功! 用时: ${elapsedTime/1000}秒`);
    console.log(`📝 响应内容: "${response.choices[0].message.content}"`);
    console.log(`📊 模型: ${response.model}`);
    console.log(`📊 使用tokens: ${response.usage?.total_tokens || '未知'}`);
    
    return true;
  } catch (error) {
    console.error('❌ DeepSeek API 测试失败:');
    if (error.status) {
      console.error(`   状态码: ${error.status}`);
    }
    if (error.code) {
      console.error(`   错误代码: ${error.code}`);
    }
    console.error(`   错误信息: ${error.message}`);
    
    // 如果是超时错误，给出更明确的提示
    if (error.message.toLowerCase().includes('timeout')) {
      console.error('   这是一个超时错误。可能原因:');
      console.error('   1. 网络连接问题');
      console.error('   2. DeepSeek 服务器响应时间过长');
      console.error('   3. 可能需要在 VPN 或代理服务器环境下访问');
    }
    // 如果是认证错误，给出API密钥提示
    if (error.status === 401 || error.message.toLowerCase().includes('auth')) {
      console.error('   这似乎是认证问题。请检查:');
      console.error('   1. API密钥是否正确（无多余空格或换行符）');
      console.error('   2. API密钥是否已激活');
      console.error('   3. 是否有权限访问指定的模型');
    }
    
    return false;
  }
}

// 执行测试
testDeepSeekConnection()
  .then(success => {
    if (success) {
      console.log('\n🎉 测试完成: DeepSeek API 连接正常工作!');
    } else {
      console.log('\n⚠️ 测试完成: DeepSeek API 连接测试失败，请查看上面的错误信息。');
    }
  })
  .catch(err => {
    console.error('\n💥 测试执行过程出错:', err);
  }); 