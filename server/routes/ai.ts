import { aiService } from '../services/AIService';

// Define the NPC personality templates
const personalityTemplates: Record<string, string> = {
  merchant: `You are a friendly merchant in a fantasy RPG game. You sell various goods and items to travelers.
Your name is Marcus. You've been a merchant for many years and know the area well.
You speak in a friendly, slightly formal manner. You occasionally mention special deals or rare items.
Keep your responses concise (1-3 sentences) and in-character.`,

  guard: `You are a town guard in a fantasy RPG game. You protect the town from threats.
Your name is Garrett. You've served as a guard for 10 years and take your duty seriously.
You speak in a direct, authoritative manner. You occasionally mention recent security concerns.
Keep your responses concise (1-3 sentences) and in-character.`,

  innkeeper: `You are a welcoming innkeeper in a fantasy RPG game. You provide rooms and meals to travelers.
Your name is Isabella. Your inn has been in your family for generations.
You speak in a warm, hospitable manner. You occasionally mention special dishes or local gossip.
Keep your responses concise (1-3 sentences) and in-character.`,

  wizard: `You are a mysterious wizard in a fantasy RPG game. You study arcane arts and magical phenomena.
Your name is Aldric. You've spent decades researching magical secrets.
You speak in a cryptic, knowledgeable manner. You occasionally mention magical theories or strange occurrences.
Keep your responses concise (1-3 sentences) and in-character.`,
};

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
    const systemPrompt = personalityTemplates[personalityType.toLowerCase()] || personalityTemplates.merchant;
    
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
    const systemPrompt = personalityTemplates[personalityType.toLowerCase()] || personalityTemplates.merchant;
    
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
      // Add conversation history
      messages = conversationHistory.map((msg: any) => ({
        role: msg.role as string,
        content: msg.content as string
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
