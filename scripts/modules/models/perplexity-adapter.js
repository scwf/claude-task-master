/**
 * perplexity-adapter.js
 * Perplexity模型的适配器实现
 */

import { ModelAdapter } from './model-adapter.js';
import { sanitizePrompt, CONFIG, log } from '../utils.js';

export class PerplexityAdapter extends ModelAdapter {
  constructor(config = {}) {
    super(config);
  }
  
  /**
   * 获取模型类型
   * @returns {string} 模型类型标识符
   */
  static getType() {
    return 'perplexity';
  }
  
  /**
   * 初始化Perplexity客户端
   * @param {Object} session - 会话对象
   * @returns {Object} 初始化的OpenAI兼容客户端
   * @throws {Error} 如果初始化失败
   */
  async initialize(session) {
    try {
      const apiKey = session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
      
      if (!apiKey) {
        throw new Error('PERPLEXITY_API_KEY未在会话环境或环境变量中找到');
      }
      
      // 动态导入OpenAI SDK
      const { default: OpenAI } = await import('openai');
      
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.perplexity.ai',
      });
      
      return this.client;
    } catch (error) {
      log('error', `初始化Perplexity客户端失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 调用Perplexity模型处理请求
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
    
    report('使用Perplexity处理PRD...');
    
    try {
      // 获取模型配置
      const modelConfig = options.modelConfig || {};
      const model = modelConfig.perplexityModel || session?.env?.PERPLEXITY_MODEL || process.env.PERPLEXITY_MODEL || 'sonar-pro';
      const maxTokens = modelConfig.maxTokens || parseInt(session?.env?.MAX_TOKENS || process.env.MAX_TOKENS || CONFIG.MAX_TOKENS);
      const temperature = modelConfig.temperature || parseFloat(session?.env?.TEMPERATURE || process.env.TEMPERATURE || CONFIG.TEMPERATURE);
      
      // 初始化结果容器
      let textContent = '';
      
      // 创建流式请求 (使用与OpenAI兼容的格式)
      const stream = await this.client.chat.completions.create({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: sanitizePrompt(`以下是PRD文档:\n\n${prdContent}\n\n请生成${numTasks}个开发任务，遵循JSON格式。`) 
          }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        stream: true,
      });
      
      report('开始接收来自Perplexity的响应...');
      
      // 处理流式响应
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          textContent += content;
          if (reportProgress && typeof reportProgress === 'function') {
            reportProgress('接收Perplexity数据中...');
          }
        }
      }
      
      report('完成接收Perplexity响应');
      
      return {
        textContent,
        retryCount,
        prdContent,
        prdPath,
        options
      };
    } catch (error) {
      const errorMessage = this.handleError(error);
      report(`Perplexity请求失败: ${errorMessage}`, 'error');
      
      // 如果还有重试次数，尝试重试
      if (retryCount < 3) {
        report(`重试调用Perplexity (${retryCount + 1}/3)...`, 'warn');
        return this.callModel(
          { ...params, retryCount: retryCount + 1 },
          options
        );
      }
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * 处理Perplexity API错误
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  handleError(error) {
    // 检查结构化错误响应
    if (error.response && error.response.data) {
      const { error: apiError } = error.response.data;
      if (apiError) {
        return `Perplexity API错误: ${apiError.message || '未知错误'}`;
      }
    }
    
    // 检查网络/超时错误
    if (error.message?.toLowerCase().includes('timeout')) {
      return 'Perplexity API请求超时，请重试。';
    }
    if (error.message?.toLowerCase().includes('network')) {
      return '连接Perplexity API时出现网络错误，请检查网络连接并重试。';
    }
    
    // 默认错误消息
    return `与Perplexity通信时出错: ${error.message}`;
  }
  
  /**
   * 检查Perplexity是否可用
   * @param {Object} session - 会话对象
   * @returns {boolean} 是否可用
   */
  isAvailable(session) {
    return !!(session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY);
  }
  
  /**
   * 获取Perplexity的优先级
   * @param {Object} options - 选项
   * @returns {number} 优先级值
   */
  getPriority(options = {}) {
    // Perplexity主要用于研究支持功能
    return options.requiresResearch ? 90 : 40;
  }
} 