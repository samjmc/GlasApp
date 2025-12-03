
import 'dotenv/config';
import { supabaseDb } from '../db';
import { getOpenAIClient } from '../services/openaiService';

/**
 * Review Negative Feedback Job (Self-Correction System)
 * 
 * Analyzes why users downvoted responses.
 * If the AI detects a hallucination or contradiction, it flags the 
 * corresponding policy position for review.
 */
async function reviewNegativeFeedback() {
  if (!supabaseDb) {
    console.error('❌ Supabase client not available');
    process.exit(1);
  }

  console.log('\n🕵️ Starting Feedback Review Job...');

  // 1. Get unprocessed negative feedback
  const { data: feedbackItems, error } = await supabaseDb
    .from('chat_feedback')
    .select('*')
    .eq('rating', 'negative')
    .eq('processed_for_review', false)
    .limit(10);

  if (error) {
    console.error('Error fetching feedback:', error);
    process.exit(1);
  }

  if (!feedbackItems || feedbackItems.length === 0) {
    console.log('✅ No new negative feedback to review.');
    process.exit(0);
  }

  console.log(`Processing ${feedbackItems.length} negative feedback items...`);

  for (const item of feedbackItems) {
    console.log(`\nAnalyzing feedback ID: ${item.id} for ${item.politician_name}`);
    await analyzeFeedbackItem(item);
  }

  console.log('\n✅ Feedback review complete.');
}

async function analyzeFeedbackItem(item: any) {
  try {
    // 2. Ask GPT-4 to diagnose the error
    const diagnosisPrompt = `
      You are a QA system for a politician AI clone.
      The user DOWNVOTED the following response.

      Politician: ${item.politician_name}
      User Question: "${item.user_question}"
      AI Response: "${item.ai_response}"
      User Feedback: "${item.feedback_text || '(No text provided)'}"

      Task:
      Analyze if the AI response was likely a hallucination, factually incorrect, or just a tone issue.
      If it was a factual error about a policy position, identify the TOPIC.

      Return JSON:
      {
        "error_type": "hallucination" | "tone" | "missing_data" | "user_error" | "unknown",
        "topic": "Housing" | "Health" | null,
        "reasoning": "The AI claimed X but..."
      }
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: diagnosisPrompt }],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });

    const diagnosis = JSON.parse(response.choices[0].message.content || '{}');
    console.log(`   diagnosis: ${diagnosis.error_type} - ${diagnosis.reasoning}`);

    // 3. Take Action (Self-Correction)
    if (diagnosis.error_type === 'hallucination' && diagnosis.topic) {
      // Flag the policy position for that topic
      console.log(`   ⚠️ Flagging "${diagnosis.topic}" position for review...`);
      
      const { error: updateError } = await supabaseDb!
        .from('policy_positions')
        .update({
          flagged_for_review: true,
          review_reason: `User reported error: ${diagnosis.reasoning}`,
          confidence_score: 0.5, // Downgrade confidence
          last_reviewed_at: new Date().toISOString()
        })
        .eq('politician_id', (await getPoliticianId(item.politician_name)))
        .eq('topic', diagnosis.topic);

      if (updateError) {
        console.error('   ❌ Failed to flag position:', updateError.message);
      } else {
        console.log('   ✅ Position flagged for human review.');
      }
    }

    // 4. Mark feedback as processed
    await supabaseDb!
      .from('chat_feedback')
      .update({ processed_for_review: true })
      .eq('id', item.id);

  } catch (err) {
    console.error(`   ❌ Error analyzing item ${item.id}:`, err);
  }
}

async function getPoliticianId(name: string) {
  const { data } = await supabaseDb!
    .from('td_scores')
    .select('id')
    .eq('politician_name', name)
    .single();
  return data?.id;
}

// Execute
reviewNegativeFeedback().catch(console.error);




