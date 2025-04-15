/**
 * ai-client-utils.js
 * Utility functions for initializing AI clients in MCP context
 */

import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables for CLI mode
dotenv.config();

// 确定默认的LLM提供商
const defaultLlmProvider = process.env.LLM_PROVIDER || 'anthropic';

// Default model configuration from CLI environment
const DEFAULT_MODEL_CONFIG = {
	llmProvider: defaultLlmProvider,
	anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219',
	deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
	perplexityModel: process.env.PERPLEXITY_MODEL || 'sonar-pro',
	maxTokens: 64000,
	temperature: 0.2
};

/**
 * Get an Anthropic client instance initialized with MCP session environment variables
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {Anthropic} Anthropic client instance
 * @throws {Error} If API key is missing
 */
export function getAnthropicClientForMCP(session, log = console) {
	try {
		// Extract API key from session.env or fall back to environment variables
		const apiKey =
			session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

		if (!apiKey) {
			throw new Error(
				'ANTHROPIC_API_KEY not found in session environment or process.env'
			);
		}

		// Initialize and return a new Anthropic client
		return new Anthropic({
			apiKey,
			defaultHeaders: {
				'anthropic-beta': 'output-128k-2025-02-19' // Include header for increased token limit
			}
		});
	} catch (error) {
		log.error(`Failed to initialize Anthropic client: ${error.message}`);
		throw error;
	}
}

/**
 * Get a Perplexity client instance initialized with MCP session environment variables
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {OpenAI} OpenAI client configured for Perplexity API
 * @throws {Error} If API key is missing or OpenAI package can't be imported
 */
export async function getPerplexityClientForMCP(session, log = console) {
	try {
		// Extract API key from session.env or fall back to environment variables
		const apiKey =
			session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;

		if (!apiKey) {
			throw new Error(
				'PERPLEXITY_API_KEY not found in session environment or process.env'
			);
		}

		// Dynamically import OpenAI (it may not be used in all contexts)
		const { default: OpenAI } = await import('openai');

		// Initialize and return a new OpenAI client configured for Perplexity
		return new OpenAI({
			apiKey,
			baseURL: 'https://api.perplexity.ai'
		});
	} catch (error) {
		log.error(`Failed to initialize Perplexity client: ${error.message}`);
		throw error;
	}
}

/**
 * Get a DeepSeek client instance initialized with MCP session environment variables
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {OpenAI} OpenAI client configured for DeepSeek API
 * @throws {Error} If API key is missing or OpenAI package can't be imported
 */
export async function getDeepSeekClientForMCP(session, log = console) {
	try {
		// Extract API key from session.env or fall back to environment variables
		const apiKey =
			session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

		if (!apiKey) {
			throw new Error(
				'DEEPSEEK_API_KEY not found in session environment or process.env'
			);
		}

		// Dynamically import OpenAI (it may not be used in all contexts)
		const { default: OpenAI } = await import('openai');

		// Initialize and return a new OpenAI client configured for DeepSeek
		const client = new OpenAI({
			apiKey,
			baseURL: 'https://api.deepseek.com'
		});
		
		// 验证客户端结构正确
		if (!client.chat || !client.chat.completions || typeof client.chat.completions.create !== 'function') {
			log.error('DeepSeek客户端初始化错误：客户端缺少必要的chat.completions.create方法');
			throw new Error('DeepSeek客户端结构不符合要求');
		}
		
		return client;
	} catch (error) {
		log.error(`Failed to initialize DeepSeek client: ${error.message}`);
		throw error;
	}
}

/**
 * Get model configuration from session environment or fall back to defaults
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [defaults] - Default model configuration to use if not in session
 * @returns {Object} Model configuration with model, maxTokens, and temperature
 */
export function getModelConfig(session, defaults = DEFAULT_MODEL_CONFIG) {
	// 获取LLM提供商设置
	const llmProvider = session?.env?.LLM_PROVIDER || defaults.llmProvider;
	
	// 根据提供商选择对应的模型
	let model;
	if (llmProvider === 'deepseek') {
		model = session?.env?.DEEPSEEK_MODEL || defaults.deepseekModel;
	}  else {
		// 默认使用Anthropic/Claude
		model = session?.env?.ANTHROPIC_MODEL || defaults.anthropicModel;
	}
	
	// Get values from session or fall back to defaults
	return {
		llmProvider,
		model, // 根据提供商选择的主要模型
		anthropicModel: session?.env?.ANTHROPIC_MODEL || defaults.anthropicModel,
		deepseekModel: session?.env?.DEEPSEEK_MODEL || defaults.deepseekModel,
		perplexityModel: session?.env?.PERPLEXITY_MODEL || defaults.perplexityModel,
		maxTokens: parseInt(session?.env?.MAX_TOKENS || defaults.maxTokens),
		temperature: parseFloat(session?.env?.TEMPERATURE || defaults.temperature)
	};
}

/**
 * Returns the best available AI model based on specified options
 * @param {Object} session - Session object from MCP containing environment variables
 * @param {Object} options - Options for model selection
 * @param {boolean} [options.requiresResearch=false] - Whether the operation requires research capabilities
 * @param {boolean} [options.claudeOverloaded=false] - Whether Claude is currently overloaded
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {Promise<Object>} Selected model info with type and client
 * @throws {Error} If no AI models are available
 */
export async function getBestAvailableAIModel(
	session,
	options = {},
	log = console
) {
	const { requiresResearch = false, claudeOverloaded = false } = options;
	
	// 获取用户指定的LLM提供商
	const modelConfig = getModelConfig(session);
	const preferredProvider = modelConfig.llmProvider;
	
	log.info(`首选LLM提供商: ${preferredProvider}`);
	
	// 特殊情况：研究操作优先使用Perplexity（如果可用）
	if (requiresResearch && (session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY)) {
		try {
			log.info('研究操作使用Perplexity');
			const client = await getPerplexityClientForMCP(session, log);
			return { type: 'perplexity', client };
		} catch (error) {
			log.warn(`Perplexity不可用: ${error.message}`);
			// 继续尝试其他模型
		}
	}
	
	// 按用户偏好尝试选择模型
	// 1. DeepSeek优先
	if (preferredProvider === 'deepseek') {
		if (session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY) {
			try {
				log.info('使用用户首选的DeepSeek');
				const client = await getDeepSeekClientForMCP(session, log);
				return { type: 'deepseek', client };
			} catch (error) {
				log.warn(`DeepSeek不可用: ${error.message}`);
				// 继续尝试其他备选
			}
		} else {
			log.warn('用户首选DeepSeek但缺少DEEPSEEK_API_KEY');
		}
	}
	
	// 2. Anthropic/Claude优先
	if (preferredProvider === 'anthropic' && !claudeOverloaded) {
		if (session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) {
			try {
				log.info('使用用户首选的Claude');
				const client = getAnthropicClientForMCP(session, log);
				return { type: 'claude', client };
			} catch (error) {
				log.warn(`Claude不可用: ${error.message}`);
				// 继续尝试备选
			}
		} else {
			log.warn('用户首选Claude但缺少ANTHROPIC_API_KEY');
		}
	}
	
	// 备选方案：如果首选提供商不可用或出现特殊情况（如Claude过载）
	
	// 1. Claude过载 -> 尝试DeepSeek
	if (claudeOverloaded && (session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY)) {
		try {
			log.info('Claude过载，尝试DeepSeek作为替代');
			const client = await getDeepSeekClientForMCP(session, log);
			return { type: 'deepseek', client };
		} catch (error) {
			log.warn(`DeepSeek备选不可用: ${error.message}`);
		}
	}
	
	// 2. 如果DeepSeek是首选但不可用 -> 尝试Claude
	if (preferredProvider === 'deepseek' && (session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)) {
		try {
			log.info('DeepSeek不可用，回退到Claude');
			const client = getAnthropicClientForMCP(session, log);
			return { type: 'claude', client };
		} catch (error) {
			log.warn(`Claude备选不可用: ${error.message}`);
		}
	}
	
	// 3. 如果Claude是首选但不可用/过载 -> 尝试DeepSeek
	if (preferredProvider === 'anthropic' && (session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY)) {
		try {
			log.info('Claude不可用或过载，回退到DeepSeek');
			const client = await getDeepSeekClientForMCP(session, log);
			return { type: 'deepseek', client };
		} catch (error) {
			log.warn(`DeepSeek备选不可用: ${error.message}`);
		}
	}
	
	// 4. 紧急情况：Claude过载但没有备选 -> 还是用Claude
	if (claudeOverloaded && (session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)) {
		try {
			log.warn('Claude过载但无替代方案可用，仍使用Claude');
			const client = getAnthropicClientForMCP(session, log);
			return { type: 'claude', client };
		} catch (error) {
			log.error(`Claude最终尝试失败: ${error.message}`);
		}
	}

	// 如果无法初始化任何模型
	throw new Error('无可用的AI模型。请检查您的API密钥和LLM_PROVIDER设置。');
}

/**
 * Handle Claude API errors with user-friendly messages
 * @param {Error} error - The error from Claude API
 * @returns {string} User-friendly error message
 */
export function handleClaudeError(error) {
	// Check if it's a structured error response
	if (error.type === 'error' && error.error) {
		switch (error.error.type) {
			case 'overloaded_error':
				return 'Claude is currently experiencing high demand and is overloaded. Please wait a few minutes and try again.';
			case 'rate_limit_error':
				return 'You have exceeded the rate limit. Please wait a few minutes before making more requests.';
			case 'invalid_request_error':
				return 'There was an issue with the request format. If this persists, please report it as a bug.';
			default:
				return `Claude API error: ${error.error.message}`;
		}
	}

	// Check for network/timeout errors
	if (error.message?.toLowerCase().includes('timeout')) {
		return 'The request to Claude timed out. Please try again.';
	}
	if (error.message?.toLowerCase().includes('network')) {
		return 'There was a network error connecting to Claude. Please check your internet connection and try again.';
	}

	// Default error message
	return `Error communicating with Claude: ${error.message}`;
}
