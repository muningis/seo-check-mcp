# SEO Check MCP

A Model Context Protocol (MCP) server that provides comprehensive SEO analysis tools with actionable fix instructions for AI assistants like Claude Code and Claude Desktop.

## Features

- **22 SEO Analysis & Fix Tools**
- **Actionable Instructions** for Claude Code to apply fixes directly
- **Dual Transport Support**: HTTP (Claude Code) and stdio (Claude Desktop)
- **Headless Chrome** via Selenium for screenshots and Core Web Vitals

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime
- Chrome/Chromium browser (for screenshot tools)

### Installation

```bash
git clone git@github.com:muningis/seo-check-mcp.git
cd seo-check-mcp
bun install
```

## Claude Code Integration (HTTP Server)

Claude Code supports HTTP-based MCP servers:

### 1. Start the server

```bash
bun server.mts
```

### 2. Configure Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "seo-analysis": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Or add to your global `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "seo-analysis": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### 3. Use the tools

The 22 SEO tools will be available in Claude Code automatically.

## Claude Desktop Integration (stdio)

Add to your `claude_desktop_config.json`:

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

### Fix Tools (Actionable Instructions)

These tools return structured instructions that Claude Code can execute:

| Tool | Returns |
|------|---------|
| `fix-meta` | Title, description, canonical, Open Graph fixes with HTML snippets |
| `fix-images` | Alt text fixes with suggested values and CSS selectors |
| `fix-headings` | Heading hierarchy fixes with before/after HTML |
| `fix-schema` | JSON-LD schema templates ready to add |
| `generate-seo-tasks` | Prioritized task list with recommended tools |
| `improve-content` | SEO, readability, and structure improvements for local markdown files |

## Example Workflow with Claude Code

### 1. Generate a task list

```
Use the generate-seo-tasks tool on https://example.com
```

### 2. Review prioritized improvements

The tool returns tasks sorted by priority (critical → low) with effort/impact ratings:

```json
{
  "url": "https://example.com",
  "score": 62,
  "tasks": [
    {
      "id": "meta-title-missing",
      "description": "Add missing title tag",
      "tool": "fix-meta",
      "priority": "critical",
      "effort": "low",
      "impact": "high"
    }
  ],
  "quickWins": ["meta-title-missing", "meta-canonical"],
  "summary": "SEO Score: 62/100. 1 critical issue(s) need immediate attention."
}
```

### 3. Apply fixes

```
Run fix-meta on https://example.com to get the HTML changes needed
```

### 4. Example fix-meta output

```json
{
  "url": "https://example.com",
  "instructions": [
    {
      "action": "replace",
      "target": { "type": "html-tag", "selector": "title" },
      "value": {
        "current": "<title>Home</title>",
        "suggested": "<title>Example - Your Brand Name</title>"
      },
      "reason": "Title too short (4 chars). Should be 50-60 chars with keywords.",
      "priority": "critical",
      "automated": true
    },
    {
      "action": "add",
      "target": { "type": "html-tag", "selector": "head", "tagName": "link" },
      "value": {
        "suggested": "<link rel=\"canonical\" href=\"https://example.com\">"
      },
      "reason": "Missing canonical URL causes duplicate content issues.",
      "priority": "high",
      "automated": true
    }
  ],
  "summary": "2 fixes needed: 1 critical, 1 high priority"
}
```

## Development

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

# Set custom port (HTTP mode only)
MCP_PORT=8080 bun server.mts

# Type check
npx tsc --noEmit
```

## Server Endpoints (HTTP Mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check, returns `{ status: 'ok' }` |
| `/mcp` | POST/GET/DELETE | MCP Streamable HTTP transport endpoint |

## Architecture

```
server.mts              # HTTP server (for programmatic clients)
cli.mts                 # Stdio server (for Claude Desktop)
browser/
├── driver.ts           # Headless Chrome WebDriver
├── load-page.ts        # Page loading, Core Web Vitals, screenshots
└── mod.ts
lib/
├── analysis/           # Text analysis & scoring algorithms
├── cache/              # Resource caching
├── config/             # Constants & configuration
├── extraction/         # Page parsing helpers
├── page/               # Page retrieval orchestration
├── suggestions/        # SEO improvement suggestions
├── tools/              # MCP tool implementations (21 tools)
└── types/              # TypeScript interfaces
```

## Adding New Tools

1. Create tool file in `lib/tools/your-tool.ts`
2. Export registration function: `registerYourTool(server: McpServer)`
3. Import and call in `lib/tools/mod.ts`
4. Add to `registerAllTools()` function

## Technical Stack

- **Runtime**: Bun (primary), Node.js compatible
- **HTTP Framework**: Hono
- **Transports**: StdioServerTransport (Claude Desktop), WebStandardStreamableHTTPServerTransport (HTTP clients)
- **Browser Automation**: Selenium WebDriver with headless Chrome
- **Key Dependencies**: `@modelcontextprotocol/sdk`, `zod`, `hono`, `fast-xml-parser`, `node-html-parser`

## License

MIT
