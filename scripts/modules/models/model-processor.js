/**
 * model-processor.js
 * 处理模型响应的工具函数
 */

import { log } from '../utils.js';

/**
 * 提取文本中的JSON任务
 * @param {string} text - 包含任务JSON的文本
 * @returns {Object|null} 解析后的任务对象或null
 */
function extractTasksJson(text) {
  try {
    // 尝试直接解析整个文本
    const parsed = JSON.parse(text.trim());
    if (parsed && parsed.tasks) {
      return parsed;
    }
  } catch (e) {
    // 直接解析失败，尝试查找JSON块
  }
  
  // 使用正则表达式查找JSON对象
  const jsonRegex = /```(?:json)?\s*({[\s\S]*?})\s*```|({[\s\S]*})/gm;
  const matches = [...text.matchAll(jsonRegex)];
  
  for (const match of matches) {
    const jsonStr = (match[1] || match[2]).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.tasks) {
        return parsed;
      }
    } catch (e) {
      // 继续尝试下一个匹配项
    }
  }
  
  // 没有找到有效的任务JSON
  return null;
}

/**
 * 验证任务的完整性
 * @param {Object} tasks - 任务对象
 * @param {number} expectedCount - 预期的任务数量
 * @returns {boolean} 是否有效
 */
function validateTasks(tasks, expectedCount) {
  if (!tasks || !tasks.tasks || !Array.isArray(tasks.tasks)) {
    return false;
  }
  
  // 检查任务数量
  if (tasks.tasks.length < expectedCount * 0.8) {
    return false; // 任务数量不足预期的80%
  }
  
  // 检查任务属性
  for (const task of tasks.tasks) {
    if (!task.id || !task.title || !task.description) {
      return false; // 缺少必要属性
    }
  }
  
  return true;
}

/**
 * 处理模型生成的响应
 * @param {Object} modelResult - 模型返回的结果
 * @param {Object} options - 处理选项
 * @returns {Object} 处理后的任务
 */
export function processModelResponse(modelResult, options = {}) {
  const { textContent, retryCount, prdContent, prdPath } = modelResult;
  const { numTasks = 10, reportProgress, mcpLog } = options;
  
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
  
  report('解析模型响应...');
  
  // 提取任务JSON
  const tasks = extractTasksJson(textContent);
  
  if (!tasks) {
    report('无法从响应中提取任务JSON', 'error');
    throw new Error('从模型响应中提取任务JSON失败');
  }
  
  // 验证任务
  if (!validateTasks(tasks, numTasks)) {
    report('任务验证失败，任务不完整或数量不足', 'error');
    
    // 如果还有重试次数，可以触发重试
    if (retryCount < 3) {
      report(`将重试生成任务 (${retryCount + 1}/3)...`, 'warn');
      // 在调用此函数的上层处理重试逻辑
      return { shouldRetry: true, retryCount: retryCount + 1 };
    }
    
    throw new Error('任务生成失败，无法创建有效的任务');
  }
  
  report(`成功解析出${tasks.tasks.length}个任务`);
  
  return {
    shouldRetry: false,
    tasks: tasks
  };
} 