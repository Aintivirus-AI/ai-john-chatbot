# John McAfee Persona Chatbot

This repository hosts a small Node/Express backend that proxies OpenAI's latest Responses API with a John McAfee persona, along with the drop-in web widget located at `web/widget/widget.js`.

## Prerequisites

- **Node.js:** >= 20.11.0 (see `package.json` engines)
- **npm** or **yarn** package manager
- **OpenAI API Key** (required for production)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd aintivirus-ai-john

# Install dependencies
npm install

# Copy environment template (create .env file)
# See Environment Variables section below
```

## Quick Start

### Development

```bash
# Start development server with hot reload
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `PORT` env var).

### Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Environment Variables

Create a `.env` file in the project root (or set environment variables in your deployment platform):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment: `development`, `test`, or `production` |
| `PORT` | No | `3000` | Server port (1-65535) |
| `OPENAI_API_KEY` | **Yes** (production) | - | OpenAI API key for Responses API |
| `OPENAI_MODEL` | No | `gpt-4.1-mini` | OpenAI model identifier |
| `OPENAI_ORG_ID` | No | - | OpenAI organization ID (optional) |
| `ALLOWED_ORIGINS` | No | - | Comma-separated list of allowed CORS origins (e.g., `https://example.com,https://app.example.com`). If not set, all origins are allowed. |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in milliseconds (1 minute) |
| `RATE_LIMIT_MAX` | No | `30` | Maximum requests per window per client |
| `CACHE_TTL_SECONDS` | No | `120` | Cache entry TTL in seconds (minimum 30) |
| `CACHE_MAX_ENTRIES` | No | `200` | Maximum cached responses (minimum 10) |

### Example `.env` file

```env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=30
CACHE_TTL_SECONDS=120
CACHE_MAX_ENTRIES=200
```

> **Security Note:** Never commit `.env` files to version control. The `.gitignore` already excludes them.

## Backend Overview

- **Stack:** Node.js + Express + TypeScript.
- **Endpoints:** `POST /api/chat` for persona conversations, `GET /health` for uptime checks.
- **OpenAI integration:** Uses the Responses API with optional web search; persona prompt lives in `server/src/prompts/persona.ts`.
- **Security:** Helmet.js for security headers, CORS protection, rate limiting, request validation.
- **Logging:** Pino logger with structured JSON logs in production, pretty-printed in development.

### Rate Limiting

The rate-limiting middleware (`server/src/middleware/rateLimit.ts`) guards every `/api/*` route:

| Config (env)              | Default | Description                                                     |
| ------------------------- | ------- | --------------------------------------------------------------- |
| `RATE_LIMIT_WINDOW_MS`    | 60000   | Rolling window size in ms (1 minute).                           |
| `RATE_LIMIT_MAX`          | 30      | Number of requests allowed per bucket within the window.       |

**How it works**

1. **Bucket key:** For each request it looks at `X-API-Key` if supplied, otherwise falls back to the client IP (`req.ip`), finally `"anonymous"` as a last resort.
2. **In-memory store:** Buckets are tracked in a `Map<string, {count, resetAt}>`. When the counter reaches `RATE_LIMIT_MAX`, the request is rejected with HTTP `429`.
3. **Response:** Clients receive JSON `{ error: "...", retryAfterSeconds: <int> }` plus standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`). The widget can surface this message to end-users.
4. **Scope:** Only routes whose path matches `/^\/api\//i` are throttled, so `/health` and other future routes can stay unthrottled.

> **Scaling note:** Because the store is in-memory, limits reset on process restart and are not shared across instances. For multi-node deployments you’d move this state to Redis or a similar distributed store.

### Response Caching

Located in `server/src/lib/cache.ts`, the cache is a simple LRU (`lru-cache`) keyed by the normalized conversation history:

| Config (env)         | Default | Description                             |
| -------------------- | ------- | --------------------------------------- |
| `CACHE_TTL_SECONDS`  | 120     | TTL per entry (converted to milliseconds). |
| `CACHE_MAX_ENTRIES`  | 200     | Maximum number of cached persona responses. |

**Flow**

1. Incoming messages are normalized (lowercased, whitespace collapsed) and hashed (SHA-256) to build a cache key.
2. `cacheMiddleware` (in `server/src/middleware/cache.ts`) runs before `/api/chat`. If there’s a hit, it short-circuits the request and returns the cached response with header `X-Cache: HIT`.
3. On a miss, `/api/chat` proceeds normally. Once OpenAI responds, the result is stored via `setCachedPersonaResponse`.
4. Cache entries include the persona text, citations, and usage metadata; a `fromCache` flag is added when replying so the frontend can surface that information if desired.

Like the rate limiter, this cache is in-memory—perfect for single-instance deployments. Swap `responseCache` with Redis/Memcached if you need cross-instance persistence.

## API Reference

### `POST /api/chat`

Chat endpoint for persona conversations.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "What's your take on Bitcoin?" },
    { "role": "assistant", "content": "Bitcoin is..." }
  ],
  "useSearch": false,           // Optional: force web search
  "temperature": 0.6,           // Optional: 0-2, default 0.6
  "maxOutputTokens": 1024       // Optional: 64-2048, default varies
}
```

**Response (200 OK):**
```json
{
  "text": "Response text from John McAfee persona",
  "model": "gpt-4.1-mini",
  "usage": {
    "inputTokens": 150,
    "outputTokens": 200,
    "totalTokens": 350
  },
  "usedSearch": false,
  "fromCache": false
}
```

**Error Responses:**
- `400 Bad Request`: Invalid payload (e.g., message too long, missing required fields)
- `429 Too Many Requests`: Rate limit exceeded (includes `retryAfterSeconds` and rate limit headers)
- `500 Internal Server Error`: Server error (generic message in production)

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds to wait before retrying (on 429)

**Cache Headers:**
- `X-Cache`: `HIT` if response was served from cache, absent otherwise

### `GET /health`

Health check endpoint for monitoring and load balancers.

**Response (200 OK):**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "hostname": "server-01"
}
```

This endpoint is not rate-limited and always returns 200 when the server is running.

## Security Features

- **Helmet.js:** Security headers (XSS protection, content security policy, etc.)
- **CORS:** Configurable origin whitelist via `ALLOWED_ORIGINS`
- **Rate Limiting:** Per-client/IP rate limiting on API routes
- **Input Validation:** Zod schema validation for all requests
- **Error Handling:** Sanitized error messages in production (no stack traces)
- **Request Size Limits:** 1MB JSON payload limit
- **API Key Protection:** OpenAI API key required in production, never logged

## Production Deployment

> **📖 For detailed Linux server deployment with nginx, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

### Build Process

```bash
# Build TypeScript
npm run build

# Output will be in dist/server/src/
```

### Process Management

Use a process manager like PM2, systemd, or Docker:

**PM2 Example:**
```bash
pm2 start dist/server/src/index.js --name "john-chatbot" --env production
```

**Docker Example:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY server/src/data ./server/src/data
EXPOSE 3000
CMD ["node", "dist/server/src/index.js"]
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure all required environment variables (especially `OPENAI_API_KEY`)
3. Set `ALLOWED_ORIGINS` to your frontend domain(s)
4. Adjust rate limits and cache settings based on expected load

### Monitoring

- **Health Checks:** Use `/health` endpoint for load balancer health checks
- **Logging:** Structured JSON logs via Pino (parse with log aggregation tools)
- **Graceful Shutdown:** Server handles SIGTERM/SIGINT with 10-second timeout
- **Error Tracking:** Unhandled rejections and exceptions are logged

### Scaling Considerations

- **Single Instance:** Current setup works perfectly for single-instance deployments
- **Multi-Instance:** For horizontal scaling, consider:
  - Redis for shared rate limiting state
  - Redis/Memcached for shared cache
  - Load balancer with sticky sessions (if needed)
  - Shared logging aggregation

### Quick Deployment Checklist

```
□ Clone repository to server
□ Run `npm install && npm run build`
□ Create `.env` with production values
□ Set `OPENAI_API_KEY` (required)
□ Set `ALLOWED_ORIGINS` to your domain(s)
□ Start with PM2: `pm2 start dist/server/src/index.js --name chatbot`
□ Configure nginx reverse proxy
□ Setup SSL with Let's Encrypt
□ Verify health check: `curl https://yourdomain.com/health`
□ Test chat endpoint
□ Save PM2 config: `pm2 save`
```

## Development

### Scripts

- `npm run dev`: Start development server with hot reload (tsx)
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Start production server (requires build first)
- `npm run lint`: Run ESLint (warnings allowed, exits 0)
- `npm run process-pdf`: Process PDF files into the knowledge base
- `npm run scrape-websites`: Scrape configured websites for knowledge base

### Project Structure

```
server/src/
├── app.ts              # Express app configuration
├── index.ts            # Server entry point
├── config.ts           # Environment configuration
├── logger.ts           # Pino logger setup
├── data/
│   └── knowledge/      # Knowledge base JSON files
│       ├── events.json     # Biographical events/facts
│       ├── blogs.json      # Book excerpts and blog content
│       └── websites.json   # Scraped website content
├── routes/
│   ├── chat.ts         # Chat API endpoint
│   └── health.ts       # Health check endpoint
├── middleware/
│   ├── cache.ts        # Response caching middleware
│   ├── errorHandler.ts # Error handling
│   ├── notFound.ts     # 404 handler
│   └── rateLimit.ts    # Rate limiting
├── lib/
│   ├── cache.ts        # LRU cache utilities
│   ├── freshness.ts    # Fresh answer detection
│   ├── knowledgeBase.ts # Semantic search over knowledge
│   ├── openai.ts       # OpenAI Responses API client
│   └── search.ts       # Web search integration
├── prompts/
│   └── persona.ts      # John McAfee persona prompt
└── scripts/
    ├── embed-events.ts     # Generate embeddings for events
    ├── process-pdfs.ts     # Extract text from PDFs
    └── scrape-websites.ts  # Scrape websites for content

web/widget/
├── widget.js           # Embeddable chat widget
├── index.html          # Production widget demo page
├── demo.html           # Local development demo page
├── ai-john.jpg         # Launcher avatar image
├── binary-john.jpg     # Chat message avatar
└── README.md           # Widget documentation
```

## Knowledge Base

The chatbot uses a semantic search knowledge base to provide accurate, contextual responses about John McAfee's life, books, and history.

### Knowledge Base Structure

Knowledge is stored in JSON files under `server/src/data/knowledge/`:

| File | Description |
|------|-------------|
| `events.json` | Biographical events, facts, and timeline data |
| `blogs.json` | Book excerpts and blog content |
| `websites.json` | Scraped content from related websites |

Each entry contains:
- `content`: The actual text content
- `embedding`: Vector embedding for semantic search
- `keywords`: Associated keywords
- `source`: Origin of the content
- `context`: Additional context for the AI

### Adding Content

#### Processing PDFs (Books, Documents)

```bash
# Process a single PDF
npm run process-pdf -- ./path/to/book.pdf "Book Title" "2019-01-01"

# Batch process all PDFs in server/src/data/pdfs/
npm run process-pdf -- --batch
```

The script will:
1. Extract text from the PDF
2. Split into intelligent chunks (preserving sentences)
3. Generate embeddings via OpenAI
4. Add entries to `blogs.json`

#### Scraping Websites

```bash
# Scrape configured websites (aintivirus.ai, matrixprivacy.ai)
npm run scrape-websites

# Scrape a specific URL
npm run scrape-websites -- --url https://example.com
```

The script uses Puppeteer to:
1. Load pages with JavaScript rendering
2. Extract structured content (FAQs, features, etc.)
3. Generate embeddings
4. Save to `websites.json`

#### Regenerating Embeddings

If you update `events.json` manually, regenerate embeddings:

```bash
npx tsx server/src/scripts/embed-events.ts
```

### How Semantic Search Works

1. User message is converted to an embedding vector
2. Cosine similarity finds the most relevant knowledge entries
3. Top matches are injected into the persona prompt as context
4. The AI uses this context to provide accurate, detailed responses

> **Note:** After updating knowledge base files, restart the server to load new entries.

## Widget Reference

See `web/widget/README.md` for detailed instructions on hosting and embedding the front-end widget (launcher configuration, styling options, and behavior). That README also covers the available `JohnMcAfeeWidget.mount` options.

