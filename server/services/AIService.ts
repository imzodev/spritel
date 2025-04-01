import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// AI Provider Types
export type AIProviderType = 'openai' | 'gemini' | 'deepseek' | 'ollama';

// Message Types
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// AI Provider Interface
export interface AIProvider {
  initialize(): boolean;
  isInitialized(): boolean;
  getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string>;
}

// OpenAI Provider
class OpenAIProvider implements AIProvider {
  private client: OpenAI | null = null;
  private model: string;
  private apiKey: string;
  private endpoint?: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.endpoint = process.env.OPENAI_ENDPOINT;
  }

  initialize(): boolean {
    try {
      const config: any = {
        apiKey: this.apiKey,
      };

      if (this.endpoint) {
        config.baseURL = this.endpoint;
      }

      this.client = new OpenAI(config);
      return true;
    } catch (error) {
      console.error('[OpenAIProvider] Failed to initialize OpenAI service:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Convert messages to the format expected by OpenAI API
      const systemMessage = { role: 'system' as const, content: systemPrompt };
      const userMessages = messages.map(msg => ({
        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [systemMessage, ...userMessages],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('[OpenAIProvider] Error getting chat completion:', error);
      throw error;
    }
  }
}

// Google Gemini Provider
class GeminiProvider implements AIProvider {
  private client: any = null;
  private model: string;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-pro';
  }

  initialize(): boolean {
    try {
      this.client = new GoogleGenerativeAI(this.apiKey);
      return true;
    } catch (error) {
      console.error('[GeminiProvider] Failed to initialize Gemini service:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      
      // Format messages for Gemini
      const chatHistory: any[] = [];
      
      // Add previous messages to chat history
      for (const msg of messages) {
        if (msg.role === 'user') {
          chatHistory.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant') {
          chatHistory.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      }
      
      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.7,
        },
      });
      
      // Send the system prompt as part of the user's message
      const result = await chat.sendMessage(
        `${systemPrompt}\n\n${messages[messages.length - 1].content}`
      );
      
      return result.response.text();
    } catch (error) {
      console.error('[GeminiProvider] Error getting chat completion:', error);
      throw error;
    }
  }
}

// DeepSeek Provider
class DeepSeekProvider implements AIProvider {
  private client: OpenAI | null = null;
  private model: string;
  private apiKey: string;
  private endpoint: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.endpoint = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com';
  }

  initialize(): boolean {
    try {
      if (!this.apiKey) {
        console.error('[DeepSeekProvider] API key is missing');
        return false;
      }
      
      console.log(`[DeepSeekProvider] Initializing with endpoint: ${this.endpoint}`);
      console.log(`[DeepSeekProvider] Using model: ${this.model}`);
      console.log(`[DeepSeekProvider] API key length: ${this.apiKey.length}`);
      
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.endpoint + '/v1',
      });
      return true;
    } catch (error) {
      console.error('[DeepSeekProvider] Failed to initialize DeepSeek service:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
    if (!this.client) {
      throw new Error('DeepSeek client not initialized');
    }

    try {
      // Convert messages to the format expected by OpenAI API
      const systemMessage = { role: 'system' as const, content: systemPrompt };
      const userMessages = messages.map(msg => ({
        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [systemMessage, ...userMessages],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('[DeepSeekProvider] Error getting chat completion:', error);
      throw error;
    }
  }
}

// Ollama Provider
class OllamaProvider implements AIProvider {
  private initialized: boolean = false;
  private model: string;
  private endpoint: string;

  constructor() {
    this.model = process.env.OLLAMA_MODEL || 'llama3';
    this.endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api';
  }

  initialize(): boolean {
    try {
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[OllamaProvider] Failed to initialize Ollama service:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
    try {
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ];

      const response = await axios.post(`${this.endpoint}/chat`, {
        model: this.model,
        messages: formattedMessages,
        options: {
          temperature: 0.7
        },
        stream: false
      });

      return response.data.message?.content || 'No response generated';
    } catch (error) {
      console.error('[OllamaProvider] Error getting chat completion:', error);
      throw error;
    }
  }
}

// Main AI Service
export class AIService {
  private provider: AIProvider | null = null;
  private providerType: AIProviderType;

  constructor(providerType: AIProviderType = 'openai') {
    this.providerType = providerType;
    this.initialize();
  }

  initialize(): boolean {
    try {
      switch (this.providerType) {
        case 'openai':
          this.provider = new OpenAIProvider();
          break;
        case 'gemini':
          this.provider = new GeminiProvider();
          break;
        case 'deepseek':
          this.provider = new DeepSeekProvider();
          break;
        case 'ollama':
          this.provider = new OllamaProvider();
          break;
        default:
          console.error(`[AIService] Unknown provider type: ${this.providerType}`);
          return false;
      }

      const initialized = this.provider.initialize();
      if (!initialized) {
        console.error(`[AIService] Failed to initialize provider: ${this.providerType}`);
        return false;
      }

      console.log(`[AIService] Successfully initialized provider: ${this.providerType}`);
      return true;
    } catch (error) {
      console.error(`[AIService] Error initializing provider: ${error}`);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.provider !== null && this.provider.isInitialized();
  }

  async getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
    if (!this.provider) {
      throw new Error('AI provider not initialized');
    }

    return await this.provider.getChatCompletion(systemPrompt, messages);
  }
}

// Create a singleton instance
const aiProvider = process.env.AI_PROVIDER as AIProviderType || 'deepseek';
export const aiService = new AIService(aiProvider);
