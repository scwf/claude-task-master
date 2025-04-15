/**
 * model-adapter.js
 * 基础模型适配器类，所有特定模型的适配器都继承自此类
 */

export class ModelAdapter {
  constructor(config = {}) {
    this.config = config;
    this.client = null;
  }
  
  /**
   * 初始化模型客户端
   * @param {Object} session - 会话对象，包含环境变量等
   * @returns {Object} 初始化的客户端实例
   * @throws {Error} 如果初始化失败
   */
  async initialize(session) { 
    throw new Error("方法未实现");
  }
  
  /**
   * 调用模型进行请求
   * @param {Object} params - 请求参数
   * @param {Object} options - 调用选项
   * @returns {Object} 模型响应
   * @throws {Error} 如果调用失败
   */
  async callModel(params, options) { 
    throw new Error("方法未实现");
  }
  
  /**
   * 处理模型特定的错误
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  handleError(error) { 
    throw new Error("方法未实现");
  }
  
  /**
   * 检查模型是否可用（API密钥等）
   * @param {Object} session - 会话对象
   * @returns {boolean} 模型是否可用
   */
  isAvailable(session) {
    return false; // 子类应覆盖此方法
  }
  
  /**
   * 获取模型类型
   * @returns {string} 模型类型标识符
   */
  getType() {
    return this.constructor.getType();
  }
  
  /**
   * 获取模型类型（静态方法）
   * @returns {string} 模型类型标识符
   */
  static getType() {
    throw new Error("静态方法getType()未实现");
  }
  
  /**
   * 获取优先级（用于排序）
   * @param {Object} options - 选项对象
   * @returns {number} 优先级值（越高越优先）
   */
  getPriority(options = {}) {
    return 0; // 子类应覆盖此方法
  }
} 