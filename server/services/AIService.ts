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
  supportsStreaming(): boolean;
  getChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string>;
  streamChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<ReadableStream>;
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

  /**
   * Check if the current model supports streaming
   * @returns boolean indicating if streaming is supported
   */
  supportsStreaming(): boolean {
    // OpenAI models generally support streaming
    return true;
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

  async streamChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<ReadableStream> {
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
      
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [systemMessage, ...userMessages],
        max_tokens: 150,
        temperature: 0.7,
        stream: true
      });

      return stream.toReadableStream();
    } catch (error) {
      console.error('[OpenAIProvider] Error streaming chat completion:', error);
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

  /**
   * Check if the current model supports streaming
   * @returns boolean indicating if streaming is supported
   */
  supportsStreaming(): boolean {
    // Gemini models generally support streaming
    return true;
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

  async streamChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<ReadableStream> {
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
      
      // Create a TransformStream to convert Gemini's streaming response to a ReadableStream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      
      // Start streaming response
      chat.sendMessageStream(`${systemPrompt}\n\n${messages[messages.length - 1].content}`)
        .then(async (streamingResponse: any) => {
          try {
            for await (const chunk of streamingResponse.stream) {
              const text = chunk.text();
              if (text) {
                const data = JSON.stringify({ content: text });
                await writer.write(new TextEncoder().encode(`data: ${data}\n\n`));
              }
            }
            await writer.close();
          } catch (error) {
            console.error('[GeminiProvider] Error in stream processing:', error);
            await writer.abort(error);
          }
        })
        .catch((error: Error) => {
          console.error('[GeminiProvider] Error starting stream:', error);
          writer.abort(error);
        });
      
      return readable;
    } catch (error) {
      console.error('[GeminiProvider] Error streaming chat completion:', error);
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
  
  /**
   * Check if the current model supports streaming
   * @returns boolean indicating if streaming is supported
   */
  supportsStreaming(): boolean {
    // DeepSeek models generally support streaming
    // This could be extended to check specific models if needed
    return true;
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

  async streamChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<ReadableStream> {
    if (!this.client) {
      throw new Error('DeepSeek client not initialized');
    }

    // Check if streaming is supported by the current model
    const streamingSupported = this.supportsStreaming();
    
    // Create a text encoder for the stream
    const encoder = new TextEncoder();
    
    // If streaming is not supported, create a simulated stream from a regular completion
    if (!streamingSupported) {
      console.log('[DeepSeekProvider] Streaming not supported by model, using fallback');
      return new ReadableStream({
        async start(controller) {
          try {
            // Get a regular completion
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
            
            const fullContent = response.choices[0]?.message?.content || 'No response generated';
            
            // Simulate streaming by breaking the content into smaller chunks
            const chunkSize = 5; // Characters per chunk
            for (let i = 0; i < fullContent.length; i += chunkSize) {
              const chunk = fullContent.substring(i, Math.min(i + chunkSize, fullContent.length));
              const sseData = `data: ${JSON.stringify({ content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(sseData));
              
              // Add a small delay to simulate real streaming
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Send a final empty data event to signal completion
            controller.enqueue(encoder.encode('data: {"content":""}\n\n'));
            controller.close();
          } catch (error) {
            console.error('[DeepSeekProvider] Fallback stream error:', error);
            controller.error(error);
          }
        }
      });
    }
    
    // If streaming is supported, use the native streaming capability
    try {
      // Convert messages to the format expected by OpenAI API
      const systemMessage = { role: 'system' as const, content: systemPrompt };
      const userMessages = messages.map(msg => ({
        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
      
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [systemMessage, ...userMessages],
        max_tokens: 150,
        temperature: 0.7,
        stream: true
      });

      // Create a custom readable stream that formats the data as SSE
      return new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                // Format as SSE with JSON payload
                const sseData = `data: ${JSON.stringify({ content })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
            }
            // Send a final empty data event to signal completion
            controller.enqueue(encoder.encode('data: {"content":""}\n\n'));
            controller.close();
          } catch (error) {
            console.error('[DeepSeekProvider] Stream processing error:', error);
            controller.error(error);
          }
        }
      });
    } catch (error) {
      console.error('[DeepSeekProvider] Error streaming chat completion:', error);
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

  /**
   * Check if the current model supports streaming
   * @returns boolean indicating if streaming is supported
   */
  supportsStreaming(): boolean {
    // Ollama models generally support streaming
    return true;
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

  async streamChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<ReadableStream> {
    try {
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ];

      // Create a TransformStream to convert Ollama's streaming response to a ReadableStream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      
      // Make the request with axios
      axios({
        method: 'post',
        url: `${this.endpoint}/chat`,
        data: {
          model: this.model,
          messages: formattedMessages,
          options: {
            temperature: 0.7
          },
          stream: true
        },
        responseType: 'stream'
      }).then(response => {
        response.data.on('data', (chunk: Buffer) => {
          try {
            const text = chunk.toString();
            const lines = text.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message && json.message.content) {
                  const data = JSON.stringify({ content: json.message.content });
                  writer.write(new TextEncoder().encode(`data: ${data}\n\n`));
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          } catch (error) {
            console.error('[OllamaProvider] Error processing chunk:', error);
          }
        });
        
        response.data.on('end', () => {
          writer.close();
        });
        
        response.data.on('error', (error: Error) => {
          console.error('[OllamaProvider] Stream error:', error);
          writer.abort(error);
        });
      }).catch(error => {
        console.error('[OllamaProvider] Request error:', error);
        writer.abort(error);
      });
      
      return readable;
    } catch (error) {
      console.error('[OllamaProvider] Error setting up streaming:', error);
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

  async streamChatCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<ReadableStream> {
    if (!this.provider) {
      throw new Error('AI provider not initialized');
    }

    return await this.provider.streamChatCompletion(systemPrompt, messages);
  }
}

// Create a singleton instance
const aiProvider = process.env.AI_PROVIDER as AIProviderType || 'deepseek';
export const aiService = new AIService(aiProvider);
