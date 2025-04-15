/**
 * index.js
 * 模型模块的入口文件，导出所有模型相关的组件
 */

export { ModelAdapter } from './model-adapter.js';
export { ClaudeAdapter } from './claude-adapter.js';
export { DeepSeekAdapter } from './deepseek-adapter.js';
export { PerplexityAdapter } from './perplexity-adapter.js';
export { modelRegistry } from './model-registry.js';

// 导出模型选择和处理的便捷函数
export { processModelResponse } from './model-processor.js'; 