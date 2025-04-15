/**
 * claude-adapter.js
 * Claude模型的适配器实现
 */

import { ModelAdapter } from './model-adapter.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { sanitizePrompt, CONFIG, log } from '../utils.js';

export class ClaudeAdapter extends ModelAdapter {
  constructor(config = {}) {
    super(config);
  }
  
  /**
   * 获取模型类型
   * @returns {string} 模型类型标识符
   */
  static getType() {
    return 'claude';
  }
  
  /**
   * 初始化Claude客户端
   * @param {Object} session - 会话对象
   * @returns {Anthropic} 初始化的Anthropic客户端
   * @throws {Error} 如果初始化失败
   */
  async initialize(session) {
    try {
      const apiKey = session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY未在会话环境或环境变量中找到');
      }
      
      this.client = new Anthropic({
        apiKey,
        defaultHeaders: {
          'anthropic-beta': 'output-128k-2025-02-19' // 启用增加的token限制
        }
      });
      
      return this.client;
    } catch (error) {
      log('error', `初始化Claude客户端失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 调用Claude模型处理请求
   * @param {Object} params - 请求参数
   * @param {Object} options - 调用选项
   * @returns {Object} 处理结果
   */
  async callModel(params, options = {}) {
    const { prdContent, prdPath, numTasks, systemPrompt, retryCount = 0 } = params;
    const { reportProgress, mcpLog, session } = options;
    
    // 定义报告进度的函数
    const report = (message, level = 'info') => {
      if (reportProgress && typeof reportProgress === 'function') {
        reportProgress(message);
      }
      if (mcpLog && typeof mcpLog[level] === 'function') {
        mcpLog[level](message);
      } else {
        log(level, message);
      }
    };
    
    report('使用Claude处理PRD...');
    
    try {
      // 获取模型配置
      const modelConfig = options.modelConfig || {};
      const model = modelConfig.model || session?.env?.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
      const maxTokens = modelConfig.maxTokens || parseInt(session?.env?.MAX_TOKENS || process.env.MAX_TOKENS || CONFIG.MAX_TOKENS);
      const temperature = modelConfig.temperature || parseFloat(session?.env?.TEMPERATURE || process.env.TEMPERATURE || CONFIG.TEMPERATURE);
      
      // 初始化结果容器
      let textContent = '';
      
      // 创建流式请求
      const stream = await this.client.messages.create({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: sanitizePrompt(`以下是PRD文档:\n\n${prdContent}\n\n请生成${numTasks}个开发任务，遵循JSON格式。`)
          }
        ],
        stream: true
      });
      
      report('开始接收来自Claude的响应...');
      
      // 处理流式响应
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const text = chunk.delta?.text || '';
          if (text) {
            textContent += text;
            if (reportProgress && typeof reportProgress === 'function') {
              reportProgress('接收Claude数据中...');
            }
          }
        }
      }
      
      report('完成接收Claude响应');
      
      return {
        textContent,
        retryCount,
        prdContent,
        prdPath,
        options
      };
    } catch (error) {
      const errorMessage = this.handleError(error);
      report(`Claude请求失败: ${errorMessage}`, 'error');
      
      // 如果还有重试次数，尝试重试
      if (retryCount < 3) {
        report(`重试调用Claude (${retryCount + 1}/3)...`, 'warn');
        return this.callModel(
          { ...params, retryCount: retryCount + 1 },
          options
        );
      }
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * 处理Claude API错误
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  handleError(error) {
    // 检查结构化错误响应
    if (error.type === 'error' && error.error) {
      switch (error.error.type) {
        case 'overloaded_error':
          return 'Claude当前需求量大，处于过载状态。请稍等几分钟后重试。';
        case 'rate_limit_error':
          return '您已超出速率限制。请等待几分钟后再发送请求。';
        case 'invalid_request_error':
          return '请求格式有问题。如果这个问题持续存在，请报告为bug。';
        default:
          return `Claude API错误: ${error.error.message}`;
      }
    }
    
    // 检查网络/超时错误
    if (error.message?.toLowerCase().includes('timeout')) {
      return 'Claude请求超时。请重试。';
    }
    if (error.message?.toLowerCase().includes('network')) {
      return '连接Claude时出现网络错误。请检查您的网络连接并重试。';
    }
    
    // 默认错误消息
    return `与Claude通信时出错: ${error.message}`;
  }
  
  /**
   * 检查Claude是否可用
   * @param {Object} session - 会话对象
   * @returns {boolean} 是否可用
   */
  isAvailable(session) {
    return !!(session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
  }
  
  /**
   * 获取Claude的优先级
   * @param {Object} options - 选项
   * @returns {number} 优先级值
   */
  getPriority(options = {}) {
    // 首先检查LLM_PROVIDER设置
    const llmProvider = process.env.LLM_PROVIDER || 'anthropic';
    
    // 如果用户明确指定使用Claude
    if (llmProvider === 'anthropic') {
      // Claude是明确指定的首选，但如果过载则降低优先级
      return options.claudeOverloaded ? 70 : 100;
    }
    
    // 如果用户指定了其他提供商，Claude作为备选
    if (llmProvider === 'deepseek') {
      // 当其他提供商被指定为首选时，Claude是备选，除非过载
      return options.claudeOverloaded ? -10 : 50;
    }
    
    // 默认行为：Claude通常是首选，除非过载
    return options.claudeOverloaded ? -10 : 100;
  }
} 