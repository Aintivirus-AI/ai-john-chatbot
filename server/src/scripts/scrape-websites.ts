import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import puppeteer, { Browser, Page } from "puppeteer";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
});

// Target websites to scrape
const WEBSITES = [
  {
    name: "aintivirus.ai",
    baseUrl: "https://aintivirus.ai",
    pages: [
      { path: "/", section: "homepage" },
    ]
  },
  {
    name: "matrixprivacy.ai",
    baseUrl: "https://www.matrixprivacy.ai",
    pages: [
      { path: "/", section: "homepage" },
    ]
  }
];

interface KnowledgeEntry {
  id: string;
  category: string;
  content: string;
  date?: string;
  source: string;
  sourceType: string;
  keywords: string[];
  context?: string;
  url?: string;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeFile {
  version: string;
  lastUpdated: string;
  entries: KnowledgeEntry[];
}

interface ScrapedSection {
  title: string;
  content: string;
  category: string;
  url: string;
}

/**
 * Split text into intelligent chunks by sentences
 */
function intelligentChunk(text: string, targetSize: number = 1200, maxSize: number = 2000): string[] {
  const chunks: string[] = [];
  
  // Split by sentences (handles ., !, ? followed by space or newline)
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    // If this single sentence is too long, split it
    if (trimmedSentence.length > maxSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      const parts = trimmedSentence.match(new RegExp(`.{1,${maxSize}}`, 'g')) || [trimmedSentence];
      chunks.push(...parts.map(p => p.trim()).filter(p => p.length > 50));
      continue;
    }
    
    if (currentChunk.length + trimmedSentence.length + 1 > maxSize && currentChunk.length >= targetSize / 2) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    }
    
    if (currentChunk.length >= targetSize) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
  }
  
  if (currentChunk.trim() && currentChunk.trim().length > 80) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 80);
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string, siteName: string): string[] {
  const commonWords = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "more", "can", "your", "our", "new", "also", "any", "only", "just",
    "been", "has", "was", "were", "are", "is", "than", "into", "some"
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.has(w));
  
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  
  // Add site-specific keywords
  const siteKeywords = siteName.includes("ainti") 
    ? ["ainti", "aintivirus", "john mcafee", "crypto", "privacy"]
    : ["matrix", "matrixprivacy", "blockchain", "privacy", "cryptocurrency"];
  
  return [...new Set([...siteKeywords, ...sorted])];
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000)
  });
  return response.data[0].embedding;
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/(\*\*|__)/g, "")  // Remove markdown bold
    .replace(/#{1,6}\s*/g, "")  // Remove markdown headers
    .trim();
}

/**
 * Extract structured content from page
 */
async function extractPageContent(page: Page, url: string, siteName: string): Promise<ScrapedSection[]> {
  const sections: ScrapedSection[] = [];
  
  // Wait for content to load
  await page.waitForSelector("body", { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait for JS
  
  // Extract content using page.evaluate
  const pageData = await page.evaluate(() => {
    const result: { sections: Array<{ title: string; content: string; type: string }> } = {
      sections: []
    };
    
    // Get main content sections
    const selectors = [
      "main", "article", ".content", "#content", 
      "[class*='hero']", "[class*='section']", "[class*='container']",
      ".faq", "[class*='faq']", "[class*='roadmap']"
    ];
    
    const processedTexts = new Set<string>();
    
    // Extract hero/intro section
    const heroElements = document.querySelectorAll("h1, h2, [class*='hero'] p, [class*='intro'] p");
    let heroText = "";
    heroElements.forEach(el => {
      const text = el.textContent?.trim() || "";
      if (text && text.length > 10 && !processedTexts.has(text)) {
        heroText += text + " ";
        processedTexts.add(text);
      }
    });
    if (heroText.length > 50) {
      result.sections.push({ title: "Introduction", content: heroText.trim(), type: "project-info" });
    }
    
    // Extract FAQ sections
    const faqItems = document.querySelectorAll("[class*='faq'] details, [class*='accordion'], .faq-item, [class*='question']");
    let faqText = "";
    faqItems.forEach(item => {
      const text = item.textContent?.trim() || "";
      if (text && text.length > 20 && !processedTexts.has(text)) {
        faqText += text + " ";
        processedTexts.add(text);
      }
    });
    if (faqText.length > 100) {
      result.sections.push({ title: "FAQ", content: faqText.trim(), type: "faq" });
    }
    
    // Extract roadmap
    const roadmapItems = document.querySelectorAll("[class*='roadmap'] li, [class*='roadmap'] article, [class*='timeline'] > *");
    let roadmapText = "";
    roadmapItems.forEach(item => {
      const text = item.textContent?.trim() || "";
      if (text && text.length > 15 && !processedTexts.has(text)) {
        roadmapText += text + " | ";
        processedTexts.add(text);
      }
    });
    if (roadmapText.length > 100) {
      result.sections.push({ title: "Roadmap", content: roadmapText.trim(), type: "roadmap" });
    }
    
    // Extract product/feature descriptions
    const featureBlocks = document.querySelectorAll("[class*='feature'], [class*='product'], [class*='service'], [class*='card']");
    let featuresText = "";
    featureBlocks.forEach(block => {
      const text = block.textContent?.trim() || "";
      if (text && text.length > 30 && text.length < 2000 && !processedTexts.has(text)) {
        featuresText += text + " ";
        processedTexts.add(text);
      }
    });
    if (featuresText.length > 100) {
      result.sections.push({ title: "Products & Features", content: featuresText.trim(), type: "products" });
    }
    
    // Get all remaining meaningful text
    const allParagraphs = document.querySelectorAll("p, li, h3, h4");
    let generalText = "";
    allParagraphs.forEach(p => {
      const text = p.textContent?.trim() || "";
      if (text && text.length > 20 && text.length < 1000 && !processedTexts.has(text)) {
        generalText += text + " ";
        processedTexts.add(text);
      }
    });
    if (generalText.length > 200) {
      result.sections.push({ title: "General Information", content: generalText.trim(), type: "project-info" });
    }
    
    return result;
  });
  
  // Process extracted sections
  for (const section of pageData.sections) {
    const cleanedContent = cleanText(section.content);
    if (cleanedContent.length > 100) {
      sections.push({
        title: section.title,
        content: cleanedContent,
        category: section.type,
        url
      });
    }
  }
  
  return sections;
}

/**
 * Scrape a website and return knowledge entries
 */
async function scrapeWebsite(
  browser: Browser, 
  website: { name: string; baseUrl: string; pages: Array<{ path: string; section: string }> }
): Promise<KnowledgeEntry[]> {
  console.log(`\n🌐 Scraping: ${website.name}`);
  
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1920, height: 1080 });
  
  const allSections: ScrapedSection[] = [];
  
  for (const pageInfo of website.pages) {
    const url = `${website.baseUrl}${pageInfo.path}`;
    console.log(`   📄 Loading: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      
      // Scroll to load lazy content
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 500;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const sections = await extractPageContent(page, url, website.name);
      allSections.push(...sections);
      
      console.log(`   ✓ Extracted ${sections.length} sections`);
    } catch (error) {
      console.error(`   ❌ Error loading ${url}:`, error);
    }
  }
  
  await page.close();
  
  // Generate knowledge entries
  const entries: KnowledgeEntry[] = [];
  const timestamp = new Date().toISOString();
  
  for (let i = 0; i < allSections.length; i++) {
    const section = allSections[i];
    
    // Chunk content if too large
    const chunks = intelligentChunk(section.content);
    
    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      
      process.stdout.write(`\r   Generating embeddings: ${i + 1}/${allSections.length} (chunk ${j + 1}/${chunks.length})`);
      
      const embedding = await generateEmbedding(chunk);
      const keywords = extractKeywords(chunk, website.name);
      
      const context = chunks.length > 1
        ? `${section.title} (Part ${j + 1}/${chunks.length}) from ${website.name}`
        : `${section.title} from ${website.name}`;
      
      entries.push({
        id: `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: section.category,
        content: chunk,
        source: website.name,
        sourceType: "website",
        keywords,
        context,
        url: section.url,
        embedding,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      
      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  
  console.log(`\n   ✅ Created ${entries.length} knowledge base entries from ${website.name}`);
  return entries;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  console.log(`
🕷️  Website Scraper for Knowledge Base
=====================================
`);
  
  // Parse arguments
  let targetUrl: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      targetUrl = args[i + 1];
    }
  }
  
  // Filter websites if specific URL provided
  let websitesToScrape = WEBSITES;
  if (targetUrl) {
    websitesToScrape = WEBSITES.filter(w => targetUrl!.includes(w.name) || w.baseUrl === targetUrl);
    if (websitesToScrape.length === 0) {
      // Add custom URL
      websitesToScrape = [{
        name: new URL(targetUrl).hostname,
        baseUrl: targetUrl.replace(/\/$/, ""),
        pages: [{ path: "/", section: "homepage" }]
      }];
    }
  }
  
  console.log(`Websites to scrape: ${websitesToScrape.map(w => w.name).join(", ")}`);
  
  // Launch browser
  console.log("\n🚀 Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  
  const allEntries: KnowledgeEntry[] = [];
  
  try {
    for (const website of websitesToScrape) {
      const entries = await scrapeWebsite(browser, website);
      allEntries.push(...entries);
    }
  } finally {
    await browser.close();
  }
  
  if (allEntries.length === 0) {
    console.log("\n⚠️  No content extracted. Check if the websites are accessible.");
    process.exit(1);
  }
  
  // Save to websites.json
  const websitesPath = join(process.cwd(), "server/src/data/knowledge/websites.json");
  let websitesData: KnowledgeFile;
  
  if (existsSync(websitesPath)) {
    websitesData = JSON.parse(readFileSync(websitesPath, "utf-8"));
    // Remove old entries from the same sources before adding new ones
    const newSources = new Set(allEntries.map(e => e.source));
    websitesData.entries = websitesData.entries.filter(e => !newSources.has(e.source));
  } else {
    websitesData = {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      entries: []
    };
  }
  
  websitesData.entries.push(...allEntries);
  websitesData.lastUpdated = new Date().toISOString();
  
  writeFileSync(websitesPath, JSON.stringify(websitesData, null, 2));
  
  console.log(`
✅ Scraping complete!
   - Total entries: ${allEntries.length}
   - Saved to: ${websitesPath}

🔄 Restart the server to load new entries!
`);
}

main().catch(console.error);

