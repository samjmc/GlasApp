import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';
import { insertPoliticalEvolutionSchema } from '@shared/schema';

const router = Router();

// Get all political evolution entries for the current user
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }
    
    const evolutionData = await storage.getPoliticalEvolutionByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: evolutionData || []
    });
  } catch (error) {
    console.error('Get political evolution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve political evolution data'
    });
  }
});

// Get a specific political evolution entry by ID
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const evolutionId = parseInt(req.params.id);
    const userId = req.session.userId;
    
    if (isNaN(evolutionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid evolution ID'
      });
    }
    
    const evolution = await storage.getPoliticalEvolutionById(evolutionId.toString());
    
    if (!evolution) {
      return res.status(404).json({
        success: false,
        message: 'Evolution record not found'
      });
    }
    
    // Ensure the record belongs to the current user
    if (evolution.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this record'
      });
    }
    
    res.status(200).json(evolution);
  } catch (error) {
    console.error('Get political evolution by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve political evolution record'
    });
  }
});

// Create a new political evolution entry
router.post('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    
    // Validate request body
    const validatedData = insertPoliticalEvolutionSchema.parse({
      ...req.body,
      userId
    });
    
    const evolution = await storage.savePoliticalEvolution(validatedData);
    
    res.status(201).json({
      success: true,
      message: 'Political evolution recorded successfully',
      data: evolution
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    console.error('Create political evolution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record political evolution'
    });
  }
});

// Update a political evolution entry
router.patch('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const evolutionId = parseInt(req.params.id);
    const userId = req.session.userId;
    
    if (isNaN(evolutionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid evolution ID'
      });
    }
    
    // Check if the evolution record exists and belongs to the user
    const existingEvolution = await storage.getPoliticalEvolutionById(evolutionId.toString());
    
    if (!existingEvolution) {
      return res.status(404).json({
        success: false,
        message: 'Evolution record not found'
      });
    }
    
    if (existingEvolution.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this record'
      });
    }
    
    // Only allow updating specific fields
    const updateSchema = z.object({
      label: z.string().optional(),
      notes: z.string().optional(),
    });
    
    const validatedData = updateSchema.parse(req.body);
    
    const updatedEvolution = await storage.updatePoliticalEvolution(evolutionId.toString(), validatedData);
    
    res.status(200).json({
      success: true,
      message: 'Political evolution updated successfully',
      data: updatedEvolution
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    console.error('Update political evolution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update political evolution'
    });
  }
});

// Function to create analysis prompt for OpenAI
function createPoliticalEvolutionPrompt(evolutionData: any[]) {
  const dataPoints = evolutionData.map((entry, index) => {
    const date = new Date(entry.createdAt).toLocaleDateString();
    return `
Entry ${index + 1} (${date}):
- Economic: ${entry.economicScore} (Left-Right scale)
- Social: ${entry.socialScore} (Progressive-Traditional scale)
- Cultural: ${entry.culturalScore || 'N/A'} (Change-Tradition scale)
- Globalism: ${entry.globalismScore || 'N/A'} (Nationalist-Globalist scale)
- Environmental: ${entry.environmentalScore || 'N/A'} (Growth-Green scale)
- Authority: ${entry.authorityScore || 'N/A'} (Libertarian-Authoritarian scale)
- Welfare: ${entry.welfareScore || 'N/A'} (Individual-Collective scale)
- Technocratic: ${entry.technocraticScore || 'N/A'} (Populist-Expert scale)
- Notes: ${entry.notes || 'None'}
    `;
  }).join('\n');

  return `
Analyze the following political evolution data for someone who has taken political compass quizzes over time. Each dimension uses a scale from -10 to +10.

${dataPoints}

Please provide a concise analysis in JSON format with the following structure:
{
  "summary": "A brief 1-2 sentence overview of your political journey",
  "keyChanges": ["Array of 2-3 most significant changes you've experienced"],
  "trends": ["Array of 2-3 key patterns in your political evolution"],
  "interpretation": "A concise interpretation of what these changes might reflect (1-2 sentences)"
}

Focus on the most important:
- Significant shifts in your political positions
- Your overall trajectory and consistency
- Notable patterns between dimensions

Address the person directly using "you" and "your". Keep it concise, insightful, and politically neutral.
  `;
}

// Generate AI analysis of political evolution
router.post('/analysis', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { evolutionData } = req.body;
    
    if (!evolutionData || evolutionData.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No evolution data provided for analysis" 
      });
    }

    if (evolutionData.length < 2) {
      return res.json({
        success: true,
        data: {
          summary: "You need at least two quiz attempts to analyze your political evolution over time.",
          keyChanges: [],
          trends: [],
          interpretation: "Take the quiz again in the future to see how your political views evolve!"
        }
      });
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "AI analysis service is currently unavailable"
      });
    }

    // Prepare data for OpenAI analysis
    const analysisPrompt = createPoliticalEvolutionPrompt(evolutionData);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a political scientist analyzing political evolution data. Provide insightful, objective analysis of political beliefs and their changes over time. Focus on patterns, trends, and meaningful interpretations while remaining politically neutral.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const analysis = JSON.parse(aiResponse.choices[0].message.content);

    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("Error generating political evolution analysis:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate analysis. Please try again later." 
    });
  }
});

export default router;