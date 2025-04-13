# SEO Check MCP

Retrieves requires information, so that LLMs can consume it and perform a SEO analysis.

## Use

### 1. Clone this repo
```
git clone git@github.com:muningis/seo-check-mcp.git
```

### 2. Install deps
```sh
bun install
# 
npm install
# or
pnpm install
# or
yarn install
```

### 2. Link it in your used client, e.g. Claude Desktop:
```json
{
  "SEO Analysis": {
    "command": "npx",
    "args": [
      "tsx",
      "path/to/seo-check-mcp/server.mts"
    ]
  }
}
```

### 3. Perform a query, e.g. `Get sitemap of https://example.org and perform seo analysis`