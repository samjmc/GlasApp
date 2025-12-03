import { Router, Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { chatToolsDefinition, chatToolsImplementation } from "../services/chatTools";

const router = Router();

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set. Chat features are disabled.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Model to use for chat completions
const MODEL = "gpt-4o"; // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Validation schema for chat request
const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system', 'tool']),
      content: z.string().nullable(),
      tool_call_id: z.string().optional(),
      name: z.string().optional()
    })
  ).optional(),
  userContext: z.object({
    user: z.object({
      username: z.string(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      county: z.string().nullable(),
      bio: z.string().nullable()
    }).nullable(),
    currentPage: z.string(),
    politicalEvolution: z.object({
      totalEntries: z.number(),
      latestEntry: z.any().nullable(),
      evolutionSummary: z.string()
    }).nullable(),
    quizHistory: z.object({
      totalQuizzes: z.number(),
      hasHistory: z.boolean()
    }).nullable()
  }).optional()
});

// Helper function to format the system message
const getSystemMessage = () => {
  return `You are an AI assistant for the Glas Politics app, a platform that helps users understand Irish politics.
  
Your role:
- Provide neutral, factual information about Irish politics, the electoral system, political parties, and current issues
- Explain political terminology and concepts in an accessible way
- Help users navigate and understand the app's features such as the constituency comparison tool and political compass
- Answer questions about Irish political history and the current political landscape
- Avoid making political judgments or expressing personal opinions
- Direct users to the app's tools and features that can help them learn more

CAPABILITIES:
- You have access to real-time database tools. 
- ALWAYS use the 'search_politicians' or 'get_politician_details' tools when asked about specific politicians to ensure accuracy.
- Use 'get_recent_political_news' to find the latest information on topics.
- Do not guess about voting records or scores—look them up.

Key facts about Irish politics:
- Ireland has a proportional representation electoral system with transferable votes (PR-STV)
- The Irish parliament (Oireachtas) consists of the Dáil Éireann (lower house) and Seanad Éireann (upper house)
- Major political parties include Fine Gael, Fianna Fáil, Sinn Féin, Labour, Green Party, and others
- The President is the head of state, and the Taoiseach is the head of government

Guidelines:
- Be helpful, respectful, and informative
- Keep responses concise and easy to understand
- If you don't know something, admit it rather than making up information
- When discussing controversial topics, present multiple perspectives fairly
- Always maintain a neutral, educational tone focused on helping users form their own opinions

Remember that you're part of an educational tool designed to increase political awareness and engagement. Your role is to inform, not to persuade.`;
};

// Route for chat interaction
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    // Allow loose validation for history as tool messages are complex
    const body = req.body;
    const { message, history = [], userContext } = body;
    
    // Format conversation history for OpenAI API
    let formattedHistory: any[] = history.map((msg: any) => {
        // Handle basic messages
        if (msg.role === 'user' || msg.role === 'system') {
            return { role: msg.role, content: msg.content };
        }
        // Handle assistant messages (might have tool calls)
        if (msg.role === 'assistant') {
            // Simplified for now - in a full impl we'd reconstruct tool_calls
            return { role: msg.role, content: msg.content };
        }
        // Handle tool outputs
        if (msg.role === 'tool') {
             return { 
                 role: msg.role, 
                 content: msg.content,
                 tool_call_id: msg.tool_call_id
             };
        }
        return msg;
    });
    
    // Create enhanced system message with user context
    let enhancedSystemMessage = getSystemMessage();
    
    if (userContext) {
      enhancedSystemMessage += "\n\nUser Context:";
      
      if (userContext.user) {
        enhancedSystemMessage += `\n- User: ${userContext.user.firstName || ''} ${userContext.user.lastName || ''} (${userContext.user.username})`;
        if (userContext.user.county) {
          enhancedSystemMessage += `\n- Location: ${userContext.user.county}`;
        }
        if (userContext.user.bio) {
          enhancedSystemMessage += `\n- Bio: ${userContext.user.bio}`;
        }
      }
      
      enhancedSystemMessage += `\n- Current page: ${userContext.currentPage}`;
      
      if (userContext.politicalEvolution) {
        enhancedSystemMessage += `\n- Political Evolution: ${userContext.politicalEvolution.evolutionSummary} (${userContext.politicalEvolution.totalEntries} entries)`;
        if (userContext.politicalEvolution.latestEntry) {
          const latest = userContext.politicalEvolution.latestEntry;
          enhancedSystemMessage += `\n- Latest political position: Economic: ${latest.economicScore}, Social: ${latest.socialScore}`;
        }
      }
      
      if (userContext.quizHistory) {
        enhancedSystemMessage += `\n- Quiz history: ${userContext.quizHistory.totalQuizzes} quizzes taken`;
      }
      
      enhancedSystemMessage += "\n\nUse this context to provide personalized, relevant responses. Reference their political evolution, location, or quiz history when appropriate.";
    }
    
    // Construct the full message array including enhanced system message
    let messages = [
      {
        role: "system",
        content: enhancedSystemMessage
      },
      ...formattedHistory.slice(-10), // Keep last 10 messages for context
      {
        role: "user",
        content: message
      }
    ];
    
    const client = getOpenAIClient();

    // First call to OpenAI with tools enabled
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: messages as any,
      tools: chatToolsDefinition as any,
      tool_choice: "auto", 
      max_tokens: 800,
      temperature: 0.7
    });
    
    const responseMessage = completion.choices[0].message;
    let reply = responseMessage.content;

    // Check if the model wants to call a tool
    if (responseMessage.tool_calls) {
      // Add the assistant's "thought" (tool call request) to the history
      messages.push(responseMessage as any);

      // Execute each tool call
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${functionName}`);
        
        let functionResult = "";
        
        // Route to the correct implementation
        if (functionName in chatToolsImplementation) {
          // @ts-ignore
          functionResult = await chatToolsImplementation[functionName](functionArgs);
        } else {
          functionResult = JSON.stringify({ error: "Tool not found" });
        }

        // Add the tool result to the history
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          // @ts-ignore
          name: functionName,
          content: functionResult
        });
      }

      // Second call to OpenAI with the tool results
      const secondResponse = await client.chat.completions.create({
        model: MODEL,
        messages: messages as any,
        tools: chatToolsDefinition as any,
        tool_choice: "auto", 
      });

      reply = secondResponse.choices[0].message.content;
    }
    
    return res.json({
      success: true,
      reply
    });

  } catch (error) {
    console.error("Error in chat assistant:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        details: error.errors
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    });
  }
});

export default router;