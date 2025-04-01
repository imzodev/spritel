/**
 * Common types for AI service providers
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIServiceProvider {
  initialize(config: AIConfig): void;
  isInitialized(): boolean;
  getCompletion(systemPrompt: string, userPrompt: string): Promise<string>;
  getChatCompletion(systemPrompt: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string>;
}

export enum AIProviderType {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  DEEPSEEK = 'deepseek',
  OLLAMA = 'ollama',
}

export interface GameContext {
  timeOfDay: string;
  weather: string;
  playerLevel: number;
  location: string;
  activeQuests: string[];
}

export interface NPCMemory {
  conversationHistory: string[];
  playerInteractions: string[];
  lastInteraction: number;
}
