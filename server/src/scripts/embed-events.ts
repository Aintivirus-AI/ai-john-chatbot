import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
});

interface KnowledgeEntry {
  id: string;
  category: string;
  content: string;
  date?: string;
  source: string;
  sourceType: string;
  keywords: string[];
  context?: string;
  embedding?: number[];
}

interface KnowledgeFile {
  version: string;
  lastUpdated: string;
  entries: KnowledgeEntry[];
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000)
  });
  return response.data[0].embedding;
}

async function main() {
  const eventsPath = join(process.cwd(), "server/src/data/knowledge/events.json");
  
  console.log("Loading events.json...");
  const eventsData: KnowledgeFile = JSON.parse(readFileSync(eventsPath, "utf-8"));
  
  console.log(`Found ${eventsData.entries.length} entries to embed`);
  
  for (let i = 0; i < eventsData.entries.length; i++) {
    const entry = eventsData.entries[i];
    
    if (entry.embedding && entry.embedding.length > 0) {
      console.log(`  Skipping ${entry.id} (already has embedding)`);
      continue;
    }
    
    process.stdout.write(`  Embedding ${i + 1}/${eventsData.entries.length}: ${entry.id}...`);
    
    // Combine content with keywords for better semantic matching
    const textToEmbed = `${entry.content} Keywords: ${entry.keywords.join(", ")}`;
    entry.embedding = await generateEmbedding(textToEmbed);
    
    console.log(" done");
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  eventsData.lastUpdated = new Date().toISOString();
  writeFileSync(eventsPath, JSON.stringify(eventsData, null, 2));
  
  console.log(`\n✅ Saved embeddings to ${eventsPath}`);
}

main().catch(console.error);

