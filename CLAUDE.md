# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SEO Check MCP is a **long-running** Model Context Protocol (MCP) server that provides tools for LLMs to perform comprehensive SEO analysis. It uses headless Chrome via Selenium and runs as an HTTP server that stays alive between requests.

## Development Commands

```bash
# Start HTTP server (for programmatic clients)
bun server.mts
# or
bun run start

# Start stdio server (for Claude Desktop)
bun cli.mts
# or
bun run start:stdio

# Health check (HTTP mode only)
curl http://localhost:3000/health

# Install dependencies
bun install

# Set custom port (HTTP mode only)
MCP_PORT=8080 bun server.mts

# Type check
npx tsc --noEmit
```

## Server Modes

### 1. Stdio Mode (for Claude Desktop)
Claude Desktop spawns the MCP server as a child process using stdio transport.

**Entry point:** `cli.mts`

### 2. HTTP Mode (for programmatic clients)
Long-running HTTP server with Streamable HTTP transport.

**Entry point:** `server.mts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check, returns `{ status: 'ok' }` |
| `/mcp` | POST/GET/DELETE | MCP Streamable HTTP transport endpoint |

## Claude Desktop Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seo-analysis": {
      "command": "bun",
      "args": ["cli.mts"],
      "cwd": "/path/to/seo-check-mcp"
    }
  }
}
```

Replace `/path/to/seo-check-mcp` with the actual path to this project.

## Available Tools (22 total)

### Core Tools
| Tool | Description |
|------|-------------|
| `read-sitemap` | Fetches and parses XML sitemaps |
| `read-robots-txt` | Fetches robots.txt content |
| `scan` | Comprehensive page analysis with optional screenshots |
| `scan-lite` | Lightweight page scan (no WebDriver) |

### Content Analysis
| Tool | Description |
|------|-------------|
| `analyze-content` | Keyword density, readability scores, content suggestions |
| `check-readability` | Flesch-Kincaid, Gunning Fog, SMOG analysis |

### Technical SEO
| Tool | Description |
|------|-------------|
| `validate-schema` | JSON-LD/Schema.org validation with suggestions |
| `analyze-sitemap` | Deep sitemap analysis (freshness, priorities) |
| `check-internal-links` | Internal linking structure analysis |
| `find-broken-links` | Broken link detection with status codes |

### On-Page Optimization
| Tool | Description |
|------|-------------|
| `analyze-meta` | Meta tag analysis with SERP preview |
| `analyze-headings` | H1-H6 structure validation |
| `analyze-images` | Image SEO with alt text suggestions |
| `analyze-url` | URL structure and canonical analysis |

### Competitive Analysis
| Tool | Description |
|------|-------------|
| `compare-pages` | Side-by-side SEO comparison |
| `benchmark-seo` | Overall SEO score with grades |

### Fix Tools (Actionable Instructions for Claude Code)
| Tool | Description |
|------|-------------|
| `fix-meta` | Returns actionable instructions for meta tag fixes |
| `fix-images` | Returns actionable instructions for image SEO fixes |
| `fix-headings` | Returns actionable instructions for heading structure fixes |
| `fix-schema` | Returns JSON-LD schema templates ready to add |
| `generate-seo-tasks` | Generates prioritized SEO task list with recommended tools |
| `improve-content` | Analyzes local markdown files for SEO, readability, and structure improvements |

## Architecture

### Project Structure
```
server.mts              # HTTP server bootstrap (for programmatic clients)
cli.mts                 # Stdio server entry point (for Claude Desktop)
browser/
├── driver.ts           # Headless Chrome WebDriver
├── load-page.ts        # Page loading, Core Web Vitals, screenshots
└── mod.ts              # Barrel export
lib/
├── analysis/           # Text analysis & scoring algorithms
│   ├── text.ts         # Readability, keyword extraction
│   ├── scoring.ts      # SEO scoring formulas
│   ├── content-analyzer.ts  # Markdown content analysis
│   └── mod.ts
├── cache/              # Resource caching
│   ├── resource-cache.ts
│   └── mod.ts
├── config/             # Constants & configuration
│   ├── constants.ts
│   └── mod.ts
├── extraction/         # Page parsing helpers
│   ├── meta.ts         # Meta tag extraction
│   ├── images.ts       # Image extraction
│   ├── links.ts        # Link extraction
│   ├── content.ts      # Headings, word count, LD-JSON
│   ├── headers.ts      # Security headers
│   ├── validation.ts   # Missing field markers
│   └── mod.ts
├── page/               # Page retrieval orchestration
│   ├── retrieve-page.ts
│   └── mod.ts
├── suggestions/        # SEO improvement suggestions
│   ├── meta.ts         # Title/description suggestions
│   ├── images.ts       # Alt text suggestions
│   ├── headings.ts     # Heading structure suggestions
│   ├── url.ts          # URL structure suggestions
│   └── mod.ts
├── tools/              # MCP tool implementations (22 tools)
│   ├── read-sitemap.ts
│   ├── read-robots-txt.ts
│   ├── scan.ts
│   ├── scan-lite.ts
│   ├── analyze-content.ts
│   ├── check-readability.ts
│   ├── validate-schema.ts
│   ├── analyze-sitemap.ts
│   ├── check-internal-links.ts
│   ├── find-broken-links.ts
│   ├── analyze-meta.ts
│   ├── analyze-headings.ts
│   ├── analyze-images.ts
│   ├── analyze-url.ts
│   ├── compare-pages.ts
│   ├── benchmark-seo.ts
│   ├── fix-meta.ts
│   ├── fix-images.ts
│   ├── fix-headings.ts
│   ├── fix-schema.ts
│   ├── generate-seo-tasks.ts
│   ├── improve-content.ts
│   └── mod.ts
└── types/              # TypeScript interfaces
    ├── validation.ts
    ├── content.ts
    ├── page-info.ts
    ├── instructions.ts
    ├── content-instructions.ts  # Content improvement types
    └── mod.ts
```

### Key Types (`types.d.ts` & `lib/types/`)
- `VitalMetrics`: Navigation timing + Core Web Vitals (LCP, CLS, FCP)
- `PageInfo`: Complete page analysis structure
- `RetrievePageResult`: Page info + screenshots
- `ReadabilityScores`: Flesch, Gunning Fog, SMOG, ARI
- `SEOScore`: Overall score with category breakdowns
- `ActionableInstruction`: Structured fix instruction for Claude Code
- `FixResult`: Fix tool response with instructions array
- `SEOTask`: Prioritized task for generate-seo-tasks
- `SEOTasksResult`: Complete task list with score and quick wins
- `ContentInstruction`: Structured content improvement instruction with line numbers
- `ContentFixResult`: Content analysis result with category scores
- `ContentAnalysisResult`: Raw analysis metrics (readability, SEO, structure)

## Technical Stack

- **Runtime**: Bun (primary), Node.js compatible
- **HTTP Framework**: Hono (~13kb, uses standard Web APIs)
- **Transports**: StdioServerTransport (Claude Desktop), WebStandardStreamableHTTPServerTransport (HTTP clients)
- **Browser Automation**: Selenium WebDriver with headless Chrome
- **Key Dependencies**: `@modelcontextprotocol/sdk@1.25`, `zod@4` (v3 compat), `hono`, `fast-xml-parser`, `node-html-parser`

## Adding New Tools

1. Create tool file in `lib/tools/your-tool.ts`
2. Export registration function: `registerYourTool(server: McpServer)`
3. Import and call in `lib/tools/mod.ts`
4. Add to `registerAllTools()` function
