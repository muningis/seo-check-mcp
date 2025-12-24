/**
 * SEO Analysis MCP Server - Long-running HTTP version
 *
 * Run with: bun server.mts
 * Health check: http://localhost:3000/health
 * MCP endpoint: http://localhost:3000/mcp
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { quitDriver } from './browser/driver';
import { registerAllTools } from './lib/tools/mod';
import { DEFAULT_PORT, SERVER_VERSION, SERVER_NAME } from './lib/config/mod';

// =============================================================================
// Configuration
// =============================================================================

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : DEFAULT_PORT;

// =============================================================================
// MCP Server Setup
// =============================================================================

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

registerAllTools(server);

// =============================================================================
// HTTP Server (Hono + Streamable HTTP Transport)
// =============================================================================

const transport = new WebStandardStreamableHTTPServerTransport();
const app = new Hono();

// CORS configuration
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'mcp-session-id', 'Last-Event-ID', 'mcp-protocol-version'],
  exposeHeaders: ['mcp-session-id', 'mcp-protocol-version']
}));

// Health check endpoint
app.get('/health', c => c.json({
  status: 'ok',
  server: `${SERVER_NAME} MCP`,
  version: SERVER_VERSION
}));

// MCP endpoint - handles all HTTP methods
app.all('/mcp', c => transport.handleRequest(c.req.raw));

// =============================================================================
// Server Startup
// =============================================================================

server.connect(transport).then(() => {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ${SERVER_NAME} MCP Server v${SERVER_VERSION}                              ║
╠══════════════════════════════════════════════════════════════╣
║  Status:  Running                                            ║
║  Port:    ${PORT.toString().padEnd(50)}║
║  MCP:     http://localhost:${PORT}/mcp${' '.repeat(32 - PORT.toString().length)}║
║  Health:  http://localhost:${PORT}/health${' '.repeat(29 - PORT.toString().length)}║
╚══════════════════════════════════════════════════════════════╝
  `);

  serve({ fetch: app.fetch, port: PORT });
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

process.on('SIGINT', async () => {
  console.error('\nShutting down gracefully...');
  try {
    await quitDriver();
    console.error('WebDriver closed.');
  } catch (e) {
    console.error('Error closing WebDriver:', e);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\nReceived SIGTERM, shutting down...');
  try {
    await quitDriver();
  } catch (e) {
    // Ignore
  }
  process.exit(0);
});
