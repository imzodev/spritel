import { aiService } from '../services/AIService';
import { NPC_PERSONALITIES } from '../data/npc-personalities';

// Handle AI chat completion request
export async function handleAIChatRequest(request: Request): Promise<Response> {
  console.log('[AI Route] Received AI chat request');
  console.log(`[AI Route] Request method: ${request.method}`);
  console.log(`[AI Route] Request headers:`, Object.fromEntries(request.headers.entries()));
  try {
    // Parse the request body
    const body = await request.json();
    console.log('[AI Route] Request body:', body);
    const { personalityType, message, gameContext } = body;
    
    if (!personalityType || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the appropriate system prompt based on personality type
    const personalityKey = personalityType.toLowerCase();
    const personality = NPC_PERSONALITIES[personalityKey] || NPC_PERSONALITIES.merchant;
    const systemPrompt = personality.systemPrompt;
    
    // Format the game context as additional information for the AI
    let contextPrompt = '';
    if (gameContext) {
      contextPrompt = `\nCurrent game context: 
- Location: ${gameContext.location || 'Unknown'}
- Time of day: ${gameContext.timeOfDay || 'Day'}
- Weather: ${gameContext.weather || 'Clear'}
- Player level: ${gameContext.playerLevel || 1}
- Active quests: ${gameContext.activeQuests?.join(', ') || 'None'}
`;
    }
    
    // Combine the system prompt with context
    const fullSystemPrompt = systemPrompt + contextPrompt;
    
    // Format the messages for the AI service
    const messages = [
      { role: 'user', content: message }
    ];
    
    // Get the AI response
    const response = await aiService.getChatCompletion(fullSystemPrompt, messages);
    
    // Return the response
    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[AI Route] Error handling AI chat request:', error);
    return new Response(JSON.stringify({ error: 'Failed to process AI request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle AI chat completion with memory
export async function handleAIChatWithMemoryRequest(request: Request): Promise<Response> {
  console.log('[AI Route] Received AI chat with memory request');
  console.log(`[AI Route] Request method: ${request.method}`);
  console.log(`[AI Route] Request headers:`, Object.fromEntries(request.headers.entries()));
  try {
    // Parse the request body
    const body = await request.json();
    console.log('[AI Route] Request body with memory:', body);
    const { personalityType, message, gameContext, conversationHistory } = body;
    
    if (!personalityType || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the appropriate system prompt based on personality type
    const personalityKey = personalityType.toLowerCase();
    const personality = NPC_PERSONALITIES[personalityKey] || NPC_PERSONALITIES.merchant;
    const systemPrompt = personality.systemPrompt;
    
    // Format the game context as additional information for the AI
    let contextPrompt = '';
    if (gameContext) {
      contextPrompt = `\nCurrent game context: 
- Location: ${gameContext.location || 'Unknown'}
- Time of day: ${gameContext.timeOfDay || 'Day'}
- Weather: ${gameContext.weather || 'Clear'}
- Player level: ${gameContext.playerLevel || 1}
- Active quests: ${gameContext.activeQuests?.join(', ') || 'None'}
`;
    }
    
    // Combine the system prompt with context
    const fullSystemPrompt = systemPrompt + contextPrompt;
    
    // Format the conversation history for the AI service
    let messages: { role: string; content: string }[] = [];
    
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }
    
    // Add the current message
    messages.push({ role: 'user', content: message });
    
    // Get the AI response
    const response = await aiService.getChatCompletion(fullSystemPrompt, messages);
    
    // Return the response
    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[AI Route] Error handling AI chat with memory request:', error);
    return new Response(JSON.stringify({ error: 'Failed to process AI request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
