import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import OpenAI from "openai";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
// pdf-parse v2 exports PDFParse class
const PDFParse = pdfParseModule.PDFParse;

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
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeFile {
  version: string;
  lastUpdated: string;
  entries: KnowledgeEntry[];
}

/**
 * Split text into intelligent chunks by sentences
 * Works well for continuous text from PDFs
 */
function intelligentChunk(text: string, targetSize: number = 1500, maxSize: number = 2500): string[] {
  const chunks: string[] = [];
  
  // Split by sentences (handles ., !, ? followed by space or newline)
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    // If this single sentence is too long, split it by commas or just force split
    if (trimmedSentence.length > maxSize) {
      // Save current chunk first
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      // Force split long sentence
      const parts = trimmedSentence.match(new RegExp(`.{1,${maxSize}}`, 'g')) || [trimmedSentence];
      chunks.push(...parts.map(p => p.trim()).filter(p => p.length > 50));
      continue;
    }
    
    // If adding this sentence would exceed maxSize, save current chunk
    if (currentChunk.length + trimmedSentence.length + 1 > maxSize && currentChunk.length >= targetSize / 2) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    }
    
    // If current chunk reached target size, consider it complete
    if (currentChunk.length >= targetSize) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim() && currentChunk.trim().length > 100) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 100); // Filter out tiny chunks
}

/**
 * Extract keywords from text using simple frequency analysis
 */
function extractKeywords(text: string, bookTitle: string): string[] {
  const commonWords = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me"
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.has(w));
  
  // Count frequencies
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  // Get top keywords
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  
  // Always include book title words
  const titleWords = bookTitle.toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  return [...new Set([...titleWords, ...sorted, "john mcafee", "book"])];
}

/**
 * Generate embeddings for text chunks
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000) // API limit
  });
  return response.data[0].embedding;
}

/**
 * Process a single PDF and return knowledge entries
 */
async function processPDF(pdfPath: string, metadata: {
  title: string;
  author?: string;
  date?: string;
  category?: string;
}): Promise<KnowledgeEntry[]> {
  console.log(`\n📖 Processing: ${metadata.title}`);
  console.log(`   File: ${pdfPath}`);
  
  // Read and parse PDF using pdf-parse v2 API
  const dataBuffer = readFileSync(pdfPath);
  const pdf = new PDFParse({ data: dataBuffer });
  await pdf.load();
  const pdfData = await pdf.getText();
  
  // Join all page texts together
  const fullText = pdfData.pages.map((page: { text: string; num: number }) => page.text).join("\n\n");
  
  console.log(`   Pages: ${pdfData.pages.length}`);
  console.log(`   Text length: ${fullText.length} characters`);
  
  // Clean up text - preserve sentence structure for better chunking
  const cleanedText = fullText
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, " ")     // Replace multiple newlines with space
    .replace(/\n/g, " ")         // Replace single newlines with space
    .replace(/\s{2,}/g, " ")     // Collapse multiple spaces into one
    .replace(/\s+([.!?,;:])/g, "$1")  // Remove space before punctuation
    .trim();
  
  // Split into chunks
  console.log(`   Chunking text...`);
  const chunks = intelligentChunk(cleanedText);
  console.log(`   Created ${chunks.length} chunks`);
  
  // Generate entries with embeddings
  const entries: KnowledgeEntry[] = [];
  const batchSize = 20; // Process in batches to avoid rate limits
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkNum = i + 1;
    
    process.stdout.write(`\r   Generating embeddings: ${chunkNum}/${chunks.length}`);
    
    // Generate embedding
    const embedding = await generateEmbedding(chunk);
    
    // Extract keywords from this chunk
    const keywords = extractKeywords(chunk, metadata.title);
    
    // Determine context
    let context = `Part ${chunkNum} of ${chunks.length} from the book "${metadata.title}" by John McAfee`;
    
    // Try to identify if this is a chapter or specific section
    const chapterMatch = chunk.match(/^(Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+)[:\s]([^\n]+)/i);
    if (chapterMatch) {
      context = `${chapterMatch[1]}: ${chapterMatch[2]} from "${metadata.title}"`;
    }
    
    const entry: KnowledgeEntry = {
      id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: metadata.category || "books",
      content: chunk,
      date: metadata.date,
      source: metadata.title,
      sourceType: "book",
      keywords,
      context,
      embedding,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    entries.push(entry);
    
    // Small delay to avoid rate limits
    if (chunkNum % batchSize === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n   ✅ Created ${entries.length} knowledge base entries`);
  return entries;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📚 PDF to Knowledge Base Processor

Usage:
  npm run process-pdf -- <pdf-path> <book-title> [date]
  
Or place PDFs in server/src/data/pdfs/ and run:
  npm run process-pdf -- --batch

Examples:
  npm run process-pdf -- ./book.pdf "Beyond The Siddhis" "2019-01-01"
  npm run process-pdf -- --batch

The script will:
1. Extract text from PDF
2. Split into intelligent chunks (chapters/sections)
3. Generate embeddings for each chunk
4. Add to knowledge base (blogs.json)
    `);
    process.exit(0);
  }
  
  // Batch mode: process all PDFs in pdfs directory
  if (args[0] === "--batch") {
    const pdfsDir = join(process.cwd(), "server/src/data/pdfs");
    
    if (!existsSync(pdfsDir)) {
      console.error(`❌ Directory not found: ${pdfsDir}`);
      console.log(`\nCreate the directory and add PDF files:`);
      console.log(`  mkdir -p server/src/data/pdfs`);
      process.exit(1);
    }
    
    const pdfFiles = readdirSync(pdfsDir).filter(f => f.endsWith(".pdf"));
    
    if (pdfFiles.length === 0) {
      console.error(`❌ No PDF files found in ${pdfsDir}`);
      process.exit(1);
    }
    
    console.log(`Found ${pdfFiles.length} PDF files to process\n`);
    
    const allEntries: KnowledgeEntry[] = [];
    
    for (const pdfFile of pdfFiles) {
      const pdfPath = join(pdfsDir, pdfFile);
      const title = pdfFile.replace(".pdf", "").replace(/_/g, " ");
      
      try {
        const entries = await processPDF(pdfPath, { title });
        allEntries.push(...entries);
      } catch (error) {
        console.error(`\n❌ Error processing ${pdfFile}:`, error);
      }
    }
    
    // Load existing knowledge base
    const blogsPath = join(process.cwd(), "server/src/data/knowledge/blogs.json");
    let blogsData: KnowledgeFile;
    
    if (existsSync(blogsPath)) {
      blogsData = JSON.parse(readFileSync(blogsPath, "utf-8"));
    } else {
      blogsData = {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        entries: []
      };
    }
    
    // Add new entries
    blogsData.entries.push(...allEntries);
    blogsData.lastUpdated = new Date().toISOString();
    
    // Save
    writeFileSync(blogsPath, JSON.stringify(blogsData, null, 2));
    
    console.log(`\n✅ Added ${allEntries.length} entries to ${blogsPath}`);
    console.log(`   Total entries in knowledge base: ${blogsData.entries.length}`);
    
  } else {
    // Single file mode
    const [pdfPath, title, date] = args;
    
    if (!existsSync(pdfPath)) {
      console.error(`❌ File not found: ${pdfPath}`);
      process.exit(1);
    }
    
    if (!title) {
      console.error(`❌ Book title required`);
      process.exit(1);
    }
    
    const entries = await processPDF(pdfPath, { title, date });
    
    // Load existing knowledge base
    const blogsPath = join(process.cwd(), "server/src/data/knowledge/blogs.json");
    let blogsData: KnowledgeFile;
    
    if (existsSync(blogsPath)) {
      blogsData = JSON.parse(readFileSync(blogsPath, "utf-8"));
    } else {
      blogsData = {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        entries: []
      };
    }
    
    // Add new entries
    blogsData.entries.push(...entries);
    blogsData.lastUpdated = new Date().toISOString();
    
    // Save
    writeFileSync(blogsPath, JSON.stringify(blogsData, null, 2));
    
    console.log(`\n✅ Added ${entries.length} entries to ${blogsPath}`);
    console.log(`   Total entries in knowledge base: ${blogsData.entries.length}`);
  }
  
  console.log(`\n🔄 Restart the server to load new entries!`);
}

main().catch(console.error);

