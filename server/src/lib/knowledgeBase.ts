import { readFileSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { config } from "../config.js";
import { logger } from "../logger.js";

// Resolve the data directory from the project root
function getDataDir(): string {
  return join(process.cwd(), "server", "src", "data", "knowledge");
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  content: string;
  date?: string;
  source: string;
  sourceType: string;
  keywords: string[];
  context?: string;
  embedding: number[];
}

interface KnowledgeFile {
  version: string;
  lastUpdated: string;
  entries: KnowledgeEntry[];
}

interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
}

let knowledgeEntries: KnowledgeEntry[] = [];
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openAiApiKey,
      organization: config.openAiOrgId
    });
  }
  return openaiClient;
}

/**
 * Load all knowledge base JSON files
 */
export function loadKnowledgeBase(): void {
  const dataDir = getDataDir();
  // Load all knowledge files - events has biographical data, blogs has books/archive content, websites has scraped site data
  const files = ["events.json", "blogs.json", "websites.json"];

  knowledgeEntries = [];

  for (const file of files) {
    try {
      const filePath = join(dataDir, file);
      const data = readFileSync(filePath, "utf-8");
      const parsed: KnowledgeFile = JSON.parse(data);

      if (parsed.entries && Array.isArray(parsed.entries)) {
        // Filter entries that have valid embeddings
        const validEntries = parsed.entries.filter(
          (entry) => entry.embedding && Array.isArray(entry.embedding) && entry.embedding.length > 0
        );
        knowledgeEntries.push(...validEntries);
        logger.info({ file, entryCount: validEntries.length }, "Loaded knowledge base file");
      }
    } catch (error) {
      logger.error({ error, file }, "Failed to load knowledge base file");
    }
  }

  logger.info({ totalEntries: knowledgeEntries.length }, "Knowledge base loaded");
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Get embedding for a query using OpenAI
 */
async function getQueryEmbedding(query: string): Promise<number[]> {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: query.slice(0, 8000) // Limit input length
  });

  return response.data[0].embedding;
}

/**
 * Search knowledge base using semantic similarity
 */
export async function searchKnowledgeBase(
  query: string,
  options?: {
    topK?: number;
    minScore?: number;
  }
): Promise<SearchResult[]> {
  const topK = options?.topK ?? 5;
  const minScore = options?.minScore ?? 0.3;

  if (knowledgeEntries.length === 0) {
    loadKnowledgeBase();
  }

  if (knowledgeEntries.length === 0) {
    logger.warn("Knowledge base is empty");
    return [];
  }

  try {
    const queryEmbedding = await getQueryEmbedding(query);

    // Calculate similarity scores for all entries
    const results: SearchResult[] = knowledgeEntries.map((entry) => ({
      entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding)
    }));

    // Sort by score descending and filter by minimum score
    return results
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (error) {
    logger.error({ error }, "Failed to search knowledge base");
    return [];
  }
}

/**
 * Format search results as context for the persona prompt
 */
export function formatKnowledgeContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "";
  }

  // Format as simple context, no headers, no meta-instructions
  const entries = results.map((r) => {
    const entry = r.entry;
    let text = entry.content;
    
    // Add temporal context naturally
    if (entry.date) {
      text += ` (${entry.date})`;
    }
    
    // Add situational context if available
    if (entry.context) {
      text += ` — ${entry.context}`;
    }
    
    return text;
  });

  // Just return the facts, clean and simple
  return entries.join("\n\n");
}

/**
 * Initialize the knowledge base on module load
 */
loadKnowledgeBase();

