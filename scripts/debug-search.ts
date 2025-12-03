
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function debugSearch() {
    const query = "Housing rent homelessness eviction";
    const politician = "Darragh"; // Simplify to avoid quote issues
    
    console.log(`Searching for '${politician}' on '${query}'...`);
    
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });
    const embedding = embeddingResponse.data[0].embedding;
    
    const { data: chunks, error } = await supabase.rpc('match_debate_chunks', {
        query_embedding: embedding,
        match_politician: politician,
        match_threshold: 0.0, // Show EVERYTHING to check if anything exists
        match_count: 5
    });
    
    if (error) {
        console.error(error);
    } else {
        console.log("Found chunks:", chunks?.length);
        if (chunks) {
            chunks.forEach((c: any) => {
                console.log(`- [${c.similarity.toFixed(3)}] ${c.chunk_content.substring(0, 100)}...`);
            });
        }
    }
}

debugSearch();

