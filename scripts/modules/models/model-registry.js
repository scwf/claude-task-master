/**
 * model-registry.js
 * 模型注册表，用于管理和选择可用的AI模型
 */

import { ClaudeAdapter } from './claude-adapter.js';
import { DeepSeekAdapter } from './deepseek-adapter.js';
import { PerplexityAdapter } from './perplexity-adapter.js';
import { log } from '../utils.js';

/**
 * 模型注册表类，管理所有可用的模型适配器
 */
class ModelRegistry {
  constructor() {
    this.adapters = new Map();
    this.registerDefaultAdapters();
  }
  
  /**
   * 注册默认的模型适配器
   */
  registerDefaultAdapters() {
    this.register(new ClaudeAdapter());
    this.register(new DeepSeekAdapter());
    this.register(new PerplexityAdapter());
  }
  
  /**
   * 注册模型适配器
   * @param {ModelAdapter} adapter - 模型适配器实例
   * @returns {ModelRegistry} 当前实例，支持链式调用
   */
  register(adapter) {
    if (!adapter || typeof adapter.getType !== 'function') {
      throw new Error('无效的模型适配器');
    }
    
    this.adapters.set(adapter.getType(), adapter);
    return this; // 支持链式调用
  }
  
  /**
   * 获取指定类型的适配器
   * @param {string} type - 模型类型
   * @returns {ModelAdapter|null} 适配器实例或null
   */
  getAdapter(type) {
    return this.adapters.get(type) || null;
  }
  
  /**
   * 获取所有注册的适配器
   * @returns {ModelAdapter[]} 适配器实例数组
   */
  getAllAdapters() {
    return Array.from(this.adapters.values());
  }
  
  /**
   * 根据客户端实例确定模型类型
   * @param {Object} client - 客户端实例
   * @returns {string} 模型类型
   */
  determineModelType(client) {
    if (!client) return 'unknown';
    
    if (client.constructor.name.toLowerCase().includes('anthropic')) {
      return 'claude';
    }
    
    if (client.baseURL) {
      if (client.baseURL.includes('deepseek')) return 'deepseek';
      if (client.baseURL.includes('perplexity')) return 'perplexity';
    }
    
    return 'unknown';
  }
  
  /**
   * 选择最佳可用模型
   * @param {Object} session - 会话对象
   * @param {Object} options - 选择选项
   * @param {boolean} [options.claudeOverloaded=false] - Claude是否过载
   * @param {boolean} [options.requiresResearch=false] - 是否需要研究能力
   * @returns {Promise<Object>} 选择的模型信息
   * @throws {Error} 如果没有可用模型
   */
  async selectBestModel(session, options = {}) {
    log('debug', `选择最佳模型，选项: ${JSON.stringify(options)}`);
    
    // 过滤出可用的适配器并按优先级排序
    const availableAdapters = this.getAllAdapters()
      .filter(adapter => adapter.isAvailable(session))
      .sort((a, b) => b.getPriority(options) - a.getPriority(options));
    
    if (availableAdapters.length === 0) {
      throw new Error('没有可用的模型，请检查API密钥配置');
    }
    
    // 获取优先级最高的适配器
    const selectedAdapter = availableAdapters[0];
    log('info', `选择模型: ${selectedAdapter.getType()}, 优先级: ${selectedAdapter.getPriority(options)}`);
    
    // 初始化选中的适配器
    try {
      const client = await selectedAdapter.initialize(session);
      
      return {
        type: selectedAdapter.getType(),
        adapter: selectedAdapter,
        client
      };
    } catch (error) {
      log('warn', `初始化所选模型失败: ${error.message}`);
      
      // 如果初始化失败，尝试下一个可用适配器
      if (availableAdapters.length > 1) {
        log('info', '尝试下一个可用模型...');
        // 移除当前失败的适配器，递归调用
        return this.selectBestModel(
          session, 
          { 
            ...options, 
            _excludeTypes: [...(options._excludeTypes || []), selectedAdapter.getType()]
          }
        );
      }
      
      throw new Error(`无法初始化任何可用模型: ${error.message}`);
    }
  }
  
  /**
   * 清理和释放资源
   */
  cleanup() {
    this.adapters.clear();
  }
}

// 创建单例
export const modelRegistry = new ModelRegistry(); 