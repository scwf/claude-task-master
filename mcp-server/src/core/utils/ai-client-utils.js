/**
 * ai-client-utils.js
 * Utility functions for initializing AI clients in MCP context
 */

import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables for CLI mode
dotenv.config();

// Default model configuration from CLI environment
const DEFAULT_MODEL_CONFIG = {
	model: 'claude-3-7-sonnet-20250219',
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
		return new OpenAI({
			apiKey,
			baseURL: 'https://api.deepseek.com'
		});
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
	// Get values from session or fall back to defaults
	return {
		model: session?.env?.MODEL || defaults.model,
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

	// Case 1: When research is needed but no Perplexity, use Claude
	if (
		requiresResearch &&
		!(session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY) &&
		(session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
	) {
		try {
			log.warn('Perplexity not available for research, using Claude');
			const client = getAnthropicClientForMCP(session, log);
			return { type: 'claude', client };
		} catch (error) {
			log.error(`Claude not available: ${error.message}`);
			
			// Try DeepSeek as last resort for research
			if (session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY) {
				try {
					log.warn('Trying DeepSeek for research as last resort');
					const client = await getDeepSeekClientForMCP(session, log);
					return { type: 'deepseek', client };
				} catch (deepseekError) {
					log.error(`DeepSeek not available: ${deepseekError.message}`);
				}
			}
			
			throw new Error('No AI models available for research');
		}
	}

	// Case 2: Regular path - Perplexity for research when available
	if (
		requiresResearch &&
		(session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY)
	) {
		try {
			const client = await getPerplexityClientForMCP(session, log);
			return { type: 'perplexity', client };
		} catch (error) {
			log.warn(`Perplexity not available: ${error.message}`);
			// Fall through to Claude or DeepSeek as backup
		}
	}

	// Case 3: Claude is overloaded, try DeepSeek
	if (
		claudeOverloaded &&
		(session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY)
	) {
		try {
			log.info('Claude is overloaded, trying DeepSeek');
			const client = await getDeepSeekClientForMCP(session, log);
			return { type: 'deepseek', client };
		} catch (error) {
			log.warn(`DeepSeek not available: ${error.message}`);
			// Fall through to check other options
		}
	}

	// Case 4: Claude for overloaded scenario as last resort
	if (
		claudeOverloaded &&
		(session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
	) {
		try {
			log.warn(
				'Claude is overloaded but no alternatives are available. Proceeding with Claude anyway.'
			);
			const client = getAnthropicClientForMCP(session, log);
			return { type: 'claude', client };
		} catch (error) {
			log.error(
				`Claude not available despite being overloaded: ${error.message}`
			);
			throw new Error('No AI models available');
		}
	}

	// Case 5: Default - Use Claude when available and not overloaded
	if (
		!claudeOverloaded &&
		(session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
	) {
		try {
			const client = getAnthropicClientForMCP(session, log);
			return { type: 'claude', client };
		} catch (error) {
			log.warn(`Claude not available: ${error.message}`);
			// Fall through to try DeepSeek
		}
	}
	
	// Case 6: DeepSeek as fallback when Claude is not available
	if (session?.env?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY) {
		try {
			log.info('Claude not available, using DeepSeek');
			const client = await getDeepSeekClientForMCP(session, log);
			return { type: 'deepseek', client };
		} catch (error) {
			log.error(`DeepSeek not available: ${error.message}`);
			// Fall through to error
		}
	}

	// If we got here, no models were successfully initialized
	throw new Error('No AI models available. Please check your API keys.');
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
